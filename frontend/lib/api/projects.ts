// API Projects – call backend, use session cookie
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export type ProjectRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  team_members: string[]
  file_keys: string[]
  tags?: string[]
  icon?: string | null
  created_at: string
  updated_at: string
  /** true khi user hiện tại là thành viên được chia sẻ (không phải chủ sở hữu) */
  is_shared?: boolean
  /** Email chủ sở hữu (có khi is_shared) */
  owner_email?: string | null
  /** Tên hiển thị chủ sở hữu (có khi is_shared) */
  owner_display_name?: string | null
}

function normalizeProject(row: Record<string, unknown>): ProjectRow {
  const raw = row as Record<string, unknown>
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(raw.name ?? raw.title ?? ""),
    description: row.description != null ? String(row.description) : null,
    team_members: Array.isArray(row.team_members) ? row.team_members.map(String) : [],
    file_keys: Array.isArray(row.file_keys) ? row.file_keys.map(String) : [],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    icon: row.icon != null ? String(row.icon) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    is_shared: !!row.is_shared,
    owner_email: row.owner_email != null ? String(row.owner_email) : null,
    owner_display_name: row.owner_display_name != null ? String(row.owner_display_name) : null,
  }
}

export async function getProjects(): Promise<ProjectRow[]> {
  const res = await fetch(`${base()}/api/users/projects`, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  const list = (data as { projects?: Record<string, unknown>[] }).projects ?? []
  return list.map(normalizeProject)
}

export async function postProject(body: {
  name: string
  description?: string | null
  team_members?: string[]
  file_keys?: string[]
  tags?: string[]
  icon?: string | null
}): Promise<ProjectRow> {
  const res = await fetch(`${base()}/api/users/projects`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return normalizeProject((data as { project: Record<string, unknown> }).project)
}

export async function patchProject(id: string, body: {
  name?: string
  description?: string | null
  team_members?: string[]
  file_keys?: string[]
  tags?: string[]
  icon?: string | null
}): Promise<ProjectRow> {
  const res = await fetch(`${base()}/api/users/projects/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return normalizeProject((data as { project: Record<string, unknown> }).project)
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${base()}/api/users/projects/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
}

/** projectId: nếu có thì file lưu vào folder projects/{userId}/{projectId}/ */
export async function uploadProjectFiles(files: File[], projectId?: string): Promise<string[]> {
  if (files.length === 0) return []
  const form = new FormData()
  files.forEach((f) => form.append("files", f))
  const url = projectId
    ? `${base()}/api/users/projects/upload?project_id=${encodeURIComponent(projectId)}`
    : `${base()}/api/users/projects/upload`
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return (data as { keys: string[] }).keys ?? []
}

export function getProjectFileUrl(key: string): string {
  return `${base()}/api/users/projects/files/${encodeURIComponent(key)}`
}
