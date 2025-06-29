import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import des traductions
import fr from './locales/fr.json';
import de from './locales/de.json';
import en from './locales/en.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';

const resources = {
  fr: {
    translation: fr
  },
  de: {
    translation: de
  },
  en: {
    translation: en
  },
  ru: {
    translation: ru
  },
  ar: {
    translation: ar
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr', // langue par défaut
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false, // React Native gère déjà l'échappement
    },
    react: {
      useSuspense: false, // Important pour React Native
    },
  });

export default i18n; 