import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resources from "./locales";

const LANGUAGE_STORAGE_KEY = "app-language";
const DEFAULT_LANGUAGE = "en";

const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
const initialLanguage = resources[storedLanguage] ? storedLanguage : DEFAULT_LANGUAGE;

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
});

document.documentElement.lang = initialLanguage;

i18n.on("languageChanged", (language) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.documentElement.lang = language;
});

export { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY };
export default i18n;
