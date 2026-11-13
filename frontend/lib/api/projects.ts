// API Projects – call backend, use session cookie
import { API_CONFIG } from "@/lib/config"
import { portalRootForStorageDownload } from "@/lib/storage-url-browser"
import type { ProjectLifecycle } from "@/lib/project-lifecycle"
import type { ProjectFileMeta, ProjectMember } from "@/types"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

/** Thông điệp lỗi từ API: ưu tiên `error` (tiếng Việt, có chủ đích) rồi `message`. */
function apiErrorMessage(data: unknown, status: number): string {
  const d = (data ?? {}) as { error?: string; message?: string }
  return d.error || d.message || `HTTP ${status}`
}

export type ProjectRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  team_members: string[]
  file_keys: string[]
  tags?: string[]
  icon?: string | null
  /** null = chưa có dữ liệu vòng đời nghiên cứu */
  lifecycle?: ProjectLifecycle | null
  created_at: string
  updated_at: string
  my_role?: "owner" | "editor" | "viewer"
  members?: ProjectMember[]
  file_meta?: Record<string, ProjectFileMeta>
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
    lifecycle: row.lifecycle && typeof row.lifecycle === "object" ? (row.lifecycle as ProjectLifecycle) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    is_shared: !!row.is_shared,
    my_role: row.my_role === "owner" || row.my_role === "editor" || row.my_role === "viewer" ? row.my_role : row.is_shared ? "viewer" : "owner",
    members: Array.isArray(row.members) ? (row.members as ProjectMember[]) : [],
    file_meta: row.file_meta && typeof row.file_meta === "object" ? (row.file_meta as Record<string, ProjectFileMeta>) : {},
    owner_email: row.owner_email != null ? String(row.owner_email) : null,
    owner_display_name: row.owner_display_name != null ? String(row.owner_display_name) : null,
  }
}

export async function getProjects(): Promise<ProjectRow[]> {
  const res = await fetch(`${base()}/api/users/projects`, { credentials: "include" })
  // Trả về danh sách rỗng khi chưa đăng nhập — không ném lỗi để layout vẫn hoạt động (vd: /tools/surveylab)
  if (res.status === 401) return []
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  const list = (data as { projects?: Record<string, unknown>[] }).projects ?? []
  return list.map(normalizeProject)
}

export async function postProject(body: {
  name: string
  description?: string | null
  team_members?: string[]
  members?: { email: string; role: "editor" | "viewer" }[]
  file_keys?: string[]
  tags?: string[]
  icon?: string | null
  /** null = đặt lại về chưa có dữ liệu */
  lifecycle?: ProjectLifecycle | null
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
  /** Thành viên kèm vai (ưu tiên hơn team_members) — chỉ chủ dự án gửi */
  members?: { email: string; role: "editor" | "viewer" }[]
  file_keys?: string[]
  tags?: string[]
  icon?: string | null
  /** null = đặt lại về chưa có dữ liệu */
  lifecycle?: ProjectLifecycle | null
}): Promise<ProjectRow> {
  const res = await fetch(`${base()}/api/users/projects/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(apiErrorMessage(data, res.status))
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

export interface UploadedProjectFile extends ProjectFileMeta {
  key: string
}

/**
 * projectId: nếu có thì tệp được ghi thẳng vào dự án (chủ hoặc biên tập viên), kèm tên gốc/thư mục/người tải.
 * Không có projectId: tệp tạm của chính người dùng.
 */
export async function uploadProjectFilesDetailed(files: File[], projectId?: string, folder?: string): Promise<UploadedProjectFile[]> {
  if (files.length === 0) return []
  const form = new FormData()
  files.forEach((f) => form.append("files", f))
  const qs = new URLSearchParams()
  if (projectId) qs.set("project_id", projectId)
  if (projectId && folder) qs.set("folder", folder)
  const res = await fetch(`${base()}/api/users/projects/upload${qs.toString() ? `?${qs}` : ""}`, {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(apiErrorMessage(data, res.status))
  const d = data as { keys?: string[]; files?: UploadedProjectFile[] }
  return d.files ?? (d.keys ?? []).map((key) => ({ key, name: key.split("/").pop() ?? key, size: 0, mime: "", folder: "", by: "", at: "" }))
}

/** Giữ chữ ký cũ: trả về danh sách khoá tệp. */
export async function uploadProjectFiles(files: File[], projectId?: string): Promise<string[]> {
  return (await uploadProjectFilesDetailed(files, projectId)).map((f) => f.key)
}

export async function patchProjectFile(projectId: string, body: { key: string; name?: string; folder?: string }): Promise<void> {
  const res = await fetch(`${base()}/api/users/projects/${projectId}/files`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(apiErrorMessage(data, res.status))
}

export async function deleteProjectFile(projectId: string, key: string): Promise<void> {
  const res = await fetch(`${base()}/api/users/projects/${projectId}/files?key=${encodeURIComponent(key)}`, {
    method: "DELETE",
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(apiErrorMessage(data, res.status))
}

export interface ProjectActivityRow {
  id: number
  actor_email: string | null
  kind: string
  detail: Record<string, unknown>
  created_at: string
}

export async function getProjectActivity(projectId: string): Promise<ProjectActivityRow[]> {
  const res = await fetch(`${base()}/api/users/projects/${projectId}/activity`, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(apiErrorMessage(data, res.status))
  return (data as { activity?: ProjectActivityRow[] }).activity ?? []
}

export interface MyTask {
  project_id: string
  project_name: string
  stage_id: string
  stage_name: string
  id: string
  text: string
  due: string | null
}

export async function getMyTasks(): Promise<MyTask[]> {
  const res = await fetch(`${base()}/api/users/projects/my-tasks`, { credentials: "include" })
  if (!res.ok) return []
  const data = await res.json().catch(() => ({}))
  return (data as { tasks?: MyTask[] }).tasks ?? []
}

/**
 * Trả về URL TUYỆT ĐỐI (không dùng base() vì có thể rỗng ở prod). URL này còn được gửi thẳng
 * cho Central (context.extra_data.document[].url) để backend tự fetch — URL tương đối bị
 * orchestrator.ts loại bỏ (isValidUrl dùng `new URL()`, throw với chuỗi tương đối) nên Central
 * coi như không có file đính kèm nào dù project đã gắn file.
 */
export function getProjectFileUrl(key: string): string {
  return `${portalRootForStorageDownload().replace(/\/+$/, "")}/api/users/projects/files/${encodeURIComponent(key)}`
}
