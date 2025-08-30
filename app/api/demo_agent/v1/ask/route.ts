// app/api/ask/route.ts
import { NextRequest, NextResponse } from "next/server"

interface AskRequest {
    session_id: string
    model_id: string
    user: string   // URL của user
    prompt: string
    context?: {
        project?: string   // URL của project
        extra_data?: any   // dữ liệu bổ sung (vd: document, dataset...)
    }
}

// ====== CORS config ======
const PRIMARY_DOMAIN = process.env.PRIMARY_DOMAIN ?? "research.neu.edu.vn"
const EXTRA_WHITELIST = new Set(["http://localhost:3000", "https://localhost:3000"])

function isAllowedOrigin(origin: string | null): boolean {
    if (!origin) return false
    try {
        const u = new URL(origin)
        // cho phép đúng domain hoặc subdomain (*.PRIMARY_DOMAIN)
        if (u.hostname === PRIMARY_DOMAIN || u.hostname.endsWith(`.${PRIMARY_DOMAIN}`)) return true
        // cho phép localhost dev
        if (EXTRA_WHITELIST.has(origin)) return true
        return false
    } catch {
        return false
    }
}

function buildCorsHeaders(origin: string | null) {
    const allowedOrigin = isAllowedOrigin(origin) ? origin! : ""
    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        // Nếu cần gửi cookie/session qua CORS, bật dòng dưới và trên client dùng fetch(..., { credentials: "include" })
        // "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
}

// Preflight cho CORS
export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get("origin")
    return new NextResponse(null, { status: 204, headers: buildCorsHeaders(origin) })
}

// POST chính
export async function POST(req: NextRequest) {
    const origin = req.headers.get("origin")
    const corsHeaders = buildCorsHeaders(origin)

    // Bọc parse JSON để trả lỗi 400 rõ ràng nếu body hỏng
    let body: AskRequest
    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            {
                session_id: null,
                status: "error",
                error_code: "INVALID_JSON",
                error_message: "Payload không phải JSON hợp lệ",
            },
            { status: 400, headers: corsHeaders }
        )
    }

    // Validate bắt buộc
    if (!body.session_id || !body.model_id || !body.user || !body.prompt) {
        return NextResponse.json(
            {
                session_id: body.session_id || null,
                status: "error",
                error_code: "INVALID_REQUEST",
                error_message: "Thiếu tham số bắt buộc",
            },
            { status: 400, headers: corsHeaders }
        )
    }

    const startTime = Date.now()

    // Xử lý thật sự: ở đây demo
    const markdownContent = `## Tóm tắt
Bạn đã yêu cầu: **${body.prompt}**

_Nội dung này là demo._`

    const responseTime = Date.now() - startTime

    return NextResponse.json(
        {
            session_id: body.session_id,
            status: "success",
            content_markdown: markdownContent,
            meta: {
                model: body.model_id,
                response_time_ms: responseTime,
                tokens_used: 42, // giả lập
            },
            attachments: [
                { type: "pdf", url: "https://example.com/file.pdf" }
            ],
        },
        { headers: corsHeaders }
    )
}
