import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly } from "./middleware"

const router = Router()

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { user_id, user_email, title, body } = req.body ?? {}
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "title là bắt buộc" })
    }
    let targetUserId: string | null = null
    if (user_id && typeof user_id === "string") {
      targetUserId = user_id.trim()
    } else if (user_email && typeof user_email === "string") {
      const r = await query(`SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`, [
        user_email.trim().toLowerCase(),
      ])
      if (r.rows[0]?.id) targetUserId = (r.rows[0] as { id: string }).id
    }
    if (!targetUserId) {
      return res.status(400).json({ error: "Cần user_id hoặc user_email hợp lệ" })
    }
    await query(
      `INSERT INTO ai_portal.notifications (user_id, type, title, body, payload)
       VALUES ($1::uuid, 'system', $2, $3, '{}'::jsonb)`,
      [targetUserId, title.trim(), body != null ? String(body).trim() : null]
    )
    res.status(201).json({ ok: true, message: "Đã gửi thông báo" })
  } catch (err: any) {
    console.error("POST /api/admin/notifications error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

export default router
