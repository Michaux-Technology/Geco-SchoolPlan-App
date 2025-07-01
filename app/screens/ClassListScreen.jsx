import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Platform, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../../utils/apiService';
import useNetworkStatus from '../../hooks/useNetworkStatus';

const ClassListScreen = ({ route }) => {
  const { school } = route.params;
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const navigation = useNavigation();
  
  // Variables pour la gestion offline
  const { isOnline } = useNetworkStatus();
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const sortClassesByFavorites = (classesList, favoritesSet) => {
    return [...classesList].sort((a, b) => {
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
      const storedFavorites = await AsyncStorage.getItem(`class_favorites_${school.id}`);
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

  const toggleFavorite = async (classId) => {
    try {
      const newFavorites = new Set(favorites);
      if (newFavorites.has(classId)) {
        newFavorites.delete(classId);
      } else {
        newFavorites.add(classId);
      }

      setFavorites(newFavorites);
      await AsyncStorage.setItem(
        `class_favorites_${school.id}`,
        JSON.stringify(Array.from(newFavorites))
      );

      const updatedClasses = [...classes];
      const sortedClasses = sortClassesByFavorites(updatedClasses, newFavorites);
      setClasses(sortedClasses);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des favoris:', error);
    }
  };

  const loadClasses = async (currentFavorites) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!school?.token) {
        throw new Error('Token d\'authentification manquant. Veuillez vous reconnecter.');
      }

      // Utiliser le service API centralisé
      const result = await ApiService.makeRequest(school, '/api/mobile/classe');
      
      if (result.fromCache) {
        setIsOfflineMode(true);
        console.log('📱 Mode hors ligne - Données récupérées depuis le cache');
      } else {
        setIsOfflineMode(false);
        console.log('🌐 Mode en ligne - Données récupérées depuis le serveur');
      }
      
      if (!result.success) {
        if (result.error === 'Aucune donnée disponible en mode hors ligne') {
          throw new Error('Aucune donnée en cache. Veuillez vous connecter à internet pour charger les données.');
        }
        throw new Error(result.error || 'Erreur lors du chargement des classes');
      }
      
      const data = result.data;
      
      if (!Array.isArray(data)) {
        throw new Error('Format de données invalide');
      }

      const favsToUse = currentFavorites || favorites;
      const sortedClasses = sortClassesByFavorites(data, favsToUse);
      setClasses(sortedClasses);
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
      await loadClasses(loadedFavorites);
    };
    initialize();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    const currentFavs = await loadFavorites();
    await loadClasses(currentFavs);
  }, []);

  const renderClassItem = ({ item }) => {
    const isFavorite = favorites.has(item._id || item.id);
    
    return (
      <TouchableOpacity 
        style={styles.classItem}
        onPress={() => {
          console.log('🎯 Clic sur la classe:', item.nom);
          console.log('🎯 Paramètres de navigation:', {
            school: school,
            classe: item
          });
          try {
            navigation.navigate('ClassPlanning', {
              school: school,
              classe: item
            });
            console.log('✅ Navigation réussie vers ClassPlanning');
          } catch (error) {
            console.error('❌ Erreur lors de la navigation:', error);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.classInfo}>
          <View style={styles.classHeader}>
            <Text style={styles.className}>{item.nom}</Text>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation(); // Empêcher la navigation
                console.log('⭐ Toggle favori pour:', item.nom);
                toggleFavorite(item._id || item.id);
              }}
              style={styles.favoriteButton}
            >
              <MaterialIcons
                name={isFavorite ? "star" : "star-border"}
                size={24}
                color={isFavorite ? "#FFD700" : "#666666"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des classes...</Text>
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
      {/* Indicateur offline */}
      {isOfflineMode && (
        <View style={styles.offlineIndicator}>
          <MaterialIcons name="wifi-off" size={16} color="#FF6B6B" />
          <Text style={styles.offlineText}>Mode hors ligne - Données en cache</Text>
        </View>
      )}
      
      <FlatList
        data={classes}
        renderItem={renderClassItem}
        keyExtractor={(item) => item._id || item.id || item.nom}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="class" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>Aucune classe trouvée</Text>
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
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFCC02',
  },
  offlineText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 4,
    fontWeight: '600',
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
  classItem: {
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
  classInfo: {
    flex: 1,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
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

export default ClassListScreen; 