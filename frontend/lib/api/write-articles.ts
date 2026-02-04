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
  const res = await fetch(url, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return ((data as { articles?: WriteArticle[] }).articles ?? []).map(normalize)
}

export type WriteArticleWithShare = WriteArticle & { share_token?: string | null }

export async function getWriteArticle(id: string): Promise<WriteArticleWithShare> {
  const res = await fetch(`${base()}/api/write-articles/${id}`, { credentials: "include" })
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
