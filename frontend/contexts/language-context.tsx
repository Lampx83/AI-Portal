"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { getStoredLocale, setStoredLocale, t as tFn, type Locale } from "@/lib/i18n"
import { getSiteStrings } from "@/lib/api/site-strings"
import { API_CONFIG } from "@/lib/config"
import { fetchWithTimeout } from "@/lib/fetch-utils"

const FETCH_TIMEOUT_MS = 10_000

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  /** Chuỗi từ DB (rebrand), ưu tiên hơn i18n mặc định */
  siteStrings: Record<string, string>
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")
  const [mounted, setMounted] = useState(false)
  const [siteStrings, setSiteStrings] = useState<Record<string, string>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  // System language: from API (Admin config), applied to entire app
  useEffect(() => {
    if (!mounted) return
    const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
    fetchWithTimeout(`${base}/api/site-strings/available-locales`, {
      credentials: "include",
      timeoutMs: FETCH_TIMEOUT_MS,
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data: { defaultLocale?: string }) => {
        const systemLocale = (data?.defaultLocale || getStoredLocale() || "en") as Locale
        setLocaleState(systemLocale)
        setStoredLocale(systemLocale)
        if (typeof document !== "undefined") document.documentElement.lang = systemLocale
      })
      .catch(() => {
        const fallback = getStoredLocale()
        setLocaleState(fallback)
        if (typeof document !== "undefined") document.documentElement.lang = fallback
      })
  }, [mounted])

  const fetchSiteStrings = useCallback(() => {
    getSiteStrings(locale)
      .then((s) => setSiteStrings(s))
      .catch(() => setSiteStrings({}))
  }, [locale])

  useEffect(() => {
    if (!mounted) return
    fetchSiteStrings()
  }, [mounted, fetchSiteStrings])

  const applySystemLocale = useCallback(() => {
    const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
    return fetchWithTimeout(`${base}/api/site-strings/available-locales`, {
      credentials: "include",
      timeoutMs: FETCH_TIMEOUT_MS,
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data: { defaultLocale?: string }) => {
        const systemLocale = (data?.defaultLocale || getStoredLocale() || "en") as Locale
        setLocaleState(systemLocale)
        setStoredLocale(systemLocale)
        if (typeof document !== "undefined") document.documentElement.lang = systemLocale
        return systemLocale
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    const handler = () => {
      applySystemLocale().then((newLocale) => {
        if (newLocale) getSiteStrings(newLocale).then((s) => setSiteStrings(s)).catch(() => setSiteStrings({}))
        else fetchSiteStrings()
      })
    }
    window.addEventListener("site-strings-updated", handler)
    return () => window.removeEventListener("site-strings-updated", handler)
  }, [applySystemLocale, fetchSiteStrings])

  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value)
    setStoredLocale(value)
    if (typeof document !== "undefined") document.documentElement.lang = value
  }, [])

  const t = useCallback(
    (key: string) => siteStrings[key] ?? tFn(locale, key),
    [locale, siteStrings]
  )

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, siteStrings }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    return {
      locale: "vi" as Locale,
      setLocale: (_: Locale) => {},
      t: (key: string) => tFn("vi", key),
      siteStrings: {} as Record<string, string>,
    }
  }
  return ctx
}
