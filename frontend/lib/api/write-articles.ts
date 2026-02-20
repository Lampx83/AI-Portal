/**
 * Write Articles API client – gọi backend Write (standalone hoặc mount tại /api/apps/write).
 * Gửi X-Guest-Id để backend chấp nhận khi chưa có session (fallback guest).
 */
import { API_CONFIG } from "@/lib/config"
import { getOrCreateGuestDeviceId } from "@/lib/guest-device-id"

const WRITE_ARTICLES_BASE =
  typeof API_CONFIG?.baseUrl === "string"
    ? `${API_CONFIG.baseUrl.replace(/\/+$/, "")}/api/apps/write/api/write-articles`
    : "/api/apps/write/api/write-articles"

function getUrl(path: string, search?: Record<string, string>): string {
  const base = WRITE_ARTICLES_BASE.replace(/\/+$/, "")
  const p = path.startsWith("/") ? path : `/${path}`
  const url = `${base}${p}`
  if (search && Object.keys(search).length > 0) {
    const q = new URLSearchParams(search).toString()
    return q ? `${url}?${q}` : url
  }
  return url
}

function getRequestHeaders(init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  }
  if (typeof window !== "undefined") {
    const guestId = getOrCreateGuestDeviceId()
    if (guestId && guestId !== "anonymous") headers["X-Guest-Id"] = guestId
  }
  return headers
}

async function request<T>(
  path: string,
  options: RequestInit & { search?: Record<string, string> } = {}
): Promise<T> {
  const { search, ...init } = options
  const url = getUrl(path, search)
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: getRequestHeaders(init),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string; message?: string })?.message ?? data?.error ?? `HTTP ${res.status}`)
  return data as T
}

// --- Types (khớp backend Write) ---

export type CitationReference = {
  type?: string
  author?: string
  title?: string
  year?: string
  journal?: string
  volume?: string
  pages?: string
  publisher?: string
  doi?: string
  url?: string
  booktitle?: string
}

export type WriteArticle = {
  id: string
  user_id: string
  project_id: string | null
  title: string
  content: string
  template_id: string | null
  references_json: CitationReference[] | string
  created_at: string
  updated_at: string
}

export type WriteArticleWithShare = WriteArticle & { share_token?: string | null }

export type WriteArticleComment = {
  id: string
  article_id: string
  user_id: string
  author_display: string | null
  content: string
  parent_id: string | null
  created_at: string
}

export type WriteArticleVersion = {
  id: string
  article_id: string
  title: string
  content: string
  references_json: unknown
  created_at: string
}

// --- API functions (khớp backend Write) ---

export async function getWriteArticles(projectId?: string | null): Promise<WriteArticle[]> {
  const search: Record<string, string> = { limit: "50", offset: "0" }
  if (projectId) search.project_id = projectId
  const data = await request<{ articles: WriteArticle[] }>("/", { method: "GET", search })
  return data.articles ?? []
}

export async function getWriteArticle(id: string): Promise<WriteArticleWithShare> {
  const data = await request<{ article: WriteArticleWithShare }>(`/${id}`, { method: "GET" })
  return data.article
}

export async function createWriteArticle(body: {
  title?: string
  content?: string
  template_id?: string | null
  project_id?: string | null
  references?: CitationReference[]
  references_json?: CitationReference[]
}): Promise<WriteArticleWithShare> {
  const payload = {
    title: body.title ?? "Tài liệu chưa có tiêu đề",
    content: body.content ?? "",
    template_id: body.template_id ?? null,
    project_id: body.project_id ?? null,
    references_json: body.references_json ?? body.references ?? [],
  }
  const data = await request<{ article: WriteArticleWithShare }>("/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return data.article
}

export async function updateWriteArticle(
  id: string,
  body: { title?: string; content?: string; template_id?: string | null; references?: CitationReference[]; references_json?: CitationReference[] }
): Promise<WriteArticleWithShare> {
  const payload: Record<string, unknown> = {}
  if (body.title !== undefined) payload.title = body.title
  if (body.content !== undefined) payload.content = body.content
  if (body.template_id !== undefined) payload.template_id = body.template_id
  if (body.references_json !== undefined) payload.references_json = body.references_json
  if (body.references !== undefined) payload.references_json = body.references
  const data = await request<{ article: WriteArticleWithShare }>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return data.article
}

export async function updateWriteArticleByShareToken(
  token: string,
  body: { title?: string; content?: string; template_id?: string | null; references?: CitationReference[]; references_json?: CitationReference[] }
): Promise<WriteArticleWithShare> {
  const payload: Record<string, unknown> = {}
  if (body.title !== undefined) payload.title = body.title
  if (body.content !== undefined) payload.content = body.content
  if (body.template_id !== undefined) payload.template_id = body.template_id
  if (body.references_json !== undefined) payload.references_json = body.references_json
  if (body.references !== undefined) payload.references_json = body.references
  const data = await request<{ article: WriteArticleWithShare }>(`/shared/${encodeURIComponent(token)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return data.article
}

export async function deleteWriteArticle(id: string): Promise<void> {
  await request(`/${id}`, { method: "DELETE" })
}

export async function getWriteArticleByShareToken(token: string): Promise<WriteArticleWithShare> {
  const data = await request<{ article: WriteArticleWithShare }>(`/shared/${encodeURIComponent(token)}`, { method: "GET" })
  return data.article
}

export async function createShareLink(articleId: string): Promise<{ share_token: string; share_url?: string }> {
  const data = await request<{ share_token: string; share_url?: string }>(`/${articleId}/share`, { method: "POST" })
  return data
}

export async function revokeShareLink(articleId: string): Promise<void> {
  await request(`/${articleId}/share`, { method: "DELETE" })
}

export async function getWriteArticleComments(articleId: string): Promise<WriteArticleComment[]> {
  const data = await request<{ comments: WriteArticleComment[] }>(`/${articleId}/comments`, { method: "GET" })
  return data.comments ?? []
}

export async function createWriteArticleComment(
  articleId: string,
  body: { content: string; parent_id?: string | null; id?: string }
): Promise<WriteArticleComment> {
  const data = await request<{ comment: WriteArticleComment }>(`/${articleId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content: body.content, parent_id: body.parent_id ?? null, id: body.id ?? undefined }),
  })
  return data.comment
}

export async function deleteWriteArticleComment(articleId: string, commentId: string): Promise<void> {
  await request(`/${articleId}/comments/${commentId}`, { method: "DELETE" })
}

export async function getArticleVersions(articleId: string, limit = 50): Promise<WriteArticleVersion[]> {
  const data = await request<{ versions: WriteArticleVersion[] }>(`/${articleId}/versions`, {
    method: "GET",
    search: { limit: String(limit) },
  })
  return data.versions ?? []
}

export async function restoreArticleVersion(articleId: string, versionId: string): Promise<WriteArticleWithShare> {
  const data = await request<{ article: WriteArticleWithShare }>(`/${articleId}/versions/${versionId}/restore`, {
    method: "POST",
  })
  return data.article
}

export async function deleteArticleVersion(articleId: string, versionId: string): Promise<void> {
  await request(`/${articleId}/versions/${versionId}`, { method: "DELETE" })
}

export async function clearArticleVersionsExceptLatest(articleId: string): Promise<void> {
  await request(`/${articleId}/versions/clear`, { method: "POST" })
}
