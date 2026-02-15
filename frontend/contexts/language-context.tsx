"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { getStoredLocale, setStoredLocale, t as tFn, type Locale } from "@/lib/i18n"
import { getSiteStrings } from "@/lib/api/site-strings"

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  /** Chuỗi từ DB (rebrand), ưu tiên hơn i18n mặc định */
  siteStrings: Record<string, string>
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("vi")
  const [mounted, setMounted] = useState(false)
  const [siteStrings, setSiteStrings] = useState<Record<string, string>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      const stored = getStoredLocale()
      setLocaleState(stored)
      if (typeof document !== "undefined") document.documentElement.lang = stored
    }
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

  useEffect(() => {
    const handler = () => fetchSiteStrings()
    window.addEventListener("site-strings-updated", handler)
    return () => window.removeEventListener("site-strings-updated", handler)
  }, [fetchSiteStrings])

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
