// routes/regulations-agent.ts
// Trợ lý "Quy chế, quy định" - truy vấn Qdrant (NEU quy chế quản lý khoa học), trả lời dựa trên ngữ liệu.
import { Router, Request, Response } from "express"
import OpenAI from "openai"
import { searchPoints, getTextFromPayload } from "../lib/qdrant"

const router = Router()

const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION_REGULATIONS || "research_regulations"
const EMBEDDING_MODEL = process.env.REGULATIONS_EMBEDDING_MODEL || "text-embedding-3-small"
/** API embed local (vd. EduAI http://localhost:8011/search/embed) — trả về vector 384 chiều, thay cho OpenAI */
const REGULATIONS_EMBEDDING_URL = process.env.REGULATIONS_EMBEDDING_URL || "http://localhost:8011/search/embed"

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const primary = process.env.PRIMARY_DOMAIN ?? "research.neu.edu.vn"
  const allowed =
    origin && (origin.includes(primary) || origin.includes("localhost"))
      ? origin
      : ""
  return {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
  }
}

// GET /api/regulations_agent/v1/metadata
router.get("/v1/metadata", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)
  const body = {
    name: "Quy chế, quy định",
    description:
      "Trả lời câu hỏi liên quan đến quy chế, quy định tại NEU về quản lý khoa học. Dữ liệu được lấy từ kho quy định đã được vector hóa.",
    version: "1.0.0",
    developer: "NEU Research Team",
    capabilities: ["regulations", "quy che", "quy dinh", "khoa hoc"],
    supported_models: [
      {
        model_id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Mô hình nhanh cho tra cứu quy chế, quy định",
        accepted_file_types: [],
      },
    ],
    sample_prompts: [
      "Tổng số giờ NCKH tối đa mà một giảng viên có thể được tính khi chủ trì đề tài cấp Quốc gia và đồng thời có bài báo quốc tế Scopus Q1 là bao nhiêu?",
      "Sự chênh lệch số giờ NCKH giữa vai trò chủ trì, thư ký khoa học và thành viên tham gia trong đề tài cấp Bộ được quy định như thế nào?",
      "Một bài báo quốc tế thuộc danh mục SSCI/SCIE xếp hạng Q1 được tính bao nhiêu giờ nếu là tác giả chính so với không phải tác giả chính?",
      "Nếu một giảng viên hướng dẫn sinh viên đạt giải Nhất cấp Bộ và đồng thời có bài đăng tạp chí trong nước nhóm 1 điểm, tổng số giờ NCKH được cộng là bao nhiêu?",
    ],
    provided_data_types: [],
    contact: "research@neu.edu.vn",
    status: "active",
  }
  res.set(headers).json(body)
})

// POST /api/regulations_agent/v1/ask
interface AskRequest {
  session_id?: string
  model_id?: string
  user?: string
  prompt: string
  context?: { history?: Array<{ role: string; content: string }> }
}

