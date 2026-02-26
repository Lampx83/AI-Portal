/** Admin API client. Uses credentials: 'include' for admin_secret cookie. */
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
    const err = data as { error?: string; message?: string; errorCode?: string }
    const ex = new Error(err.message || err.error || `HTTP ${res.status}`) as Error & { body?: typeof data }
    ex.body = data
    throw ex
  }
  return data as T
}

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

/** Messages per day (last 30 days; query ?days=7..90). */
export async function getMessagesPerDay(days?: number) {
  const q = days != null ? `?days=${days}` : ""
  return adminJson<{ data: { day: string; count: number }[] }>(`/api/admin/stats/messages-per-day${q}`)
}

/** Logins per day (query ?days=7..90). */
export async function getLoginsPerDay(days?: number) {
  const q = days != null ? `?days=${days}` : ""
  return adminJson<{ data: { day: string; count: number }[] }>(`/api/admin/stats/logins-per-day${q}`)
}

/** Messages by source (web / embed). */
export async function getMessagesBySource() {
  return adminJson<{ data: { source: string; count: number }[] }>("/api/admin/stats/messages-by-source")
}

/** Messages by agent (assistant_alias). */
export async function getMessagesByAgent() {
  return adminJson<{ data: { assistant_alias: string; count: number }[] }>("/api/admin/stats/messages-by-agent")
}

/** Online users (active in last 15 min). */
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

