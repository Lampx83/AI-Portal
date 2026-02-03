// routes/users.ts
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import multer from "multer"
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { Readable } from "stream"
import crypto from "crypto"

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

function paramStr(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] ?? "" : p ?? ""
}

const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
})
const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "research"

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

/** Lấy user id từ session (NextAuth cookie) */
async function getCurrentUserId(req: Request): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  return (token as { id?: string })?.id ?? null
}

/** Lấy email của user hiện tại (để kiểm tra team_members chia sẻ) */
async function getCurrentUserEmail(req: Request): Promise<string | null> {
  const userId = await getCurrentUserId(req)
  if (!userId) return null
  const r = await query<{ email: string }>(
    `SELECT email FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
    [userId]
  )
  return r.rows[0]?.email ?? null
}

/**
 * GET /api/faculties - Danh sách Khoa/Viện (cho dropdown hồ sơ)
 */
router.get("/faculties", async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, display_order FROM research_chat.faculties ORDER BY display_order ASC, name ASC`
    )
    res.json({ faculties: result.rows })
  } catch (err: any) {
    console.error("GET /api/users/faculties error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/me - Hồ sơ người dùng hiện tại (theo session)
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const result = await query(
      `SELECT id, email, display_name, full_name, sso_provider, position, faculty_id, intro, research_direction, settings_json
       FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
      [userId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    const row = result.rows[0] as { faculty_id?: string; settings_json?: Record<string, unknown> }
    let faculty = null
    if (row.faculty_id) {
      const f = await query(`SELECT id, name FROM research_chat.faculties WHERE id = $1::uuid`, [row.faculty_id])
      faculty = f.rows[0] ?? null
    }
    const profile = { ...result.rows[0] } as Record<string, unknown>
    const settingsJson = row.settings_json ?? {}
    delete profile.settings_json
    const defaults = {
      language: "vi",
      notifications: { email: false, push: false, research: false, publications: false },
      privacy: { profileVisible: false, researchVisible: false, publicationsVisible: false },
      ai: { personalization: true, autoSuggestions: true, externalSearch: false, responseLength: 2, creativity: 3 },
      data: { autoBackup: false, syncEnabled: false, cacheSize: 1 },
    }
    const settings = { ...defaults, ...settingsJson } as Record<string, unknown>
    if (typeof settings.notifications !== "object") settings.notifications = defaults.notifications
    else settings.notifications = { ...defaults.notifications, ...settings.notifications }
    if (typeof settings.privacy !== "object") settings.privacy = defaults.privacy
    else settings.privacy = { ...defaults.privacy, ...settings.privacy }
    if (typeof settings.ai !== "object") settings.ai = defaults.ai
    else settings.ai = { ...defaults.ai, ...settings.ai }
    if (typeof settings.data !== "object") settings.data = defaults.data
    else settings.data = { ...defaults.data, ...settings.data }
    res.json({ profile, faculty, settings })
  } catch (err: any) {
    console.error("GET /api/users/me error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * PATCH /api/users/me - Cập nhật hồ sơ (position, faculty_id, intro, research_direction; full_name chỉ khi không SSO)
 */
router.patch("/me", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const { full_name, position, faculty_id, intro, research_direction, settings: settingsBody } = req.body
    const updates: string[] = ["updated_at = now()"]
    const values: unknown[] = []
    let idx = 1

    const current = await query(
      `SELECT sso_provider, settings_json FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
      [userId]
    )
    const isSSO = !!(current.rows[0] as { sso_provider?: string })?.sso_provider
    const existingSettings = (current.rows[0] as { settings_json?: Record<string, unknown> })?.settings_json ?? {}

    if (full_name !== undefined && !isSSO) {
      updates.push(`full_name = $${idx++}`)
      values.push(full_name ? String(full_name).trim() : null)
    }
    if (position !== undefined) {
      updates.push(`position = $${idx++}`)
      values.push(position ? String(position).trim() : null)
    }
    if (faculty_id !== undefined) {
      updates.push(`faculty_id = $${idx++}`)
      values.push(faculty_id ? String(faculty_id).trim() : null)
    }
    if (intro !== undefined) {
      updates.push(`intro = $${idx++}`)
      values.push(intro != null ? String(intro) : null)
    }
    if (research_direction !== undefined) {
      updates.push(`research_direction = $${idx++}::jsonb`)
      values.push(
        Array.isArray(research_direction) ? JSON.stringify(research_direction) : research_direction == null ? null : JSON.stringify(Array.isArray(research_direction) ? research_direction : [String(research_direction)])
      )
    }
    if (settingsBody !== undefined && typeof settingsBody === "object" && settingsBody !== null) {
      const body = settingsBody as Record<string, unknown>
      const merged: Record<string, unknown> = { ...existingSettings }
      if (typeof body.language === "string") merged.language = body.language
      if (body.notifications && typeof body.notifications === "object") {
        merged.notifications = { ...(merged.notifications as Record<string, unknown> || {}), ...body.notifications }
      }
      if (body.privacy && typeof body.privacy === "object") {
        merged.privacy = { ...(merged.privacy as Record<string, unknown> || {}), ...body.privacy }
      }
      if (body.ai && typeof body.ai === "object") {
        merged.ai = { ...(merged.ai as Record<string, unknown> || {}), ...body.ai }
      }
      if (body.data && typeof body.data === "object") {
        merged.data = { ...(merged.data as Record<string, unknown> || {}), ...body.data }
      }
      updates.push(`settings_json = $${idx++}::jsonb`)
      values.push(JSON.stringify(merged))
    }

    if (updates.length <= 1) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    }
    values.push(userId)
    await query(
      `UPDATE research_chat.users SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      values
    )
    const updated = await query(
      `SELECT id, email, display_name, full_name, sso_provider, position, faculty_id, intro, research_direction, settings_json
       FROM research_chat.users WHERE id = $1::uuid`,
      [userId]
    )
    const row = updated.rows[0] as { faculty_id?: string; settings_json?: Record<string, unknown> }
    let faculty = null
    if (row?.faculty_id) {
      const f = await query(`SELECT id, name FROM research_chat.faculties WHERE id = $1::uuid`, [row.faculty_id])
      faculty = f.rows[0] ?? null
    }
    const profileRow = { ...updated.rows[0] } as Record<string, unknown>
    delete profileRow.settings_json
    const settingsJson = row?.settings_json ?? {}
    const defaults = {
      language: "vi",
      notifications: { email: false, push: false, research: false, publications: false },
      privacy: { profileVisible: false, researchVisible: false, publicationsVisible: false },
      ai: { personalization: true, autoSuggestions: true, externalSearch: false, responseLength: 2, creativity: 3 },
      data: { autoBackup: false, syncEnabled: false, cacheSize: 1 },
    }
    const settings = { ...defaults, ...settingsJson } as Record<string, unknown>
    if (typeof settings.notifications === "object") settings.notifications = { ...defaults.notifications, ...settings.notifications }
    if (typeof settings.privacy === "object") settings.privacy = { ...defaults.privacy, ...settings.privacy }
    if (typeof settings.ai === "object") settings.ai = { ...defaults.ai, ...settings.ai }
    if (typeof settings.data === "object") settings.data = { ...defaults.data, ...settings.data }
    res.json({ profile: profileRow, faculty, settings })
  } catch (err: any) {
    console.error("PATCH /api/users/me error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/publications - Danh sách công bố của user
 */
router.get("/publications", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const result = await query(
      `SELECT id, user_id, title, authors, journal, year, type, status, doi, abstract, file_keys, created_at, updated_at
       FROM research_chat.publications WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
      [userId]
    )
    res.json({ publications: result.rows })
  } catch (err: any) {
    console.error("GET /api/users/publications error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * POST /api/users/publications - Tạo công bố mới
 */
router.post("/publications", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const { title, authors, journal, year, type, status, doi, abstract, file_keys } = req.body
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Tiêu đề là bắt buộc" })
    }
    const authorsArr = Array.isArray(authors) ? authors : (typeof authors === "string" ? authors.split(",").map((s: string) => s.trim()).filter(Boolean) : [])
    const yearNum = year != null ? parseInt(String(year), 10) : null
    const typeVal = ["journal", "conference", "book", "thesis"].includes(type) ? type : "journal"
    const statusVal = ["published", "accepted", "submitted", "draft"].includes(status) ? status : "draft"
    const fileKeysArr = Array.isArray(file_keys) ? file_keys : []
    const id = crypto.randomUUID()
    await query(
      `INSERT INTO research_chat.publications (id, user_id, title, authors, journal, year, type, status, doi, abstract, file_keys)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [id, userId, title.trim(), JSON.stringify(authorsArr), journal ? String(journal).trim() : null, isNaN(yearNum!) ? null : yearNum, typeVal, statusVal, doi ? String(doi).trim() : null, abstract ? String(abstract).trim() : null, JSON.stringify(fileKeysArr)]
    )
    const row = await query(`SELECT id, user_id, title, authors, journal, year, type, status, doi, abstract, file_keys, created_at, updated_at FROM research_chat.publications WHERE id = $1::uuid`, [id])
    res.status(201).json({ publication: row.rows[0] })
  } catch (err: any) {
    console.error("POST /api/users/publications error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * POST /api/users/publications/upload - Tải file công bố lên MinIO (prefix publications/{userId}/)
 */
router.post("/publications/upload", upload.array("files", 10), async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_PORT || !process.env.MINIO_BUCKET_NAME) {
      return res.status(503).json({ error: "MinIO chưa cấu hình" })
    }
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) return res.status(400).json({ error: "Không có file" })
    const prefix = `publications/${userId}`
    const keys: string[] = []
    for (const file of files) {
      const ext = file.originalname.includes(".") ? "." + file.originalname.split(".").pop()!.toLowerCase() : ""
      const key = `${prefix}/${crypto.randomUUID()}${ext}`
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
        })
      )
      keys.push(key)
    }
    res.json({ keys })
  } catch (err: any) {
    console.error("POST /api/users/publications/upload error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/publications/files/:key - Tải file công bố (key = publications/{userId}/...)
 */
router.get("/publications/files/:key(*)", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const key = decodeURIComponent(paramStr(req.params.key))
    const expectedPrefix = `publications/${userId}/`
    if (!key.startsWith(expectedPrefix)) return res.status(403).json({ error: "Không được truy cập file này" })
    if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_PORT) {
      return res.status(503).json({ error: "MinIO chưa cấu hình" })
    }
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    )
    const contentType = response.ContentType || "application/octet-stream"
    const name = key.split("/").pop() || "file"
    res.setHeader("Content-Type", contentType)
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`)
    if (response.Body instanceof Readable) {
      response.Body.pipe(res)
    } else if (response.Body) {
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) chunks.push(chunk)
      res.send(Buffer.concat(chunks))
    } else {
      res.status(404).json({ error: "File trống" })
    }
  } catch (err: any) {
    console.error("GET /api/users/publications/files error:", err)
    if ((err as { name?: string }).name === "NoSuchKey") return res.status(404).json({ error: "Không tìm thấy file" })
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * PATCH /api/users/publications/:id - Cập nhật công bố (chỉ của user)
 */
router.patch("/publications/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const { title, authors, journal, year, type, status, doi, abstract, file_keys } = req.body
    const owner = await query(`SELECT id FROM research_chat.publications WHERE id = $1::uuid AND user_id = $2::uuid`, [id, userId])
    if (!owner.rows[0]) return res.status(404).json({ error: "Không tìm thấy công bố" })
    const updates: string[] = ["updated_at = now()"]
    const values: unknown[] = []
    let idx = 1
    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(String(title).trim()) }
    if (authors !== undefined) {
      const authorsArr = Array.isArray(authors) ? authors : (typeof authors === "string" ? authors.split(",").map((s: string) => s.trim()).filter(Boolean) : [])
      updates.push(`authors = $${idx++}::jsonb`); values.push(JSON.stringify(authorsArr))
    }
    if (journal !== undefined) { updates.push(`journal = $${idx++}`); values.push(journal ? String(journal).trim() : null) }
    if (year !== undefined) { const y = parseInt(String(year), 10); updates.push(`year = $${idx++}`); values.push(isNaN(y) ? null : y) }
    if (type !== undefined && ["journal", "conference", "book", "thesis"].includes(type)) { updates.push(`type = $${idx++}`); values.push(type) }
    if (status !== undefined && ["published", "accepted", "submitted", "draft"].includes(status)) { updates.push(`status = $${idx++}`); values.push(status) }
    if (doi !== undefined) { updates.push(`doi = $${idx++}`); values.push(doi ? String(doi).trim() : null) }
    if (abstract !== undefined) { updates.push(`abstract = $${idx++}`); values.push(abstract ? String(abstract).trim() : null) }
    if (file_keys !== undefined) { updates.push(`file_keys = $${idx++}::jsonb`); values.push(JSON.stringify(Array.isArray(file_keys) ? file_keys : [])) }
    if (updates.length <= 1) return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    values.push(id)
    await query(`UPDATE research_chat.publications SET ${updates.join(", ")} WHERE id = $${idx}::uuid`, values)
    const row = await query(`SELECT id, user_id, title, authors, journal, year, type, status, doi, abstract, file_keys, created_at, updated_at FROM research_chat.publications WHERE id = $1::uuid`, [id])
    res.json({ publication: row.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/users/publications error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * DELETE /api/users/publications/:id - Xóa công bố (chỉ của user)
 */
router.delete("/publications/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const r = await query(`DELETE FROM research_chat.publications WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`, [id, userId])
    if (!r.rows[0]) return res.status(404).json({ error: "Không tìm thấy công bố" })
    res.json({ ok: true })
  } catch (err: any) {
    console.error("DELETE /api/users/publications error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * GET /api/users/research-projects - Danh sách dự án: của user + được chia sẻ (user nằm trong team_members)
 */
router.get("/research-projects", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const userEmail = await getCurrentUserEmail(req)
    const result = await query(
      `SELECT id, user_id, name, description, team_members, file_keys, created_at, updated_at,
              (user_id != $1::uuid) AS is_shared
       FROM research_chat.research_projects
       WHERE user_id = $1::uuid
          OR ($2::text IS NOT NULL AND team_members @> to_jsonb($2::text))
       ORDER BY updated_at DESC`,
      [userId, userEmail ?? ""]
    )
    res.json({ projects: result.rows })
  } catch (err: any) {
    console.error("GET /api/users/research-projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * POST /api/users/research-projects - Tạo dự án nghiên cứu mới
 */
router.post("/research-projects", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const { name, description, team_members, file_keys } = req.body
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Tên nghiên cứu là bắt buộc" })
    }
    const teamArr = Array.isArray(team_members) ? team_members : []
    const fileKeysArr = Array.isArray(file_keys) ? file_keys : []
    const id = crypto.randomUUID()
    await query(
      `INSERT INTO research_chat.research_projects (id, user_id, name, description, team_members, file_keys)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb)`,
      [id, userId, name.trim(), description ? String(description).trim() : null, JSON.stringify(teamArr), JSON.stringify(fileKeysArr)]
    )
    const row = await query(
      `SELECT id, user_id, name, description, team_members, file_keys, created_at, updated_at FROM research_chat.research_projects WHERE id = $1::uuid`,
      [id]
    )
    res.status(201).json({ project: row.rows[0] })
  } catch (err: any) {
    console.error("POST /api/users/research-projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * POST /api/users/research-projects/upload - Tải file lên MinIO
 * Query: project_id (optional) - nếu có thì lưu vào research-projects/{userId}/{projectId}/, không thì research-projects/{userId}/temp/{uuid}/
 */
router.post("/research-projects/upload", upload.array("files", 10), async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_PORT || !process.env.MINIO_BUCKET_NAME) {
      return res.status(503).json({ error: "MinIO chưa cấu hình" })
    }
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) return res.status(400).json({ error: "Không có file" })

    const projectId = (req.query.project_id as string)?.trim()
    let prefix: string
    if (projectId && /^[0-9a-f-]{36}$/i.test(projectId)) {
      const owner = await query(
        `SELECT 1 FROM research_chat.research_projects WHERE id = $1::uuid AND user_id = $2::uuid`,
        [projectId, userId]
      )
      if (!owner.rows[0]) return res.status(403).json({ error: "Không có quyền với dự án này" })
      prefix = `research-projects/${userId}/${projectId}`
    } else {
      prefix = `research-projects/${userId}/temp/${crypto.randomUUID()}`
    }

    const keys: string[] = []
    for (const file of files) {
      const ext = file.originalname.includes(".") ? "." + file.originalname.split(".").pop()!.toLowerCase() : ""
      const key = `${prefix}/${crypto.randomUUID()}${ext}`
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
        })
      )
      keys.push(key)
    }
    res.json({ keys })
  } catch (err: any) {
    console.error("POST /api/users/research-projects/upload error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/research-projects/files/:key - Tải file (cho phép nếu là chủ sở hữu hoặc thành viên được chia sẻ)
 */
router.get("/research-projects/files/:key(*)", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const key = decodeURIComponent(paramStr(req.params.key))
    const ownerPrefix = `research-projects/${userId}/`
    let allowed = key.startsWith(ownerPrefix)
    if (!allowed) {
      const userEmail = await getCurrentUserEmail(req)
      const shared = await query(
        `SELECT 1 FROM research_chat.research_projects rp,
          LATERAL jsonb_array_elements_text(rp.file_keys) AS fk
         WHERE (rp.user_id = $1::uuid OR ($2::text IS NOT NULL AND rp.team_members @> to_jsonb($2::text)))
           AND fk = $3
         LIMIT 1`,
        [userId, userEmail ?? "", key]
      )
      allowed = !!shared.rows[0]
    }
    if (!allowed) return res.status(403).json({ error: "Không được truy cập file này" })
    if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_PORT) {
      return res.status(503).json({ error: "MinIO chưa cấu hình" })
    }
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    )
    const contentType = response.ContentType || "application/octet-stream"
    const name = key.split("/").pop() || "file"
    res.setHeader("Content-Type", contentType)
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`)
    if (response.Body instanceof Readable) {
      response.Body.pipe(res)
    } else if (response.Body) {
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) chunks.push(chunk)
      res.send(Buffer.concat(chunks))
    } else {
      res.status(404).json({ error: "File trống" })
    }
  } catch (err: any) {
    console.error("GET /api/users/research-projects/files error:", err)
    if ((err as { name?: string }).name === "NoSuchKey") return res.status(404).json({ error: "Không tìm thấy file" })
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * PATCH /api/users/research-projects/:id - Cập nhật dự án nghiên cứu (chỉ của user)
 */
router.patch("/research-projects/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const { name, description, team_members, file_keys } = req.body
    const owner = await query(`SELECT id FROM research_chat.research_projects WHERE id = $1::uuid AND user_id = $2::uuid`, [id, userId])
    if (!owner.rows[0]) return res.status(404).json({ error: "Không tìm thấy dự án nghiên cứu" })
    const updates: string[] = ["updated_at = now()"]
    const values: unknown[] = []
    let idx = 1
    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(String(name).trim()) }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description ? String(description).trim() : null) }
    if (team_members !== undefined) { updates.push(`team_members = $${idx++}::jsonb`); values.push(JSON.stringify(Array.isArray(team_members) ? team_members : [])) }
    if (file_keys !== undefined) { updates.push(`file_keys = $${idx++}::jsonb`); values.push(JSON.stringify(Array.isArray(file_keys) ? file_keys : [])) }
    if (updates.length <= 1) return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    values.push(id)
    await query(`UPDATE research_chat.research_projects SET ${updates.join(", ")} WHERE id = $${idx}::uuid`, values)
    const row = await query(`SELECT id, user_id, name, description, team_members, file_keys, created_at, updated_at FROM research_chat.research_projects WHERE id = $1::uuid`, [id])
    res.json({ project: row.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/users/research-projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * DELETE /api/users/research-projects/:id - Xóa dự án nghiên cứu (chỉ của user)
 */
router.delete("/research-projects/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const r = await query(`DELETE FROM research_chat.research_projects WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`, [id, userId])
    if (!r.rows[0]) return res.status(404).json({ error: "Không tìm thấy dự án nghiên cứu" })
    res.json({ ok: true })
  } catch (err: any) {
    console.error("DELETE /api/users/research-projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * POST /api/users/ensure
 * Ensure a user exists in the database by email
 * Creates a new user if not exists, returns existing user ID if exists
 * 
 * Body: { email: string }
 * Response: { id: string }
 */
router.post("/ensure", async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email || typeof email !== "string") {
      return res.status(400).json({ 
        error: "Invalid request",
        message: "Email is required and must be a string"
      })
    }

    // Check if user exists
    const found = await query(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (found.rowCount && found.rows[0]?.id) {
      return res.json({ id: found.rows[0].id })
    }

    // Create new user if not exists
    const newId = crypto.randomUUID()
    await query(
      `INSERT INTO research_chat.users (id, email, display_name) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [newId, email, email.split("@")[0]]
    )

    // Fetch the created user (in case of conflict, get existing one)
    const finalCheck = await query(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (finalCheck.rowCount && finalCheck.rows[0]?.id) {
      return res.json({ id: finalCheck.rows[0].id })
    }

    return res.status(500).json({ 
      error: "Failed to create or retrieve user" 
    })
  } catch (err: any) {
    console.error("POST /api/users/ensure error:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    })
  }
})

export default router
