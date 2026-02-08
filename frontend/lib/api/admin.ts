// Client cho Admin API – gọi backend (localhost:3001 dev, research.neu.edu.vn prod)
// Dùng credentials: 'include' để gửi cookie admin_secret (sau khi /api/admin/enter)
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export async function adminFetch(path: string, init?: RequestInit) {
  const url = path.startsWith("http") ? path : `${base()}${path.startsWith("/") ? "" : "/"}${path}`
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  return res
}

export async function adminJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await adminFetch(path, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data as { error?: string; message?: string }
    throw new Error(err.message || err.error || `HTTP ${res.status}`)
  }
  return data as T
}

// Overview – backend trả về { stats: [ { table_name, row_count }, ... ] }
export async function getDbStats() {
  const d = await adminJson<{ stats: { table_name: string; row_count: string }[] }>("/api/admin/db/stats")
  const stats = d.stats || []
  const totalRows = stats.reduce((sum, s) => sum + Number(s.row_count || 0), 0)
  return { tables: stats.length, totalRows, stats }
}
export async function getStorageStats(prefix?: string) {
  const q = prefix != null && prefix !== "" ? `?prefix=${encodeURIComponent(prefix)}` : ""
  return adminJson<{ totalObjects: number; totalSize: number; totalSizeFormatted?: string }>(`/api/storage/stats${q}`)
}

/** Số tin nhắn mỗi ngày (30 ngày gần nhất, query ?days=7..90) */
export async function getMessagesPerDay(days?: number) {
  const q = days != null ? `?days=${days}` : ""
  return adminJson<{ data: { day: string; count: number }[] }>(`/api/admin/stats/messages-per-day${q}`)
}

/** Số lần đăng nhập mỗi ngày (30 ngày gần nhất, query ?days=7..90) */
export async function getLoginsPerDay(days?: number) {
  const q = days != null ? `?days=${days}` : ""
  return adminJson<{ data: { day: string; count: number }[] }>(`/api/admin/stats/logins-per-day${q}`)
}

/** Số tin nhắn theo nguồn (web / embed) */
export async function getMessagesBySource() {
  return adminJson<{ data: { source: string; count: number }[] }>("/api/admin/stats/messages-by-source")
}

/** Số tin nhắn theo agent (assistant_alias) */
export async function getMessagesByAgent() {
  return adminJson<{ data: { assistant_alias: string; count: number }[] }>("/api/admin/stats/messages-by-agent")
}

/** Số tài khoản đang trực tuyến (hoạt động trong 15 phút qua) */
export async function getOnlineUsers() {
  return adminJson<{ count: number; user_ids: string[] }>("/api/admin/stats/online-users")
}

// Users
export type UserRole = "user" | "admin" | "developer"
export type UserRow = {
  id: string
  email: string
  display_name: string | null
  full_name: string | null
  is_admin: boolean
  role?: UserRole
  created_at: string
  last_login_at: string | null
  sso_provider: string | null
  daily_message_limit?: number
  extra_messages_today?: number | null
  daily_used?: number
}
export async function getUsers() {
  return adminJson<{ users: UserRow[] }>("/api/admin/users")
}
export async function postUser(body: { email: string; display_name?: string; full_name?: string; password: string }) {
  return adminJson<{ user: UserRow }>("/api/admin/users", { method: "POST", body: JSON.stringify(body) })
}
export async function patchUser(id: string, body: { role?: "user" | "admin" | "developer"; is_admin?: boolean; display_name?: string; full_name?: string; password?: string; daily_message_limit?: number }) {
  return adminJson<{ user: UserRow }>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) })
}
export async function patchUsersBulk(updates: { user_id: string; daily_message_limit: number }[]) {
  return adminJson<{ ok: boolean; updated: number }>("/api/admin/users/bulk", { method: "PATCH", body: JSON.stringify({ updates }) })
}
export async function postUserLimitOverride(userId: string, extra_messages: number) {
  return adminJson<{ ok: boolean; extra_messages: number; effective_limit_today: number }>(`/api/admin/users/${userId}/limit-override`, { method: "POST", body: JSON.stringify({ extra_messages }) })
}
export async function deleteUser(id: string) {
  return adminJson<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" })
}

