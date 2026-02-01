// routes/main-agent.ts
import { Router, Request, Response } from "express"

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

// GET /api/main_agent/v1/metadata
router.get("/v1/metadata", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  const body = {
    name: "Trợ lý Nghiên cứu",
    description: "Trợ lý AI điều phối nghiên cứu NEU. Hỗ trợ tìm kiếm, tóm tắt và giải thích các tài liệu nghiên cứu, kết nối với các chuyên gia và tài nguyên nghiên cứu.",
    version: "1.0.0",
    developer: "NEU Research Team",
    capabilities: ["orchestrate", "search", "summarize", "explain", "coordinate"],
    supported_models: [
      {
        model_id: "gpt-4o",
        name: "GPT-4o",
        description: "Mô hình mạnh cho điều phối và phân tích phức tạp",
        accepted_file_types: ["pdf", "docx", "xlsx", "xls", "txt", "md"],
      },
      {
        model_id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Mô hình nhanh, tiết kiệm chi phí cho các tác vụ đơn giản",
        accepted_file_types: ["pdf", "txt"],
      },
    ],
    sample_prompts: [
      "Tìm kiếm các bài nghiên cứu về học sâu trong y tế",
      "Tóm tắt các nghiên cứu của Ông Xuân Lâm",
      "Giải thích khái niệm 'federated learning' trong AI",
      "Kết nối tôi với các chuyên gia về biến đổi khí hậu",
    ],
    provided_data_types: [
      {
        type: "documents",
        description: "Danh sách và thông tin tóm tắt các tài liệu nghiên cứu",
      },
      {
        type: "experts",
        description: "Danh sách chuyên gia liên quan tới các lĩnh vực nghiên cứu",
      },
    ],
    contact: "research@neu.edu.vn",
    status: "active",
  }

  res.set(headers).json(body)
})

// GET /api/main_agent/v1/data
router.get("/v1/data", async (req: Request, res: Response) => {
  const origin = req.headers.origin || null
  const headers = buildCorsHeaders(origin)

  const type = (req.query.type as string) || "documents"

  // Trả về empty array vì main agent không có data riêng, nó điều phối từ các agent khác
  res.set(headers).json({
    status: "success",
    data_type: type,
    items: [],
    last_updated: new Date().toISOString(),
  })
})

// POST /api/main_agent/v1/ask - Proxy đến orchestrator
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

  // Proxy request đến orchestrator endpoint trong cùng server
  try {
    // Gọi orchestrator handler trực tiếp bằng cách import và gọi function
    const { default: orchestratorRouter } = await import("./orchestrator")
    
    // Tạo một mock request/response để pass vào orchestrator handler
    // Hoặc đơn giản hơn: gọi qua HTTP internal
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`
    const orchestratorUrl = `${baseUrl}/api/orchestrator/v1/ask`
    
    const orchestratorRes = await fetch(orchestratorUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        // Forward các headers cần thiết
        ...(req.headers.authorization && { Authorization: req.headers.authorization }),
      },
      body: JSON.stringify(body),
    })

    const orchestratorData = await orchestratorRes.json()
    res.set(headers).status(orchestratorRes.status).json(orchestratorData)
  } catch (err: any) {
    console.error("Error proxying to orchestrator:", err)
    res.status(502).set(headers).json({
      session_id: body.session_id,
      status: "error",
      error_message: "Không thể kết nối đến orchestrator: " + (err?.message || "Unknown error"),
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
