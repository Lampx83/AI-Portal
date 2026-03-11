// routes/categories.ts – Public API: danh sách category cho Store
import { Router, Request, Response } from "express"
import { query } from "../lib/db"

const router = Router()

// GET /api/categories – list categories (public, for Store)
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await query<{ id: string; slug: string; name: string; display_order: number }>(
      `SELECT id, slug, name, display_order
       FROM ai_portal.tool_categories
       ORDER BY display_order ASC, slug ASC`
    )
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
    res.json({ categories: result.rows })
  } catch (err: any) {
    if (err?.code === "42P01") {
      res.setHeader("Cache-Control", "public, max-age=60")
      return res.json({ categories: [] })
    }
    console.error("GET /api/categories error:", err)
    res.status(500).json({
      error: "Failed to fetch categories",
      message: err?.message || "Unknown error",
    })
  }
})

export default router
