/** Re-export all i18n from split locale files. */
export {
  BUILTIN_LOCALES,
  type BuiltinLocale,
  type Locale,
  isValidLocaleCode,
  getStoredLocale,
  setStoredLocale,
  translations,
  t,
  getLocaleLabel,
} from "./i18n/index"
