// Public API: display strings by locale (from DB, rebrand). Supports built-in + custom locales.
import { API_CONFIG } from "@/lib/config"
import { fetchWithTimeout } from "@/lib/fetch-utils"

const FETCH_TIMEOUT_MS = 10_000

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export async function getSiteStrings(locale: string): Promise<Record<string, string>> {
  const url = `${base()}/api/site-strings?locale=${encodeURIComponent(locale)}`
  const res = await fetchWithTimeout(url, { credentials: "include", timeoutMs: FETCH_TIMEOUT_MS })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return {}
  return (data as Record<string, string>) ?? {}
}

export async function getAvailableLocales(): Promise<string[]> {
  const url = `${base()}/api/site-strings/available-locales`
  const res = await fetchWithTimeout(url, { credentials: "include", timeoutMs: FETCH_TIMEOUT_MS })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return ["en", "zh", "hi", "es", "vi"]
  return (data as { locales?: string[] }).locales ?? ["en", "zh", "hi", "es", "vi"]
}
