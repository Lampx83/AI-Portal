// API Công bố của tôi (gọi backend, dùng session cookie)
import { API_CONFIG } from "@/lib/config"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")

export type PublicationType = "journal" | "conference" | "book" | "thesis"
export type PublicationStatus = "published" | "accepted" | "submitted" | "draft"

export type Publication = {
  id: string
  user_id: string
  title: string
  authors: string[]
  journal: string | null
  year: number | null
  type: PublicationType
  status: PublicationStatus
  doi: string | null
  abstract: string | null
  file_keys: string[]
  created_at: string
  updated_at: string
}

export async function getPublications(): Promise<Publication[]> {
  const res = await fetch(`${base()}/api/users/publications`, { credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  const list = (data as { publications?: Publication[] }).publications ?? []
  return list.map(normalizePublication)
}

function normalizePublication(row: Record<string, unknown>): Publication {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    authors: Array.isArray(row.authors) ? row.authors.map(String) : [],
    journal: row.journal != null ? String(row.journal) : null,
    year: row.year != null ? Number(row.year) : null,
    type: (["journal", "conference", "book", "thesis"].includes(String(row.type)) ? row.type : "journal") as PublicationType,
    status: (["published", "accepted", "submitted", "draft"].includes(String(row.status)) ? row.status : "draft") as PublicationStatus,
    doi: row.doi != null ? String(row.doi) : null,
    abstract: row.abstract != null ? String(row.abstract) : null,
    file_keys: Array.isArray(row.file_keys) ? row.file_keys.map(String) : [],
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }
}

export async function postPublication(body: {
  title: string
  authors?: string[]
  journal?: string | null
  year?: number | null
  type?: PublicationType
  status?: PublicationStatus
  doi?: string | null
  abstract?: string | null
  file_keys?: string[]
}): Promise<Publication> {
  const res = await fetch(`${base()}/api/users/publications`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return normalizePublication((data as { publication: Record<string, unknown> }).publication)
}

export async function patchPublication(id: string, body: {
  title?: string
  authors?: string[]
  journal?: string | null
  year?: number | null
  type?: PublicationType
  status?: PublicationStatus
  doi?: string | null
  abstract?: string | null
  file_keys?: string[]
}): Promise<Publication> {
  const res = await fetch(`${base()}/api/users/publications/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return normalizePublication((data as { publication: Record<string, unknown> }).publication)
}

export async function deletePublication(id: string): Promise<void> {
  const res = await fetch(`${base()}/api/users/publications/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
}

export async function uploadPublicationFiles(files: File[]): Promise<string[]> {
  if (files.length === 0) return []
  const form = new FormData()
  files.forEach((f) => form.append("files", f))
  const res = await fetch(`${base()}/api/users/publications/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
  return (data as { keys: string[] }).keys ?? []
}

export function getPublicationFileUrl(key: string): string {
  return `${base()}/api/users/publications/files/${encodeURIComponent(key)}`
}

export type SyncGoogleScholarResult = {
  imported: number
  skipped: number
  total_fetched: number
  message: string
}

export async function syncFromGoogleScholar(url?: string): Promise<SyncGoogleScholarResult> {
  const res = await fetch(`${base()}/api/users/publications/sync-google-scholar`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(url?.trim() ? { url: url.trim() } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message || (data as { error?: string }).error || `HTTP ${res.status}`)
  return {
    imported: (data as { imported?: number }).imported ?? 0,
    skipped: (data as { skipped?: number }).skipped ?? 0,
    total_fetched: (data as { total_fetched?: number }).total_fetched ?? 0,
    message: (data as { message?: string }).message ?? "",
  }
}
