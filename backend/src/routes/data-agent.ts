// routes/data-agent.ts
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

// GET /api/data_agent/v1/metadata
router.get("/v1/metadata", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  const body = {
    name: "Dữ liệu",
    description: "Hỗ trợ phân tích và xử lý dữ liệu nghiên cứu. Giúp thống kê mô tả, phân tích thống kê, trực quan hóa dữ liệu và đưa ra các insights từ dữ liệu nghiên cứu.",
    version: "1.0.0",
    developer: "NEU Research Team",
    capabilities: ["analyze", "statistics", "visualize", "insights", "process"],
    supported_models: [
      {
        model_id: "gpt-4o",
        name: "GPT-4o",
        description: "Mô hình mạnh cho phân tích dữ liệu phức tạp và đưa ra insights",
        accepted_file_types: ["csv", "xlsx", "json", "txt"],
      },
      {
        model_id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Mô hình nhanh cho các phân tích dữ liệu đơn giản",
        accepted_file_types: ["csv", "txt"],
      },
    ],
    sample_prompts: [
      "Phân tích xu hướng của dữ liệu khảo sát về mức độ hài lòng",
      "Tạo bảng thống kê mô tả cho dataset này",
      "Giải thích ý nghĩa của các chỉ số thống kê trong kết quả nghiên cứu",
      "Đề xuất các biểu đồ phù hợp để trực quan hóa dữ liệu này",
    ],
    provided_data_types: [
      {
        type: "datasets",
        description: "Các dataset mẫu và dữ liệu nghiên cứu",
      },
      {
        type: "analyses",
        description: "Các phân tích và kết quả đã được xử lý",
      },
    ],
    contact: "research@neu.edu.vn",
    status: "active",
  }

  res.set(headers).json(body)
})

// GET /api/data_agent/v1/data
router.get("/v1/data", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  const type = (req.query.type as string) || "datasets"

  const data = {
    datasets: [
      { id: "dataset1", title: "Dataset Khảo sát Sinh viên", description: "Dữ liệu khảo sát về mức độ hài lòng của sinh viên", type: "survey" },
      { id: "dataset2", title: "Dataset Thực nghiệm", description: "Dữ liệu từ các thực nghiệm nghiên cứu", type: "experiment" },
      { id: "dataset3", title: "Dataset Phân tích", description: "Dữ liệu đã được xử lý và phân tích", type: "processed" },
    ],
    analyses: [
      { id: "analysis1", title: "Phân tích Thống kê Mô tả", description: "Kết quả thống kê mô tả cho dataset", type: "descriptive" },
      { id: "analysis2", title: "Phân tích Tương quan", description: "Kết quả phân tích tương quan giữa các biến", type: "correlation" },
    ],
  }

  res.set(headers).json({
    status: "success",
    data_type: type,
    items: (data as any)[type] || [],
    last_updated: new Date().toISOString(),
  })
})

// POST /api/data_agent/v1/ask
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

  // System prompt cho data agent
  const systemPrompt = `Bạn là trợ lý AI chuyên phân tích và xử lý dữ liệu nghiên cứu. Nhiệm vụ của bạn:
- Phân tích dữ liệu và đưa ra các insights
- Giải thích các chỉ số thống kê và ý nghĩa của chúng
- Đề xuất các phương pháp phân tích phù hợp
- Hỗ trợ trực quan hóa dữ liệu
- Giải thích kết quả phân tích một cách dễ hiểu

Hãy trả lời một cách chuyên nghiệp, chính xác và dựa trên dữ liệu thực tế.`

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
