"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { getStoredLocale, setStoredLocale, t as tFn, type Locale } from "@/lib/i18n"
import { getSiteStrings } from "@/lib/api/site-strings"
import { API_CONFIG } from "@/lib/config"
import { fetchWithTimeout } from "@/lib/fetch-utils"

const FETCH_TIMEOUT_MS = 10_000

// Đánh dấu người dùng đã CHỦ ĐỘNG chọn ngôn ngữ (qua bộ chuyển ở header / hồ sơ).
// Khi đã chọn, không để defaultLocale của hệ thống ghi đè lúc tải lại trang.
const USER_SET_KEY = "neu-locale-user-set"
function hasUserChosenLocale(): boolean {
  if (typeof window === "undefined") return false
  try { return localStorage.getItem(USER_SET_KEY) === "1" } catch { return false }
}
function markUserChoseLocale() {
  try { localStorage.setItem(USER_SET_KEY, "1") } catch { /* ignore */ }
}

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  /** Chuỗi từ DB (rebrand), ưu tiên hơn i18n mặc định */
  siteStrings: Record<string, string>
  /** Ngôn ngữ admin bật cho người dùng chọn. >1 phần tử thì header hiện bộ chuyển. */
  publicLocales: string[]
  /** Tên công cụ/trợ lý theo ngôn ngữ hiện tại: {alias: "English name"}. Rỗng = dùng tên gốc. */
  toolNames: Record<string, string>
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")
  const [mounted, setMounted] = useState(false)
  const [siteStrings, setSiteStrings] = useState<Record<string, string>>({})
  const [publicLocales, setPublicLocales] = useState<string[]>([])
  const [toolNames, setToolNames] = useState<Record<string, string>>({})

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
      .then((data: { defaultLocale?: string; publicLocales?: string[] }) => {
        const def = (data?.defaultLocale || "en") as Locale
        const list = Array.isArray(data?.publicLocales) && data.publicLocales.length ? data.publicLocales : [String(def)]
        setPublicLocales(list)
        // Người dùng đã tự chọn (và ngôn ngữ đó vẫn được bật) → giữ; nếu không → dùng mặc định hệ thống.
        const stored = getStoredLocale()
        const effective = (hasUserChosenLocale() && list.includes(String(stored)) ? stored : def) as Locale
        setLocaleState(effective)
        setStoredLocale(effective)
        if (typeof document !== "undefined") document.documentElement.lang = String(effective)
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

  // Tên công cụ theo ngôn ngữ hiện tại (override hiển thị sidebar/hộp thoại).
  useEffect(() => {
    if (!mounted) return
    const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
    fetchWithTimeout(`${base}/api/setup/tool-names?locale=${encodeURIComponent(String(locale))}`, {
      timeoutMs: FETCH_TIMEOUT_MS,
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data: { names?: Record<string, string> }) =>
        setToolNames(data?.names && typeof data.names === "object" ? data.names : {})
      )
      .catch(() => setToolNames({}))
  }, [mounted, locale])

  const applySystemLocale = useCallback(() => {
    const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
    return fetchWithTimeout(`${base}/api/site-strings/available-locales`, {
      credentials: "include",
      timeoutMs: FETCH_TIMEOUT_MS,
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data: { defaultLocale?: string; publicLocales?: string[] }) => {
        const def = (data?.defaultLocale || "en") as Locale
        const list = Array.isArray(data?.publicLocales) && data.publicLocales.length ? data.publicLocales : [String(def)]
        setPublicLocales(list)
        const stored = getStoredLocale()
        const effective = (hasUserChosenLocale() && list.includes(String(stored)) ? stored : def) as Locale
        setLocaleState(effective)
        setStoredLocale(effective)
        if (typeof document !== "undefined") document.documentElement.lang = String(effective)
        return effective
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
    markUserChoseLocale()
    if (typeof document !== "undefined") document.documentElement.lang = value
  }, [])

  const t = useCallback(
    (key: string) => siteStrings[key] ?? tFn(locale, key),
    [locale, siteStrings]
  )

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, siteStrings, publicLocales, toolNames }}>
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
      publicLocales: [] as string[],
      toolNames: {} as Record<string, string>,
    }
  }
  return ctx
}
