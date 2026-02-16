import { Router, Request, Response } from "express"
import OpenAI from "openai"
import { getRegulationsEmbeddingUrl, getQdrantUrl } from "../../lib/config"
import { getOpenAIApiKey } from "../../lib/central-agent-config"
import { getSetting } from "../../lib/settings"
import { searchPoints, scrollPoints } from "../../lib/qdrant"
import { adminOnly } from "./middleware"

const getEmbeddingModel = () => getSetting("REGULATIONS_EMBEDDING_MODEL", "text-embedding-3-small")

function requireQdrantPlugin(_req: Request, res: Response): string | null {
  const url = getQdrantUrl()
  if (!url) {
    res
      .status(400)
      .json({
        error:
          "Plugin Qdrant chưa bật. Vào Settings → Plugin Qdrant, bật plugin và nhập địa chỉ Qdrant.",
      })
    return null
  }
  return url
}

const router = Router()

router.get("/health", adminOnly, async (req: Request, res: Response) => {
  const QDRANT_ADMIN_URL = requireQdrantPlugin(req, res)
  if (!QDRANT_ADMIN_URL) return
  try {
    const r = await fetch(`${QDRANT_ADMIN_URL}/`, { method: "GET" })
    const ok = r.ok
    const data = await r.json().catch(() => ({}))
    res.json({
      ok,
      status: r.status,
      url: QDRANT_ADMIN_URL,
      title: (data as { title?: string }).title ?? null,
      version: (data as { version?: string }).version ?? null,
    })
  } catch (err: any) {
    res.status(502).json({
      ok: false,
      url: QDRANT_ADMIN_URL,
      error: err?.message ?? "Không kết nối được Qdrant",
    })
  }
})

