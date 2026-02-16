import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly } from "./middleware"

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"
const router = Router()

router.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.display_name, u.full_name, u.is_admin, COALESCE(u.role, CASE WHEN u.is_admin THEN 'admin' ELSE 'user' END) AS role, u.created_at, u.last_login_at, u.sso_provider,
             u.position, u.department_id, u.intro, u.direction,
             COALESCE(u.daily_message_limit, 10) AS daily_message_limit,
             (SELECT o.extra_messages FROM ai_portal.user_daily_limit_overrides o
              WHERE o.user_id = u.id AND o.override_date = current_date LIMIT 1) AS extra_messages_today,
             (SELECT COUNT(*)::int FROM ai_portal.messages m
              JOIN ai_portal.chat_sessions s ON s.id = m.session_id
              WHERE s.user_id = u.id AND m.role = 'user' AND m.created_at >= date_trunc('day', now())) AS daily_used
      FROM ai_portal.users u
      ORDER BY u.created_at DESC
    `)
    res.json({ users: result.rows })
  } catch (err: any) {
    console.error("Error fetching users:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      hint: "Đảm bảo đã chạy schema.sql (cột is_admin có trong ai_portal.users)",
    })
  }
})

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { hashPassword } = await import("../../lib/password")
    const { email, display_name, full_name, password } = req.body
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "email là bắt buộc" })
    }
    const emailNorm = String(email).trim().toLowerCase()
    const displayName = display_name != null ? String(display_name).trim() || null : null
    const fullName = full_name != null ? String(full_name).trim() || null : null
    const pwd = password != null ? String(password) : ""
    if (!pwd || pwd.length < 6) {
      return res.status(400).json({ error: "password bắt buộc, tối thiểu 6 ký tự" })
    }
    const existing = await query(`SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`, [
      emailNorm,
    ])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email đã tồn tại" })
    }
    const id = crypto.randomUUID()
    const passwordHash = hashPassword(pwd)
    await query(
      `INSERT INTO ai_portal.users (id, email, display_name, full_name, password_hash, password_algo, password_updated_at, is_admin, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, 'scrypt', now(), false, now(), now())`,
      [id, emailNorm, displayName ?? emailNorm.split("@")[0], fullName, passwordHash]
    )
    const created = await query(
      `SELECT id, email, display_name, full_name, is_admin, COALESCE(role, 'user') AS role, created_at, last_login_at, sso_provider FROM ai_portal.users WHERE id = $1::uuid`,
      [id]
    )
    res.status(201).json({ user: created.rows[0] })
  } catch (err: any) {
    console.error("Error creating user:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.patch("/bulk", adminOnly, async (req: Request, res: Response) => {
  try {
    const updates = req.body?.updates
    if (!Array.isArray(updates) || updates.length === 0) {
      return res
        .status(400)
        .json({
          error:
            "updates phải là mảng không rỗng, mỗi phần tử { user_id, daily_message_limit }",
        })
    }
    let affected = 0
    for (const item of updates) {
      const user_id = item?.user_id
      const daily_message_limit = item?.daily_message_limit
      if (!user_id || typeof user_id !== "string") continue
      const n = Number(daily_message_limit)
      if (!Number.isInteger(n) || n < 0) continue
      const id = String(user_id).trim().replace(/[^a-f0-9-]/gi, "")
      if (id.length !== 36) continue
      const r = await query(
        `UPDATE ai_portal.users SET daily_message_limit = $1, updated_at = now() WHERE id = $2::uuid`,
        [n, id]
      )
      if (r.rowCount && r.rowCount > 0) affected++
    }
    res.json({ ok: true, updated: affected })
  } catch (err: any) {
    console.error("Error bulk updating users:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.patch("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim().replace(/[^a-f0-9-]/gi, "")
    if (id.length !== 36) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    const { role, is_admin, display_name, full_name, password, daily_message_limit } = req.body
    const updates: string[] = ["updated_at = now()"]
    const values: unknown[] = []
    let idx = 1
    if (role === "user" || role === "admin" || role === "developer") {
      updates.push(`role = $${idx++}`)
      values.push(role)
      updates.push(`is_admin = $${idx++}`)
      values.push(role === "admin" || role === "developer")
    } else if (typeof is_admin === "boolean") {
      updates.push(`is_admin = $${idx++}`)
      values.push(is_admin)
      updates.push(`role = $${idx++}`)
      values.push(is_admin ? "admin" : "user")
    }
    if (display_name !== undefined) {
      updates.push(`display_name = $${idx++}`)
      values.push(display_name ? String(display_name).trim() : null)
    }
    if (full_name !== undefined) {
      updates.push(`full_name = $${idx++}`)
      values.push(full_name ? String(full_name).trim() : null)
    }
    if (daily_message_limit !== undefined) {
      const n = Number(daily_message_limit)
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ error: "daily_message_limit phải là số nguyên không âm" })
      }
      updates.push(`daily_message_limit = $${idx++}`)
      values.push(n)
    }
    if (password !== undefined && password !== null && String(password).length > 0) {
      const { hashPassword } = await import("../../lib/password")
      const pwd = String(password)
      if (pwd.length < 6) {
        return res.status(400).json({ error: "password tối thiểu 6 ký tự" })
      }
      updates.push(`password_hash = $${idx++}`, `password_algo = 'scrypt'`, `password_updated_at = now()`)
      values.push(hashPassword(pwd))
    }
    if (updates.length <= 1) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    }
    values.push(id)
    await query(
      `UPDATE ai_portal.users SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      values
    )
    const updated = await query(
      `SELECT id, email, display_name, full_name, is_admin, COALESCE(role, CASE WHEN is_admin THEN 'admin' ELSE 'user' END) AS role, daily_message_limit, updated_at, last_login_at, sso_provider FROM ai_portal.users WHERE id = $1::uuid`,
      [id]
    )
    if (updated.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    res.json({ user: updated.rows[0] })
  } catch (err: any) {
    console.error("Error updating user:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.post("/:id/limit-override", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim().replace(/[^a-f0-9-]/gi, "")
    if (id.length !== 36) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    const extra_messages = Number(req.body?.extra_messages ?? 0)
    if (!Number.isInteger(extra_messages) || extra_messages < 0) {
      return res.status(400).json({ error: "extra_messages phải là số nguyên không âm" })
    }
    await query(
      `INSERT INTO ai_portal.user_daily_limit_overrides (user_id, override_date, extra_messages)
       VALUES ($1::uuid, current_date, $2)
       ON CONFLICT (user_id, override_date) DO UPDATE SET extra_messages = $2`,
      [id, extra_messages]
    )
    const row = await query(
      `SELECT u.id, u.email, COALESCE(u.daily_message_limit, 10) AS base_limit,
              (SELECT o.extra_messages FROM ai_portal.user_daily_limit_overrides o
               WHERE o.user_id = u.id AND o.override_date = current_date LIMIT 1) AS extra_today
       FROM ai_portal.users u WHERE u.id = $1::uuid LIMIT 1`,
      [id]
    )
    if (row.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    const r = row.rows[0] as { base_limit: number; extra_today: number | null }
    const limit = (r.base_limit ?? 10) + (Number(r.extra_today) || 0)
    res.json({ ok: true, extra_messages, effective_limit_today: limit })
  } catch (err: any) {
    console.error("Error setting limit override:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.delete("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim().replace(/[^a-f0-9-]/gi, "")
    if (id.length !== 36) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    if (id.toLowerCase() === SYSTEM_USER_ID) {
      return res.status(403).json({ error: "Không được xóa tài khoản system" })
    }
    const result = await query(`DELETE FROM ai_portal.users WHERE id = $1::uuid RETURNING id`, [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    res.json({ ok: true })
  } catch (err: any) {
    console.error("Error deleting user:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

export default router
