import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function json(data: any, init?: number | ResponseInit) {
    return new NextResponse(JSON.stringify(data), {
        ...(typeof init === "number" ? { status: init } : init),
        headers: { "Content-Type": "application/json" },
    })
}

function withCors(res: NextResponse) {
    res.headers.set("Access-Control-Allow-Origin", "*")
    return res
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        },
    })
}

function isValidUrl(u?: string) {
    if (!u) return false
    try {
        new URL(u)
        return true
    } catch {
        return false
    }
}

function extractLastPathSegment(u?: string | null) {
    if (!u || !isValidUrl(u)) return null
    const url = new URL(u)
    const parts = url.pathname.split("/").filter(Boolean)
    return parts.at(-1) ?? null
}

// Map model_id của client → model Qwen thực tế
function pickQwenModel(modelIdFromClient?: string): string {
    if (modelIdFromClient && /^qwen/i.test(modelIdFromClient)) return modelIdFromClient
    return "qwen-plus"
}

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type AskRequest = {
    session_id: string
    model_id: string
    user: string
    prompt: string
    context?: {
        project?: string
        extra_data?: {
            document?: string[]
            [k: string]: unknown
        }
        [k: string]: unknown
    }
}

// ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const t0 = Date.now()
    const rid = Math.random().toString(36).slice(2, 10)

    // Env cho Qwen (DashScope compatible)
    const apiKey = process.env.DASHSCOPE_API_KEY
    const baseURL =
        process.env.DASHSCOPE_BASE_URL ||
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

    if (!apiKey) {
        return withCors(
            json(
                {
                    session_id: null,
                    status: "error",
                    error_message: "Thiếu DASHSCOPE_API_KEY trong biến môi trường.",
                },
                500
            )
        )
    }

    // Đọc body
    let body: Partial<AskRequest> | null = null
    try {
        body = await req.json()
    } catch {
        return withCors(
            json(
                {
                    session_id: null,
                    status: "error",
                    error_message: "Body phải là JSON hợp lệ.",
                },
                400
            )
        )
    }

    // Validate tối thiểu
    const session_id = body?.session_id?.trim()
    const model_id = body?.model_id?.trim()
    const user = body?.user?.trim()
    const prompt = body?.prompt

    if (!session_id)
        return withCors(json({ session_id, status: "error", error_message: "Thiếu session_id." }, 400))
    if (!model_id)
        return withCors(json({ session_id, status: "error", error_message: "Thiếu model_id." }, 400))
    if (!user)
        return withCors(json({ session_id, status: "error", error_message: "Thiếu user." }, 400))
    if (typeof prompt !== "string") {
        return withCors(json({ session_id, status: "error", error_message: "prompt phải là chuỗi." }, 400))
    }

    // Chuẩn hóa context
    const projectUrl = body?.context?.project && isValidUrl(body.context.project)
        ? body.context.project!
        : null
    const projectId = extractLastPathSegment(projectUrl)

    const rawDocs = Array.isArray(body?.context?.extra_data?.document)
        ? (body!.context!.extra_data!.document as string[])
        : []

    const docSet = new Set<string>()
    for (const d of rawDocs) {
        if (isValidUrl(d)) docSet.add(d)
    }
    const documents = Array.from(docSet)

    // Attachments từ documents (pdf)
    const attachments = documents
        .filter((u) => /\.pdf($|\?)/i.test(u))
        .map((u) => ({ type: "pdf" as const, url: u }))

    // Tạo messages: nhúng ngữ cảnh vào system
    const systemContext =
        `Bạn là trợ lý AI điều phối nghiên cứu NEU. Nếu có dự án hoặc tài liệu, hãy dùng như ngữ cảnh:\n` +
        `- project_id: ${projectId ?? "N/A"}\n` +
        `- documents(${documents.length}): ${documents.length ? documents.join(", ") : "none"}\n` +
        `Trả lời ngắn gọn, chính xác và thân thiện.`

    const messages = [
        { role: "system", content: systemContext },
        { role: "user", content: prompt },
    ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]

    // const calledModel = pickQwenModel(model_id)
    const calledModel = model_id

    // Khởi tạo client theo OpenAI-compatible của Qwen
    const client = new OpenAI({ apiKey, baseURL })

    try {
        const completion = await client.chat.completions.create({
            model: calledModel,
            messages,
        })

        const choice = completion.choices?.[0]
        const answer = (choice?.message?.content ?? "").trim()

        const response_time_ms = Date.now() - t0
        // usage.total_tokens thường có sẵn; fallback 0 nếu provider không trả về
        const tokens_used =
            (completion.usage as any)?.total_tokens ??
            (typeof (completion as any)?.usage?.total_tokens === "number"
                ? (completion as any).usage.total_tokens
                : 0)

        // TRẢ VỀ THEO FORMAT YÊU CẦU
        return withCors(
            json(
                {
                    session_id,
                    status: "success",
                    content_markdown: answer || "*(không có nội dung)*",
                    meta: {
                        model: model_id,             // giữ nguyên model client gửi (ví dụ "gpt-4o")
                        response_time_ms,
                        tokens_used,
                        // nếu muốn debug thêm:
                        // provider_model: calledModel,
                        // request_id: completion.id,
                    },
                    attachments,                   // lấy từ context.extra_data.document
                },
                200
            )
        )
    } catch (err: any) {
        const response_time_ms = Date.now() - t0
        const status = Number(err?.status) || 500
        return withCors(
            json(
                {
                    session_id,
                    status: "error",
                    error_message: err?.message || "Gọi Qwen API thất bại.",
                    meta: {
                        model: model_id,
                        response_time_ms,
                    },
                    details: err?.response?.data ?? null,
                },
                status
            )
        )
    }
}
