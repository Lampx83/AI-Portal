/**
 * Qdrant vector database client (REST API).
 * Mặc định dùng Qdrant trong dự án (docker-compose: qdrant, local: localhost:6333).
 */

const QDRANT_URL = (process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "")

export type QdrantSearchResult = {
  id: string | number
  score: number
  payload: Record<string, unknown>
}

/**
 * Tìm kiếm points trong collection theo vector.
 * POST /collections/{collection}/points/search
 */
export async function searchPoints(
  collection: string,
  vector: number[],
  options: { limit?: number; withPayload?: boolean; scoreThreshold?: number } = {}
): Promise<QdrantSearchResult[]> {
  const limit = Math.min(options.limit ?? 5, 20)
  const url = `${QDRANT_URL}/collections/${encodeURIComponent(collection)}/points/search`
  const body: Record<string, unknown> = {
    vector,
    limit,
    with_payload: options.withPayload !== false,
  }
  if (options.scoreThreshold != null) body.score_threshold = options.scoreThreshold

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Qdrant search failed: ${res.status} ${errText}`)
  }

  const data = (await res.json()) as { result?: Array<{ id: unknown; score?: number; payload?: Record<string, unknown> }> }
  const result = data?.result ?? []
  return result.map((r): QdrantSearchResult => ({
    id: typeof r.id === "string" || typeof r.id === "number" ? r.id : String(r.id),
    score: r.score ?? 0,
    payload: r.payload ?? {},
  }))
}

export type QdrantScrollResult = {
  points: Array<{ id: string | number; payload: Record<string, unknown> }>
  next_page_offset: string | number | null
}

/**
 * Scroll (duyệt) points trong collection, có phân trang.
 * POST /collections/{collection}/points/scroll
 */
export async function scrollPoints(
  collection: string,
  options: { limit?: number; offset?: string | number | null } = {}
): Promise<QdrantScrollResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
  const url = `${QDRANT_URL}/collections/${encodeURIComponent(collection)}/points/scroll`
  const body: Record<string, unknown> = {
    limit,
    with_payload: true,
    with_vector: false,
  }
  if (options.offset != null) body.offset = options.offset

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Qdrant scroll failed: ${res.status} ${errText}`)
  }

  const data = (await res.json()) as {
    result?: { points?: Array<{ id?: unknown; payload?: Record<string, unknown> }>; next_page_offset?: string | number | null }
  }
  const result = data?.result ?? {}
  const points = (result.points ?? []).map((p) => ({
    id: typeof p.id === "string" || typeof p.id === "number" ? p.id : String(p.id),
    payload: p.payload ?? {},
  }))
  return {
    points,
    next_page_offset: result.next_page_offset ?? null,
  }
}

/**
 * Lấy text từ payload của point (hỗ trợ các key phổ biến: text, content, body).
 */
export function getTextFromPayload(payload: Record<string, unknown>): string {
  const keys = ["text", "content", "body", "paragraph", "chunk"]
  for (const k of keys) {
    const v = payload[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  // Fallback: nếu payload có một trường string duy nhất
  for (const v of Object.values(payload)) {
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return JSON.stringify(payload)
}
