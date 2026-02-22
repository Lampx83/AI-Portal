// Public API: system name and logo (from DB app_settings or file during setup)
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export type Branding = { systemName: string; logoDataUrl?: string; systemSubtitle?: string; themeColor?: string; projectsEnabled?: boolean }

export async function getBranding(): Promise<Branding> {
  const res = await fetch(`${base()}/api/setup/branding`, { cache: "no-store" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { systemName: "", projectsEnabled: true }
  const d = data as { systemName?: string; logoDataUrl?: string; systemSubtitle?: string; themeColor?: string; projectsEnabled?: boolean }
  return {
    systemName: typeof d.systemName === "string" ? d.systemName.trim() : "",
    logoDataUrl: typeof d.logoDataUrl === "string" && d.logoDataUrl ? d.logoDataUrl : undefined,
    systemSubtitle: typeof d.systemSubtitle === "string" && d.systemSubtitle.trim() ? d.systemSubtitle.trim() : undefined,
    themeColor: typeof d.themeColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(d.themeColor) ? d.themeColor : undefined,
    projectsEnabled: d.projectsEnabled !== false,
  }
}
