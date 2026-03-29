import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { it } from '@/locales/it';
import { en } from '@/locales/en';

const STORAGE_KEY = 'officinai_lang';

const savedLang = localStorage.getItem(STORAGE_KEY) || 'it';

i18next.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'it',
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