router.get("/collections", adminOnly, async (req: Request, res: Response) => {
  const QDRANT_ADMIN_URL = requireQdrantPlugin(req, res)
  if (!QDRANT_ADMIN_URL) return
  try {
    const r = await fetch(`${QDRANT_ADMIN_URL}/collections`, { method: "GET" })
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Qdrant: ${errText}` })
    }
    const data = (await r.json()) as { result?: { collections?: Array<{ name: string }> } }
    const collections = data?.result?.collections ?? []
    res.json({ url: QDRANT_ADMIN_URL, collections: collections.map((c) => c.name) })
  } catch (err: any) {
    res.status(502).json({
      url: QDRANT_ADMIN_URL,
      error: err?.message ?? "Không kết nối được Qdrant",
      collections: [],
    })
  }
})

router.get("/collections/:name", adminOnly, async (req: Request, res: Response) => {
  const QDRANT_ADMIN_URL = requireQdrantPlugin(req, res)
  if (!QDRANT_ADMIN_URL) return
  try {
    const name = String(req.params.name ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
    if (!name) return res.status(400).json({ error: "Tên collection không hợp lệ" })
    const r = await fetch(`${QDRANT_ADMIN_URL}/collections/${encodeURIComponent(name)}`, {
      method: "GET",
    })
    if (!r.ok) {
      if (r.status === 404) return res.status(404).json({ error: "Collection không tồn tại" })
      const errText = await r.text()
      return res.status(r.status).json({ error: errText })
    }
    const data = (await r.json()) as {
      result?: {
        status?: string
        vectors_count?: number
        points_count?: number
        segments_count?: number
        config?: {
          params?: { vectors?: { size?: number; distance?: string } }
        }
      }
    }
    const result = data?.result ?? {}
    res.json({
      name,
      url: QDRANT_ADMIN_URL,
      status: result.status ?? null,
      points_count: result.points_count ?? 0,
      vectors_count: result.vectors_count ?? 0,
      segments_count: result.segments_count ?? 0,
      vector_size: result.config?.params?.vectors?.size ?? null,
      distance: result.config?.params?.vectors?.distance ?? null,
    })
  } catch (err: any) {
    res.status(502).json({
      error: err?.message ?? "Không kết nối được Qdrant",
    })
  }
})

router.post("/search", adminOnly, async (req: Request, res: Response) => {
  if (!requireQdrantPlugin(req, res)) return
  try {
    const { collection, keyword, limit } = req.body ?? {}
    const col = typeof collection === "string" ? collection.trim() : ""
    const kw = typeof keyword === "string" ? keyword.trim() : ""
    if (!col || !kw) {
      return res.status(400).json({ error: "collection và keyword là bắt buộc" })
    }
    const embeddingUrl = getRegulationsEmbeddingUrl()
    const useLakeFlowEmbed = embeddingUrl.startsWith("http")
    const apiKey = useLakeFlowEmbed ? null : await getOpenAIApiKey()
    if (!apiKey && !useLakeFlowEmbed) {
      return res
        .status(500)
        .json({
          error:
            "Cấu hình OPENAI_API_KEY tại Admin → Central (Trợ lý chính), hoặc set REGULATIONS_EMBEDDING_URL.",
        })
    }

    const EMBED_TIMEOUT_MS = 25000
    const ac = new AbortController()
    const timeoutId = setTimeout(() => ac.abort(), EMBED_TIMEOUT_MS)

    let vector: number[]
    try {
      if (useLakeFlowEmbed) {
        const embedRes = await fetch(embeddingUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: kw }),
          signal: ac.signal,
        })
        clearTimeout(timeoutId)
        if (!embedRes.ok) {
          const errText = await embedRes.text()
          throw new Error(`Embedding API failed: ${embedRes.status} ${errText}`)
        }
        const embedJson = (await embedRes.json()) as { embedding?: number[]; vector?: number[] }
        vector = embedJson.embedding ?? embedJson.vector ?? []
        if (!Array.isArray(vector) || vector.length === 0) {
          throw new Error("Embedding API trả về vector rỗng hoặc không hợp lệ")
        }
      } else {
        const openai = new OpenAI({ apiKey: apiKey! })
        const embedRes = await openai.embeddings.create(
          {
            model: getEmbeddingModel(),
            input: kw,
          },
          { signal: ac.signal }
        )
        clearTimeout(timeoutId)
        const v = embedRes.data?.[0]?.embedding
        if (!v || !Array.isArray(v)) throw new Error("Không nhận được vector từ embedding API")
        vector = v
      }
    } catch (embedErr: any) {
      clearTimeout(timeoutId)
      if (embedErr?.name === "AbortError") {
        throw new Error(
          "Embedding quá thời gian (timeout 25s). Kiểm tra REGULATIONS_EMBEDDING_URL hoặc cấu hình tại Admin → Central (Trợ lý chính)."
        )
      }
      throw embedErr
    }

    const searchLimit = Math.min(Math.max(typeof limit === "number" ? limit : 20, 1), 50)
    const points = await searchPoints(col, vector, { limit: searchLimit, withPayload: true })
    res.json({ keyword: kw, collection: col, points })
  } catch (err: any) {
    console.error("POST /api/admin/qdrant/search error:", err)
    res.status(500).json({
      error: err?.message ?? "Lỗi tìm kiếm vector",
    })
  }
})

router.post("/collections/:name/scroll", adminOnly, async (req: Request, res: Response) => {
  if (!requireQdrantPlugin(req, res)) return
  try {
    const name = String(req.params.name ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
    if (!name) return res.status(400).json({ error: "Tên collection không hợp lệ" })
    const { limit, offset } = req.body ?? {}
    const result = await scrollPoints(name, {
      limit: typeof limit === "number" ? limit : 20,
      offset: offset != null ? offset : undefined,
    })
    res.json(result)
  } catch (err: any) {
    console.error("POST /api/admin/qdrant/collections/:name/scroll error:", err)
    res.status(500).json({
      error: err?.message ?? "Lỗi duyệt points",
    })
  }
})

export default router
