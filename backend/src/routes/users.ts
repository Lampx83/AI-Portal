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
 * GET /api/users/email/:identifier - Thông tin user theo email (dành cho agents fetch)
 * Identifier = email (encode URI, ví dụ lampx%40neu.edu.vn).
 * API công khai để agent có thể gọi khi nhận được user_url trong context.
 */
router.get("/email/:identifier", async (req: Request, res: Response) => {
  try {
    const raw = decodeURIComponent(paramStr(req.params.identifier))
    const email = (raw || "").trim().toLowerCase()
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Email không hợp lệ" })
    }
    const result = await query(
      `SELECT u.id, u.email, u.display_name, u.full_name, u.sso_provider,
              u.position, u.academic_title, u.academic_degree, u.faculty_id,
              u.intro, u.research_direction, u.google_scholar_url, u.created_at
       FROM research_chat.users u WHERE LOWER(u.email) = $1 LIMIT 1`,
      [email]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    const profileRow = result.rows[0] as { id: string; faculty_id?: string }
    let faculty = null
    if (profileRow.faculty_id) {
      const f = await query(`SELECT id, name FROM research_chat.faculties WHERE id = $1::uuid`, [profileRow.faculty_id])
      faculty = f.rows[0] ?? null
    }
    const pubs = await query(
      `SELECT id, title, authors, journal, year, type, status, doi, abstract
       FROM research_chat.publications WHERE user_id = $1::uuid ORDER BY year DESC NULLS LAST, updated_at DESC`,
      [profileRow.id]
    )
    const projects = await query(
      `SELECT id, name, description, created_at
       FROM research_chat.research_projects WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
      [profileRow.id]
    )
    res.json({
      profile: profileRow,
      faculty,
      publications: pubs.rows,
      projects: projects.rows,
    })
  } catch (err: any) {
    console.error("GET /api/users/email/:identifier error:", err)
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
      `SELECT id, email, display_name, full_name, sso_provider, position, faculty_id, intro, research_direction, google_scholar_url, settings_json
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
    const { full_name, position, academic_title, academic_degree, faculty_id, intro, research_direction, google_scholar_url: googleScholarUrl, settings: settingsBody } = req.body
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
    if (academic_title !== undefined) {
      updates.push(`academic_title = $${idx++}`)
      values.push(academic_title ? String(academic_title).trim() : null)
    }
    if (academic_degree !== undefined) {
      updates.push(`academic_degree = $${idx++}`)
      values.push(academic_degree ? String(academic_degree).trim() : null)
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
    if (googleScholarUrl !== undefined) {
      updates.push(`google_scholar_url = $${idx++}`)
      values.push(googleScholarUrl ? String(googleScholarUrl).trim() : null)
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
      `SELECT id, email, display_name, full_name, sso_provider, position, faculty_id, intro, research_direction, google_scholar_url, settings_json
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

/** Chuẩn hóa tiêu đề để so sánh trùng: trim, lowercase, gộp khoảng trắng. */
function normalizeTitleForDedup(title: string): string {
  return (title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

/**
 * POST /api/users/publications/sync-google-scholar - Đồng bộ công bố từ Google Scholar
 * Sử dụng SerpAPI (cần SERPAPI_KEY). Lấy author_id từ google_scholar_url đã lưu trong hồ sơ hoặc từ body/query ?url=...
 * Kiểm tra trùng theo tiêu đề đã chuẩn hóa (trim, lowercase, gộp khoảng trắng).
 */
router.post("/publications/sync-google-scholar", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })

    const apiKey = process.env.SERPAPI_KEY
    if (!apiKey) {
      return res.status(503).json({
        error: "Tính năng đồng bộ Google Scholar chưa được cấu hình",
        message: "Cần thiết lập SERPAPI_KEY trong môi trường. Đăng ký tại https://serpapi.com",
      })
    }

    let authorId: string | null = null
    const urlParam = (req.body?.url ?? req.query?.url) as string | undefined
    if (urlParam && typeof urlParam === "string") {
      const m = urlParam.match(/user=([^&]+)/)
      if (m) authorId = m[1].trim()
    }
    if (!authorId) {
      const profile = await query(
        `SELECT google_scholar_url FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
        [userId]
      )
      const gsUrl = (profile.rows[0] as { google_scholar_url?: string } | undefined)?.google_scholar_url
      if (gsUrl) {
        const m = gsUrl.match(/user=([^&]+)/)
        if (m) authorId = m[1].trim()
      }
    }
    if (!authorId) {
      return res.status(400).json({
        error: "Chưa có link Google Scholar",
        message: "Vui lòng khai báo link Google Scholar trong Hồ sơ cá nhân trước khi đồng bộ.",
      })
    }

    const serpRes = await fetch(
      `https://serpapi.com/search?engine=google_scholar_author&author_id=${encodeURIComponent(authorId)}&api_key=${encodeURIComponent(apiKey)}&num=100`
    )
    if (!serpRes.ok) {
      const errText = await serpRes.text()
      console.error("SerpAPI error:", serpRes.status, errText)
      return res.status(502).json({
        error: "Không thể lấy dữ liệu từ Google Scholar",
        message: serpRes.status === 401 ? "SERPAPI_KEY không hợp lệ" : errText?.slice(0, 200) || "Lỗi SerpAPI",
      })
    }
    const serpData = (await serpRes.json()) as {
      articles?: Array<{
        title?: string
        link?: string
        citation_id?: string
        authors?: string
        publication?: string
        year?: number | string
        cited_by?: { value?: number }
      }>
    }

    const articles = serpData?.articles ?? []
    const existing = await query(
      `SELECT id, title FROM research_chat.publications WHERE user_id = $1::uuid`,
      [userId]
    )
    const existingNormalizedTitles = new Set(
      (existing.rows as { title: string }[]).map((r) => normalizeTitleForDedup(r.title ?? "")).filter(Boolean)
    )

    let imported = 0
    let skipped = 0
    for (const a of articles) {
      const rawTitle = (a.title ?? "").trim()
      if (!rawTitle) {
        skipped++
        continue
      }
      const normalizedTitle = normalizeTitleForDedup(rawTitle)
      if (existingNormalizedTitles.has(normalizedTitle)) {
        skipped++
        continue
      }

      const authorsStr = a.authors ?? ""
      const authors = authorsStr ? authorsStr.split(",").map((s) => s.trim()).filter(Boolean) : []
      const yearVal = a.year
      const year =
        yearVal != null ? (typeof yearVal === "number" ? yearVal : parseInt(String(yearVal), 10)) : null
      const journal = (a.publication ?? "").trim() || null
      const validYear = year != null && !isNaN(year) ? year : null

      const id = crypto.randomUUID()
      await query(
        `INSERT INTO research_chat.publications (id, user_id, title, authors, journal, year, type, status, doi, abstract, file_keys)
         VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
        [id, userId, rawTitle, JSON.stringify(authors), journal, validYear, "journal", "published", null, null, "[]"]
      )
      existingNormalizedTitles.add(normalizedTitle)
      imported++
    }

    const message =
      articles.length === 0
        ? "Không có công bố nào từ Google Scholar (hoặc tài khoản chưa có bài)."
        : skipped === 0
          ? `Đã thêm ${imported} công bố mới từ Google Scholar (tổng lấy về: ${articles.length}).`
          : `Đã thêm ${imported} công bố mới, ${skipped} trùng đã bỏ qua (tổng lấy về: ${articles.length}).`

    res.json({
      ok: true,
      imported,
      skipped,
      total_fetched: articles.length,
      message,
    })
  } catch (err: any) {
    console.error("POST /api/users/publications/sync-google-scholar error:", err)
    res.status(500).json({
      error: "Lỗi đồng bộ",
      message: err?.message ?? "Không thể đồng bộ từ Google Scholar",
    })
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
      `SELECT p.id, p.user_id, p.name, p.description, p.team_members, p.file_keys, p.created_at, p.updated_at,
              (p.user_id != $1::uuid) AS is_shared,
              u.email AS owner_email,
              u.display_name AS owner_display_name
       FROM research_chat.research_projects p
       LEFT JOIN research_chat.users u ON u.id = p.user_id
       WHERE p.user_id = $1::uuid
          OR ($2::text IS NOT NULL AND p.team_members @> to_jsonb($2::text))
       ORDER BY p.updated_at DESC`,
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
    const ownerRow = await query(
      `SELECT id, name, team_members FROM research_chat.research_projects WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    )
    if (!ownerRow.rows[0]) return res.status(404).json({ error: "Không tìm thấy dự án nghiên cứu" })
    const prevTeam = Array.isArray((ownerRow.rows[0] as { team_members?: unknown }).team_members)
      ? (ownerRow.rows[0] as { team_members: string[] }).team_members.map(String)
      : []
    const projectName = String((ownerRow.rows[0] as { name?: string }).name ?? "")

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

    // Tạo thông báo mời tham gia cho từng email mới được thêm vào team_members
    if (team_members !== undefined && Array.isArray(team_members)) {
      const newEmails = team_members
        .map((e) => (typeof e === "string" ? e : String(e)).trim().toLowerCase())
        .filter((e) => e && !prevTeam.map((p) => p.toLowerCase()).includes(e))
      const inviter = await query(
        `SELECT email, display_name FROM research_chat.users WHERE id = $1::uuid`,
        [userId]
      )
      const inviterEmail = (inviter.rows[0] as { email?: string })?.email ?? ""
      const inviterName = (inviter.rows[0] as { display_name?: string })?.display_name ?? inviterEmail
      for (const email of newEmails) {
        const target = await query(`SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`, [email])
        if (target.rows[0]?.id) {
          const payload = {
            research_id: id,
            research_name: projectName,
            inviter_email: inviterEmail,
            inviter_name: inviterName,
          }
          await query(
            `INSERT INTO research_chat.notifications (user_id, type, title, body, payload)
             VALUES ($1::uuid, 'research_invite', $2, $3, $4::jsonb)`,
            [
              (target.rows[0] as { id: string }).id,
              "Mời tham gia nghiên cứu",
              `${inviterName || inviterEmail} mời bạn tham gia nghiên cứu "${projectName}".`,
              JSON.stringify(payload),
            ]
          )
        }
      }
    }

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
 * GET /api/users/notifications - Danh sách thông báo của user (system, research_invite)
 */
router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const unreadOnly = req.query.unread === "1"
    let sql = `SELECT id, user_id, type, title, body, payload, read_at, created_at
       FROM research_chat.notifications WHERE user_id = $1::uuid`
    const params: unknown[] = [userId]
    if (unreadOnly) {
      sql += ` AND read_at IS NULL`
    }
    sql += ` ORDER BY created_at DESC LIMIT $2`
    params.push(limit)
    const result = await query(sql, params)
    res.json({ notifications: result.rows })
  } catch (err: any) {
    console.error("GET /api/users/notifications error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * PATCH /api/users/notifications/:id/read - Đánh dấu đã đọc
 */
router.patch("/notifications/:id/read", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const r = await query(
      `UPDATE research_chat.notifications SET read_at = now() WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`,
      [id, userId]
    )
    if (!r.rows[0]) return res.status(404).json({ error: "Không tìm thấy thông báo" })
    res.json({ ok: true })
  } catch (err: any) {
    console.error("PATCH /api/users/notifications/:id/read error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * PATCH /api/users/notifications/:id/accept - Chấp nhận lời mời nghiên cứu (đánh dấu đã đọc; nghiên cứu đã có trong danh sách)
 */
router.patch("/notifications/:id/accept", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const r = await query(
      `SELECT id, type FROM research_chat.notifications WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    )
    if (!r.rows[0]) return res.status(404).json({ error: "Không tìm thấy thông báo" })
    if ((r.rows[0] as { type: string }).type !== "research_invite") {
      return res.status(400).json({ error: "Chỉ thông báo mời tham gia nghiên cứu mới có thể chấp nhận" })
    }
    await query(
      `UPDATE research_chat.notifications SET read_at = now() WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    )
    res.json({ ok: true })
  } catch (err: any) {
    console.error("PATCH /api/users/notifications/:id/accept error:", err)
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
