import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Platform, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RoomListScreen = ({ route }) => {
  const { school } = route.params;
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState(new Set());

  const sortRoomsByFavorites = (roomsList, favoritesSet) => {
    return [...roomsList].sort((a, b) => {
      const aIsFav = favoritesSet.has(a._id || a.id);
      const bIsFav = favoritesSet.has(b._id || b.id);
      
      // Si l'un est favori et l'autre non
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      
      // Si les deux sont favoris ou les deux ne sont pas favoris,
      // trier par ordre alphabétique
      const aName = a.nom.toLowerCase();
      const bName = b.nom.toLowerCase();
      return aName.localeCompare(bName);
    });
  };

  const loadFavorites = async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem(`room_favorites_${school.id}`);
      if (storedFavorites) {
        const favoritesSet = new Set(JSON.parse(storedFavorites));
        setFavorites(favoritesSet);
        return favoritesSet;
      }
      return new Set();
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error);
      return new Set();
    }
  };

  const toggleFavorite = async (roomId) => {
    try {
      const newFavorites = new Set(favorites);
      if (newFavorites.has(roomId)) {
        newFavorites.delete(roomId);
      } else {
        newFavorites.add(roomId);
      }

      setFavorites(newFavorites);
      await AsyncStorage.setItem(
        `room_favorites_${school.id}`,
        JSON.stringify(Array.from(newFavorites))
      );

      const updatedRooms = [...rooms];
      const sortedRooms = sortRoomsByFavorites(updatedRooms, newFavorites);
      setRooms(sortedRooms);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des favoris:', error);
    }
  };

  const loadRooms = async (currentFavorites) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!school?.token) {
        throw new Error('Token d\'authentification manquant. Veuillez vous reconnecter.');
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const apiUrl = `${baseUrl}/api/mobile/salle`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${school.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new Error('Session expirée ou token invalide. Veuillez vous reconnecter.');
        }
        throw new Error(`Erreur ${response.status}: ${errorText || 'Erreur lors de la récupération des salles'}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Format de données invalide');
      }

      const favsToUse = currentFavorites || favorites;
      const sortedRooms = sortRoomsByFavorites(data, favsToUse);
      setRooms(sortedRooms);
    } catch (err) {
      console.error('Erreur détaillée:', err);
      setError(err.message || 'Une erreur est survenue lors de la récupération des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const loadedFavorites = await loadFavorites();
      await loadRooms(loadedFavorites);
    };
    initialize();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    const currentFavs = await loadFavorites();
    await loadRooms(currentFavs);
  }, []);

  const renderRoomItem = ({ item }) => {
    const isFavorite = favorites.has(item._id || item.id);
    
    return (
      <View style={styles.roomItem}>
        <View style={styles.roomInfo}>
          <View style={styles.roomHeader}>
            <Text style={styles.roomName}>{item.nom}</Text>
            <TouchableOpacity
              onPress={() => toggleFavorite(item._id || item.id)}
              style={styles.favoriteButton}
            >
              <MaterialIcons
                name={isFavorite ? "star" : "star-border"}
                size={24}
                color={isFavorite ? "#FFD700" : "#666666"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.roomDetails}>
            {item.type && (
              <Text style={styles.roomType}>Type : {item.type}</Text>
            )}
            {item.capacite && (
              <Text style={styles.roomCapacity}>Capacité : {item.capacite} places</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des salles...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color="#F44336" />
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>Tirez vers le bas pour réessayer</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        renderItem={renderRoomItem}
        keyExtractor={(item) => item._id || item.id || item.nom}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="meeting-room" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>Aucune salle trouvée</Text>
            <Text style={styles.emptySubtext}>Tirez vers le bas pour actualiser</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  listContent: {
    padding: 16,
  },
  roomItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  roomInfo: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  roomDetails: {
    marginTop: 4,
  },
  roomType: {
    fontSize: 14,
    color: '#666666',
  },
  roomCapacity: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  favoriteButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default RoomListScreen; 