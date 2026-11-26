// routes/feedback-hub.ts - Cấp token + cấu hình công khai cho widget Feedback Hub
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import { getSetting } from "../lib/settings"
import { hubEnabled, hubProject, hubUrl, signFeedbackToken } from "../lib/feedback-hub"

const router = Router()

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(";").map((s) => {
      const i = s.indexOf("=")
      return [decodeURIComponent(s.slice(0, i).trim()), decodeURIComponent(s.slice(i + 1).trim().replace(/^"|"$/g, ""))]
    })
  )
}

async function currentUserId(req: Request): Promise<string | null> {
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const token = await getToken({ req: { cookies: parseCookies(req.headers.cookie), headers: req.headers } as any, secret })
  return (token as { id?: string } | null)?.id ?? null
}

// GET /api/feedback-hub/config — công khai, KHÔNG chứa khoá ký.
router.get("/config", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store")
  if (!hubEnabled()) return res.json({ enabled: false })
  res.json({ enabled: true, hubUrl: hubUrl(), project: hubProject() })
})

// GET /api/feedback-hub/token — chỉ người đã đăng nhập; danh tính lấy từ DB theo phiên, không từ tham số.
router.get("/token", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store")
  if (!hubEnabled()) return res.status(404).json({ error: "Not found" })
  try {
    const uid = await currentUserId(req)
    if (!uid) return res.status(401).json({ error: "Unauthorized" })
    const r = await query<{ id: string; email: string | null; name: string | null; is_admin: boolean; role: string }>(
      `SELECT id::text AS id, email::text AS email, COALESCE(NULLIF(full_name, ''), NULLIF(display_name, ''), email::text) AS name, is_admin, role
       FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
      [uid]
    )
    const u = r.rows[0]
    if (!u) return res.status(401).json({ error: "Unauthorized" })
    const token = signFeedbackToken({ id: u.id, name: u.name || "Người dùng", email: u.email, admin: u.is_admin || u.role === "admin" })
    if (!token) return res.status(404).json({ error: "Not found" })
    res.json({ token })
  } catch (err) {
    console.error("GET /api/feedback-hub/token error:", err)
    res.status(500).json({ error: "Internal error" })
  }
})

export default router
