// API công khai: tên hệ thống và logo (từ DB app_settings hoặc file khi setup)
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export type Branding = { systemName: string; logoDataUrl?: string }

export async function getBranding(): Promise<Branding> {
  const res = await fetch(`${base()}/api/setup/branding`, { cache: "no-store" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { systemName: "" }
  const d = data as { systemName?: string; logoDataUrl?: string }
  return {
    systemName: typeof d.systemName === "string" ? d.systemName.trim() : "",
    logoDataUrl: typeof d.logoDataUrl === "string" && d.logoDataUrl ? d.logoDataUrl : undefined,
  }
}
