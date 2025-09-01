// app/api/chat/sessions/[sessionId]/messages/route.ts
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

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ sessionId: string }> } // ⬅️ params là Promise
) {
    try {
        const { sessionId: rawParam } = await ctx.params;                // ⬅️ await
        const sessionId = rawParam.trim().replace(/\/+$/g, "")           // bỏ dấu '/' đuôi
        if (!UUID_RE.test(sessionId)) return json({ error: "Invalid sessionId" }, 400)

        const { searchParams } = new URL(req.url)
        let limit = Number(searchParams.get("limit") ?? 100)
        let offset = Number(searchParams.get("offset") ?? 0)
        if (!Number.isFinite(limit) || limit <= 0) limit = 100
        if (limit > 200) limit = 200
        if (!Number.isFinite(offset) || offset < 0) offset = 0

        // Debug nhẹ
        const dbg = await query(`SELECT current_database() db, current_user db_user`)
        const sql = `
      SELECT
        m.id,
        m.session_id,
        m.user_id,
        m.assistant_alias,
        m.role,
        m.status,
        m.content_type,
        m.content,
        m.content_json,
        m.model_id,
        m.prompt_tokens,
        m.completion_tokens,
        m.total_tokens,
        m.response_time_ms,
        m.refs,
        m.created_at
      FROM research_chat.messages m
      WHERE m.session_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `

        const res = await query(sql, [sessionId, limit, offset])
        return json({ data: res.rows }, 200)
    } catch (err: any) {
        console.error("GET /api/chat/sessions/[sessionId]/messages error:", err)
        return json({ error: "Internal Server Error" }, 500)
    }
}
