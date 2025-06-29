import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@app_language';

export const useLanguage = () => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState('fr');

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) {
        setCurrentLanguage(savedLanguage);
        i18n.changeLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la langue:', error);
    }
  };

  const changeLanguage = async (language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
      setCurrentLanguage(language);
      i18n.changeLanguage(language);
    } catch (error) {
      console.error('Erreur lors du changement de langue:', error);
    }
  };

  const getLanguageName = (languageCode) => {
    const languageNames = {
      fr: 'Français',
      de: 'Deutsch',
      en: 'English',
      ru: 'Русский',
      ar: 'العربية'
    };
    return languageNames[languageCode] || languageCode;
  };

  const getLanguageFlag = (languageCode) => {
    const flags = {
      fr: '🇫🇷',
      de: '🇩🇪',
      en: '🇬🇧',
      ru: '🇷🇺',
      ar: '🇸🇦'
    };
    return flags[languageCode] || '🌐';
  };

  const isRTL = (languageCode) => {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    return rtlLanguages.includes(languageCode);
  };

  const getCurrentLanguageDirection = () => {
    return isRTL(currentLanguage) ? 'rtl' : 'ltr';
  };

  return {
    currentLanguage,
    changeLanguage,
    getLanguageName,
    getLanguageFlag,
    isRTL,
    getCurrentLanguageDirection,
    availableLanguages: ['fr', 'de', 'en', 'ru', 'ar']
  };
}; 