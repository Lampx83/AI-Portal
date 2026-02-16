import { Router, Request, Response } from "express"
import { readLocaleFile, writeLocaleFile, listLocaleFiles } from "../../lib/locale-packages"
import { adminOnly } from "./middleware"

const router = Router()

router.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const locales = await listLocaleFiles()
    const builtin = ["en", "vi", "zh", "ja", "fr"]
    const allLocales = [...new Set([...builtin, ...locales])].sort()
    const byKey: Record<string, Record<string, string>> = {}
    for (const loc of allLocales) {
      const strings = await readLocaleFile(loc)
      for (const [key, value] of Object.entries(strings)) {
        if (!byKey[key]) byKey[key] = {}
        byKey[key][loc] = value
      }
    }
    res.json({ strings: byKey })
  } catch (err: any) {
    console.error("GET /api/admin/site-strings error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.patch("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { strings } = req.body ?? {}
    if (typeof strings !== "object" || strings === null) {
      return res.status(400).json({ error: "Body must be { strings: { [key]: { [locale]?: string } } }" })
    }
    const localesToUpdate = new Set<string>()
    for (const [, locales] of Object.entries(strings as Record<string, Record<string, string>>)) {
      if (typeof locales === "object" && locales !== null) {
        for (const loc of Object.keys(locales)) {
          const l = String(loc).trim().toLowerCase()
          if (l && l.length <= 20) localesToUpdate.add(l)
        }
      }
    }
    for (const locale of localesToUpdate) {
      const current = await readLocaleFile(locale)
      for (const [key, locales] of Object.entries(strings as Record<string, Record<string, string>>)) {
        const k = String(key).trim()
        if (!k || typeof locales !== "object" || locales === null) continue
        const val = locales[locale]
        if (val !== undefined) current[k] = String(val ?? "")
      }
      await writeLocaleFile(locale, current)
    }
    const allLocales = [...new Set([...(await listLocaleFiles()), "en", "vi", "zh", "ja", "fr"])].sort()
    const byKey: Record<string, Record<string, string>> = {}
    for (const loc of allLocales) {
      const str = await readLocaleFile(loc)
      for (const [key, value] of Object.entries(str)) {
        if (!byKey[key]) byKey[key] = {}
        byKey[key][loc] = value
      }
    }
    res.json({ strings: byKey })
  } catch (err: any) {
    console.error("PATCH /api/admin/site-strings error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

export default router
