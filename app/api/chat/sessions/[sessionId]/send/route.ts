// app/api/chat/sessions/[sessionId]/send/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function json(data: any, init?: number | ResponseInit) {
    return new NextResponse(JSON.stringify(data), {
        ...(typeof init === "number" ? { status: init } : init),
        headers: { "Content-Type": "application/json" },
    })
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function createSessionIfMissing(opts: {
    sessionId: string
    userId?: string | null
    assistantAlias?: string | null
    title?: string | null
    modelId?: string | null
}) {
    const { sessionId, userId = null, assistantAlias = null, title = null, modelId = null, } = opts
    // Chỉ tạo nếu chưa có (id là PK nên ON CONFLICT DO NOTHING là đủ)
    await query(
        `
        INSERT INTO research_chat.chat_sessions (id, user_id, assistant_alias, title,model_id)
        VALUES ($1::uuid, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `,
        [sessionId, userId, assistantAlias, title, modelId]
    )
}

type AppendMessageInput = {
    role: "user" | "assistant"
    content: string
    content_type?: "markdown" | "text" | "json"
    model_id?: string | null
    status?: "ok" | "error"
    assistant_alias?: string | null
    prompt_tokens?: number | null
    completion_tokens?: number | null
    total_tokens?: number | null
    response_time_ms?: number | null
    refs?: any
}

async function appendMessage(sessionId: string, m: AppendMessageInput) {
    const {
        role,
        content,
        content_type = "markdown",
        model_id = null,
        status = "ok",
        assistant_alias = null,
        prompt_tokens = null,
        completion_tokens = null,
        total_tokens = null,
        response_time_ms = null,
        refs = null,
    } = m

    await query(
        `
    INSERT INTO research_chat.messages (
      session_id, assistant_alias,
      role, status, content_type, content,
      model_id, prompt_tokens, completion_tokens, total_tokens,
      response_time_ms, refs
    )
    VALUES (
      $1::uuid, $2,
      $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12
    )
  `,
        [
            sessionId,
            assistant_alias,
            role,
            status,
            content_type,
            String(content ?? ""),
            model_id,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            response_time_ms,
            refs,
        ]
    )
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ sessionId: string }> }
) {
    const t0 = Date.now()

    try {
        const { sessionId: rawParam } = await ctx.params
        const sessionId = rawParam.trim().replace(/\/+$/g, "")
        if (!UUID_RE.test(sessionId)) return json({ error: "Invalid sessionId" }, 400)

        const body = await req.json().catch(() => ({}))
        const {
            assistant_base_url,
            model_id,
            prompt,
            user = "anonymous",
            context = {},
            // optional metadata
            session_title,
            assistant_alias,
            user_id,
        } = body || {}

        if (!assistant_base_url || !model_id || !prompt) {
            return json({ error: "Missing assistant_base_url | model_id | prompt" }, 400)
        }

        // (1) GỌI AI TRƯỚC
        const aiReqBody = {
            session_id: sessionId,
            model_id,
            user,
            prompt,
            context,
        }

        const aiRes = await fetch(`${assistant_base_url}/ask`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(aiReqBody),
        })

        if (!aiRes.ok) {
            const errText = await aiRes.text().catch(() => "")
            return json({ error: `Agent error: ${aiRes.status} ${errText}` }, 502)
        }

        const aiJson = await aiRes.json().catch(() => ({}))
        if (aiJson?.status !== "success") {
            return json({ error: aiJson?.error_message || "Agent failed" }, 502)
        }

        const contentMarkdown: string = String(aiJson?.content_markdown ?? "")
        const promptTokens: number | null = aiJson?.meta?.prompt_tokens ?? null
        const completionTokens: number | null = aiJson?.meta?.completion_tokens ?? null
        const totalTokens: number | null = aiJson?.meta?.tokens_used ?? null
        const responseTimeMs: number =
            aiJson?.meta?.response_time_ms ?? Math.max(1, Date.now() - t0)

        // (2) SAU KHI AI TRẢ VỀ → TẠO SESSION NẾU CHƯA CÓ
        await createSessionIfMissing({
            sessionId,
            userId: user_id ?? null,
            assistantAlias: assistant_alias ?? null,
            title: session_title ?? null,
            modelId: model_id ?? null,
        })

        //   (3) GHI CẢ USER + ASSISTANT MESSAGE TRONG TRANSACTION
        await query("BEGIN")
        try {
            // 3.1 User message
            await appendMessage(sessionId, {
                role: "user",
                content: String(prompt),
                content_type: "markdown",
                model_id,
                status: "ok",
                assistant_alias: assistant_alias ?? null,
            })

            // 3.2 Assistant message
            await appendMessage(sessionId, {
                role: "assistant",
                content: contentMarkdown,
                content_type: "markdown",
                model_id,
                status: "ok",
                assistant_alias: assistant_alias ?? null,
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: totalTokens,
                response_time_ms: responseTimeMs,
            })

            await query("COMMIT")
        } catch (e) {
            await query("ROLLBACK")
            throw e
        }

        return json(
            {
                status: "success",
                content_markdown: contentMarkdown,
                meta: {
                    model: model_id,
                    response_time_ms: responseTimeMs,
                    tokens_used: totalTokens,
                },
            },
            200
        )
    } catch (err: any) {
        console.error("POST /api/chat/sessions/[sessionId]/send error:", err)
        return json({ error: "Internal Server Error" }, 500)
    }
}
