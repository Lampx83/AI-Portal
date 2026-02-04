// routes/write-articles.ts - API CRUD cho bài viết trợ lý Viết
import { Router, Request, Response } from "express"
import { query } from "../lib/db"

const router = Router()

// POST /api/write-articles/export-docx - Chuyển HTML sang DOCX (dùng html-to-docx, tương thích Word/LibreOffice/Google Docs)
router.post("/export-docx", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const { html = "" } = req.body ?? {}
    const htmlStr = String(html).trim()
    if (!htmlStr) {
      return res.status(400).json({ error: "Thiếu nội dung HTML" })
    }

    const HTMLtoDOCX = require("html-to-docx")
    const result = await HTMLtoDOCX(htmlStr, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
    })

    const data = Buffer.isBuffer(result)
      ? result
      : result instanceof Uint8Array
        ? Buffer.from(result)
        : Buffer.from(result as ArrayBuffer)

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    res.setHeader("Content-Disposition", 'attachment; filename="document.docx"')
    res.send(data)
  } catch (err: any) {
    console.error("POST /api/write-articles/export-docx error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function paramId(req: Request): string {
  const p = req.params.id
  return Array.isArray(p) ? (p[0] ?? "") : (p ?? "")
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(";").map((s) => {
      const i = s.indexOf("=")
      const key = decodeURIComponent(s.slice(0, i).trim())
      const value = decodeURIComponent(s.slice(i + 1).trim().replace(/^"|"$/g, ""))
      return [key, value]
    })
  )
}

async function getCurrentUserId(req: Request): Promise<string | null> {
  const { getToken } = await import("next-auth/jwt")
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  return (token as { id?: string })?.id ?? null
}

