// GET /api/site-strings?locale=vi — Display strings by locale (from locale packages: data/locales/{locale}.json).
import { Router, Request, Response } from "express"
import { query } from "../lib/db"
import { readLocaleFile, listLocaleFiles } from "../lib/locale-packages"

const router = Router()
const BUILTIN_LOCALES = ["en", "vi", "zh", "ja", "fr"]

router.get("/", async (req: Request, res: Response) => {
  try {
    const locale = (req.query.locale as string)?.trim() || "en"
    if (!locale || locale.length > 20) {
      return res.status(400).json({ error: "Invalid locale" })
    }
    let strings = await readLocaleFile(locale)
    if (Object.keys(strings).length === 0 && ["zh", "ja", "fr"].includes(locale)) {
      strings = await readLocaleFile("en")
    }
    res.json(strings)
  } catch (err: any) {
    console.error("GET /api/site-strings error:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

router.get("/available-locales", async (req: Request, res: Response) => {
  try {
    const fromFiles = await listLocaleFiles()
    const combined = [...new Set([...BUILTIN_LOCALES, ...fromFiles])].sort()
    let defaultLocale = "en"
    try {
      const def = await query(
        `SELECT value FROM ai_portal.app_settings WHERE key = 'default_locale' LIMIT 1`
      )
      const v = (def.rows[0] as { value?: string } | undefined)?.value?.trim()
      if (v && combined.includes(v)) defaultLocale = v
    } catch {
      // schema may not exist
    }
    res.json({ locales: combined, defaultLocale })
  } catch (err: any) {
    const code = err?.code as string | undefined
    const msg = err?.message ?? ""
    const isSetupPhase =
      code === "42P01" ||
      /relation\s+["']?[\w.]*["']?\s+does not exist/i.test(msg) ||
      /database\s+["'].*["']\s+does not exist/i.test(msg)
    if (isSetupPhase) {
      res.json({ locales: BUILTIN_LOCALES, defaultLocale: "en" })
      return
    }
    console.error("GET /api/site-strings/available-locales error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

export default router