// Projects (Research Projects)
export type AdminProjectRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  team_members: string[]
  file_keys: string[]
  created_at: string
  updated_at: string
  user_email: string
  user_display_name: string | null
  user_full_name: string | null
}
export async function getAdminProjects() {
  return adminJson<{ projects: AdminProjectRow[] }>("/api/admin/projects")
}

// Agents
export type AgentRow = {
  id: string
  alias: string
  icon: string
  base_url: string
  domain_url: string | null
  is_active: boolean
  display_order: number
  config_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
  daily_message_limit?: number
  daily_used?: number
}
export async function getAgents() {
  return adminJson<{ agents: AgentRow[] }>("/api/admin/agents")
}
export async function getAgent(id: string) {
  return adminJson<{ agent: AgentRow }>(`/api/admin/agents/${id}`)
}
export async function postAgent(body: Partial<AgentRow> & { alias: string; base_url: string }) {
  return adminJson<{ agent: AgentRow }>("/api/admin/agents", { method: "POST", body: JSON.stringify(body) })
}
export async function patchAgent(id: string, body: Partial<AgentRow>) {
  return adminJson<{ agent: AgentRow }>(`/api/admin/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) })
}
export async function deleteAgent(id: string) {
  return adminJson<{ ok?: boolean }>(`/api/admin/agents/${id}`, { method: "DELETE" })
}

// Admin Chat: hội thoại gửi đến Agents (ẩn danh tính người nhắn)
export type AdminChatSession = {
  id: string
  title: string | null
  assistant_alias: string
  /** Nguồn phiên: 'web' | 'embed' – phục vụ quản lý */
  source?: string
  created_at: string
  updated_at: string
  message_count: number
  user_display: string
}
export async function getAdminChatSessions(params?: { assistant_alias?: string; source?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams()
  if (params?.assistant_alias) q.set("assistant_alias", params.assistant_alias)
  if (params?.source) q.set("source", params.source)
  if (params?.limit != null) q.set("limit", String(params.limit))
  if (params?.offset != null) q.set("offset", String(params.offset))
  const queryString = q.toString()
  return adminJson<{ data: AdminChatSession[]; page: { limit: number; offset: number; total: number } }>(
    `/api/admin/chat/sessions${queryString ? `?${queryString}` : ""}`
  )
}
export async function getAdminChatSession(sessionId: string) {
  return adminJson<AdminChatSession & { user_display: string }>(`/api/admin/chat/sessions/${encodeURIComponent(sessionId)}`)
}
export type AdminChatMessage = {
  id: string
  assistant_alias: string | null
  role: string
  content_type: string
  content: string | null
  model_id: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  response_time_ms: number | null
  refs: unknown
  created_at: string
  attachments?: { file_name?: string; file_url?: string }[]
}
export async function getAdminChatMessages(sessionId: string, params?: { limit?: number; offset?: number }) {
  const q = new URLSearchParams()
  if (params?.limit != null) q.set("limit", String(params.limit))
  if (params?.offset != null) q.set("offset", String(params.offset))
  const queryString = q.toString()
  return adminJson<{ data: AdminChatMessage[] }>(
    `/api/admin/chat/sessions/${encodeURIComponent(sessionId)}/messages${queryString ? `?${queryString}` : ""}`
  )
}

// Feedback (góp ý)
export type AdminUserFeedback = {
  id: string
  user_id: string
  user_email: string
  user_display_name: string | null
  content: string
  assistant_alias: string | null
  created_at: string
  admin_note: string | null
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
}
export async function getAdminFeedback(params?: { limit?: number; offset?: number; resolved?: "true" | "false" }) {
  const q = new URLSearchParams()
  if (params?.limit != null) q.set("limit", String(params.limit))
  if (params?.offset != null) q.set("offset", String(params.offset))
  if (params?.resolved) q.set("resolved", params.resolved)
  const qs = q.toString()
  return adminJson<{ data: AdminUserFeedback[]; page: { limit: number; offset: number; total: number } }>(
    `/api/admin/feedback${qs ? `?${qs}` : ""}`
  )
}
export async function patchAdminFeedback(id: string, body: { admin_note?: string | null; resolved?: boolean }) {
  return adminJson<{ feedback: AdminUserFeedback }>(`/api/admin/feedback/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export type AdminMessageFeedback = {
  message_id: string
  user_id: string
  session_id: string
  user_email: string
  user_display_name: string | null
  comment: string
  created_at: string
  admin_note: string | null
  resolved: boolean
  assistant_alias: string
  session_title: string | null
  session_created_at: string
  disliked_message_id: string
  disliked_message: { id: string; content: string | null; created_at: string }
  session_messages: Array<{ id: string; role: string; content: string | null; created_at: string }>
}
export async function getAdminMessageFeedback(params?: {
  limit?: number
  offset?: number
  assistant_alias?: string
  resolved?: "true" | "false"
}) {
  const q = new URLSearchParams()
  if (params?.limit != null) q.set("limit", String(params.limit))
  if (params?.offset != null) q.set("offset", String(params.offset))
  if (params?.assistant_alias) q.set("assistant_alias", params.assistant_alias)
  if (params?.resolved) q.set("resolved", params.resolved)
  const qs = q.toString()
  return adminJson<{
    data: AdminMessageFeedback[]
    page: { limit: number; offset: number; total: number }
  }>(`/api/admin/message-feedback${qs ? `?${qs}` : ""}`)
}
export async function patchAdminMessageFeedback(
  messageId: string,
  userId: string,
  body: { admin_note?: string | null; resolved?: boolean }
) {
  return adminJson<{ feedback: AdminMessageFeedback }>(
    `/api/admin/message-feedback/${messageId}/${userId}`,
    { method: "PATCH", body: JSON.stringify(body) }
  )
}
export async function deleteAdminMessageFeedback(messageId: string, userId: string) {
  return adminJson<{ success: boolean }>(`/api/admin/message-feedback/${messageId}/${userId}`, {
    method: "DELETE",
  })
}

// Agent test results
export async function getAgentTestResults(all?: boolean) {
  return adminJson<{ runs: { id: string; run_at: string; total_agents: number; passed_count: number }[]; results: Record<string, unknown[]> }>(
    `/api/admin/agents/test-results${all ? "?all=1" : ""}`
  )
}

// Test từng agent (metadata, data, ask)
export async function postAgentTest(body: {
  base_url: string
  test_type: "metadata" | "data" | "ask"
  model_id?: string
  prompt?: string
  document_urls?: string[]
  data_type?: string
}) {
  return adminJson<{ ok: boolean; status: number; url: string; data?: unknown }>(
    "/api/admin/agents/test",
    { method: "POST", body: JSON.stringify(body) }
  )
}

// Sample files cho test agent (ask với file)
export async function getSampleFiles() {
  return adminJson<{ files: { filename: string; format: string; url: string }[] }>("/api/admin/sample-files")
}

// Database
export async function getDbTables() {
  return adminJson<{ tables: { table_schema: string; table_name: string; column_count: number }[] }>("/api/admin/db/tables")
}
export type DbTableSchemaCol = { column_name: string; data_type: string; is_nullable: string; column_default: string | null }
export async function getDbTable(tableName: string, limit?: number, offset?: number) {
  const params = new URLSearchParams()
  if (limit != null) params.set("limit", String(limit))
  if (offset != null) params.set("offset", String(offset))
  return adminJson<{
    table: string
    schema: DbTableSchemaCol[]
    primary_key: string[]
    data: Record<string, unknown>[]
    pagination: { limit: number; offset: number; total: number }
  }>(`/api/admin/db/table/${encodeURIComponent(tableName)}?${params}`)
}
export async function getDbConnectionInfo() {
  return adminJson<{ connectionString: string }>("/api/admin/db/connection-info")
}
export async function postDbQuery(body: { query: string }) {
  return adminJson<{ rows: unknown[]; columns: { name: string }[] }>("/api/admin/db/query", { method: "POST", body: JSON.stringify(body) })
}
export async function postDbRow(tableName: string, row: Record<string, unknown>) {
  return adminJson<{ row: unknown }>(`/api/admin/db/table/${encodeURIComponent(tableName)}/row`, { method: "POST", body: JSON.stringify(row) })
}
export async function putDbRow(tableName: string, pk: Record<string, unknown>, row: Record<string, unknown>) {
  return adminJson<{ row: unknown }>(`/api/admin/db/table/${encodeURIComponent(tableName)}/row`, {
    method: "PUT",
    body: JSON.stringify({ pk, row }),
  })
}
export async function deleteDbRow(tableName: string, pk: Record<string, unknown>) {
  return adminJson<{ ok?: boolean }>(`/api/admin/db/table/${encodeURIComponent(tableName)}/row`, {
    method: "DELETE",
    body: JSON.stringify({ pk }),
  })
}

// Storage
export async function getStorageConnectionInfo() {
  return adminJson<Record<string, unknown>>("/api/storage/connection-info")
}
export async function getStorageList(prefix?: string) {
  const d = await adminJson<{
    prefixes: { prefix: string }[]
    objects: { key: string; size: number; lastModified?: string }[]
  }>(`/api/storage/list${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`)
  return {
    prefixes: (d.prefixes || []).map((p) => p.prefix).filter(Boolean),
    objects: d.objects || [],
  }
}
export function getStorageDownloadUrl(key: string) {
  return `${base()}/api/storage/download/${encodeURIComponent(key)}`
}
export async function getStorageInfo(key: string) {
  return adminJson<Record<string, unknown>>(`/api/storage/info/${encodeURIComponent(key)}`)
}
export async function deleteStorageObject(key: string) {
  return adminFetch(`/api/storage/object/${encodeURIComponent(key)}`, { method: "DELETE" })
}
/** Xóa toàn bộ object trong một prefix (folder). Prefix nên có dạng "path/to/folder/" */
export async function deleteStoragePrefix(prefix: string) {
  const normalized = prefix.endsWith("/") ? prefix : prefix + "/"
  return adminFetch(`/api/storage/prefix/${encodeURIComponent(normalized)}`, { method: "DELETE" })
}

/** Xóa nhiều object theo danh sách key. Trả về { deletedCount, totalCount } */
export async function deleteStorageBatch(keys: string[]) {
  return adminJson<{ deletedCount?: number; totalCount?: number; message?: string }>("/api/storage/delete-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  })
}

// Qdrant Vector Database (cùng instance trong dự án: docker-compose qdrant / localhost:6333)
export type QdrantHealth = {
  ok: boolean
  status: number
  url: string
  title: string | null
  version: string | null
  error?: string
}
export async function getQdrantHealth() {
  return adminJson<QdrantHealth>("/api/admin/qdrant/health")
}

export async function getQdrantCollections() {
  return adminJson<{ url: string; collections: string[] }>("/api/admin/qdrant/collections")
}

export type QdrantCollectionInfo = {
  name: string
  url: string
  status: string | null
  points_count: number
  vectors_count: number
  segments_count: number
  vector_size: number | null
  distance: string | null
}
export async function getQdrantCollection(name: string) {
  return adminJson<QdrantCollectionInfo>(`/api/admin/qdrant/collections/${encodeURIComponent(name)}`)
}

export type QdrantSearchPoint = {
  id: string | number
  score: number
  payload: Record<string, unknown>
}
export async function searchQdrantVectors(params: {
  collection: string
  keyword: string
  limit?: number
}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await adminFetch("/api/admin/qdrant/search", {
      method: "POST",
      body: JSON.stringify(params),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = data as { error?: string; message?: string }
      throw new Error(err.message || err.error || `HTTP ${res.status}`)
    }
    return data as { keyword: string; collection: string; points: QdrantSearchPoint[] }
  } catch (e: unknown) {
    clearTimeout(timeoutId)
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Tìm kiếm quá thời gian (timeout 30s). Thử lại hoặc kiểm tra kết nối.")
    }
    throw e
  }
}

export type QdrantScrollPoint = {
  id: string | number
  payload: Record<string, unknown>
}
export async function scrollQdrantCollection(
  collection: string,
  params?: { limit?: number; offset?: string | number | null }
) {
  return adminJson<{
    points: QdrantScrollPoint[]
    next_page_offset: string | number | null
  }>(`/api/admin/qdrant/collections/${encodeURIComponent(collection)}/scroll`, {
    method: "POST",
    body: JSON.stringify(params ?? {}),
  })
}
