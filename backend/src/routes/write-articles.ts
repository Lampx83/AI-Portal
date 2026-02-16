// routes/write-articles.ts - API CRUD cho bài viết trợ lý Viết
import { Router, Request, Response } from "express"
import { query } from "../lib/db"
import { getSetting } from "../lib/settings"

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
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  return (token as { id?: string })?.id ?? null
}

async function getCurrentUser(req: Request): Promise<{ id: string; email?: string; name?: string } | null> {
  const { getToken } = await import("next-auth/jwt")
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  if (!token) return null
  const t = token as { id?: string; email?: string; name?: string }
  if (!t.id) return null
  return { id: t.id, email: t.email, name: t.name }
}

/** Kiểm tra user có quyền đọc/sửa bài viết: là chủ bài viết hoặc là thành viên dự án của bài viết */
async function canAccessArticle(
  userId: string,
  userEmail: string | undefined,
  articleId: string,
  _mode: "read" | "write"
): Promise<boolean> {
  const art = await query<{ user_id: string; project_id: string | null }>(
    `SELECT user_id, project_id FROM ai_portal.write_articles WHERE id = $1::uuid LIMIT 1`,
    [articleId]
  )
  if (art.rows.length === 0) return false
  const row = art.rows[0]
  if (row.user_id === userId) return true
  if (!row.project_id || !userEmail) return false
  const proj = await query<{ user_id: string; team_members: unknown }>(
    `SELECT user_id, team_members FROM ai_portal.projects WHERE id = $1::uuid LIMIT 1`,
    [row.project_id]
  )
  if (proj.rows.length === 0) return false
  const members = proj.rows[0].team_members
  const arr = Array.isArray(members) ? members.map((m: unknown) => String(m).trim().toLowerCase()) : []
  return arr.includes(userEmail.trim().toLowerCase())
}

