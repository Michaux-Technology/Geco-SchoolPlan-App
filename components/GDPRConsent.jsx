import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import i18n from '../i18n';

const GDPRConsent = ({ onConsent }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    initializeLanguage();
    checkConsentStatus();
  }, []);

  const initializeLanguage = async () => {
    try {
      // Vérifier si une langue est déjà définie
      const savedLanguage = await AsyncStorage.getItem('user_language');
      
      if (!savedLanguage) {
        // Détecter la langue du système de manière plus robuste
        let systemLocale = 'en'; // langue par défaut
        
        try {
          if (Platform.OS === 'ios') {
            systemLocale = NativeModules.SettingsManager.settings.AppleLocale || 
                          NativeModules.SettingsManager.settings.AppleLanguages[0] || 'en';
          } else if (Platform.OS === 'android') {
            systemLocale = NativeModules.I18nManager.localeIdentifier || 'en';
          }
        } catch (localeError) {
          console.log('Erreur lors de la détection de la langue système:', localeError);
          systemLocale = 'en';
        }
        
        let detectedLanguage = 'en'; // langue par défaut
        
        // Normaliser la locale (prendre seulement la partie langue)
        const languageCode = systemLocale.split('_')[0].split('-')[0].toLowerCase();
        
        if (languageCode === 'fr') {
          detectedLanguage = 'fr';
        } else if (languageCode === 'de') {
          detectedLanguage = 'de';
        } else if (languageCode === 'ar') {
          detectedLanguage = 'ar';
        } else if (languageCode === 'ru') {
          detectedLanguage = 'ru';
        }
        
        console.log('Langue système détectée:', systemLocale, '->', detectedLanguage);
        
        // Sauvegarder et appliquer la langue détectée
        await AsyncStorage.setItem('user_language', detectedLanguage);
        i18n.changeLanguage(detectedLanguage);
      } else {
        // Utiliser la langue sauvegardée
        i18n.changeLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de la langue:', error);
      // Utiliser l'anglais par défaut en cas d'erreur
      i18n.changeLanguage('en');
    }
  };

  const checkConsentStatus = async () => {
    try {
      const consentStatus = await AsyncStorage.getItem('gdpr_consent');
      console.log('Statut du consentement GDPR:', consentStatus);
      
      if (!consentStatus) {
        console.log('Aucun consentement trouvé, affichage du modal');
        setVisible(true);
      } else {
        console.log('Consentement déjà donné, modal masqué');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du consentement:', error);
      setVisible(true);
    }
  };

  const handleAccept = async () => {
    try {
      await AsyncStorage.setItem('gdpr_consent', 'accepted');
      await AsyncStorage.setItem('gdpr_consent_date', new Date().toISOString());
      setVisible(false);
      if (onConsent) {
        onConsent('accepted');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du consentement:', error);
    }
  };

  const handleDecline = async () => {
    Alert.alert(
      t('gdpr.consentTitle'),
      t('gdpr.consentRequired'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('gdpr.consentAccept'),
          onPress: handleAccept,
        },
      ]
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialIcons name="privacy-tip" size={24} color="#1976D2" />
          <Text style={styles.title}>{t('gdpr.consentTitle')}</Text>
        </View>
        
        <Text style={styles.message}>{t('gdpr.consentMessage')}</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
            <Text style={styles.declineButtonText}>{t('gdpr.consentDecline')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
            <Text style={styles.acceptButtonText}>{t('gdpr.consentAccept')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#666666',
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1976D2',
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default GDPRConsent; 