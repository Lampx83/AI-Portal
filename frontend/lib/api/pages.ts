/** Public API: page content for /welcome and /guide (from app_settings) */
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export type WelcomePageConfig = {
  title?: string
  subtitle?: string
  cards?: { title: string; description: string; icon?: string; targetType?: "assistant" | "tool"; targetAlias?: string }[]
}
export type GuidePageConfig = {
  title?: string
  subtitle?: string
  cards?: { title: string; description: string; icon?: string; targetType?: "assistant" | "tool"; targetAlias?: string }[]
}

export async function getWelcomePageConfig(locale?: string): Promise<WelcomePageConfig> {
  try {
    const q = locale ? `&locale=${encodeURIComponent(locale)}` : ""
    const res = await fetch(`${base()}/api/setup/page-config?page=welcome${q}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { title: "", subtitle: "", cards: [] }
    const d = data as WelcomePageConfig
    return {
      title: typeof d.title === "string" ? d.title : "",
      subtitle: typeof d.subtitle === "string" ? d.subtitle : "",
      cards: Array.isArray(d.cards) ? d.cards : [],
    }
  } catch {
    return { title: "", subtitle: "", cards: [] }
  }
}

export async function getGuidePageConfig(): Promise<GuidePageConfig> {
  try {
    const res = await fetch(`${base()}/api/setup/page-config?page=guide`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { title: "", subtitle: "", cards: [] }
    const d = data as GuidePageConfig
    return {
      title: typeof d.title === "string" ? d.title : "",
      subtitle: typeof d.subtitle === "string" ? d.subtitle : "",
      cards: Array.isArray(d.cards) ? d.cards : [],
    }
  } catch {
    return { title: "", subtitle: "", cards: [] }
  }
}
