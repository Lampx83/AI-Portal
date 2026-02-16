import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../../lib/db"
import { getSetting } from "../../lib/settings"
import { parseCookies } from "../../lib/parse-cookies"
import { adminOnly } from "./middleware"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const feedbackRouter = Router()

feedbackRouter.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)
    const resolved = req.query.resolved as string | undefined
    const conditions: string[] = []
    const params: unknown[] = []
    if (resolved === "true") {
      conditions.push("uf.resolved = true")
    } else if (resolved === "false") {
      conditions.push("(uf.resolved = false OR uf.resolved IS NULL)")
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    const sql = `
      SELECT uf.id, uf.user_id, uf.content, uf.assistant_alias, uf.created_at,
             uf.admin_note, uf.resolved, uf.resolved_at, uf.resolved_by,
             u.email AS user_email, u.display_name AS user_display_name
      FROM ai_portal.user_feedback uf
      JOIN ai_portal.users u ON u.id = uf.user_id
      ${where}
      ORDER BY uf.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const countSql = `
      SELECT COUNT(*)::int AS total FROM ai_portal.user_feedback uf ${where}
    `
    const listParams = [...params, limit, offset]
    const [rowsResult, countResult] = await Promise.all([
      query(sql, listParams),
      query(countSql, params),
    ])
    const total = (countResult.rows[0] as { total: number })?.total ?? 0
    res.json({ data: rowsResult.rows, page: { limit, offset, total } })
  } catch (err: any) {
    console.error("GET /api/admin/feedback error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

feedbackRouter.patch("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const secret = getSetting("NEXTAUTH_SECRET")
    if (!secret) return res.status(503).json({ error: "NEXTAUTH_SECRET chưa cấu hình" })
    const cookies = parseCookies(req.headers.cookie)
    const token = await getToken({ req: { cookies, headers: req.headers } as any, secret })
    const adminUserId = (token as { id?: string })?.id ?? null
    const body = req.body as { admin_note?: string | null; resolved?: boolean }
    const updates: string[] = []
    const params: unknown[] = []
    let idx = 1
    if (body.admin_note !== undefined) {
      updates.push(`admin_note = $${idx}`)
      params.push(
        body.admin_note === null || body.admin_note === ""
          ? null
          : String(body.admin_note).trim().slice(0, 2000)
      )
      idx++
    }
    if (body.resolved !== undefined) {
      updates.push(`resolved = $${idx}`)
      params.push(!!body.resolved)
      idx++
      updates.push(`resolved_at = $${idx}`)
      params.push(body.resolved ? new Date() : null)
      idx++
      updates.push(`resolved_by = $${idx}`)
      params.push(body.resolved && adminUserId ? adminUserId : null)
      idx++
    }
    if (updates.length === 0) return res.status(400).json({ error: "Cần admin_note hoặc resolved" })
    params.push(id)
    await query(
      `UPDATE ai_portal.user_feedback SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      params
    )
    const row = await query(
      `SELECT id, admin_note, resolved, resolved_at, resolved_by FROM ai_portal.user_feedback WHERE id = $1::uuid`,
      [id]
    )
    res.json({ feedback: row.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/admin/feedback/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

const messageFeedbackRouter = Router()

messageFeedbackRouter.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)
    const assistantAlias = req.query.assistant_alias as string | undefined
    const resolved = req.query.resolved as string | undefined
    const conditions: string[] = ["mf.feedback = 'dislike'", "mf.comment IS NOT NULL", "mf.comment != ''"]
    const params: unknown[] = []
    if (resolved === "true") conditions.push("mf.resolved = true")
    else if (resolved === "false") conditions.push("(mf.resolved = false OR mf.resolved IS NULL)")
    if (assistantAlias && assistantAlias.trim()) {
      conditions.push("cs.assistant_alias = $" + (params.length + 1))
      params.push(assistantAlias.trim())
    }
    const where = `WHERE ${conditions.join(" AND ")}`
    params.push(limit, offset)
    const pLen = params.length
    const sql = `
      SELECT mf.message_id, mf.user_id, mf.comment, mf.created_at,
             mf.admin_note, mf.resolved, mf.resolved_at, mf.resolved_by,
             cs.id AS session_id, cs.assistant_alias, cs.title AS session_title, cs.created_at AS session_created_at,
             u.email AS user_email, u.display_name AS user_display_name,
             m_assist.id AS disliked_message_id, m_assist.content AS disliked_content, m_assist.created_at AS disliked_at
      FROM ai_portal.message_feedback mf
      JOIN ai_portal.messages m_assist ON m_assist.id = mf.message_id AND m_assist.role = 'assistant'
      JOIN ai_portal.chat_sessions cs ON cs.id = m_assist.session_id
      JOIN ai_portal.users u ON u.id = mf.user_id
      ${where}
      ORDER BY mf.created_at DESC
      LIMIT $${pLen - 1} OFFSET $${pLen}
    `
    const rowsResult = await query(sql, params)
    const rows = rowsResult.rows as Array<{
      message_id: string
      user_id: string
      comment: string
      created_at: string
      admin_note: string | null
      resolved: boolean
      session_id: string
      user_email: string
      user_display_name: string | null
      assistant_alias: string
      session_title: string | null
      session_created_at: string
      disliked_message_id: string
      disliked_content: string | null
      disliked_at: string
    }>
    const sessionIds = [...new Set(rows.map((r) => r.session_id))]
    let sessionMessages: Record<
      string,
      Array<{ id: string; role: string; content: string | null; created_at: string }>
    > = {}
    if (sessionIds.length > 0) {
      const msgsResult = await query(
        `SELECT m.id, m.session_id, m.role, m.content, m.created_at
         FROM ai_portal.messages m
         WHERE m.session_id = ANY($1::uuid[])
         ORDER BY m.session_id, m.created_at ASC`,
        [sessionIds]
      )
      for (const m of msgsResult.rows as Array<{
        id: string
        session_id: string
        role: string
        content: string | null
        created_at: string
      }>) {
        if (!sessionMessages[m.session_id]) sessionMessages[m.session_id] = []
        sessionMessages[m.session_id].push({
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })
      }
    }
    const data = rows.map((r) => ({
      message_id: r.message_id,
      user_id: r.user_id,
      session_id: r.session_id,
      user_email: r.user_email,
      user_display_name: r.user_display_name,
      comment: r.comment,
      created_at: r.created_at,
      admin_note: r.admin_note,
      resolved: !!r.resolved,
      assistant_alias: r.assistant_alias,
      session_title: r.session_title,
      session_created_at: r.session_created_at,
      disliked_message_id: r.disliked_message_id,
      disliked_message: {
        id: r.disliked_message_id,
        content: r.disliked_content,
        created_at: r.disliked_at,
      },
      session_messages: sessionMessages[r.session_id] ?? [],
    }))
    const countParams = params.slice(0, -2)
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM ai_portal.message_feedback mf
       JOIN ai_portal.messages m_assist ON m_assist.id = mf.message_id AND m_assist.role = 'assistant'
       JOIN ai_portal.chat_sessions cs ON cs.id = m_assist.session_id
       ${where}`,
      countParams
    )
    const total = (countResult.rows[0] as { total: number })?.total ?? 0
    res.json({ data, page: { limit, offset, total } })
  } catch (err: any) {
    console.error("GET /api/admin/message-feedback error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

messageFeedbackRouter.patch("/:messageId/:userId", adminOnly, async (req: Request, res: Response) => {
  try {
    const messageId = String(req.params.messageId).trim()
    const userId = String(req.params.userId).trim()
    if (!UUID_RE.test(messageId) || !UUID_RE.test(userId))
      return res.status(400).json({ error: "Invalid messageId or userId" })
    const secret = getSetting("NEXTAUTH_SECRET")
    if (!secret) return res.status(503).json({ error: "NEXTAUTH_SECRET chưa cấu hình" })
    const cookies = parseCookies(req.headers.cookie)
    const token = await getToken({ req: { cookies, headers: req.headers } as any, secret })
    const adminUserId = (token as { id?: string })?.id ?? null
    const body = req.body as { admin_note?: string | null; resolved?: boolean }
    const updates: string[] = []
    const params: unknown[] = []
    let idx = 1
    if (body.admin_note !== undefined) {
      updates.push(`admin_note = $${idx}`)
      params.push(
        body.admin_note === null || body.admin_note === ""
          ? null
          : String(body.admin_note).trim().slice(0, 2000)
      )
      idx++
    }
    if (body.resolved !== undefined) {
      updates.push(`resolved = $${idx}`)
      params.push(!!body.resolved)
      idx++
      updates.push(`resolved_at = $${idx}`)
      params.push(body.resolved ? new Date() : null)
      idx++
      updates.push(`resolved_by = $${idx}`)
      params.push(body.resolved && adminUserId ? adminUserId : null)
      idx++
    }
    if (updates.length === 0) return res.status(400).json({ error: "Cần admin_note hoặc resolved" })
    params.push(messageId, userId)
    await query(
      `UPDATE ai_portal.message_feedback SET ${updates.join(", ")}
       WHERE message_id = $${idx}::uuid AND user_id = $${idx + 1}::uuid`,
      params
    )
    const row = await query(
      `SELECT message_id, user_id, admin_note, resolved, resolved_at, resolved_by
       FROM ai_portal.message_feedback WHERE message_id = $1::uuid AND user_id = $2::uuid`,
      [messageId, userId]
    )
    res.json({ feedback: row.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/admin/message-feedback/:messageId/:userId error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

messageFeedbackRouter.delete("/:messageId/:userId", adminOnly, async (req: Request, res: Response) => {
  try {
    const messageId = String(req.params.messageId).trim()
    const userId = String(req.params.userId).trim()
    if (!UUID_RE.test(messageId) || !UUID_RE.test(userId))
      return res.status(400).json({ error: "Invalid messageId or userId" })
    const result = await query(
      `DELETE FROM ai_portal.message_feedback WHERE message_id = $1::uuid AND user_id = $2::uuid`,
      [messageId, userId]
    )
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: "Góp ý không tồn tại" })
    res.json({ success: true })
  } catch (err: any) {
    console.error("DELETE /api/admin/message-feedback/:messageId/:userId error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

export { feedbackRouter, messageFeedbackRouter }
