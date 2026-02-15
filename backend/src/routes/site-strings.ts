// GET /api/site-strings?locale=vi — Chuỗi hiển thị theo ngôn ngữ (public, dùng cho rebrand)
import { Router, Request, Response } from "express"
import { query } from "../lib/db"

const router = Router()
const VALID_LOCALES = ["vi", "en"]

router.get("/", async (req: Request, res: Response) => {
  try {
    const locale = (req.query.locale as string)?.trim() || "vi"
    if (!VALID_LOCALES.includes(locale)) {
      return res.status(400).json({ error: "locale phải là vi hoặc en" })
    }
    const result = await query(
      `SELECT key, value FROM ai_portal.site_strings WHERE locale = $1`,
      [locale]
    )
    const strings: Record<string, string> = {}
    for (const row of result.rows as { key: string; value: string }[]) {
      strings[row.key] = row.value ?? ""
    }
    res.json(strings)
  } catch (err: any) {
    const code = err?.code as string | undefined
    const msg = err?.message ?? ""
    const isSetupPhase =
      code === "42P01" ||
      /relation\s+["']?[\w.]*["']?\s+does not exist/i.test(msg) ||
      /database\s+["'].*["']\s+does not exist/i.test(msg)
    if (isSetupPhase) {
      res.json({})
      return
    }
    console.error("GET /api/site-strings error:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

export default router
