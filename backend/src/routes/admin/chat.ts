import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly } from "./middleware"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const router = Router()

router.get("/sessions", adminOnly, async (req: Request, res: Response) => {
  try {
    const assistantAlias = (req.query.assistant_alias as string)?.trim() || undefined
    const sourceFilter = (req.query.source as string)?.trim()
    const source = sourceFilter === "embed" || sourceFilter === "web" ? sourceFilter : undefined
    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)

    const conditions: string[] = []
    const params: (string | number)[] = []
    let idx = 1
    if (assistantAlias) {
      conditions.push(`cs.assistant_alias = $${idx++}`)
      params.push(assistantAlias)
    }
    if (source) {
      conditions.push(`cs.source = $${idx++}`)
      params.push(source)
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    params.push(limit, offset)
    const paramLimit = `$${idx++}`
    const paramOffset = `$${idx}`

    const sql = `
      SELECT cs.id, cs.title, cs.assistant_alias, cs.source, cs.created_at, cs.updated_at,
             COALESCE(cs.message_count, (SELECT COUNT(*) FROM ai_portal.messages WHERE session_id = cs.id)) AS message_count
      FROM ai_portal.chat_sessions cs
      ${where}
      ORDER BY cs.updated_at DESC NULLS LAST, cs.created_at DESC
      LIMIT ${paramLimit} OFFSET ${paramOffset}
    `
    const result = await query(sql, params)
    const rows = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      user_display: "Người dùng",
    }))
    const countWhere = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    const countParams = conditions.length ? params.slice(0, conditions.length) : []
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM ai_portal.chat_sessions cs ${countWhere}`,
      countParams
    )
    const total = countResult.rows[0]?.total ?? 0
    res.json({ data: rows, page: { limit, offset, total } })
  } catch (err: any) {
    console.error("GET /api/admin/chat/sessions error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.get("/sessions/:sessionId", adminOnly, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim()
    if (!UUID_RE.test(sessionId)) return res.status(400).json({ error: "Invalid sessionId" })
    const result = await query(
      `SELECT cs.id, cs.title, cs.assistant_alias, cs.source, cs.created_at, cs.updated_at, COALESCE(cs.message_count, 0) AS message_count
       FROM ai_portal.chat_sessions cs
       WHERE cs.id = $1::uuid`,
      [sessionId]
    )
    const row = result.rows[0]
    if (!row) return res.status(404).json({ error: "Session not found" })
    res.json({
      ...row,
      user_display: "Người dùng",
    })
  } catch (err: any) {
    console.error("GET /api/admin/chat/sessions/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.get("/sessions/:sessionId/messages", adminOnly, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim()
    if (!UUID_RE.test(sessionId)) return res.status(400).json({ error: "Invalid sessionId" })
    let limit = Number(req.query.limit ?? 200)
    let offset = Number(req.query.offset ?? 0)
    if (!Number.isFinite(limit) || limit <= 0) limit = 200
    if (limit > 500) limit = 500
    if (!Number.isFinite(offset) || offset < 0) offset = 0

    const sql = `
      SELECT m.id, m.assistant_alias, m.role, m.content_type, m.content,
             m.model_id, m.prompt_tokens, m.completion_tokens, m.response_time_ms, m.refs, m.created_at,
             COALESCE(
               (SELECT json_agg(json_build_object('file_name', ma.file_name, 'file_url', ma.file_url))
                FROM ai_portal.message_attachments ma WHERE ma.message_id = m.id),
               '[]'::json
             ) AS attachments
      FROM ai_portal.messages m
      WHERE m.session_id = $1::uuid
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `
    const result = await query(sql, [sessionId, limit, offset])
    res.json({ data: result.rows })
  } catch (err: any) {
    console.error("GET /api/admin/chat/sessions/:id/messages error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

export default router
