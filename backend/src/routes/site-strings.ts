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
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
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
    let publicLocales: string[] = []
    try {
      const def = await query(
        `SELECT key, value FROM ai_portal.app_settings WHERE key IN ('default_locale', 'public_locales')`
      )
      const map: Record<string, string> = {}
      for (const r of def.rows as { key: string; value?: string }[]) map[r.key] = (r.value ?? "").trim()
      if (map.default_locale && combined.includes(map.default_locale)) defaultLocale = map.default_locale
      publicLocales = String(map.public_locales || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => combined.includes(s))
    } catch {
      // schema may not exist
    }
    // Ngôn ngữ hiển thị cho người dùng: admin bật (>1 mới hiện switcher). Chưa đặt → chỉ ngôn ngữ mặc định.
    if (publicLocales.length === 0) publicLocales = [defaultLocale]
    if (!publicLocales.includes(defaultLocale)) publicLocales = [defaultLocale, ...publicLocales]
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
    res.json({ locales: combined, defaultLocale, publicLocales })
  } catch (err: any) {
    const code = err?.code as string | undefined
    const msg = err?.message ?? ""
    const isSetupPhase =
      code === "42P01" ||
      /relation\s+["']?[\w.]*["']?\s+does not exist/i.test(msg) ||
      /database\s+["'].*["']\s+does not exist/i.test(msg)
    if (isSetupPhase) {
      res.json({ locales: BUILTIN_LOCALES, defaultLocale: "en", publicLocales: ["en"] })
      return
    }
    console.error("GET /api/site-strings/available-locales error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

export default router
