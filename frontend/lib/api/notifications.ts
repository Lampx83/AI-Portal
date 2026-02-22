// API Notifications – call backend, use session cookie
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export type Notification = {
  id: string
  user_id: string
  type: "system" | "portal_invite"
  title: string
  body: string | null
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

function normalizeNotification(row: Record<string, unknown>): Notification {
  const rawType = row.type as string
  const isPortalInvite = rawType === "portal_invite" || rawType === "project_invite" || rawType === "research_invite"
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: (isPortalInvite ? "portal_invite" : "system") as Notification["type"],
    title: String(row.title ?? ""),
    body: row.body != null ? String(row.body) : null,
    payload: (row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {}) as Record<string, unknown>,
    read_at: row.read_at != null ? String(row.read_at) : null,
    created_at: String(row.created_at ?? ""),
  }
}

export async function getNotifications(params?: { limit?: number; unreadOnly?: boolean }): Promise<Notification[]> {
  const usp = new URLSearchParams()
  if (params?.limit) usp.set("limit", String(params.limit))
  if (params?.unreadOnly) usp.set("unread", "1")
  const res = await fetch(`${base()}/api/users/notifications?${usp.toString()}`, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  const list = (data as { notifications?: Record<string, unknown>[] }).notifications ?? []
  return list.map(normalizeNotification)
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${base()}/api/users/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
}

export async function acceptNotificationInvite(id: string): Promise<void> {
  const res = await fetch(`${base()}/api/users/notifications/${encodeURIComponent(id)}/accept`, {
    method: "PATCH",
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
}
