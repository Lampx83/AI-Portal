// routes/feedback.ts - User feedback and suggestions for the system
import { Router, Request, Response } from "express"
import { query } from "../lib/db"
import { getAssistantConfigs } from "../lib/assistants"
import { getSetting } from "../lib/settings"

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
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  return (token as { id?: string })?.id ?? null
}

// POST /api/feedback - Submit feedback/suggestions
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "feedback.loginRequired" })
    }
    const body = req.body as { content?: string; assistant_alias?: string | null }
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    if (!content || content.length < 5) {
      return res.status(400).json({ error: "feedback.minLength" })
    }
    if (content.length > 4000) {
      return res.status(400).json({ error: "feedback.maxLength" })
    }
    let assistantAlias: string | null = null
    if (body?.assistant_alias != null && typeof body.assistant_alias === "string") {
      const alias = body.assistant_alias.trim()
      if (alias) {
        const configs = await getAssistantConfigs()
        const exists = configs.some((c) => c.alias === alias)
        if (!exists) {
          return res.status(400).json({ error: "feedback.assistantNotFound" })
        }
        assistantAlias = alias
      }
    }
    await query(
      `INSERT INTO ai_portal.user_feedback (user_id, content, assistant_alias)
       VALUES ($1::uuid, $2, $3)`,
      [userId, content, assistantAlias]
    )
    return res.status(201).json({ success: true, message: "feedback.thankYou" })
  } catch (err: any) {
    console.error("POST /api/feedback error:", err)
    res.status(500).json({
      error: "feedback.sendError",
      message: getSetting("DEBUG") === "true" ? err.message : undefined,
    })
  }
})

export default router
