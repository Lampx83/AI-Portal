/**
 * Admin: edit page content (Welcome, Guide). Stored in app_settings.
 */
import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly } from "./middleware"

const router = Router()

export type WelcomePageConfig = {
  title?: string
  subtitle?: string
  cards?: { title: string; description: string; icon?: string; targetType?: "assistant" | "tool"; targetAlias?: string }[]
}

export type GuidePageConfig = {
  title?: string
  subtitle?: string
  cards?: { title: string; description: string; icon?: string; targetType?: "assistant" | "tool"; targetAlias?: string }[]
}

const WELCOME_KEY = "welcome_page_config"
const GUIDE_KEY = "guide_page_config"

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === "") return fallback
  try {
    const v = JSON.parse(raw)
    return v as T
  } catch {
    return fallback
  }
}

/** GET /api/admin/pages/welcome */
router.get("/welcome", adminOnly, async (_req: Request, res: Response) => {
  try {
    const r = await query<{ value: string }>(
      `SELECT value FROM ai_portal.app_settings WHERE key = $1 LIMIT 1`,
      [WELCOME_KEY]
    )
    const raw = r.rows[0]?.value
    const config: WelcomePageConfig = parseJson(raw, { title: "", subtitle: "", cards: [] })
    if (!Array.isArray(config.cards)) config.cards = []
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal Server Error" })
  }
})

/** PATCH /api/admin/pages/welcome - Body: { title?: string, subtitle?: string, cards?: { title, description }[] } */
router.patch("/welcome", adminOnly, async (req: Request, res: Response) => {
  try {
    const { title, subtitle, cards } = req.body ?? {}
    const config: WelcomePageConfig = {
      title: typeof title === "string" ? title.trim() : "",
      subtitle: typeof subtitle === "string" ? subtitle.trim() : "",
      cards: Array.isArray(cards)
        ? cards.map((c: any) => ({
            title: c && typeof c.title === "string" ? String(c.title).trim() : "",
            description: c && typeof c.description === "string" ? String(c.description).trim() : "",
            icon: c && typeof c.icon === "string" && String(c.icon).trim() ? String(c.icon).trim() : undefined,
            targetType:
              c && (c.targetType === "assistant" || c.target_type === "assistant" || c.targetType === "tool" || c.target_type === "tool")
                ? (c.targetType ?? c.target_type)
                : undefined,
            targetAlias:
              c && typeof (c.targetAlias ?? c.target_alias) === "string" && String(c.targetAlias ?? c.target_alias).trim()
                ? String(c.targetAlias ?? c.target_alias).trim()
                : undefined,
          }))
        : [],
    }
    const value = JSON.stringify(config)
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [WELCOME_KEY, value]
    )
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal Server Error" })
  }
})

/** GET /api/admin/pages/guide */
router.get("/guide", adminOnly, async (_req: Request, res: Response) => {
  try {
    const r = await query<{ value: string }>(
      `SELECT value FROM ai_portal.app_settings WHERE key = $1 LIMIT 1`,
      [GUIDE_KEY]
    )
    const raw = r.rows[0]?.value
    const config: GuidePageConfig = parseJson(raw, { title: "", subtitle: "", cards: [] })
    if (!Array.isArray(config.cards)) config.cards = []
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal Server Error" })
  }
})

/** PATCH /api/admin/pages/guide - Body: { title?: string, subtitle?: string, cards?: { title, description }[] } */
router.patch("/guide", adminOnly, async (req: Request, res: Response) => {
  try {
    const { title, subtitle, cards } = req.body ?? {}
    const config: GuidePageConfig = {
      title: typeof title === "string" ? title.trim() : "",
      subtitle: typeof subtitle === "string" ? subtitle.trim() : "",
      cards: Array.isArray(cards)
        ? cards
            .filter((c: any) => c && typeof c.title === "string")
            .map((c: any) => ({
              title: String(c.title).trim(),
              description: typeof c.description === "string" ? c.description.trim() : "",
              icon: c && typeof c.icon === "string" && String(c.icon).trim() ? String(c.icon).trim() : undefined,
              targetType:
                c && (c.targetType === "assistant" || c.target_type === "assistant" || c.targetType === "tool" || c.target_type === "tool")
                  ? (c.targetType ?? c.target_type)
                  : undefined,
              targetAlias:
                c && typeof (c.targetAlias ?? c.target_alias) === "string" && String(c.targetAlias ?? c.target_alias).trim()
                  ? String(c.targetAlias ?? c.target_alias).trim()
                  : undefined,
            }))
        : [],
    }
    const value = JSON.stringify(config)
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [GUIDE_KEY, value]
    )
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal Server Error" })
  }
})

export default router
