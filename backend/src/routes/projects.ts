// routes/projects.ts
// Public API to get project info by ID (for agents, links in context)
import { Router, Request, Response } from "express"
import { query } from "../lib/db"

const router = Router()

function paramStr(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] ?? "" : p ?? ""
}

/**
 * GET /api/projects/:id - Return full project info
 * Used in context sent to agents, link shown in admin page
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id)?.trim()
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: "ID project không hợp lệ" })
    }
    const result = await query(
      `SELECT p.id, p.user_id, p.name, p.description, p.team_members, p.file_keys, p.created_at, p.updated_at,
              u.email AS user_email, u.display_name AS user_display_name, u.full_name AS user_full_name
       FROM ai_portal.projects p
       JOIN ai_portal.users u ON u.id = p.user_id
       WHERE p.id = $1::uuid LIMIT 1`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy project" })
    }
    const r = result.rows[0] as Record<string, unknown>
    const project = {
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      description: r.description,
      team_members: r.team_members ?? [],
      file_keys: r.file_keys ?? [],
      created_at: r.created_at,
      updated_at: r.updated_at,
      user: {
        email: r.user_email,
        display_name: r.user_display_name,
        full_name: r.user_full_name,
      },
    }
    res.json(project)
  } catch (err: any) {
    console.error("GET /api/projects/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

export default router
