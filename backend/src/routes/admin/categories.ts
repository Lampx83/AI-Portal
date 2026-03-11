import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly } from "./middleware"

const router = Router()

export type ToolCategoryRow = {
  id: string
  slug: string
  name: string
  display_order: number
  created_at: string
  updated_at: string
}

// GET /api/admin/categories – list all (admin)
router.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query<ToolCategoryRow>(
      `SELECT id, slug, name, display_order, created_at, updated_at
       FROM ai_portal.tool_categories
       ORDER BY display_order ASC, slug ASC`
    )
    res.json({ categories: result.rows })
  } catch (err: any) {
    console.error("GET /admin/categories error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// POST /api/admin/categories – create
router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { slug, name, display_order } = req.body ?? {}
    const s = typeof slug === "string" ? slug.trim().toLowerCase().replace(/\s+/g, "-") : ""
    const n = typeof name === "string" ? name.trim() : ""
    if (!s || !n) {
      return res.status(400).json({ error: "slug và name là bắt buộc" })
    }
    const order = Number(display_order)
    const result = await query<ToolCategoryRow>(
      `INSERT INTO ai_portal.tool_categories (slug, name, display_order)
       VALUES ($1, $2, $3)
       RETURNING id, slug, name, display_order, created_at, updated_at`,
      [s, n, Number.isInteger(order) ? order : 0]
    )
    res.status(201).json({ category: result.rows[0] })
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Category với slug này đã tồn tại" })
    console.error("POST /admin/categories error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// PATCH /api/admin/categories/:id
router.patch("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "").trim()
    const { slug, name, display_order } = req.body ?? {}
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    if (typeof slug === "string") {
      const s = slug.trim().toLowerCase().replace(/\s+/g, "-")
      if (s) {
        updates.push(`slug = $${paramIndex++}`)
        values.push(s)
      }
    }
    if (typeof name === "string") {
      const n = name.trim()
      if (n) {
        updates.push(`name = $${paramIndex++}`)
        values.push(n)
      }
    }
    if (typeof display_order === "number" && Number.isInteger(display_order)) {
      updates.push(`display_order = $${paramIndex++}`)
      values.push(display_order)
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    }
    updates.push("updated_at = now()")
    values.push(id)
    const result = await query<ToolCategoryRow>(
      `UPDATE ai_portal.tool_categories
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}::uuid
       RETURNING id, slug, name, display_order, created_at, updated_at`,
      values
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category không tồn tại" })
    }
    res.json({ category: result.rows[0] })
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Category với slug này đã tồn tại" })
    console.error("PATCH /admin/categories/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// DELETE /api/admin/categories/:id – set tools' category_id to null then delete
router.delete("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "").trim()
    await query(`UPDATE ai_portal.tools SET category_id = NULL WHERE category_id = $1::uuid`, [id])
    const result = await query(`DELETE FROM ai_portal.tool_categories WHERE id = $1::uuid RETURNING id`, [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category không tồn tại" })
    }
    res.json({ success: true, message: "Đã xóa category" })
  } catch (err: any) {
    console.error("DELETE /admin/categories/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

export default router