router.post("/v1/ask", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  let body: AskRequest
  try {
    body = req.body
  } catch {
    return res.status(400).set(headers).json({
      session_id: null,
      status: "error",
      error_code: "INVALID_JSON",
      error_message: "Payload không phải JSON hợp lệ",
    })
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : ""
  if (!prompt) {
    return res.status(400).set(headers).json({
      session_id: body?.session_id ?? null,
      status: "error",
      error_code: "INVALID_REQUEST",
      error_message: "Thiếu nội dung câu hỏi (prompt)",
    })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).set(headers).json({
      session_id: body.session_id ?? null,
      status: "error",
      error_message: "Thiếu OPENAI_API_KEY trong biến môi trường.",
    })
  }

  const qdrantUrl = process.env.QDRANT_URL
  if (!qdrantUrl) {
    return res.status(503).set(headers).json({
      session_id: body.session_id ?? null,
      status: "error",
      error_message: "Chưa cấu hình QDRANT_URL cho trợ lý Quy chế, quy định.",
    })
  }

  const t0 = Date.now()

  try {
    const openai = new OpenAI({ apiKey })
    let vector: number[]
    const useExternalEmbed = async (): Promise<number[]> => {
      if (!REGULATIONS_EMBEDDING_URL) return []
      const embedRes = await fetch(REGULATIONS_EMBEDDING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt }),
      })
      if (!embedRes.ok) {
        const errText = await embedRes.text()
        throw new Error(`Embedding API failed: ${embedRes.status} ${errText}`)
      }
      const embedJson = (await embedRes.json()) as { embedding?: number[]; vector?: number[] }
      const v = embedJson.embedding ?? embedJson.vector ?? []
      if (!Array.isArray(v) || v.length === 0) throw new Error("Không nhận được vector từ embedding API")
      return v
    }
    try {
      vector = await useExternalEmbed()
    } catch (embedErr) {
      // Khi deploy: REGULATIONS_EMBEDDING_URL có thể trỏ tới localhost không reachable → fallback OpenAI
      console.warn("Regulations embedding URL không dùng được, chuyển sang OpenAI:", (embedErr as Error)?.message)
      vector = []
    }
    if (vector.length === 0) {
      const embedRes = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: prompt,
      })
      const v = embedRes.data?.[0]?.embedding
      if (!v || !Array.isArray(v)) {
        throw new Error("Không nhận được vector từ embedding API")
      }
      vector = v
    }

    // Bước 2: Truy vấn Qdrant
    const points = await searchPoints(QDRANT_COLLECTION, vector, {
      limit: 5,
      withPayload: true,
    })

    const sources: string[] = []
    const contextParts: string[] = []
    points.forEach((p, i) => {
      const text = getTextFromPayload(p.payload)
      if (text) {
        contextParts.push(`[Đoạn ${i + 1}]\n${text}`)
        const title = (p.payload?.title ?? p.payload?.source ?? `Kết quả ${i + 1}`) as string
        sources.push(typeof title === "string" ? title : `Kết quả ${i + 1}`)
      }
    })

    const contextText =
      contextParts.length > 0
        ? contextParts.join("\n\n---\n\n")
        : "Không tìm thấy đoạn quy định nào phù hợp với câu hỏi trong cơ sở dữ liệu."

    // Bước 3: Tổng hợp câu trả lời bằng LLM (dựa trên ngữ liệu)
    const systemPrompt = `Bạn là trợ lý tra cứu quy chế, quy định về quản lý khoa học tại Đại học Kinh tế Quốc dân (NEU). Nhiệm vụ của bạn:
- Trả lời CHỈ dựa trên các đoạn ngữ liệu được cung cấp bên dưới.
- Nếu thông tin không có trong ngữ liệu, hãy nói rõ "Trong cơ sở dữ liệu hiện tại không có thông tin về..." và gợi ý liên hệ phòng ban chức năng.
- Trích dẫn rõ ràng, có thể đánh số hoặc gạch đầu dòng.
- Giữ nguyên thuật ngữ chính thức (tiếng Việt) khi có trong ngữ liệu.`

    const userMessage = `Dựa trên các đoạn trích sau từ quy chế/quy định, hãy trả lời câu hỏi của người dùng.

=== NGỮ LIỆU ===
${contextText}

=== CÂU HỎI ===
${prompt}`

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ]
    if (Array.isArray(body.context?.history)) {
      for (const h of body.context.history.slice(-6)) {
        const role = h.role === "user" ? "user" : h.role === "assistant" ? "assistant" : "system"
        messages.push({ role, content: String(h.content || "") })
      }
    }
    messages.push({ role: "user", content: userMessage })

    const modelId = body.model_id && String(body.model_id).trim() ? body.model_id : "gpt-4o-mini"
    const completion = await openai.chat.completions.create({
      model: modelId,
      messages,
    })

    const choice = completion.choices?.[0]
    const contentMarkdown = (choice?.message?.content ?? "").trim() || "*(Không tạo được câu trả lời.)*"

    const responseTimeMs = Date.now() - t0
    const tokensUsed = (completion.usage as { total_tokens?: number })?.total_tokens ?? 0

    res.set(headers).json({
      session_id: body.session_id ?? null,
      status: "success",
      content_markdown: contentMarkdown,
      meta: {
        model: modelId,
        response_time_ms: responseTimeMs,
        tokens_used: tokensUsed,
        sources: sources.length ? sources : undefined,
        points_count: points.length,
      },
    })
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - t0
    const message = err instanceof Error ? err.message : "Lỗi không xác định"
    console.error("regulations_agent /ask error:", err)
    res.status(500).set(headers).json({
      session_id: body?.session_id ?? null,
      status: "error",
      error_message: message,
      meta: { response_time_ms: responseTimeMs },
    })
  }
})

router.options("/v1/*", (req: Request, res: Response) => {
  res.set(buildCorsHeaders(req.headers.origin || null)).status(204).send()
})

export default router
