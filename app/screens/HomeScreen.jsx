import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl, Platform, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome, MaterialIcons, AntDesign } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';
import GDPRConsent from '../../components/GDPRConsent';

const HomeScreen = () => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, getLanguageName, getLanguageFlag, availableLanguages, getCurrentLanguageDirection } = useLanguage();
  const [schools, setSchools] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  const languageDirection = getCurrentLanguageDirection();

  const loadSchools = async () => {
    try {
      const savedSchools = await AsyncStorage.getItem('schools');
      
      if (savedSchools) {
        const schoolsList = JSON.parse(savedSchools);
        
        // Charger les données complètes de chaque école
        const completeSchools = await Promise.all(
          schoolsList.map(async (school) => {
            const schoolData = await AsyncStorage.getItem(`school_${school.id}`);
            return schoolData ? JSON.parse(schoolData) : school;
          })
        );
        
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

  const handleLanguageChange = (language) => {
    Alert.alert(
      t('settings.language'),
      `${t('common.confirm')} ${t('settings.language')}?`,
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.confirm'),
          onPress: () => changeLanguage(language),
        },
      ]
    );
  };

  const renderLanguageOption = (languageCode) => {
    const isSelected = currentLanguage === languageCode;
    return (
      <TouchableOpacity
        key={languageCode}
        style={[styles.languageOption, isSelected && styles.selectedLanguage]}
        onPress={() => handleLanguageChange(languageCode)}
      >
        <View style={styles.languageInfo}>
          <Text style={styles.languageFlag}>{getLanguageFlag(languageCode)}</Text>
          <Text style={[styles.languageName, isSelected && styles.selectedLanguageText]}>
            {getLanguageName(languageCode)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLanguageSection = () => {
    const firstRowLanguages = ['fr', 'de', 'en'];
    const secondRowLanguages = ['ru', 'ar'];

    return (
      <View style={[styles.languageSection, { direction: languageDirection }]}>
        <Text style={styles.languageTitle}>{t('settings.language')}</Text>
        
        {/* Première ligne : Français, Allemand, Anglais */}
        <View style={styles.languageRow}>
          {firstRowLanguages.map(renderLanguageOption)}
        </View>
        
        {/* Deuxième ligne : Russe, Arabe */}
        <View style={[styles.languageRow, { justifyContent: 'center' }]}>
          {secondRowLanguages.map(renderLanguageOption)}
        </View>
      </View>
    );
  };

  const renderCopyrightSection = () => {
    const currentYear = new Date().getFullYear();
    
    const handleGitHubPress = () => {
      Linking.openURL('https://github.com/Michaux-Technology');
    };
    
    return (
      <View style={styles.copyrightSection}>
        <Text style={styles.copyrightText}>
          {t('copyright.developedBy')}
        </Text>
        <Text style={styles.copyrightText}>
          © {currentYear} {t('copyright.allRightsReserved')}
        </Text>
        <TouchableOpacity onPress={handleGitHubPress} style={styles.githubButton}>
          <AntDesign name="github" size={24} color="#333333" />
        </TouchableOpacity>
      </View>
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
        <Text style={styles.username}>{t('common.user')} : {item.username}</Text>
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
            <Text style={styles.emptyText}>{t('navigation.home')}</Text>
            <Text style={styles.emptySubtext}>{t('planning.noData')}</Text>
          </View>
        }
        ListFooterComponent={
          <View>
            {renderLanguageSection()}
            {renderCopyrightSection()}
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
      
      <GDPRConsent onConsent={(status) => {
        console.log('Consentement RGPD:', status);
      }} />
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
  languageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 4,
  },
  languageOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageFlag: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  languageName: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedLanguage: {
    borderColor: '#2196F3',
  },
  selectedLanguageText: {
    fontWeight: 'bold',
  },
  languageSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
  },
  languageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  copyrightSection: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
  githubButton: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
});

export default HomeScreen; 