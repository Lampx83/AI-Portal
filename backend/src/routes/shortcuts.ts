// shortcuts.ts – Public API: shortcut list (external app links)
import { Router, Request, Response } from "express"
import { query } from "../lib/db"

const router = Router()

export type ShortcutRow = {
  id: string
  name: string
  description: string | null
  url: string
  icon: string
  display_order: number
}

/** GET /api/shortcuts – List shortcuts (links), ordered by display_order */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await query<ShortcutRow>(
      `SELECT id, name, description, url, icon, display_order
       FROM ai_portal.shortcuts
       ORDER BY display_order ASC, name ASC`
    )
    res.json({ shortcuts: result.rows })
  } catch (err: any) {
    console.error("GET /api/shortcuts error:", err)
    if (err?.message?.includes("shortcuts") && err?.message?.includes("does not exist")) {
      return res.json({ shortcuts: [] })
    }
    res.status(500).json({ error: "Lỗi tải danh sách shortcut", message: err?.message })
  }
})

export default router
