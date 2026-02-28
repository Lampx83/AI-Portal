// Public API: system name and logo (from DB app_settings or file during setup)
import { API_CONFIG } from "@/lib/config"
import { fetchWithTimeout } from "@/lib/fetch-utils"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")
const BRANDING_TIMEOUT_MS = 10_000

export type Branding = {
  systemName: string
  logoDataUrl?: string
  systemSubtitle?: string
  themeColor?: string
  projectsEnabled?: boolean
  hideNewChatOnAdmin?: boolean
  hideAppsAllOnAdmin?: boolean
  hideAssistantsAllOnAdmin?: boolean
  hideMenuProfile?: boolean
  hideMenuNotifications?: boolean
  hideMenuSettings?: boolean
  hideMenuAdmin?: boolean
  hideMenuDevDocs?: boolean
}

export async function getBranding(): Promise<Branding> {
  const res = await fetchWithTimeout(`${base()}/api/setup/branding`, {
    cache: "no-store",
    timeoutMs: BRANDING_TIMEOUT_MS,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { systemName: "", projectsEnabled: true }
  const d = data as {
    systemName?: string
    logoDataUrl?: string
    systemSubtitle?: string
    themeColor?: string
    projectsEnabled?: boolean
    hideNewChatOnAdmin?: boolean
    hideAppsAllOnAdmin?: boolean
    hideAssistantsAllOnAdmin?: boolean
    hideMenuProfile?: boolean
    hideMenuNotifications?: boolean
    hideMenuSettings?: boolean
    hideMenuAdmin?: boolean
    hideMenuDevDocs?: boolean
  }
  return {
    systemName: typeof d.systemName === "string" ? d.systemName.trim() : "",
    logoDataUrl: typeof d.logoDataUrl === "string" && d.logoDataUrl ? d.logoDataUrl : undefined,
    systemSubtitle: typeof d.systemSubtitle === "string" && d.systemSubtitle.trim() ? d.systemSubtitle.trim() : undefined,
    themeColor: typeof d.themeColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(d.themeColor) ? d.themeColor : undefined,
    projectsEnabled: d.projectsEnabled !== false,
    hideNewChatOnAdmin: d.hideNewChatOnAdmin === true,
    hideAppsAllOnAdmin: d.hideAppsAllOnAdmin === true,
    hideAssistantsAllOnAdmin: d.hideAssistantsAllOnAdmin === true,
    hideMenuProfile: d.hideMenuProfile === true,
    hideMenuNotifications: d.hideMenuNotifications === true,
    hideMenuSettings: d.hideMenuSettings === true,
    hideMenuAdmin: d.hideMenuAdmin === true,
    hideMenuDevDocs: d.hideMenuDevDocs === true,
  }
}
