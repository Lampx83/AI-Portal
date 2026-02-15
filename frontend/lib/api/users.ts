// API hồ sơ người dùng và danh mục Đơn vị / Phòng ban (gọi backend, dùng session cookie)
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export type Department = { id: string; name: string; display_order?: number }

export type UserProfile = {
  id: string
  email: string
  display_name: string | null
  full_name: string | null
  sso_provider: string | null
  position: string | null
  department_id: string | null
  intro: string | null
  direction: string[] | null
}

export type UserSettings = {
  language: "vi" | "en"
  notifications: { email: boolean; push: boolean; projectUpdates: boolean; publications: boolean }
  privacy: { profileVisible: boolean; projectsVisible: boolean; publicationsVisible: boolean }
  ai: { personalization: boolean; autoSuggestions: boolean; externalSearch: boolean; responseLength: number; creativity: number }
  data: { autoBackup: boolean; syncEnabled: boolean; cacheSize: number }
}

export type ProfileResponse = {
  profile: UserProfile
  department: { id: string; name: string } | null
  settings?: UserSettings
}

export async function getDepartments(): Promise<Department[]> {
  const res = await fetch(`${base()}/api/users/departments`, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return (data as { departments: Department[] }).departments ?? []
}

export async function getProfile(): Promise<ProfileResponse> {
  const res = await fetch(`${base()}/api/users/me`, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return data as ProfileResponse
}

export async function patchProfile(body: {
  position?: string | null
  department_id?: string | null
  intro?: string | null
  direction?: string[] | null
  full_name?: string | null
  google_scholar_url?: string | null
  settings?: Partial<UserSettings>
}): Promise<ProfileResponse> {
  const res = await fetch(`${base()}/api/users/me`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return data as ProfileResponse
}
