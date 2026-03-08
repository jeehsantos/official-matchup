import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enLanding from "./locales/en/landing.json";
import enAuth from "./locales/en/auth.json";
import enAbout from "./locales/en/about.json";
import enContact from "./locales/en/contact.json";

import ptCommon from "./locales/pt/common.json";
import ptLanding from "./locales/pt/landing.json";
import ptAuth from "./locales/pt/auth.json";
import ptAbout from "./locales/pt/about.json";
import ptContact from "./locales/pt/contact.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        landing: enLanding,
        auth: enAuth,
        about: enAbout,
        contact: enContact,
      },
      pt: {
        common: ptCommon,
        landing: ptLanding,
        auth: ptAuth,
        about: ptAbout,
        contact: ptContact,
      },
    },
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "landing", "auth", "about", "contact"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
  });

export default i18n;
