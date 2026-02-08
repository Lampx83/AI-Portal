// API bài viết trợ lý Viết – gọi backend, dùng session cookie
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export type CitationReference = {
  id?: string
  type: string
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
  edition?: string
  [key: string]: string | undefined
}

export type WriteArticle = {
  id: string
  user_id: string
  research_id?: string | null
  title: string
  content: string
  template_id: string | null
  references?: CitationReference[]
  created_at: string
  updated_at: string
}

export async function getWriteArticles(researchId?: string | null): Promise<WriteArticle[]> {
  const url = researchId
    ? `${base()}/api/write-articles?research_id=${encodeURIComponent(researchId)}`
    : `${base()}/api/write-articles`
  const res = await fetch(url, { credentials: "include", cache: "no-store" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return ((data as { articles?: WriteArticle[] }).articles ?? []).map(normalize)
}

export type WriteArticleWithShare = WriteArticle & { share_token?: string | null }

export async function getWriteArticle(id: string): Promise<WriteArticleWithShare> {
  const res = await fetch(`${base()}/api/write-articles/${id}`, { credentials: "include", cache: "no-store" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return normalizeWithShare((data as { article: Record<string, unknown> }).article)
}

export async function getWriteArticleByShareToken(token: string): Promise<WriteArticleWithShare> {
  const res = await fetch(`${base()}/api/write-articles/shared/${encodeURIComponent(token)}`, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return normalizeWithShare((data as { article: Record<string, unknown> }).article)
}

export async function updateWriteArticleByShareToken(
  token: string,
  body: { title?: string; content?: string; template_id?: string | null; references?: CitationReference[] }
): Promise<WriteArticle> {
  const res = await fetch(`${base()}/api/write-articles/shared/${encodeURIComponent(token)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return normalize((data as { article: WriteArticle }).article)
}

export async function createShareLink(articleId: string): Promise<{ share_token: string; share_url: string }> {
  const res = await fetch(`${base()}/api/write-articles/${articleId}/share`, {
    method: "POST",
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return data as { share_token: string; share_url: string }
}

export async function revokeShareLink(articleId: string): Promise<void> {
  const res = await fetch(`${base()}/api/write-articles/${articleId}/share`, {
    method: "DELETE",
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
}

export async function createWriteArticle(body: {
  title?: string
  content?: string
  template_id?: string | null
  references?: CitationReference[]
  research_id?: string | null
}): Promise<WriteArticle> {
  const res = await fetch(`${base()}/api/write-articles`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return normalize((data as { article: WriteArticle }).article)
}

export async function updateWriteArticle(
  id: string,
  body: { title?: string; content?: string; template_id?: string | null; references?: CitationReference[] }
): Promise<WriteArticle> {
  const res = await fetch(`${base()}/api/write-articles/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return normalize((data as { article: WriteArticle }).article)
}

export async function deleteWriteArticle(id: string): Promise<void> {
  const res = await fetch(`${base()}/api/write-articles/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
}

// Phiên bản bài viết (lịch sử chỉnh sửa)
export type WriteArticleVersion = {
  id: string
  article_id: string
  title: string
  content: string
  references_json: CitationReference[] | string
  created_at: string
}

export async function getArticleVersions(articleId: string, limit = 50): Promise<WriteArticleVersion[]> {
  const res = await fetch(
    `${base()}/api/write-articles/${articleId}/versions?limit=${Math.min(limit, 100)}`,
    { credentials: "include" }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  const list = (data as { versions?: WriteArticleVersion[] }).versions ?? []
  return list.map((v) => ({
    ...v,
    id: String(v.id),
    article_id: String(v.article_id),
    title: String(v.title ?? ""),
    content: String(v.content ?? ""),
    references_json: v.references_json ?? [],
    created_at: String(v.created_at ?? ""),
  }))
}

export async function getArticleVersion(articleId: string, versionId: string): Promise<WriteArticleVersion> {
  const res = await fetch(
    `${base()}/api/write-articles/${articleId}/versions/${versionId}`,
    { credentials: "include" }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  const v = (data as { version: WriteArticleVersion }).version
  return {
    ...v,
    id: String(v.id),
    article_id: String(v.article_id),
    title: String(v.title ?? ""),
    content: String(v.content ?? ""),
    references_json: v.references_json ?? [],
    created_at: String(v.created_at ?? ""),
  }
}

export async function restoreArticleVersion(articleId: string, versionId: string): Promise<WriteArticle> {
  const res = await fetch(
    `${base()}/api/write-articles/${articleId}/versions/${versionId}/restore`,
    { method: "POST", credentials: "include" }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return normalize((data as { article: WriteArticle }).article)
}

export async function deleteArticleVersion(articleId: string, versionId: string): Promise<void> {
  const res = await fetch(
    `${base()}/api/write-articles/${articleId}/versions/${versionId}`,
    { method: "DELETE", credentials: "include" }
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
}

export async function clearArticleVersionsExceptLatest(articleId: string): Promise<void> {
  const res = await fetch(
    `${base()}/api/write-articles/${articleId}/versions/clear`,
    { method: "POST", credentials: "include" }
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
}

export type WriteArticleComment = {
  id: string
  article_id: string
  user_id: string
  author_display: string
  content: string
  parent_id: string | null
  created_at: string
}

export async function getWriteArticleComments(articleId: string): Promise<WriteArticleComment[]> {
  const res = await fetch(`${base()}/api/write-articles/${articleId}/comments`, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return ((data as { comments?: WriteArticleComment[] }).comments ?? []).map((c) => ({
    ...c,
    id: String(c.id),
    article_id: String(c.article_id),
    user_id: String(c.user_id),
    author_display: String(c.author_display ?? ""),
    content: String(c.content ?? ""),
    parent_id: c.parent_id != null ? String(c.parent_id) : null,
    created_at: String(c.created_at ?? ""),
  }))
}

export async function createWriteArticleComment(
  articleId: string,
  body: { content: string; id?: string; parent_id?: string | null }
): Promise<WriteArticleComment> {
  const res = await fetch(`${base()}/api/write-articles/${articleId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  const c = (data as { comment: WriteArticleComment }).comment
  return {
    ...c,
    id: String(c.id),
    article_id: String(c.article_id),
    user_id: String(c.user_id),
    author_display: String(c.author_display ?? ""),
    content: String(c.content ?? ""),
    parent_id: c.parent_id != null ? String(c.parent_id) : null,
    created_at: String(c.created_at ?? ""),
  }
}

export async function deleteWriteArticleComment(articleId: string, commentId: string): Promise<void> {
  const res = await fetch(`${base()}/api/write-articles/${articleId}/comments/${commentId}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
}

function normalize(row: Record<string, unknown>): WriteArticle {
  const r = normalizeWithShare(row)
  const { share_token: _, ...rest } = r
  return rest as WriteArticle
}

function normalizeWithShare(row: Record<string, unknown>): WriteArticleWithShare {
  const refs = row.references_json ?? row.references
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    research_id: row.research_id != null ? String(row.research_id) : null,
    title: String(row.title ?? "Tài liệu chưa có tiêu đề"),
    content: String(row.content ?? ""),
    template_id: row.template_id != null ? String(row.template_id) : null,
    references: Array.isArray(refs) ? (refs as CitationReference[]) : [],
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    share_token: row.share_token != null ? String(row.share_token) : null,
  }
}