/** Runtime config (guest limits, default locale, features). */
export type AppSettings = {
  guest_daily_message_limit: number
  default_locale: string
  plugin_qdrant_enabled?: boolean
  qdrant_url?: string
  projects_enabled?: boolean
}
export async function getAppSettings() {
  return adminJson<AppSettings>("/api/admin/app-settings")
}
export async function patchAppSettings(body: {
  guest_daily_message_limit?: number
  default_locale?: string
  plugin_qdrant_enabled?: boolean
  qdrant_url?: string
  projects_enabled?: boolean
}) {
  return adminJson<AppSettings>("/api/admin/app-settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

/** Central agent config: provider + API key (masked) */
export type CentralLlmProvider = "openai" | "gemini" | "anthropic" | "openai_compatible" | "skip"
export type CentralAgentConfig = {
  provider: CentralLlmProvider
  model: string
  apiKeyMasked: string
  baseUrl: string
}
export async function getCentralAgentConfig() {
  return adminJson<CentralAgentConfig>("/api/admin/central-agent-config")
}
export async function patchCentralAgentConfig(body: {
  provider?: CentralLlmProvider
  model?: string
  api_key?: string
  base_url?: string
}) {
  return adminJson<CentralAgentConfig>("/api/admin/central-agent-config", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deleteUser(id: string) {
  return adminJson<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" })
}

// Projects
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
  name?: string
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

/** Export agents list as JSON (response for download) */
export async function exportAgentsFetch() {
  return adminFetch("/api/admin/agents/export")
}

/** Import agents from JSON (body: { agents: [...] }) */
export async function importAgents(body: { agents: unknown[] }) {
  return adminJson<{ success: boolean; message: string; total: number }>("/api/admin/agents/import", {
    method: "POST",
    body: JSON.stringify(body),
  })
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
export async function deleteAgentPermanent(id: string) {
  return adminJson<{ message: string }>(`/api/admin/agents/${id}/permanent`, { method: "DELETE" })
}

// Apps (tools): data — separate from agents
export type ToolRow = {
  id: string
  alias: string
  name?: string
  icon: string
  is_active: boolean
  display_order: number
  config_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
  daily_message_limit?: number
}
export async function getTools() {
  return adminJson<{ tools: ToolRow[] }>("/api/admin/tools")
}
export async function getTool(id: string) {
  return adminJson<{ tool: ToolRow }>(`/api/admin/tools/${id}`)
}
export async function patchTool(id: string, body: Partial<ToolRow>) {
  return adminJson<{ tool: ToolRow }>(`/api/admin/tools/${id}`, { method: "PATCH", body: JSON.stringify(body) })
}
export async function deleteTool(id: string) {
  return adminJson<{ success: boolean; message?: string }>(`/api/admin/tools/${id}`, { method: "DELETE" })
}
export async function postTool(body: { alias: string; icon?: string; is_active?: boolean; display_order?: number; config_json?: Record<string, unknown> }) {
  return adminJson<{ tool: ToolRow }>("/api/admin/tools", { method: "POST", body: JSON.stringify(body) })
}

export type AppCatalogItem = {
  id: string
  alias: string
  name: string
  description?: string
  version?: string
  type?: string
  icon?: string
}
export async function getAppCatalog() {
  return adminJson<{ catalog: AppCatalogItem[] }>("/api/admin/tools/catalog")
}
export async function postInstallFromCatalog(body: { catalogId: string }) {
  return adminJson<{ tool: ToolRow; installed: boolean }>("/api/admin/tools/install-from-catalog", {
    method: "POST",
    body: JSON.stringify(body),
  })
}
export type InstallProgress = { step: string; message: string; status?: "running" | "done" }

export async function postInstallPackage(formData: FormData) {
  return postInstallPackageStream(formData, () => {})
}

export async function postInstallPackageStream(
  formData: FormData,
  onProgress: (p: InstallProgress) => void
): Promise<{ tool: ToolRow; installed: boolean }> {
  const url = `${base()}/api/admin/tools/install-package`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300_000) // 5 minutes
  try {
    const headers: Record<string, string> = { "X-Stream-Progress": "1" }
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const ct = res.headers.get("content-type") || ""
    if (ct.includes("application/x-ndjson") && res.body) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const obj = JSON.parse(line) as { type: string; step?: string; message?: string; status?: "running" | "done"; tool?: ToolRow; installed?: boolean; error?: string }
            if (obj.type === "progress" && obj.step && obj.message) {
              onProgress({ step: obj.step, message: obj.message, status: obj.status })
            } else if (obj.type === "done" && obj.tool) {
              return { tool: obj.tool, installed: obj.installed ?? true }
            } else if (obj.type === "error") {
              throw new Error(obj.error || "Lỗi cài đặt gói")
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }
      throw new Error("Không nhận được phản hồi hoàn chỉnh từ server")
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
    return data as { tool: ToolRow; installed: boolean }
  } catch (e) {
    clearTimeout(timeoutId)
    if ((e as Error)?.name === "AbortError") {
      throw new Error("Cài đặt quá thời gian (5 phút). Thử lại hoặc chạy npm install thủ công trong thư mục ứng dụng.")
    }
    throw e
  }
}

// Admin chat sessions (anonymous user display)
export type AdminChatSession = {
  id: string
  title: string | null
  assistant_alias: string
  /** Session source: 'web' | 'embed' */
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

// Feedback
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

// Test single agent (metadata, data, ask)
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

// Sample files for agent test (ask with file)
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
/** Delete all objects under a prefix (folder). Prefix should be "path/to/folder/" */
export async function deleteStoragePrefix(prefix: string) {
  const normalized = prefix.endsWith("/") ? prefix : prefix + "/"
  return adminFetch(`/api/storage/prefix/${encodeURIComponent(normalized)}`, { method: "DELETE" })
}

/** Delete multiple objects by key list. Returns { deletedCount, totalCount } */
export async function deleteStorageBatch(keys: string[]) {
  return adminJson<{ deletedCount?: number; totalCount?: number; message?: string }>("/api/storage/delete-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  })
}

// Qdrant vector DB
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

export type ConfigSection = {
  titleKey: string
  descriptionKey?: string
  items: Array<{
    key: string
    keyLabel?: string
    value: string
    valueKey?: string
    descriptionKey: string
    secret?: boolean
  }>
}

// Plugins (install agents from admin)
export type PluginAvailable = {
  id: string
  name: string
  description: string
  mountPath: string
  assistantAlias: string
}
export async function getPluginsAvailable() {
  return adminJson<{ plugins: PluginAvailable[] }>("/api/admin/plugins/available")
}
export async function getPluginsInstalled() {
  return adminJson<{ installed: string[]; mounted: string[] }>("/api/admin/plugins/installed")
}
export async function installPlugin(agentId: string) {
  return adminJson<{ success: boolean; message: string; installed?: boolean; mounted?: boolean }>(
    "/api/admin/plugins/install",
    { method: "POST", body: JSON.stringify({ agentId }) }
  )
}

export async function getAdminConfig() {
  return adminJson<{ sections: ConfigSection[] }>("/api/admin/config")
}

/** Save runtime config (stored in app_settings, loaded into env on next request). */
export async function patchAdminConfig(updates: Record<string, string>) {
  return adminJson<{ ok: boolean }>("/api/admin/config", {
    method: "POST",
    body: JSON.stringify({ updates }),
  })
}

// Site strings (per-locale, stored in DB)
export type SiteStringsMap = Record<string, Record<string, string>>

export async function getAdminSiteStrings() {
  return adminJson<{ strings: SiteStringsMap }>("/api/admin/site-strings")
}

export async function patchAdminSiteStrings(body: { strings: SiteStringsMap }) {
  return adminJson<{ strings: SiteStringsMap }>("/api/admin/site-strings", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

/** Download locale template JSON (all keys, English values) for new language package */
export async function getLocalePackageTemplate(): Promise<{ locale: string; name: string; strings: Record<string, string> }> {
  const res = await adminFetch("/api/admin/locale-packages/template")
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/** Upload a language package (locale code + strings). */
export async function postLocalePackage(body: { locale: string; name?: string; strings: Record<string, string> }) {
  return adminJson<{ ok: boolean; locale: string; name: string; inserted: number }>("/api/admin/locale-packages", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/** Branding (system name editable, database name read-only, system subtitle and theme color configurable) */
export type SettingsBranding = {
  systemName: string
  logoDataUrl?: string
  systemSubtitle?: string
  themeColor?: string
  databaseName: string
  hideNewChatOnAdmin?: boolean
  hideAppsAllOnAdmin?: boolean
  hideAssistantsAllOnAdmin?: boolean
  hideMenuProfile?: boolean
  hideMenuNotifications?: boolean
  hideMenuSettings?: boolean
  hideMenuAdmin?: boolean
  hideMenuDevDocs?: boolean
}
export async function getSettingsBranding() {
  return adminJson<SettingsBranding>("/api/admin/settings/branding")
}
export async function patchSettingsBranding(body: {
  system_name: string
  logo_data_url?: string
  system_subtitle?: string
  theme_color?: string
  hide_new_chat_on_admin?: boolean
  hide_apps_all_on_admin?: boolean
  hide_assistants_all_on_admin?: boolean
  hide_menu_profile?: boolean
  hide_menu_notifications?: boolean
  hide_menu_settings?: boolean
  hide_menu_admin?: boolean
  hide_menu_dev_docs?: boolean
}) {
  return adminJson<{
    ok: boolean
    systemName: string
    logoDataUrl?: string
    systemSubtitle?: string
    themeColor?: string
    hideNewChatOnAdmin?: boolean
    hideAppsAllOnAdmin?: boolean
    hideAssistantsAllOnAdmin?: boolean
    hideMenuProfile?: boolean
    hideMenuNotifications?: boolean
    hideMenuSettings?: boolean
    hideMenuAdmin?: boolean
    hideMenuDevDocs?: boolean
  }>("/api/admin/settings/branding", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

/** Switch to another database. After success, redirect to /setup if the new DB does not exist or is not initialized. */
export async function postSwitchDatabase(databaseName: string) {
  return adminJson<{ ok: boolean; databaseName: string }>("/api/admin/settings/switch-database", {
    method: "POST",
    body: JSON.stringify({ databaseName: databaseName.trim().toLowerCase() }),
  })
}

/** SSO config (which providers are configured) */
export type SettingsSso = {
  google: { clientId: string; clientSecretSet: boolean; configured: boolean }
  azure: { clientId: string; tenantId: string; clientSecretSet: boolean; configured: boolean }
}
export async function getSettingsSso() {
  return adminJson<SettingsSso>("/api/admin/settings/sso")
}

/** Page content (Welcome, Guide) - editable in Admin → Pages. Title mặc định = tên hệ thống, subtitle mặc định = tiêu đề phụ. */
export type WelcomePageConfig = { title?: string; subtitle?: string; cards?: { title: string; description: string }[] }
export type GuidePageConfig = { title?: string; subtitle?: string; cards?: { title: string; description: string }[] }

export async function getWelcomePageConfig() {
  return adminJson<WelcomePageConfig>("/api/admin/pages/welcome")
}
export async function patchWelcomePageConfig(body: WelcomePageConfig) {
  return adminJson<WelcomePageConfig>("/api/admin/pages/welcome", { method: "PATCH", body: JSON.stringify(body) })
}
export async function getGuidePageConfig() {
  return adminJson<GuidePageConfig>("/api/admin/pages/guide")
}
export async function patchGuidePageConfig(body: GuidePageConfig) {
  return adminJson<GuidePageConfig>("/api/admin/pages/guide", { method: "PATCH", body: JSON.stringify(body) })
}

/** Full DB reset: drop ai_portal schema and re-run schema.sql. Requires confirm: "RESET". */
export async function resetDatabase(confirm: string) {
  return adminJson<{ ok: boolean; message?: string; messageKey?: string }>("/api/admin/settings/reset-database", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  })
}

/** Download system backup (database + MinIO + setup data) as .zip. Requires admin. */
export async function getBackupBlob(): Promise<Blob> {
  const res = await fetch(`${base()}/api/admin/backup/create`, { credentials: "include" })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error((data as { message?: string }).message || (data as { error?: string }).error || `HTTP ${res.status}`) as Error & { body?: unknown }
    err.body = data
    throw err
  }
  return res.blob()
}

/** Restore system from backup .zip (FormData with field "file"). Requires admin. */
export async function postRestoreBackup(formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${base()}/api/admin/backup/restore`, {
    method: "POST",
    credentials: "include",
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message || (data as { error?: string }).error || `HTTP ${res.status}`) as Error & { body?: unknown }
    err.body = data
    throw err
  }
  return data as { ok: boolean; message?: string }
}
