// routes/users.ts – Config from Admin → Settings
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import multer from "multer"
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { Readable } from "stream"
import crypto from "crypto"
import { getSetting } from "../lib/settings"

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

function paramStr(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] ?? "" : p ?? ""
}

function getUsersS3Client(): S3Client {
  const endpoint = getSetting("MINIO_ENDPOINT", "localhost")
  const port = getSetting("MINIO_PORT", "9000")
  const region = getSetting("AWS_REGION", "us-east-1")
  const accessKey = getSetting("MINIO_ACCESS_KEY")
  const secretKey = getSetting("MINIO_SECRET_KEY")
  return new S3Client({
    endpoint: `http://${endpoint}:${port}`,
    region,
    credentials: { accessKeyId: accessKey || "", secretAccessKey: secretKey || "" },
    forcePathStyle: true,
  })
}
function getUsersBucketName(): string {
  return getSetting("MINIO_BUCKET_NAME", "portal")
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

/** Get token from session (NextAuth cookie) */
async function getCurrentToken(req: Request): Promise<{ id: string; email?: string | null } | null> {
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  if (!token || !(token as { id?: string }).id) return null
  const t = token as { id: string; email?: string | null }
  return { id: t.id, email: t.email ?? null }
}

/** Get user id from session (NextAuth cookie) */
async function getCurrentUserId(req: Request): Promise<string | null> {
  const token = await getCurrentToken(req)
  return token?.id ?? null
}

/** Ensure user exists by email (create if not). Returns user id or null. */
async function ensureUserByEmail(email: string | null | undefined): Promise<string | null> {
  if (!email || typeof email !== "string" || !email.includes("@")) return null
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  try {
    const found = await query<{ id: string }>(
      `SELECT id FROM ai_portal.users WHERE LOWER(email) = $1 LIMIT 1`,
      [normalized]
    )
    if (found.rows[0]?.id) return found.rows[0].id
    const newId = crypto.randomUUID()
    await query(
      `INSERT INTO ai_portal.users (id, email, display_name) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [newId, normalized, normalized.split("@")[0]]
    )
    const again = await query<{ id: string }>(
      `SELECT id FROM ai_portal.users WHERE LOWER(email) = $1 LIMIT 1`,
      [normalized]
    )
    return again.rows[0]?.id ?? null
  } catch (err: unknown) {
    console.error("ensureUserByEmail error:", err)
    return null
  }
}

/** Get current user email (for team_members share checks) */
async function getCurrentUserEmail(req: Request): Promise<string | null> {
  const userId = await getCurrentUserId(req)
  if (!userId) return null
  const r = await query<{ email: string }>(
    `SELECT email FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
    [userId]
  )
  return r.rows[0]?.email ?? null
}

/**
 * GET /api/departments - List departments (for profile dropdown)
 */
router.get("/departments", async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, display_order FROM ai_portal.departments ORDER BY display_order ASC, name ASC`
    )
    res.json({ departments: result.rows })
  } catch (err: any) {
    console.error("GET /api/users/departments error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/email/:identifier - User info by email (for agents to fetch)
 * Identifier = email (URI-encoded, e.g. lampx%40neu.edu.vn).
 * Public API so agent can call when it receives user_url in context.
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
              u.position, u.academic_title, u.academic_degree, u.department_id,
              u.intro, u.direction, u.google_scholar_url, u.created_at
       FROM ai_portal.users u WHERE LOWER(u.email) = $1 LIMIT 1`,
      [email]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    const profileRow = result.rows[0] as { id: string; department_id?: string }
    let department = null
    if (profileRow.department_id) {
      const d = await query(`SELECT id, name FROM ai_portal.departments WHERE id = $1::uuid`, [profileRow.department_id])
      department = d.rows[0] ?? null
    }
    const projects = await query(
      `SELECT id, name, description, created_at
       FROM ai_portal.projects WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
      [profileRow.id]
    )
    res.json({
      profile: profileRow,
      department,
      projects: projects.rows,
    })
  } catch (err: any) {
    console.error("GET /api/users/email/:identifier error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/me - Current user profile (from session)
 * If session has email but no user record (e.g. first SSO or old token), create user by email and return profile.
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = await getCurrentToken(req)
    if (!token?.id) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    let userId = token.id
    let result = await query(
      `SELECT id, email, display_name, full_name, sso_provider, position, department_id, intro, direction, google_scholar_url, settings_json
       FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
      [userId]
    )
    if (result.rows.length === 0 && token.email) {
      const resolvedId = await ensureUserByEmail(token.email)
      if (resolvedId) {
        userId = resolvedId
        result = await query(
          `SELECT id, email, display_name, full_name, sso_provider, position, department_id, intro, direction, google_scholar_url, settings_json
           FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
          [userId]
        )
      }
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    const row = result.rows[0] as { department_id?: string; settings_json?: Record<string, unknown> }
    let department = null
    if (row.department_id) {
      const d = await query(`SELECT id, name FROM ai_portal.departments WHERE id = $1::uuid`, [row.department_id])
      department = d.rows[0] ?? null
    }
    const profile = { ...result.rows[0] } as Record<string, unknown>
    const settingsJson = row.settings_json ?? {}
    delete profile.settings_json
    const defaults = {
      language: "vi",
      notifications: { email: false, push: false, projectUpdates: false },
      privacy: { profileVisible: false, projectsVisible: false },
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
    res.json({ profile, department, settings })
  } catch (err: any) {
    console.error("GET /api/users/me error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * PATCH /api/users/me - Update profile (position, department_id, intro, direction; full_name only when not SSO)
 */
router.patch("/me", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const { full_name, position, academic_title, academic_degree, department_id, intro, direction, google_scholar_url: googleScholarUrl, settings: settingsBody } = req.body
    const updates: string[] = ["updated_at = now()"]
    const values: unknown[] = []
    let idx = 1

    const current = await query(
      `SELECT sso_provider, settings_json FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
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
    if (department_id !== undefined) {
      updates.push(`department_id = $${idx++}`)
      values.push(department_id ? String(department_id).trim() : null)
    }
    if (intro !== undefined) {
      updates.push(`intro = $${idx++}`)
      values.push(intro != null ? String(intro) : null)
    }
    if (direction !== undefined) {
      updates.push(`direction = $${idx++}::jsonb`)
      values.push(
        Array.isArray(direction) ? JSON.stringify(direction) : direction == null ? null : JSON.stringify(Array.isArray(direction) ? direction : [String(direction)])
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
      `UPDATE ai_portal.users SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      values
    )
    const updated = await query(
      `SELECT id, email, display_name, full_name, sso_provider, position, department_id, intro, direction, google_scholar_url, settings_json
       FROM ai_portal.users WHERE id = $1::uuid`,
      [userId]
    )
    const row = updated.rows[0] as { department_id?: string; settings_json?: Record<string, unknown> }
    let department = null
    if (row?.department_id) {
      const d = await query(`SELECT id, name FROM ai_portal.departments WHERE id = $1::uuid`, [row.department_id])
      department = d.rows[0] ?? null
    }
    const profileRow = { ...updated.rows[0] } as Record<string, unknown>
    delete profileRow.settings_json
    const settingsJson = row?.settings_json ?? {}
    const defaults = {
      language: "vi",
      notifications: { email: false, push: false, projectUpdates: false },
      privacy: { profileVisible: false, projectsVisible: false },
      ai: { personalization: true, autoSuggestions: true, externalSearch: false, responseLength: 2, creativity: 3 },
      data: { autoBackup: false, syncEnabled: false, cacheSize: 1 },
    }
    const settings = { ...defaults, ...settingsJson } as Record<string, unknown>
    if (typeof settings.notifications === "object") settings.notifications = { ...defaults.notifications, ...settings.notifications }
    if (typeof settings.privacy === "object") settings.privacy = { ...defaults.privacy, ...settings.privacy }
    if (typeof settings.ai === "object") settings.ai = { ...defaults.ai, ...settings.ai }
    if (typeof settings.data === "object") settings.data = { ...defaults.data, ...settings.data }
    res.json({ profile: profileRow, department, settings })
  } catch (err: any) {
    console.error("PATCH /api/users/me error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/projects - List projects: owned + shared (user in team_members)
 */
router.get("/projects", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const userEmail = await getCurrentUserEmail(req)
    const result = await query(
      `SELECT p.id, p.user_id, p.name, p.description, p.team_members, p.file_keys, p.tags, p.icon, p.created_at, p.updated_at,
              (p.user_id != $1::uuid) AS is_shared,
              u.email AS owner_email,
              u.display_name AS owner_display_name
       FROM ai_portal.projects p
       LEFT JOIN ai_portal.users u ON u.id = p.user_id
       WHERE p.user_id = $1::uuid
          OR ($2::text IS NOT NULL AND p.team_members @> to_jsonb($2::text))
       ORDER BY p.updated_at DESC`,
      [userId, userEmail ?? ""]
    )
    res.json({ projects: result.rows })
  } catch (err: any) {
    console.error("GET /api/users/projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * POST /api/users/projects - Create new project
 */
router.post("/projects", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const { name, description, team_members, file_keys, tags, icon } = req.body
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Tên dự án là bắt buộc" })
    }
    const teamArr = Array.isArray(team_members) ? team_members : []
    const fileKeysArr = Array.isArray(file_keys) ? file_keys : []
    const id = crypto.randomUUID()
    const tagsArr = Array.isArray(tags) ? tags.map((t: unknown) => String(t).trim()).filter(Boolean) : []
    const iconVal = typeof icon === "string" && icon.trim() ? icon.trim() : "FolderKanban"
    await query(
      `INSERT INTO ai_portal.projects (id, user_id, name, description, team_members, file_keys, tags, icon)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7::text[], $8)`,
      [id, userId, name.trim(), description ? String(description).trim() : null, JSON.stringify(teamArr), JSON.stringify(fileKeysArr), tagsArr, iconVal]
    )
    const row = await query(
      `SELECT id, user_id, name, description, team_members, file_keys, tags, icon, created_at, updated_at FROM ai_portal.projects WHERE id = $1::uuid`,
      [id]
    )
    res.status(201).json({ project: row.rows[0] })
  } catch (err: any) {
    console.error("POST /api/users/projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * POST /api/users/projects/upload - Upload file to MinIO
 * Query: project_id (optional) - if set save to projects/{userId}/{projectId}/, else projects/{userId}/temp/{uuid}/
 */
router.post("/projects/upload", upload.array("files", 10), async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    if (!getSetting("MINIO_ENDPOINT") || !getSetting("MINIO_PORT") || !getSetting("MINIO_BUCKET_NAME")) {
      return res.status(503).json({ error: "MinIO chưa cấu hình" })
    }
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) return res.status(400).json({ error: "Không có file" })

    const projectId = (req.query.project_id as string)?.trim()
    let prefix: string
    if (projectId && /^[0-9a-f-]{36}$/i.test(projectId)) {
      const owner = await query(
        `SELECT 1 FROM ai_portal.projects WHERE id = $1::uuid AND user_id = $2::uuid`,
        [projectId, userId]
      )
      if (!owner.rows[0]) return res.status(403).json({ error: "Không có quyền với dự án này" })
      prefix = `projects/${userId}/${projectId}`
    } else {
      prefix = `projects/${userId}/temp/${crypto.randomUUID()}`
    }

    const keys: string[] = []
    for (const file of files) {
      const ext = file.originalname.includes(".") ? "." + file.originalname.split(".").pop()!.toLowerCase() : ""
      const key = `${prefix}/${crypto.randomUUID()}${ext}`
      await getUsersS3Client().send(
        new PutObjectCommand({
          Bucket: getUsersBucketName(),
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
        })
      )
      keys.push(key)
    }
    res.json({ keys })
  } catch (err: any) {
    console.error("POST /api/users/projects/upload error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/projects/files/:key - Download file (allowed if owner or shared member)
 */
router.get("/projects/files/:key(*)", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const key = decodeURIComponent(paramStr(req.params.key))
    const ownerPrefix = `projects/${userId}/`
    let allowed = key.startsWith(ownerPrefix)
    if (!allowed) {
      const userEmail = await getCurrentUserEmail(req)
      const shared = await query(
        `SELECT 1 FROM ai_portal.projects rp,
          LATERAL jsonb_array_elements_text(rp.file_keys) AS fk
         WHERE (rp.user_id = $1::uuid OR ($2::text IS NOT NULL AND rp.team_members @> to_jsonb($2::text)))
           AND fk = $3
         LIMIT 1`,
        [userId, userEmail ?? "", key]
      )
      allowed = !!shared.rows[0]
    }
    if (!allowed) return res.status(403).json({ error: "Không được truy cập file này" })
    if (!getSetting("MINIO_ENDPOINT") || !getSetting("MINIO_PORT")) {
      return res.status(503).json({ error: "MinIO chưa cấu hình" })
    }
    const response = await getUsersS3Client().send(
      new GetObjectCommand({ Bucket: getUsersBucketName(), Key: key })
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
    console.error("GET /api/users/projects/files error:", err)
    if ((err as { name?: string }).name === "NoSuchKey") return res.status(404).json({ error: "Không tìm thấy file" })
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * PATCH /api/users/projects/:id - Update project (owner only)
 */
router.patch("/projects/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const { name, description, team_members, file_keys, tags, icon } = req.body
    const ownerRow = await query(
      `SELECT id, name, team_members FROM ai_portal.projects WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    )
    if (!ownerRow.rows[0]) return res.status(404).json({ error: "Không tìm thấy dự án" })
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
    if (tags !== undefined) { updates.push(`tags = $${idx++}::text[]`); values.push(Array.isArray(tags) ? tags.map((t: unknown) => String(t).trim()).filter(Boolean) : []) }
    if (icon !== undefined) { updates.push(`icon = $${idx++}`); values.push(typeof icon === "string" && icon.trim() ? icon.trim() : "FolderKanban") }
    if (updates.length <= 1) return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    values.push(id)
    await query(`UPDATE ai_portal.projects SET ${updates.join(", ")} WHERE id = $${idx}::uuid`, values)

    // Create invite notification for each new email added to team_members
    if (team_members !== undefined && Array.isArray(team_members)) {
      const newEmails = team_members
        .map((e) => (typeof e === "string" ? e : String(e)).trim().toLowerCase())
        .filter((e) => e && !prevTeam.map((p) => p.toLowerCase()).includes(e))
      const inviter = await query(
        `SELECT email, display_name FROM ai_portal.users WHERE id = $1::uuid`,
        [userId]
      )
      const inviterEmail = (inviter.rows[0] as { email?: string })?.email ?? ""
      const inviterName = (inviter.rows[0] as { display_name?: string })?.display_name ?? inviterEmail
      for (const email of newEmails) {
        const target = await query(`SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`, [email])
        if (target.rows[0]?.id) {
          const payload = {
            project_id: id,
            project_name: projectName,
            inviter_email: inviterEmail,
            inviter_name: inviterName,
          }
          await query(
            `INSERT INTO ai_portal.notifications (user_id, type, title, body, payload)
             VALUES ($1::uuid, 'portal_invite', $2, $3, $4::jsonb)`,
            [
              (target.rows[0] as { id: string }).id,
              "Mời tham gia dự án",
              `${inviterName || inviterEmail} mời bạn tham gia dự án "${projectName}".`,
              JSON.stringify(payload),
            ]
          )
        }
      }
    }

    const row = await query(`SELECT id, user_id, name, description, team_members, file_keys, tags, icon, created_at, updated_at FROM ai_portal.projects WHERE id = $1::uuid`, [id])
    res.json({ project: row.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/users/projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * DELETE /api/users/projects/:id - Delete project (owner only)
 */
router.delete("/projects/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const r = await query(`DELETE FROM ai_portal.projects WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`, [id, userId])
    if (!r.rows[0]) return res.status(404).json({ error: "Không tìm thấy dự án" })
    res.json({ ok: true })
  } catch (err: any) {
    console.error("DELETE /api/users/projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

/**
 * GET /api/users/notifications - List user notifications (system, portal_invite)
 */
router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const unreadOnly = req.query.unread === "1"
    let sql = `SELECT id, user_id, type, title, body, payload, read_at, created_at
       FROM ai_portal.notifications WHERE user_id = $1::uuid`
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
 * PATCH /api/users/notifications/:id/read - Mark as read
 */
router.patch("/notifications/:id/read", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const r = await query(
      `UPDATE ai_portal.notifications SET read_at = now() WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`,
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
 * PATCH /api/users/notifications/:id/accept - Accept project invite (mark read; project already in list)
 */
router.patch("/notifications/:id/accept", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const r = await query(
      `SELECT id, type FROM ai_portal.notifications WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    )
    if (!r.rows[0]) return res.status(404).json({ error: "Không tìm thấy thông báo" })
    const notifType = (r.rows[0] as { type: string }).type
    if (notifType !== "portal_invite" && notifType !== "project_invite" && notifType !== "research_invite") {
      return res.status(400).json({ error: "Chỉ thông báo mời tham gia (AI Portal invite) mới có thể chấp nhận" })
    }
    await query(
      `UPDATE ai_portal.notifications SET read_at = now() WHERE id = $1::uuid AND user_id = $2::uuid`,
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
      `SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (found.rowCount && found.rows[0]?.id) {
      return res.json({ id: found.rows[0].id })
    }

    // Create new user if not exists
    const newId = crypto.randomUUID()
    await query(
      `INSERT INTO ai_portal.users (id, email, display_name) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [newId, email, email.split("@")[0]]
    )

    // Fetch the created user (in case of conflict, get existing one)
    const finalCheck = await query(
      `SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`,
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
      message: getSetting("DEBUG") === "true" ? err.message : undefined
    })
  }
})

export default router
