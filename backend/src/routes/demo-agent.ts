// routes/demo-agent.ts
import { Router, Request, Response } from "express"

const router = Router()

const PRIMARY_DOMAIN = process.env.PRIMARY_DOMAIN ?? "portal.neu.edu.vn"
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

// GET /api/demo_agent/v1/metadata
router.get("/v1/metadata", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  const body = {
    name: "Document Assistant",
    description: "Tìm kiếm, tóm tắt và giải thích tài liệu",
    version: "1.2.0",
    developer: "Nhóm H Thắng, H Việt, X Lâm",
    capabilities: ["search", "summarize", "explain"],
    supported_models: [
      {
        model_id: "gpt-4o",
        name: "GPT-4o",
        description: "Mô hình mạnh cho tóm tắt và giải thích chi tiết",
        accepted_file_types: ["pdf", "docx", "txt", "md"],
      },
      {
        model_id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Mô hình nhanh, tiết kiệm chi phí",
        accepted_file_types: ["pdf", "txt"],
      },
    ],
    sample_prompts: [
      "Tóm tắt bài báo về học sâu trong y tế",
      "Giải thích khái niệm 'federated learning' trong AI",
      "Tìm tài liệu về biến đổi khí hậu năm 2024",
    ],
    provided_data_types: [
      {
        type: "documents",
        description: "Danh sách và thông tin tóm tắt tài liệu mà Agent lưu trữ",
      },
      {
        type: "experts",
        description: "Danh sách chuyên gia liên quan tới lĩnh vực mà Agent quản lý",
      },
    ],
    contact: "email@example.com",
    status: "active",
  }

  res.set(headers).json(body)
})

// GET /api/demo_agent/v1/data
router.get("/v1/data", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  const type = (req.query.type as string) || "documents"

  const demoData = {
    documents: [
      { id: "doc1", title: "AI in Education", summary: "Tổng quan ứng dụng AI trong giáo dục" },
      { id: "doc2", title: "Machine Learning Basics", summary: "Các khái niệm cơ bản" },
    ],
  }

  res.set(headers).json({
    status: "success",
    data_type: type,
    items: (demoData as any)[type] || [],
    last_updated: new Date().toISOString(),
  })
})

// POST /api/demo_agent/v1/ask
interface AskRequest {
  session_id: string
  model_id: string
  user: string
  prompt: string
  context?: {
    project?: string
    extra_data?: any
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

  const startTime = Date.now()
  const markdownContent = `## Tóm tắt
Bạn đã yêu cầu: **${body.prompt}**

_Nội dung này là demo._`

  const responseTime = Date.now() - startTime

  res.set(headers).json({
    session_id: body.session_id,
    status: "success",
    content_markdown: markdownContent,
    meta: {
      model: body.model_id,
      response_time_ms: responseTime,
      tokens_used: 42,
    },
    attachments: [{ type: "pdf", url: "https://example.com/file.pdf" }],
  })
})

// OPTIONS handler for CORS preflight
router.options("/v1/*", (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)
  res.set(headers).status(204).send()
})

export default router
