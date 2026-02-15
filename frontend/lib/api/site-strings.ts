// API công khai: chuỗi hiển thị theo locale (từ DB, dùng rebrand)
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export async function getSiteStrings(locale: "vi" | "en"): Promise<Record<string, string>> {
  const url = `${base()}/api/site-strings?locale=${encodeURIComponent(locale)}`
  const res = await fetch(url, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return {}
  return (data as Record<string, string>) ?? {}
}
