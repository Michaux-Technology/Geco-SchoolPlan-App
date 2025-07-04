import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const SetupScreen = () => {
  const { t } = useTranslation();
  const [schools, setSchools] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  const loadSchools = async () => {
    try {
      const savedSchools = await AsyncStorage.getItem('schools');
      if (savedSchools) {
        setSchools(JSON.parse(savedSchools));
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

  const handleEditSchool = (school) => {
    navigation.navigate('Settings', { schoolToEdit: school });
  };

  const handleDeleteSchool = (school) => {
    Alert.alert(
      t('common.delete'),
      `${t('common.confirm')} ${school.name} ?`,
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedSchools = schools.filter(s => s.id !== school.id);
              await AsyncStorage.setItem('schools', JSON.stringify(updatedSchools));
              setSchools(updatedSchools);
              Alert.alert(t('common.success'), t('messages.courseDeleted'));
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert(t('common.error'), t('errors.unknownError'));
            }
          },
        },
      ]
    );
  };

  const renderSchoolItem = ({ item }) => (
    <View style={styles.schoolItem}>
      <View style={styles.schoolInfo}>
        <View style={styles.schoolHeader}>
          <Text style={styles.schoolName}>{item.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{item.role || t('common.undefined')}</Text>
          </View>
        </View>
        <Text style={styles.schoolUrl}>{item.apiUrl}</Text>
        <Text style={styles.username}>{t('auth.username')} : {item.username}</Text>
      </View>
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.iconButton, styles.editButton]}
          onPress={() => handleEditSchool(item)}
        >
          <MaterialIcons name="edit" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.iconButton, styles.deleteButton]}
          onPress={() => handleDeleteSchool(item)}
        >
          <MaterialIcons name="delete" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
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
            <Text style={styles.emptyText}>{t('setup.noSchools')}</Text>
            <Text style={styles.emptySubtext}>{t('setup.addSchoolHint')}</Text>
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
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <MaterialIcons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.addButtonText}>{t('setup.addSchool')}</Text>
      </TouchableOpacity>

      {/* Section des paramètres et confidentialité */}
      <View style={styles.settingsSection}>
        {/* Lien vers la politique de confidentialité */}
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          <MaterialIcons name="privacy-tip" size={20} color="#1976D2" />
          <Text style={styles.settingsButtonText}>{t('gdpr.privacyPolicy')}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#666666" />
        </TouchableOpacity>

        {/* Bouton pour réinitialiser le consentement GDPR (pour les tests) */}
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={async () => {
            try {
              await AsyncStorage.removeItem('gdpr_consent');
              await AsyncStorage.removeItem('gdpr_consent_date');
              Alert.alert('Test', 'Consentement GDPR réinitialisé. Redémarrez l\'app pour voir le modal.');
            } catch (error) {
              console.error('Erreur lors de la réinitialisation:', error);
            }
          }}
        >
          <MaterialIcons name="refresh" size={20} color="#FF6B6B" />
          <Text style={styles.resetButtonText}>Réinitialiser consentement GDPR</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: Platform.OS === 'ios' ? 220 : 200,
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
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#F44336',
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
  addButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 16,
    right: 16,
    left: 16,
    backgroundColor: '#2196F3',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingsSection: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  settingsButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#1976D2',
    marginLeft: 12,
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  resetButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#FF6B6B',
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default SetupScreen; 