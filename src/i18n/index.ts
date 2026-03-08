import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enLanding from "./locales/en/landing.json";
import enAuth from "./locales/en/auth.json";
import enAbout from "./locales/en/about.json";
import enContact from "./locales/en/contact.json";
import enGames from "./locales/en/games.json";
import enGroups from "./locales/en/groups.json";
import enProfile from "./locales/en/profile.json";
import enPayment from "./locales/en/payment.json";
import enDiscover from "./locales/en/discover.json";
import enCourts from "./locales/en/courts.json";
import enManager from "./locales/en/manager.json";

import ptCommon from "./locales/pt/common.json";
import ptLanding from "./locales/pt/landing.json";
import ptAuth from "./locales/pt/auth.json";
import ptAbout from "./locales/pt/about.json";
import ptContact from "./locales/pt/contact.json";
import ptGames from "./locales/pt/games.json";
import ptGroups from "./locales/pt/groups.json";
import ptProfile from "./locales/pt/profile.json";
import ptPayment from "./locales/pt/payment.json";
import ptDiscover from "./locales/pt/discover.json";
import ptCourts from "./locales/pt/courts.json";
import ptManager from "./locales/pt/manager.json";

const ns = ["common", "landing", "auth", "about", "contact", "games", "groups", "profile", "payment", "discover", "courts", "manager"] as const;

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
        games: enGames,
        groups: enGroups,
        profile: enProfile,
        payment: enPayment,
        discover: enDiscover,
        courts: enCourts,
        manager: enManager,
      },
      pt: {
        common: ptCommon,
        landing: ptLanding,
        auth: ptAuth,
        about: ptAbout,
        contact: ptContact,
        games: ptGames,
        groups: ptGroups,
        profile: ptProfile,
        payment: ptPayment,
        discover: ptDiscover,
        courts: ptCourts,
        manager: ptManager,
      },
    },
    fallbackLng: "en",
    defaultNS: "common",
    ns: [...ns],
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
