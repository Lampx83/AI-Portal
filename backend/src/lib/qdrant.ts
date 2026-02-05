/**
 * Qdrant vector database client (REST API).
 * Server: NCT-224 (Public: 101.96.66.224, Private: 10.2.13.55), port 6333.
 */

const QDRANT_URL = (process.env.QDRANT_URL || "http://101.96.66.224:6333").replace(/\/+$/, "")

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
  return result.map((r) => ({
    id: r.id,
    score: r.score ?? 0,
    payload: r.payload ?? {},
  }))
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
