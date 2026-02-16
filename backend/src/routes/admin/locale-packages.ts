import { Router, Request, Response } from "express"
import { writeLocaleFile, getTemplateStrings } from "../../lib/locale-packages"
import { adminOnly } from "./middleware"

const router = Router()

router.get("/template", adminOnly, async (req: Request, res: Response) => {
  try {
    const strings = getTemplateStrings()
    const payload = { locale: "en", name: "English (template)", strings }
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Content-Disposition", 'attachment; filename="locale-template.json"')
    res.json(payload)
  } catch (err: any) {
    console.error("GET /api/admin/locale-packages/template error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { locale: localeCode, name, strings: stringsObj } = req.body ?? {}
    const locale = String(localeCode ?? "").trim().toLowerCase()
    if (!locale || locale.length < 2 || locale.length > 20 || !/^[a-z0-9]+$/.test(locale)) {
      return res.status(400).json({ error: "locale must be 2–20 lowercase letters/numbers" })
    }
    if (typeof stringsObj !== "object" || stringsObj === null) {
      return res.status(400).json({ error: "strings must be { [key]: string }" })
    }
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(stringsObj as Record<string, string>)) {
      const k = String(key).trim()
      if (k) out[k] = String(value ?? "")
    }
    await writeLocaleFile(locale, out)
    res.json({ ok: true, locale, name: name ?? locale, inserted: Object.keys(out).length })
  } catch (err: any) {
    console.error("POST /api/admin/locale-packages error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

export default router