// GET /api/write-articles - Danh sách bài viết của user (optional: ?project_id=xxx để lọc theo project)
// Khi có project_id: trả về bài viết của chủ dự án (để thành viên cộng tác thấy cùng 1 tài liệu)
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const currentUser = await getCurrentUser(req)
    const userEmail = currentUser?.email ?? undefined

    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)
    const projectId = (req.query.project_id as string)?.trim()
    const hasProjectId = projectId && UUID_RE.test(projectId)

    let whereClause: string
    let listParams: unknown[]
    let countParams: unknown[]

    if (!hasProjectId) {
      whereClause = "WHERE user_id = $1::uuid"
      listParams = [userId, limit, offset]
      countParams = [userId]
    } else {
      const proj = await query<{ user_id: string; team_members: unknown }>(
        `SELECT user_id, team_members FROM ai_portal.projects WHERE id = $1::uuid LIMIT 1`,
        [projectId]
      )
      if (proj.rows.length === 0) {
        return res.json({ articles: [], page: { limit, offset, total: 0 } })
      }
      const ownerId = proj.rows[0].user_id
      const members = proj.rows[0].team_members
      const arr = Array.isArray(members) ? members.map((m: unknown) => String(m).trim().toLowerCase()) : []
      const isOwner = ownerId === userId
      const isMember = !!userEmail && arr.includes(userEmail.trim().toLowerCase())
      if (!isOwner && !isMember) {
        return res.json({ articles: [], page: { limit, offset, total: 0 } })
      }
      const authorId = isOwner ? userId : ownerId
      whereClause = "WHERE user_id = $1::uuid AND project_id = $2::uuid"
      listParams = [authorId, projectId, limit, offset]
      countParams = [authorId, projectId]
    }

    const limitOffset = hasProjectId ? "LIMIT $3 OFFSET $4" : "LIMIT $2 OFFSET $3"
    const rows = await query(
      `SELECT id, user_id, project_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at
       FROM ai_portal.write_articles
       ${whereClause}
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       ${limitOffset}`,
      listParams
    )
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM ai_portal.write_articles ${whereClause}`,
      countParams
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
      `SELECT id, user_id, project_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at, share_token
       FROM ai_portal.write_articles
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

    const body = req.body ?? {}
    const { title, content, template_id } = body
    const refsRaw = body.references_json ?? body.references
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
    if (refsRaw !== undefined) {
      updates.push(`references_json = $${p++}::jsonb`)
      params.push(Array.isArray(refsRaw) ? JSON.stringify(refsRaw) : "[]")
    }

    if (updates.length === 0) {
      const existing = await query(
        `SELECT id, user_id, project_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at
         FROM ai_portal.write_articles WHERE share_token = $1`,
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
      `UPDATE ai_portal.write_articles
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
      `UPDATE ai_portal.write_articles
       SET share_token = $1
       WHERE id = $2::uuid AND user_id = $3::uuid
       RETURNING id, share_token`,
      [token, id, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" })
    }

    const base = (getSetting("NEXTAUTH_URL", "http://localhost:3000")).replace(/\/$/, "")
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
      `UPDATE ai_portal.write_articles SET share_token = NULL WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    )

    res.status(204).send()
  } catch (err: any) {
    console.error("DELETE /api/write-articles/:id/share error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

const MAX_VERSIONS_PER_ARTICLE = 100

// GET /api/write-articles/:id/versions - Danh sách phiên bản (trước GET /:id)
router.get("/:id/versions", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }
    const canAccess = await isArticleOwner(id, userId)
    if (!canAccess) {
      return res.status(404).json({ error: "Không có quyền xem bài viết này" })
    }
    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const rows = await query(
      `SELECT id, article_id, title, content, references_json, created_at
       FROM ai_portal.write_article_versions
       WHERE article_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, limit]
    )
    res.json({ versions: rows.rows })
  } catch (err: any) {
    console.error("GET /api/write-articles/:id/versions error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// GET /api/write-articles/:id/versions/:vid - Chi tiết 1 phiên bản
router.get("/:id/versions/:vid", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const id = paramId(req)
    const vid = (req.params as { vid?: string }).vid
    if (!UUID_RE.test(id) || !vid || !UUID_RE.test(vid)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }
    const canAccess = await isArticleOwner(id, userId)
    if (!canAccess) {
      return res.status(404).json({ error: "Không có quyền xem bài viết này" })
    }
    const rows = await query(
      `SELECT id, article_id, title, content, references_json, created_at
       FROM ai_portal.write_article_versions
       WHERE id = $1::uuid AND article_id = $2::uuid
       LIMIT 1`,
      [vid, id]
    )
    if (rows.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy phiên bản" })
    }
    res.json({ version: rows.rows[0] })
  } catch (err: any) {
    console.error("GET /api/write-articles/:id/versions/:vid error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// POST /api/write-articles/:id/versions/:vid/restore - Khôi phục phiên bản (ghi đè nội dung hiện tại)
router.post("/:id/versions/:vid/restore", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const currentUser = await getCurrentUser(req)
    const userEmail = currentUser?.email ?? undefined
    const id = paramId(req)
    const vid = (req.params as { vid?: string }).vid
    if (!UUID_RE.test(id) || !vid || !UUID_RE.test(vid)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }
    const canAccess = await canAccessArticle(userId, userEmail, id, "write")
    if (!canAccess) {
      return res.status(404).json({ error: "Không có quyền chỉnh sửa bài viết này" })
    }
    const verRows = await query(
      `SELECT title, content, references_json FROM ai_portal.write_article_versions
       WHERE id = $1::uuid AND article_id = $2::uuid LIMIT 1`,
      [vid, id]
    )
    if (verRows.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy phiên bản" })
    }
    const v = verRows.rows[0]
    const upd = await query(
      `UPDATE ai_portal.write_articles
       SET title = $1, content = $2, references_json = $3::jsonb, updated_at = now()
       WHERE id = $4::uuid AND user_id = $5::uuid
       RETURNING id, user_id, project_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at`,
      [v.title, v.content, v.references_json ?? "[]", id, userId]
    )
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" })
    }
    res.json({ article: upd.rows[0] })
  } catch (err: any) {
    console.error("POST /api/write-articles/:id/versions/:vid/restore error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// DELETE /api/write-articles/:id/versions/:vid - Xóa một phiên bản
router.delete("/:id/versions/:vid", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const id = paramId(req)
    const vid = (req.params as { vid?: string }).vid
    if (!UUID_RE.test(id) || !vid || !UUID_RE.test(vid)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }
    const canAccess = await isArticleOwner(id, userId)
    if (!canAccess) {
      return res.status(404).json({ error: "Không có quyền xóa phiên bản bài viết này" })
    }
    const del = await query(
      `DELETE FROM ai_portal.write_article_versions WHERE id = $1::uuid AND article_id = $2::uuid`,
      [vid, id]
    )
    if (del.rowCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy phiên bản" })
    }
    res.status(204).send()
  } catch (err: any) {
    console.error("DELETE /api/write-articles/:id/versions/:vid error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// POST /api/write-articles/:id/versions/clear - Xóa toàn bộ lịch sử, chỉ giữ phiên bản gần nhất
router.post("/:id/versions/clear", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }
    const canAccess = await isArticleOwner(id, userId)
    if (!canAccess) {
      return res.status(404).json({ error: "Không có quyền xóa lịch sử bài viết này" })
    }
    await query(
      `DELETE FROM ai_portal.write_article_versions
       WHERE article_id = $1::uuid AND id NOT IN (
         SELECT id FROM ai_portal.write_article_versions WHERE article_id = $1::uuid
         ORDER BY created_at DESC LIMIT 1
       )`,
      [id]
    )
    res.status(204).send()
  } catch (err: any) {
    console.error("POST /api/write-articles/:id/versions/clear error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// GET /api/write-articles/:id - Chi tiết 1 bài viết (chủ bài viết hoặc thành viên dự án)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const currentUser = await getCurrentUser(req)
    const userEmail = currentUser?.email ?? undefined

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const allowed = await canAccessArticle(userId, userEmail, id, "read")
    if (!allowed) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" })
    }

    const rows = await query(
      `SELECT id, user_id, project_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at, share_token
       FROM ai_portal.write_articles
       WHERE id = $1::uuid
       LIMIT 1`,
      [id]
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

    const body = req.body ?? {}
    const { title = "Tài liệu chưa có tiêu đề", content = "", template_id = null, project_id = null } = body
    const refsRaw = body.references_json ?? body.references ?? []
    const refsJson = Array.isArray(refsRaw) ? JSON.stringify(refsRaw) : "[]"
    const projectIdVal = project_id && UUID_RE.test(String(project_id).trim()) ? String(project_id).trim() : null

    const rows = await query(
      `INSERT INTO ai_portal.write_articles (user_id, project_id, title, content, template_id, references_json)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)
       RETURNING id, user_id, project_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at`,
      [userId, projectIdVal, String(title).slice(0, 500), String(content), template_id || null, refsJson]
    )

    res.status(201).json({ article: rows.rows[0] })
  } catch (err: any) {
    console.error("POST /api/write-articles error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// PATCH /api/write-articles/:id - Cập nhật bài viết (chủ bài viết hoặc thành viên dự án)
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const currentUser = await getCurrentUser(req)
    const userEmail = currentUser?.email ?? undefined

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const allowed = await canAccessArticle(userId, userEmail, id, "write")
    if (!allowed) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" })
    }

    const body = req.body ?? {}
    const { title, content, template_id } = body
    const refsRaw = body.references_json ?? body.references
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
    if (refsRaw !== undefined) {
      updates.push(`references_json = $${p++}::jsonb`)
      params.push(Array.isArray(refsRaw) ? JSON.stringify(refsRaw) : "[]")
    }

    if (updates.length === 0) {
      const existing = await query(
        `SELECT id, user_id, project_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at
         FROM ai_portal.write_articles WHERE id = $1::uuid`,
        [id]
      )
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy bài viết" })
      }
      return res.json({ article: existing.rows[0] })
    }

    // Lưu phiên bản hiện tại trước khi cập nhật (theo dõi version)
    const current = await query(
      `SELECT title, content, COALESCE(references_json, '[]'::jsonb) AS references_json
       FROM ai_portal.write_articles WHERE id = $1::uuid`,
      [id]
    )
    if (current.rows.length > 0) {
      const c = current.rows[0]
      await query(
        `INSERT INTO ai_portal.write_article_versions (article_id, title, content, references_json)
         VALUES ($1::uuid, $2, $3, $4::jsonb)`,
        [id, c.title, c.content, typeof c.references_json === "string" ? c.references_json : JSON.stringify(c.references_json ?? [])]
      )
      const countRes = await query(
        `SELECT COUNT(*)::int AS n FROM ai_portal.write_article_versions WHERE article_id = $1::uuid`,
        [id]
      )
      const n = countRes.rows[0]?.n ?? 0
      if (n > MAX_VERSIONS_PER_ARTICLE) {
        await query(
          `DELETE FROM ai_portal.write_article_versions
           WHERE article_id = $1::uuid AND id NOT IN (
             SELECT id FROM ai_portal.write_article_versions WHERE article_id = $1::uuid
             ORDER BY created_at DESC LIMIT $2
           )`,
          [id, MAX_VERSIONS_PER_ARTICLE]
        )
      }
    }

    updates.push(`updated_at = now()`)
    params.push(id)
    const whereIdParam = p

    const rows = await query(
      `UPDATE ai_portal.write_articles
       SET ${updates.join(", ")}
       WHERE id = $${whereIdParam}::uuid
       RETURNING id, user_id, project_id, title, content, template_id, COALESCE(references_json, '[]'::jsonb) AS references_json, created_at, updated_at`,
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
      `DELETE FROM ai_portal.write_articles WHERE id = $1::uuid AND user_id = $2::uuid`,
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

// --- Comments (nhiều người có thể cùng comment) ---

/** Kiểm tra user có phải chủ bài viết (chỉ owner, không tính team member) */
async function isArticleOwner(articleId: string, userId: string): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM ai_portal.write_articles WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [articleId, userId]
  )
  return rows.rows.length > 0
}

// GET /api/write-articles/:id/comments - Danh sách bình luận (chủ bài viết hoặc người có quyền xem)
router.get("/:id/comments", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const canAccess = await isArticleOwner(id, userId)
    if (!canAccess) {
      return res.status(404).json({ error: "Không có quyền xem bình luận bài viết này" })
    }

    const rows = await query(
      `SELECT id, article_id, user_id, author_display, content, parent_id, created_at
       FROM ai_portal.write_article_comments
       WHERE article_id = $1::uuid
       ORDER BY created_at ASC`,
      [id]
    )

    res.json({ comments: rows.rows })
  } catch (err: any) {
    console.error("GET /api/write-articles/:id/comments error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// POST /api/write-articles/:id/comments - Thêm bình luận (id trong body = data-comment-id trong HTML, tùy chọn)
router.post("/:id/comments", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const id = paramId(req)
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const canAccess = await isArticleOwner(id, user.id)
    if (!canAccess) {
      return res.status(404).json({ error: "Không có quyền bình luận bài viết này" })
    }

    const body = req.body ?? {}
    const content = String(body.content ?? "").trim()
    const parentId = body.parent_id && UUID_RE.test(String(body.parent_id).trim()) ? String(body.parent_id).trim() : null
    const commentId = body.id && UUID_RE.test(String(body.id).trim()) ? String(body.id).trim() : null

    if (!content) {
      return res.status(400).json({ error: "Nội dung bình luận không được để trống" })
    }

    const authorDisplay = (user.name || user.email || "Người dùng").slice(0, 200)

    if (commentId) {
      const rows = await query(
        `INSERT INTO ai_portal.write_article_comments (id, article_id, user_id, author_display, content, parent_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid)
         RETURNING id, article_id, user_id, author_display, content, parent_id, created_at`,
        [commentId, id, user.id, authorDisplay, content, parentId]
      )
      return res.status(201).json({ comment: rows.rows[0] })
    }

    const rows = await query(
      `INSERT INTO ai_portal.write_article_comments (article_id, user_id, author_display, content, parent_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid)
       RETURNING id, article_id, user_id, author_display, content, parent_id, created_at`,
      [id, user.id, authorDisplay, content, parentId]
    )
    res.status(201).json({ comment: rows.rows[0] })
  } catch (err: any) {
    console.error("POST /api/write-articles/:id/comments error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// DELETE /api/write-articles/:id/comments/:commentId - Xóa bình luận (chủ bài hoặc chủ bình luận)
router.delete("/:id/comments/:commentId", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }

    const articleId = paramId(req)
    const commentId = (req.params as { commentId?: string }).commentId?.trim()
    if (!UUID_RE.test(articleId) || !commentId || !UUID_RE.test(commentId)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }

    const isOwner = await isArticleOwner(articleId, user.id)
    const commentRow = await query(
      `SELECT id, user_id FROM ai_portal.write_article_comments WHERE id = $1::uuid AND article_id = $2::uuid LIMIT 1`,
      [commentId, articleId]
    )
    const comment = commentRow.rows[0] as { id: string; user_id: string } | undefined
    if (!comment) {
      return res.status(404).json({ error: "Không tìm thấy bình luận" })
    }
    const isCommentAuthor = comment.user_id === user.id
    if (!isOwner && !isCommentAuthor) {
      return res.status(403).json({ error: "Chỉ chủ bài viết hoặc người viết bình luận mới được xóa" })
    }

    await query(
      `DELETE FROM ai_portal.write_article_comments WHERE id = $1::uuid AND article_id = $2::uuid`,
      [commentId, articleId]
    )
    res.status(204).send()
  } catch (err: any) {
    console.error("DELETE /api/write-articles/:id/comments/:commentId error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// --- Real-time collab: dùng cho WebSocket server ---
export type WsRequestLike = { headers: { cookie?: string } }

/** Lấy user hiện tại từ request (dùng cho WebSocket upgrade). */
export async function getCurrentUserFromWs(req: WsRequestLike): Promise<{ id: string; email?: string; name?: string } | null> {
  const { getToken } = await import("next-auth/jwt")
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  if (!token) return null
  const t = token as { id?: string; email?: string; name?: string }
  if (!t.id) return null
  return { id: t.id, email: t.email, name: t.name }
}

/** Trả về articleId nếu user có quyền (qua articleId hoặc shareToken). */
export async function resolveArticleAccess(
  userId: string,
  userEmail: string | undefined,
  params: { articleId?: string; shareToken?: string }
): Promise<string | null> {
  if (params.shareToken && String(params.shareToken).trim()) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM ai_portal.write_articles WHERE share_token = $1::text LIMIT 1`,
      [String(params.shareToken).trim()]
    )
    return rows.rows[0]?.id ?? null
  }
  if (params.articleId && UUID_RE.test(params.articleId)) {
    const allowed = await canAccessArticle(userId, userEmail, params.articleId, "read")
    return allowed ? params.articleId : null
  }
  return null
}

export default router
