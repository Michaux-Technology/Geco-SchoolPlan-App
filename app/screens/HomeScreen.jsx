import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';

const HomeScreen = () => {
  const [schools, setSchools] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  const loadSchools = async () => {
    try {
      const savedSchools = await AsyncStorage.getItem('schools');
      console.log('Écoles sauvegardées:', savedSchools);
      
      if (savedSchools) {
        const schoolsList = JSON.parse(savedSchools);
        console.log('Liste des écoles parsée:', schoolsList);
        
        // Charger les données complètes de chaque école
        const completeSchools = await Promise.all(
          schoolsList.map(async (school) => {
            const schoolData = await AsyncStorage.getItem(`school_${school.id}`);
            console.log(`Données de l'école ${school.name}:`, {
              rawData: schoolData,
              hasToken: schoolData ? JSON.parse(schoolData).token : false,
              hasRefreshToken: schoolData ? JSON.parse(schoolData).refreshToken : false
            });
            return schoolData ? JSON.parse(schoolData) : school;
          })
        );
        
        console.log('Écoles complètes chargées:', completeSchools.map(school => ({
          name: school.name,
          hasToken: Boolean(school.token),
          hasRefreshToken: Boolean(school.refreshToken)
        })));
        
        setSchools(completeSchools);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des écoles:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadSchools();
    }, [])
  );

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadSchools();
  }, []);

  const handleSchoolPress = async (school) => {
    try {
      console.log('École sélectionnée:', {
        name: school.name,
        apiUrl: school.apiUrl,
        token: school.token ? `${school.token.substring(0, 10)}...` : 'manquant',
        refreshToken: school.refreshToken ? `${school.refreshToken.substring(0, 10)}...` : 'manquant'
      });
      
      await AsyncStorage.setItem('currentSchool', JSON.stringify(school));
      navigation.navigate('ViewType', {
        school: {
          ...school,
          token: school.token,
          refreshToken: school.refreshToken
        },
        userType: school.role,
      });
    } catch (error) {
      console.error('Erreur lors de la sélection de l\'école:', error);
    }
  };

  const handleEditSchool = (school) => {
    navigation.navigate('Settings', { schoolToEdit: school });
  };

  const handleDeleteSchool = (school) => {
    Alert.alert(
      'Supprimer l\'école',
      `Êtes-vous sûr de vouloir supprimer ${school.name} ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedSchools = schools.filter(s => s.id !== school.id);
              await AsyncStorage.setItem('schools', JSON.stringify(updatedSchools));
              setSchools(updatedSchools);
              Alert.alert('Succès', 'École supprimée avec succès');
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'école');
            }
          },
        },
      ]
    );
  };

  const renderSchoolItem = ({ item }) => (
    <View style={styles.schoolItem}>
      <TouchableOpacity 
        style={styles.schoolInfo}
        onPress={() => handleSchoolPress(item)}
      >
        <View style={styles.schoolHeader}>
          <Text style={styles.schoolName}>{item.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{item.role || 'Non défini'}</Text>
          </View>
        </View>
        <Text style={styles.schoolUrl}>{item.apiUrl}</Text>
        <Text style={styles.username}>Utilisateur : {item.username}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={schools}
        renderItem={renderSchoolItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="school" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>Aucune école configurée</Text>
            <Text style={styles.emptySubtext}>Aucune école n'est disponible pour le moment</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
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
  listContent: {
    padding: 16,
  },
  schoolItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
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
  schoolInfo: {
    flex: 1,
    padding: 16,
  },
  schoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  roleBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  roleText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },
  schoolUrl: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
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
});

export default HomeScreen; 