// GET /api/write-articles - Danh sách bài viết của user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)

    const rows = await query(
      `SELECT id, user_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at
       FROM research_chat.write_articles
       WHERE user_id = $1::uuid
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM research_chat.write_articles WHERE user_id = $1::uuid`,
      [userId]
    )

    res.json({
      articles: rows.rows,
      page: { limit, offset, total: countRes.rows[0]?.total ?? 0 },
    })
  } catch (err: any) {
    console.error("GET /api/write-articles error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// GET /api/write-articles/shared/:token - Lấy bài viết theo share token (yêu cầu đăng nhập)
router.get("/shared/:token", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const token = String(req.params.token || "").trim()
    if (!token) {
      return res.status(400).json({ error: "Thiếu token chia sẻ" })
    }

    const rows = await query(
      `SELECT id, user_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at, share_token
       FROM research_chat.write_articles
       WHERE share_token = $1
       LIMIT 1`,
      [token]
    )

    if (rows.rows.length === 0) {
      return res.status(404).json({ error: "Link chia sẻ không hợp lệ hoặc đã hết hạn" })
    }

    res.json({ article: rows.rows[0] })
  } catch (err: any) {
    console.error("GET /api/write-articles/shared/:token error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// PATCH /api/write-articles/shared/:token - Cập nhật bài viết qua share token
router.patch("/shared/:token", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const token = String(req.params.token || "").trim()
    if (!token) {
      return res.status(400).json({ error: "Thiếu token chia sẻ" })
    }

    const { title, content, template_id, references_json } = req.body ?? {}
    const updates: string[] = []
    const params: any[] = []
    let p = 1

    if (title !== undefined) {
      updates.push(`title = $${p++}`)
      params.push(String(title).slice(0, 500))
    }
    if (content !== undefined) {
      updates.push(`content = $${p++}`)
      params.push(String(content))
    }
    if (template_id !== undefined) {
      updates.push(`template_id = $${p++}`)
      params.push(template_id || null)
    }
    if (references_json !== undefined) {
      updates.push(`references_json = $${p++}::jsonb`)
      params.push(Array.isArray(references_json) ? JSON.stringify(references_json) : "[]")
    }

    if (updates.length === 0) {
      const existing = await query(
        `SELECT id, user_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at
         FROM research_chat.write_articles WHERE share_token = $1`,
        [token]
      )
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Link chia sẻ không hợp lệ hoặc đã hết hạn" })
      }
      return res.json({ article: existing.rows[0] })
    }

    updates.push(`updated_at = now()`)
    params.push(token)
    const tokenParam = p

    const rows = await query(
      `UPDATE research_chat.write_articles
       SET ${updates.join(", ")}
       WHERE share_token = $${tokenParam}::text
       RETURNING id, user_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at`,
      params
    )

    if (rows.rows.length === 0) {
      return res.status(404).json({ error: "Link chia sẻ không hợp lệ hoặc đã hết hạn" })
    }

    res.json({ article: rows.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/write-articles/shared/:token error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// POST /api/write-articles/:id/share - Tạo link chia sẻ (chủ sở hữu)
router.post("/:id/share", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const crypto = await import("crypto")
    const token = crypto.randomBytes(16).toString("hex")

    const result = await query(
      `UPDATE research_chat.write_articles
       SET share_token = $1
       WHERE id = $2::uuid AND user_id = $3::uuid
       RETURNING id, share_token`,
      [token, id, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" })
    }

    const base = (process.env.NEXTAUTH_URL || "https://research.neu.edu.vn").replace(/\/$/, "")
    const shareUrl = `${base}/assistants/write?share=${token}`

    res.json({ share_token: token, share_url: shareUrl })
  } catch (err: any) {
    console.error("POST /api/write-articles/:id/share error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// DELETE /api/write-articles/:id/share - Thu hồi link chia sẻ (chủ sở hữu)
router.delete("/:id/share", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    await query(
      `UPDATE research_chat.write_articles SET share_token = NULL WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    )

    res.status(204).send()
  } catch (err: any) {
    console.error("DELETE /api/write-articles/:id/share error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// GET /api/write-articles/:id - Chi tiết 1 bài viết
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const rows = await query(
      `SELECT id, user_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at, share_token
       FROM research_chat.write_articles
       WHERE id = $1::uuid AND user_id = $2::uuid
       LIMIT 1`,
      [id, userId]
    )

    if (rows.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" })
    }

    res.json({ article: rows.rows[0] })
  } catch (err: any) {
    console.error("GET /api/write-articles/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// POST /api/write-articles - Tạo bài viết mới
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const { title = "Tài liệu chưa có tiêu đề", content = "", template_id = null, references_json = [] } = req.body ?? {}

    const refsJson = Array.isArray(references_json) ? JSON.stringify(references_json) : "[]"

    const rows = await query(
      `INSERT INTO research_chat.write_articles (user_id, title, content, template_id, references_json)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb)
       RETURNING id, user_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at`,
      [userId, String(title).slice(0, 500), String(content), template_id || null, refsJson]
    )

    res.status(201).json({ article: rows.rows[0] })
  } catch (err: any) {
    console.error("POST /api/write-articles error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// PATCH /api/write-articles/:id - Cập nhật bài viết
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const { title, content, template_id, references_json } = req.body ?? {}
    const updates: string[] = []
    const params: any[] = []
    let p = 1

    if (title !== undefined) {
      updates.push(`title = $${p++}`)
      params.push(String(title).slice(0, 500))
    }
    if (content !== undefined) {
      updates.push(`content = $${p++}`)
      params.push(String(content))
    }
    if (template_id !== undefined) {
      updates.push(`template_id = $${p++}`)
      params.push(template_id || null)
    }
    if (references_json !== undefined) {
      updates.push(`references_json = $${p++}::jsonb`)
      params.push(Array.isArray(references_json) ? JSON.stringify(references_json) : "[]")
    }

    if (updates.length === 0) {
      const existing = await query(
        `SELECT id, user_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at
         FROM research_chat.write_articles WHERE id = $1::uuid AND user_id = $2::uuid`,
        [id, userId]
      )
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy bài viết" })
      }
      return res.json({ article: existing.rows[0] })
    }

    updates.push(`updated_at = now()`)
    params.push(id, userId)
    const whereIdParam = p
    const whereUserIdParam = p + 1

    const rows = await query(
      `UPDATE research_chat.write_articles
       SET ${updates.join(", ")}
       WHERE id = $${whereIdParam}::uuid AND user_id = $${whereUserIdParam}::uuid
       RETURNING id, user_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at`,
      params
    )

    if (rows.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" })
    }

    res.json({ article: rows.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/write-articles/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// DELETE /api/write-articles/:id - Xóa bài viết
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const result = await query(
      `DELETE FROM research_chat.write_articles WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    )

    if ((result as any).rowCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" })
    }

    res.status(204).send()
  } catch (err: any) {
    console.error("DELETE /api/write-articles/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

export default router
