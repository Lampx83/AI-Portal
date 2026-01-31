// routes/write-agent.ts
import { Router, Request, Response } from "express"
import OpenAI from "openai"

const router = Router()

const PRIMARY_DOMAIN = process.env.PRIMARY_DOMAIN ?? "research.neu.edu.vn"
const EXTRA_WHITELIST = new Set<string>([
  "http://localhost:3000",
  "https://localhost:3000",
])

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  try {
    const u = new URL(origin)
    if (u.hostname === PRIMARY_DOMAIN || u.hostname.endsWith(`.${PRIMARY_DOMAIN}`)) return true
    if (EXTRA_WHITELIST.has(origin)) return true
    return false
  } catch {
    return false
  }
}

function buildCorsHeaders(origin: string | null) {
  const allowed = isAllowedOrigin(origin) ? origin! : ""
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }
  if (allowed) headers["Access-Control-Allow-Origin"] = allowed
  return headers
}

// GET /api/write_agent/v1/metadata
router.get("/v1/metadata", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  const body = {
    name: "Viết bài",
    description: "Hỗ trợ viết và chỉnh sửa các tài liệu nghiên cứu, luận văn, báo cáo khoa học. Giúp cấu trúc nội dung, cải thiện văn phong học thuật và đảm bảo tính nhất quán trong văn bản.",
    version: "1.0.0",
    developer: "NEU Research Team",
    capabilities: ["write", "edit", "structure", "improve", "format"],
    supported_models: [
      {
        model_id: "gpt-4o",
        name: "GPT-4o",
        description: "Mô hình mạnh cho viết và chỉnh sửa văn bản nghiên cứu phức tạp",
        accepted_file_types: ["pdf", "docx", "txt", "md"],
      },
      {
        model_id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Mô hình nhanh cho các tác vụ viết và chỉnh sửa đơn giản",
        accepted_file_types: ["txt", "md"],
      },
    ],
    sample_prompts: [
      "Viết phần giới thiệu cho nghiên cứu về ứng dụng AI trong giáo dục",
      "Cải thiện văn phong của đoạn văn này để phù hợp với văn phong học thuật",
      "Tạo cấu trúc đề cương cho luận văn về machine learning",
      "Chỉnh sửa và định dạng lại phần kết luận của bài nghiên cứu",
    ],
    provided_data_types: [
      {
        type: "templates",
        description: "Các mẫu template cho các loại tài liệu nghiên cứu khác nhau",
      },
      {
        type: "examples",
        description: "Ví dụ về các phần trong tài liệu nghiên cứu",
      },
    ],
    contact: "research@neu.edu.vn",
    status: "active",
  }

  res.set(headers).json(body)
})

// GET /api/write_agent/v1/data
router.get("/v1/data", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  const type = (req.query.type as string) || "templates"

  const data = {
    templates: [
      { id: "template1", title: "Template Luận văn Thạc sĩ", description: "Mẫu cấu trúc chuẩn cho luận văn thạc sĩ", type: "thesis" },
      { id: "template2", title: "Template Bài báo Khoa học", description: "Mẫu cấu trúc cho bài báo nghiên cứu", type: "paper" },
      { id: "template3", title: "Template Báo cáo Nghiên cứu", description: "Mẫu cấu trúc cho báo cáo nghiên cứu", type: "report" },
    ],
    examples: [
      { id: "example1", title: "Ví dụ Phần Giới thiệu", description: "Mẫu phần giới thiệu tốt", type: "introduction" },
      { id: "example2", title: "Ví dụ Phần Kết luận", description: "Mẫu phần kết luận tốt", type: "conclusion" },
    ],
  }

  res.set(headers).json({
    status: "success",
    data_type: type,
    items: (data as any)[type] || [],
    last_updated: new Date().toISOString(),
  })
})

// POST /api/write_agent/v1/ask
interface AskRequest {
  session_id: string
  model_id: string
  user: string
  prompt: string
  context?: {
    project?: string
    extra_data?: any
    history?: any[]
  }
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

  if (!body.session_id || !body.model_id || !body.user || !body.prompt) {
    return res.status(400).set(headers).json({
      session_id: body.session_id || null,
      status: "error",
      error_code: "INVALID_REQUEST",
      error_message: "Thiếu tham số bắt buộc",
    })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).set(headers).json({
      session_id: body.session_id,
      status: "error",
      error_message: "Thiếu OPENAI_API_KEY trong biến môi trường.",
    })
  }

  const t0 = Date.now()
  const client = new OpenAI({ apiKey })

  // System prompt cho write agent
  const systemPrompt = `Bạn là trợ lý AI chuyên hỗ trợ viết và chỉnh sửa tài liệu nghiên cứu. Nhiệm vụ của bạn:
- Hỗ trợ viết các phần trong tài liệu nghiên cứu (giới thiệu, phương pháp, kết quả, kết luận)
- Cải thiện văn phong học thuật
- Đảm bảo tính nhất quán và logic trong văn bản
- Định dạng và cấu trúc nội dung theo chuẩn học thuật
- Chỉnh sửa và tối ưu hóa các đoạn văn hiện có

Hãy trả lời một cách chuyên nghiệp, rõ ràng và phù hợp với văn phong học thuật.`

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ]

    // Thêm lịch sử nếu có
    if (Array.isArray(body.context?.history)) {
      const history = body.context.history.map((h: any) => ({
        role: h.role === "user" ? "user" : h.role === "assistant" ? "assistant" : "system",
        content: String(h.content || ""),
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
      messages.push(...history)
    }

    messages.push({ role: "user", content: body.prompt })

    const completion = await client.chat.completions.create({
      model: body.model_id,
      messages,
    })

    const choice = completion.choices?.[0]
    const answer = (choice?.message?.content ?? "").trim()

    const response_time_ms = Date.now() - t0
    const tokens_used = (completion.usage as any)?.total_tokens ?? 0

    res.set(headers).json({
      session_id: body.session_id,
      status: "success",
      content_markdown: answer || "*(không có nội dung)*",
      meta: {
        model: body.model_id,
        response_time_ms,
        tokens_used,
      },
    })
  } catch (err: any) {
    const response_time_ms = Date.now() - t0
    const status = Number(err?.status) || 500
    res.status(status).set(headers).json({
      session_id: body.session_id,
      status: "error",
      error_message: err?.message || "Gọi OpenAI API thất bại.",
      meta: {
        model: body.model_id,
        response_time_ms,
      },
    })
  }
})

// OPTIONS handler for CORS preflight
router.options("/v1/*", (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)
  res.set(headers).status(204).send()
})

export default router
