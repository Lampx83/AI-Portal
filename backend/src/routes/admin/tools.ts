import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly } from "./middleware"

const router = Router()

router.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { ensureDefaultTools } = await import("../../lib/tools")
    await ensureDefaultTools()
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools
       ORDER BY display_order ASC, alias ASC`
    )
    const tools = (result.rows as any[]).map((a) => {
      const config = a.config_json ?? {}
      const daily_message_limit = config.daily_message_limit != null ? Number(config.daily_message_limit) : 100
      return {
        ...a,
        daily_message_limit:
          Number.isInteger(daily_message_limit) && daily_message_limit >= 0 ? daily_message_limit : 100,
      }
    })
    res.json({ tools })
  } catch (err: any) {
    console.error("Error fetching tools:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.get("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools
       WHERE id = $1::uuid`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "App not found" })
    }
    res.json({ tool: result.rows[0] })
  } catch (err: any) {
    console.error("Error fetching tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.patch("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const { base_url, is_active, display_order, config_json } = req.body
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    if (base_url !== undefined) {
      updates.push(`base_url = $${paramIndex++}`)
      values.push(base_url)
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(is_active)
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`)
      values.push(display_order)
    }
    if (config_json !== undefined) {
      updates.push(`config_json = $${paramIndex++}::jsonb`)
      values.push(JSON.stringify(config_json))
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    }
    updates.push(`updated_at = NOW()`)
    values.push(id)
    const result = await query(
      `UPDATE ai_portal.tools
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}::uuid
       RETURNING id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at`,
      values
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "App not found" })
    }
    res.json({ tool: result.rows[0] })
  } catch (err: any) {
    console.error("Error updating tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

export default router
