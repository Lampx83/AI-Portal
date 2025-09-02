// app/api/chat/sessions/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getUserIdFromRequest } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function json(data: any, init?: number | ResponseInit) {
    return new NextResponse(JSON.stringify(data), {
        ...(typeof init === "number" ? { status: init } : init),
        headers: { "Content-Type": "application/json" },
    })
}

/**
 * GET /api/chat/sessions?user_id=<uuid>&q=<text>&limit=20&offset=0
 * - user_id: lọc theo người dùng (tuỳ chọn)
 * - q: tìm theo tên/mô tả/ghi chú (nếu có) của session (tuỳ chỉnh tuỳ schema)
 * - limit/offset: phân trang
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const userId = searchParams.get("user_id") // uuid
        const q = searchParams.get("q")?.trim()
        const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100)
        const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0)

        const where: string[] = []
        const params: any[] = []

        if (userId) {
            params.push(userId)
            where.push(`cs.user_id = $${params.length}`)
        }

        if (q) {
            // ví dụ: nếu có cột "title" trong chat_sessions; nếu không có, bỏ đoạn này
            params.push(`%${q}%`)
            where.push(`(cs.title ILIKE $${params.length})`)
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

        const sql = `
      WITH msg_counts AS (
        SELECT session_id, COUNT(*) AS message_count
        FROM research_chat.messages
        GROUP BY session_id
      )
      SELECT
        cs.id,
        cs.user_id,
        cs.created_at,
        cs.updated_at,
        cs.title,
        COALESCE(mc.message_count, 0) AS message_count
      FROM research_chat.chat_sessions cs
      LEFT JOIN msg_counts mc ON mc.session_id = cs.id
      ${whereSql}
      ORDER BY cs.updated_at DESC NULLS LAST, cs.created_at DESC
      LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}
    `

        const countSql = `
      SELECT COUNT(*)::int AS total
      FROM research_chat.chat_sessions cs
      ${whereSql}
    `

        const [rowsRes, countRes] = await Promise.all([
            query(sql, params),
            query<{ total: number }>(countSql, params.slice(0, params.length - 2)), // bỏ limit/offset
        ])

        return json(
            {
                data: rowsRes.rows,
                page: { limit, offset, total: countRes.rows[0]?.total ?? 0 },
            },
            200
        )
    } catch (err: any) {
        console.error("GET /api/chat/sessions error:", err)
        return json({ error: "Internal Server Error" }, 500)
    }
}
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}))
        const { user_id = null, title = null } = body ?? {}
        // tạo session
        const sql = `
      INSERT INTO research_chat.chat_sessions (user_id, title, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id, user_id, created_at, updated_at, title
    `
        const r = await query(sql, [user_id, title])
        return json({ data: r.rows[0] }, 201)
    } catch (e) {
        console.error("POST /api/chat/sessions error:", e)
        return json({ error: "Internal Server Error" }, 500)
    }
}
