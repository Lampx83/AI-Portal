// Built-in: en, zh, hi, es, vi (4 most spoken + Vietnam). Custom locales via Admin → Settings (upload package).
import { vi } from "./locales/vi"
import { en } from "./locales/en"
import { zh } from "./locales/zh"
import { hi } from "./locales/hi"
import { es } from "./locales/es"

export const BUILTIN_LOCALES = ["en", "zh", "hi", "es", "vi"] as const
export type BuiltinLocale = (typeof BUILTIN_LOCALES)[number]
export type Locale = BuiltinLocale | string

const STORAGE_KEY = "neu-locale"

/** Validate locale code (2–5 chars, lowercase letters/numbers). */
export function isValidLocaleCode(code: string): boolean {
  return /^[a-z0-9]{2,5}$/.test(code)
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en"
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (!v) return "en"
    if (BUILTIN_LOCALES.includes(v as BuiltinLocale)) return v as BuiltinLocale
    if (isValidLocaleCode(v)) return v
  } catch (_) {}
  return "en"
}

export function setStoredLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, String(locale))
  } catch (_) {}
}

export const translations: Record<BuiltinLocale, Record<string, string>> = {
  vi,
  en,
  zh,
  hi,
  es,
}

export function t(locale: Locale, key: string): string {
  const loc = String(locale)
  const builtin = BUILTIN_LOCALES.includes(loc as BuiltinLocale) ? translations[loc as BuiltinLocale]?.[key] : undefined
  if (builtin) return builtin
  return translations.en?.[key] ?? translations.vi?.[key] ?? key
}

const LOCALE_LABEL_KEYS: Record<BuiltinLocale, string> = {
  vi: "settings.langVi",
  en: "settings.langEn",
  zh: "settings.langZh",
  hi: "settings.langHi",
  es: "settings.langEs",
}

/** Display label for locale. Built-in: native name; custom: code. */
export function getLocaleLabel(locale: string): string {
  if (BUILTIN_LOCALES.includes(locale as BuiltinLocale))
    return translations[locale as BuiltinLocale]?.[LOCALE_LABEL_KEYS[locale as BuiltinLocale]] ?? locale
  return locale
}
