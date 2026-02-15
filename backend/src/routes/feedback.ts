// routes/feedback.ts - Phản hồi, góp ý của người dùng về hệ thống
import { Router, Request, Response } from "express"
import { query } from "../lib/db"
import { getAssistantConfigs } from "../lib/assistants"

const router = Router()

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(";").map((s) => {
      const i = s.indexOf("=")
      const key = decodeURIComponent(s.slice(0, i).trim())
      const value = decodeURIComponent(s.slice(i + 1).trim().replace(/^"|"$/g, ""))
      return [key, value]
    })
  )
}

async function getCurrentUserId(req: Request): Promise<string | null> {
  const { getToken } = await import("next-auth/jwt")
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  return (token as { id?: string })?.id ?? null
}

// POST /api/feedback - Gửi phản hồi, góp ý
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Vui lòng đăng nhập để gửi phản hồi" })
    }
    const body = req.body as { content?: string; assistant_alias?: string | null }
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    if (!content || content.length < 5) {
      return res.status(400).json({ error: "Nội dung phản hồi cần ít nhất 5 ký tự" })
    }
    if (content.length > 4000) {
      return res.status(400).json({ error: "Nội dung phản hồi tối đa 4000 ký tự" })
    }
    let assistantAlias: string | null = null
    if (body?.assistant_alias != null && typeof body.assistant_alias === "string") {
      const alias = body.assistant_alias.trim()
      if (alias) {
        const configs = await getAssistantConfigs()
        const exists = configs.some((c) => c.alias === alias)
        if (!exists) {
          return res.status(400).json({ error: "Trợ lý không tồn tại" })
        }
        assistantAlias = alias
      }
    }
    await query(
      `INSERT INTO ai_portal.user_feedback (user_id, content, assistant_alias)
       VALUES ($1::uuid, $2, $3)`,
      [userId, content, assistantAlias]
    )
    return res.status(201).json({ success: true, message: "Đã gửi phản hồi. Cảm ơn bạn!" })
  } catch (err: any) {
    console.error("❌ POST /api/feedback error:", err)
    res.status(500).json({
      error: "Không gửi được phản hồi",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    })
  }
})

export default router
