// routes/users.ts – Config from Admin → Settings
import { Router, Request, Response } from "express"
import { adminOnly } from "./admin/middleware"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import multer from "multer"
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { Readable } from "stream"
import crypto from "crypto"
import { getSetting, getBootstrapEnv } from "../lib/settings"
import { GUEST_USER_ID } from "../lib/chat/constants"
import { ensureProjectLifecycleColumn, parseLifecycleInput, LifecycleValidationError, normalizeLifecycle, diffLifecycle, LIFECYCLE_STAGES } from "../lib/project-lifecycle"
import {
  ensureProjectTeamwork, getProjectAccess, canEditContent, parseMembersInput, memberEmailsOf, memberRolesOf, roleOf, normEmail,
  cleanFolder, cleanFileName, fixUploadName, logProjectActivity, MAX_FILE_BYTES, MAX_FILES_PER_PROJECT,
  type MemberRole, type FileMeta,
} from "../lib/project-access"

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
  const secret = getSetting("NEXTAUTH_SECRET") || getBootstrapEnv("NEXTAUTH_SECRET")
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

/** Normalize `direction` (jsonb / array) to string[] for API responses */
function normalizeAreasOfInterest(direction: unknown): string[] {
  if (direction == null) return []
  if (Array.isArray(direction)) return direction.map((x) => String(x).trim()).filter(Boolean)
  if (typeof direction === "string") {
    try {
      const parsed = JSON.parse(direction) as unknown
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean)
    } catch {
      /* ignore */
    }
    const t = direction.trim()
    return t ? [t] : []
  }
  return []
}

/**
 * GET /api/users/profile?email= - Public profile fields by email (integrations, agents)
 * Response: email, full_name, qualification (trình độ / position), department, introduction, areas_of_interest
 */
router.get("/profile", async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.email === "string" ? req.query.email : Array.isArray(req.query.email) ? String(req.query.email[0] ?? "") : ""
    const email = raw.trim().toLowerCase()
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Thiếu hoặc sai email", message: "Dùng query ?email=user@domain.com" })
    }
    const result = await query(
      `SELECT u.email, u.full_name, u.position, u.academic_degree, u.department_id, u.intro, u.direction
       FROM ai_portal.users u WHERE LOWER(u.email) = $1 LIMIT 1`,
      [email]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    const row = result.rows[0] as {
      email: string
      full_name: string | null
      position: string | null
      academic_degree: string | null
      department_id: string | null
      intro: string | null
      direction: unknown
    }
    let department: { id: string; name: string } | null = null
    if (row.department_id) {
      const d = await query<{ id: string; name: string }>(
        `SELECT id, name FROM ai_portal.departments WHERE id = $1::uuid`,
        [row.department_id]
      )
      department = d.rows[0] ?? null
    }
    const qualification = (row.position?.trim() || row.academic_degree?.trim() || null) as string | null
    res.json({
      email: row.email,
      full_name: row.full_name?.trim() || null,
      qualification,
      department,
      introduction: row.intro ?? null,
      areas_of_interest: normalizeAreasOfInterest(row.direction),
    })
  } catch (err: any) {
    console.error("GET /api/users/profile error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

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
 * BẢO MẬT: chỉ trả hồ sơ cho (a) người đã đăng nhập, hoặc (b) lời gọi nội bộ giữa các tầng backend
 * (không có X-Forwarded-For/X-Real-IP — agent cùng tiến trình nhận user_url trong context).
 * Khách chưa đăng nhập đi qua gateway nhận 401 (trước đây lộ họ tên/chức danh/đơn vị theo email).
 */
router.get("/email/:identifier", async (req: Request, res: Response) => {
  try {
    {
      const { getCaller, isExternalRequest } = await import("../lib/chat/access")
      if (isExternalRequest(req)) {
        const c = await getCaller(req)
        if (!c.id) return res.status(401).json({ error: "Authentication required" })
      }
    }
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
    // BẢO MẬT: danh sách dự án nghiên cứu, id nội bộ và thông tin đăng nhập chỉ trả cho chính chủ hoặc quản trị viên.
    const { getCaller } = await import("../lib/chat/access")
    const caller = await getCaller(req)
    const isSelf = !!caller.email && caller.email.trim().toLowerCase() === email
    if (!caller.isAdmin && !isSelf) {
      const { id: _id, sso_provider: _sso, google_scholar_url: _gs, created_at: _ca, ...publicProfile } = profileRow as Record<string, unknown>
      return res.json({ profile: publicProfile, department, projects: [] })
    }
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

    // Cho phép người dùng SSO sửa họ tên hiển thị (tên SSO thường không dấu; đăng nhập lần sau KHÔNG ghi đè nhờ COALESCE)
    if (full_name !== undefined) {
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
 * Làm việc nhóm: trả về vai trò của người gọi + danh sách thành viên (kèm tên hiển thị) cho từng dự án.
 */
async function decorateProjects(rows: any[], userId: string, userEmail: string | null): Promise<any[]> {
  const emails = new Set<string>()
  for (const r of rows) for (const e of memberEmailsOf(r)) emails.add(e)
  const names = new Map<string, { display_name: string | null; id: string }>()
  if (emails.size > 0) {
    const u = await query<{ id: string; email: string; display_name: string | null }>(
      `SELECT id, email, display_name FROM ai_portal.users WHERE lower(email) = ANY($1::text[])`,
      [Array.from(emails)]
    )
    for (const x of u.rows) names.set(String(x.email).toLowerCase(), { display_name: x.display_name, id: x.id })
  }
  return rows.map((r) => {
    const roles = memberRolesOf(r)
    const members = memberEmailsOf(r).map((email) => ({
      email,
      role: (roles[email] ?? "viewer") as MemberRole,
      display_name: names.get(email)?.display_name ?? null,
      has_account: names.has(email),
    }))
    return { ...r, my_role: roleOf(r, userId, userEmail) ?? "viewer", members }
  })
}

const PROJECT_COLUMNS = `id, user_id, name, description, team_members, member_roles, file_keys, file_meta, tags, icon, lifecycle, created_at, updated_at`

/** Thông báo mời cho email mới thêm (chỉ gửi cho người đã có tài khoản; người chưa có tài khoản sẽ thấy dự án khi đăng nhập). */
async function notifyInvited(projectId: string, projectName: string, inviterId: string, newEmails: string[], roles: Record<string, MemberRole>) {
  if (newEmails.length === 0) return
  const inviter = await query(`SELECT email, display_name FROM ai_portal.users WHERE id = $1::uuid`, [inviterId])
  const inviterEmail = (inviter.rows[0] as { email?: string })?.email ?? ""
  const inviterName = (inviter.rows[0] as { display_name?: string })?.display_name ?? inviterEmail
  for (const email of newEmails) {
    const target = await query(`SELECT id FROM ai_portal.users WHERE lower(email) = $1 LIMIT 1`, [email])
    const tid = (target.rows[0] as { id?: string } | undefined)?.id
    if (!tid) continue
    const roleVi = roles[email] === "editor" ? "biên tập" : "xem"
    await query(
      `INSERT INTO ai_portal.notifications (user_id, type, title, body, payload)
       VALUES ($1::uuid, 'portal_invite', $2, $3, $4::jsonb)`,
      [
        tid,
        "Mời tham gia dự án",
        `${inviterName || inviterEmail} mời bạn tham gia dự án "${projectName}" (quyền ${roleVi}).`,
        JSON.stringify({ project_id: projectId, project_name: projectName, inviter_email: inviterEmail, inviter_name: inviterName, role: roles[email] ?? "viewer" }),
      ]
    )
  }
}

/**
 * GET /api/users/projects - List projects: owned + shared (user in team_members; email so khớp không phân biệt hoa/thường)
 */
router.get("/projects", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const userEmail = await getCurrentUserEmail(req)
    await ensureProjectLifecycleColumn()
    await ensureProjectTeamwork()
    const result = await query(
      `SELECT p.id, p.user_id, p.name, p.description, p.team_members, p.member_roles, p.file_keys, p.file_meta, p.tags, p.icon, p.lifecycle, p.created_at, p.updated_at,
              (p.user_id != $1::uuid) AS is_shared,
              u.email AS owner_email,
              u.display_name AS owner_display_name
       FROM ai_portal.projects p
       LEFT JOIN ai_portal.users u ON u.id = p.user_id
       WHERE p.user_id = $1::uuid
          OR ($2::text <> '' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.team_members) m WHERE lower(m) = $2::text))
       ORDER BY p.updated_at DESC`,
      [userId, normEmail(userEmail)]
    )
    res.json({ projects: await decorateProjects(result.rows, userId, userEmail) })
  } catch (err: any) {
    console.error("GET /api/users/projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/projects/my-tasks - Việc (mục checklist) được giao cho người dùng, chưa xong, ở mọi dự án mình thuộc về.
 */
router.get("/projects/my-tasks", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const email = normEmail(await getCurrentUserEmail(req))
    if (!email) return res.json({ tasks: [] })
    await ensureProjectLifecycleColumn()
    const r = await query(
      `SELECT p.id, p.name, p.lifecycle
       FROM ai_portal.projects p
       WHERE p.lifecycle IS NOT NULL
         AND (p.user_id = $1::uuid OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.team_members) m WHERE lower(m) = $2::text))`,
      [userId, email]
    )
    const tasks: { project_id: string; project_name: string; stage_id: string; stage_name: string; id: string; text: string; due: string | null }[] = []
    for (const row of r.rows as { id: string; name: string; lifecycle: unknown }[]) {
      const lc = normalizeLifecycle(row.lifecycle)
      lc.stages.forEach((st, i) => {
        for (const c of st.checklist) {
          if (!c.done && c.assignee === email) {
            tasks.push({ project_id: row.id, project_name: row.name, stage_id: st.id, stage_name: LIFECYCLE_STAGES[i].name, id: c.id, text: c.text, due: c.due ?? st.dueDate })
          }
        }
      })
    }
    tasks.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    res.json({ tasks: tasks.slice(0, 100) })
  } catch (err: any) {
    console.error("GET /api/users/projects/my-tasks error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * POST /api/users/projects - Create new project
 * Body: name, description, members: [{email, role}] (mới) hoặc team_members: string[] (cũ; mặc định vai biên tập), file_keys, tags, icon, lifecycle
 */
router.post("/projects", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    if (userId === GUEST_USER_ID) return res.status(403).json({ error: "Tài khoản khách không thể tạo hay lưu dự án." })
    const { name, description, file_keys, tags, icon, lifecycle } = req.body
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Tên dự án là bắt buộc" })
    }
    const ownerEmail = await getCurrentUserEmail(req)
    const parsed = parseMembersInput(req.body ?? {}, { ownerEmail, defaultRole: "editor" })
    if (parsed.invalid.length) return res.status(400).json({ error: `Email không hợp lệ: ${parsed.invalid.join(", ")}` })
    // BẢO MẬT: chỉ nhận khoá tệp nằm trong thư mục riêng của chính người dùng (chặn trỏ vào tệp của người khác).
    const ownFileKey = (k: unknown) => typeof k === "string" && k.startsWith(`projects/${userId}/`) && !k.split("/").some((seg) => seg === ".." || seg === ".")
    const fileKeysArr = Array.isArray(file_keys) ? file_keys.filter(ownFileKey) : []
    let lifecycleVal: ReturnType<typeof parseLifecycleInput> | null = null
    if (lifecycle !== undefined && lifecycle !== null) {
      try {
        lifecycleVal = parseLifecycleInput(lifecycle, undefined, {
          actorEmail: normEmail(ownerEmail) || null,
          assignableEmails: new Set([normEmail(ownerEmail), ...parsed.emails].filter(Boolean)),
        })
      } catch (e) {
        if (e instanceof LifecycleValidationError) return res.status(400).json({ error: e.message })
        throw e
      }
    }
    await ensureProjectLifecycleColumn()
    await ensureProjectTeamwork()
    const id = crypto.randomUUID()
    const tagsArr = Array.isArray(tags) ? tags.map((t: unknown) => String(t).trim()).filter(Boolean) : []
    const iconVal = typeof icon === "string" && icon.trim() ? icon.trim() : "FolderKanban"
    await query(
      `INSERT INTO ai_portal.projects (id, user_id, name, description, team_members, member_roles, file_keys, tags, icon, lifecycle)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::text[], $9, $10::jsonb)`,
      [id, userId, name.trim(), description ? String(description).trim() : null, JSON.stringify(parsed.emails), JSON.stringify(parsed.roles), JSON.stringify(fileKeysArr), tagsArr, iconVal, lifecycleVal ? JSON.stringify(lifecycleVal) : null]
    )
    await notifyInvited(id, name.trim(), userId, parsed.emails, parsed.roles).catch((e) => console.warn("[projects] gửi thông báo mời lỗi:", e?.message))
    await logProjectActivity(id, ownerEmail, "project_created", { members: parsed.emails.length })
    const row = await query(`SELECT ${PROJECT_COLUMNS} FROM ai_portal.projects WHERE id = $1::uuid`, [id])
    const [decorated] = await decorateProjects(row.rows, userId, ownerEmail)
    res.status(201).json({ project: decorated })
  } catch (err: any) {
    console.error("POST /api/users/projects error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/** multer có giới hạn kích thước: lỗi trả 413 tiếng Việt thay vì 500. */
const projectUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 10 } })
function projectUploadMiddleware(req: Request, res: Response, next: (e?: unknown) => void) {
  projectUpload.array("files", 10)(req, res, (err: unknown) => {
    if (!err) return next()
    const code = (err as { code?: string })?.code
    if (code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: `Tệp quá lớn (tối đa ${MAX_FILE_BYTES / 1024 / 1024} MB mỗi tệp).` })
    if (code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ error: "Tối đa 10 tệp mỗi lần tải lên." })
    next(err)
  })
}

/**
 * POST /api/users/projects/upload - Upload file to MinIO
 * Query: project_id (tuỳ chọn) + folder (tuỳ chọn). Có project_id: chủ HOẶC biên tập được tải; tệp lưu ở projects/{chủ}/{dự án}/
 * và được ghi vào file_keys + file_meta (tên gốc, kích thước, người tải, thư mục). Không có project_id: thư mục tạm của chính người dùng.
 */
router.post("/projects/upload", projectUploadMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    if (userId === GUEST_USER_ID) return res.status(403).json({ error: "Tài khoản khách không thể tải lên hay lưu file dự án." })
    if (!getSetting("MINIO_ENDPOINT") || !getSetting("MINIO_PORT") || !getSetting("MINIO_BUCKET_NAME")) {
      return res.status(503).json({ error: "MinIO chưa cấu hình" })
    }
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) return res.status(400).json({ error: "Không có file" })

    const projectId = (req.query.project_id as string)?.trim()
    const folder = cleanFolder(req.query.folder)
    const uploaderEmail = normEmail(await getCurrentUserEmail(req))
    let prefix: string
    let currentCount = 0
    if (projectId && /^[0-9a-f-]{36}$/i.test(projectId)) {
      const acc = await getProjectAccess(projectId, userId, uploaderEmail)
      if (!acc || !canEditContent(acc.role)) return res.status(403).json({ error: "Không có quyền tải tệp lên dự án này" })
      currentCount = Array.isArray(acc.row.file_keys) ? acc.row.file_keys.length : 0
      if (currentCount + files.length > MAX_FILES_PER_PROJECT) {
        return res.status(400).json({ error: `Mỗi dự án tối đa ${MAX_FILES_PER_PROJECT} tệp.` })
      }
      // Luôn lưu dưới thư mục của CHỦ dự án để chủ/thành viên cùng đọc được và bộ lọc khoá tệp của chủ không loại bỏ.
      prefix = `projects/${acc.row.user_id}/${projectId}`
    } else {
      prefix = `projects/${userId}/temp/${crypto.randomUUID()}`
    }

    const keys: string[] = []
    const metas: Record<string, FileMeta> = {}
    const now = new Date().toISOString()
    for (const file of files) {
      const original = cleanFileName(fixUploadName(file.originalname))
      const ext = original.includes(".") ? "." + original.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) : ""
      const key = `${prefix}/${crypto.randomUUID()}${ext === "." ? "" : ext}`
      await getUsersS3Client().send(
        new PutObjectCommand({
          Bucket: getUsersBucketName(),
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
        })
      )
      keys.push(key)
      metas[key] = { name: original, size: file.size, mime: file.mimetype || "application/octet-stream", folder, by: uploaderEmail, at: now }
    }
    if (projectId && /^[0-9a-f-]{36}$/i.test(projectId)) {
      await query(
        `UPDATE ai_portal.projects
           SET file_keys = COALESCE(file_keys, '[]'::jsonb) || $2::jsonb,
               file_meta = COALESCE(file_meta, '{}'::jsonb) || $3::jsonb,
               updated_at = now()
         WHERE id = $1::uuid`,
        [projectId, JSON.stringify(keys), JSON.stringify(metas)]
      )
      await logProjectActivity(projectId, uploaderEmail, "file_uploaded", { names: Object.values(metas).map((m) => m.name).slice(0, 5), count: keys.length, folder })
    }
    res.json({ keys, files: keys.map((k) => ({ key: k, ...metas[k] })) })
  } catch (err: any) {
    console.error("POST /api/users/projects/upload error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/projects/files/:key - Download file (allowed if owner or shared member of the project that holds the key)
 */
router.get("/projects/files/:key(*)", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const key = decodeURIComponent(paramStr(req.params.key))
    if (key.split("/").some((seg) => seg === ".." || seg === ".")) return res.status(400).json({ error: "Khoá tệp không hợp lệ" })
    await ensureProjectTeamwork()
    const userEmail = normEmail(await getCurrentUserEmail(req))
    // Tệp thuộc dự án nào thì phải là chủ/thành viên của dự án đó; tệp tạm (chưa gắn dự án) chỉ người tải đọc được.
    const holder = await query<{ user_id: string; team_members: unknown; file_meta: unknown }>(
      `SELECT user_id, team_members, file_meta FROM ai_portal.projects WHERE file_keys ? $1 LIMIT 1`,
      [key]
    )
    let allowed = false
    let displayName: string | null = null
    const h = holder.rows[0]
    if (h) {
      allowed = h.user_id === userId || (!!userEmail && memberEmailsOf(h).includes(userEmail))
      const m = (h.file_meta as Record<string, FileMeta> | null)?.[key]
      displayName = m?.name ?? null
    } else {
      allowed = key.startsWith(`projects/${userId}/`)
    }
    if (!allowed) return res.status(403).json({ error: "Không được truy cập file này" })
    if (!getSetting("MINIO_ENDPOINT") || !getSetting("MINIO_PORT")) {
      return res.status(503).json({ error: "MinIO chưa cấu hình" })
    }
    const response = await getUsersS3Client().send(
      new GetObjectCommand({ Bucket: getUsersBucketName(), Key: key })
    )
    const contentType = response.ContentType || "application/octet-stream"
    const rawName = displayName || key.split("/").pop() || "file"
    const asciiName = rawName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_")
    res.setHeader("Content-Type", contentType)
    res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(rawName)}`)
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
 * PATCH /api/users/projects/:id/files - Đổi tên / chuyển thư mục một tệp.
 * Body: { key, name?, folder? }. Chủ: mọi tệp; biên tập: tệp do mình tải; xem: không được.
 */
router.patch("/projects/:id/files", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const email = normEmail(await getCurrentUserEmail(req))
    const acc = await getProjectAccess(paramStr(req.params.id), userId, email)
    if (!acc) return res.status(404).json({ error: "Không tìm thấy dự án" })
    const key = typeof req.body?.key === "string" ? req.body.key : ""
    const keys = Array.isArray(acc.row.file_keys) ? (acc.row.file_keys as string[]) : []
    if (!key || !keys.includes(key)) return res.status(404).json({ error: "Không tìm thấy tệp trong dự án" })
    const meta = ((acc.row.file_meta as Record<string, FileMeta> | null) ?? {})[key]
    const mine = !!meta?.by && meta.by === email
    if (!(acc.role === "owner" || (acc.role === "editor" && mine))) {
      return res.status(403).json({ error: "Bạn chỉ được sửa tệp do chính mình tải lên." })
    }
    const next: FileMeta = {
      name: meta?.name ?? key.split("/").pop() ?? "tệp",
      size: meta?.size ?? 0,
      mime: meta?.mime ?? "application/octet-stream",
      folder: meta?.folder ?? "",
      by: meta?.by ?? "",
      at: meta?.at ?? "",
    }
    if (req.body?.name !== undefined) next.name = cleanFileName(req.body.name, next.name)
    if (req.body?.folder !== undefined) next.folder = cleanFolder(req.body.folder)
    await query(
      `UPDATE ai_portal.projects SET file_meta = jsonb_set(COALESCE(file_meta, '{}'::jsonb), ARRAY[$2]::text[], $3::jsonb, true), updated_at = now() WHERE id = $1::uuid`,
      [acc.row.id, key, JSON.stringify(next)]
    )
    await logProjectActivity(acc.row.id, email, "file_updated", { name: next.name, folder: next.folder })
    res.json({ ok: true, file: { key, ...next } })
  } catch (err: any) {
    console.error("PATCH /api/users/projects/:id/files error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * DELETE /api/users/projects/:id/files?key=... - Gỡ tệp khỏi dự án (đối tượng MinIO được giữ lại để khôi phục).
 * Chủ: mọi tệp; biên tập: tệp do mình tải.
 */
router.delete("/projects/:id/files", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const email = normEmail(await getCurrentUserEmail(req))
    const acc = await getProjectAccess(paramStr(req.params.id), userId, email)
    if (!acc) return res.status(404).json({ error: "Không tìm thấy dự án" })
    const key = typeof req.query.key === "string" ? req.query.key : typeof req.body?.key === "string" ? req.body.key : ""
    const keys = Array.isArray(acc.row.file_keys) ? (acc.row.file_keys as string[]) : []
    if (!key || !keys.includes(key)) return res.status(404).json({ error: "Không tìm thấy tệp trong dự án" })
    const meta = ((acc.row.file_meta as Record<string, FileMeta> | null) ?? {})[key]
    const mine = !!meta?.by && meta.by === email
    if (!(acc.role === "owner" || (acc.role === "editor" && mine))) {
      return res.status(403).json({ error: "Bạn chỉ được xoá tệp do chính mình tải lên." })
    }
    await query(
      `UPDATE ai_portal.projects
          SET file_keys = COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements_text(file_keys) AS k WHERE k <> $2), '[]'::jsonb),
              file_meta = COALESCE(file_meta, '{}'::jsonb) - $2,
              updated_at = now()
        WHERE id = $1::uuid`,
      [acc.row.id, key]
    )
    await logProjectActivity(acc.row.id, email, "file_removed", { name: meta?.name ?? key.split("/").pop() })
    res.json({ ok: true })
  } catch (err: any) {
    console.error("DELETE /api/users/projects/:id/files error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * GET /api/users/projects/:id/activity - 30 hoạt động gần nhất (mọi thành viên xem được).
 */
router.get("/projects/:id/activity", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const acc = await getProjectAccess(paramStr(req.params.id), userId, await getCurrentUserEmail(req))
    if (!acc) return res.status(404).json({ error: "Không tìm thấy dự án" })
    const r = await query(
      `SELECT id, actor_email, kind, detail, created_at FROM ai_portal.project_activity WHERE project_id = $1::uuid ORDER BY id DESC LIMIT 30`,
      [acc.row.id]
    )
    res.json({ activity: r.rows })
  } catch (err: any) {
    console.error("GET /api/users/projects/:id/activity error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

/**
 * PATCH /api/users/projects/:id - Cập nhật dự án.
 *   Chủ: mọi trường (name, description, members/team_members, file_keys, tags, icon, lifecycle).
 *   Biên tập: chỉ lifecycle (trạng thái giai đoạn, ghi chú, hạn, checklist, giao việc).
 *   Xem: không được sửa.
 */
router.patch("/projects/:id", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) return res.status(401).json({ error: "Chưa đăng nhập" })
    const id = paramStr(req.params.id)
    const { name, description, file_keys, tags, icon, lifecycle } = req.body
    await ensureProjectLifecycleColumn()
    const actorEmail = normEmail(await getCurrentUserEmail(req))
    const acc = await getProjectAccess(id, userId, actorEmail)
    if (!acc) return res.status(404).json({ error: "Không tìm thấy dự án" })
    const isOwner = acc.role === "owner"
    if (!canEditContent(acc.role)) return res.status(403).json({ error: "Bạn chỉ có quyền xem dự án này." })
    const wantsMembers = req.body.members !== undefined || req.body.team_members !== undefined
    if (!isOwner && (name !== undefined || description !== undefined || wantsMembers || file_keys !== undefined || tags !== undefined || icon !== undefined)) {
      return res.status(403).json({ error: "Chỉ chủ dự án được sửa thông tin, thành viên và danh sách tệp. Biên tập viên được cập nhật vòng đời và tải tệp." })
    }
    const ownerRow = { rows: [acc.row] }
    const prevTeam = memberEmailsOf(acc.row)
    const prevRoles = memberRolesOf(acc.row)
    const projectName = String(acc.row.name ?? "")
    const ownerEmailRes = await query<{ email: string }>(`SELECT email FROM ai_portal.users WHERE id = $1::uuid`, [acc.row.user_id])
    const ownerEmail = normEmail(ownerEmailRes.rows[0]?.email)

    const updates: string[] = ["updated_at = now()"]
    const values: unknown[] = []
    let idx = 1
    let membersAfter = prevTeam
    let rolesAfter = prevRoles
    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(String(name).trim()) }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description ? String(description).trim() : null) }
    if (wantsMembers) {
      const parsed = parseMembersInput(req.body, { ownerEmail, defaultRole: "viewer", existingRoles: prevRoles })
      if (parsed.invalid.length) return res.status(400).json({ error: `Email không hợp lệ: ${parsed.invalid.join(", ")}` })
      // Email mới thêm bằng cách gửi `team_members` (cũ) nhận quyền biên tập; vai đã có được giữ nguyên.
      if (!Array.isArray(req.body.members)) {
        for (const e of parsed.emails) if (!(e in prevRoles)) parsed.roles[e] = "editor"
      }
      membersAfter = parsed.emails
      rolesAfter = parsed.roles
      updates.push(`team_members = $${idx++}::jsonb`); values.push(JSON.stringify(parsed.emails))
      updates.push(`member_roles = $${idx++}::jsonb`); values.push(JSON.stringify(parsed.roles))
    }
    if (file_keys !== undefined) {
      const ownerPrefix = `projects/${acc.row.user_id}/`
      const kept = Array.isArray(file_keys) ? file_keys.filter((k: unknown): k is string => typeof k === "string" && k.startsWith(ownerPrefix) && !k.split("/").some((seg) => seg === ".." || seg === ".")) : []
      updates.push(`file_keys = $${idx++}::jsonb`); values.push(JSON.stringify(kept))
      // bỏ siêu dữ liệu của tệp đã gỡ
      const meta = (acc.row.file_meta as Record<string, FileMeta> | null) ?? {}
      const prunedMeta: Record<string, FileMeta> = {}
      for (const k of kept) if (meta[k]) prunedMeta[k] = meta[k]
      updates.push(`file_meta = $${idx++}::jsonb`); values.push(JSON.stringify(prunedMeta))
    }
    if (tags !== undefined) { updates.push(`tags = $${idx++}::text[]`); values.push(Array.isArray(tags) ? tags.map((t: unknown) => String(t).trim()).filter(Boolean) : []) }
    if (icon !== undefined) { updates.push(`icon = $${idx++}`); values.push(typeof icon === "string" && icon.trim() ? icon.trim() : "FolderKanban") }
    let changes: ReturnType<typeof diffLifecycle> = []
    if (lifecycle !== undefined) {
      if (lifecycle === null) {
        if (!isOwner) return res.status(403).json({ error: "Chỉ chủ dự án được xoá toàn bộ vòng đời." })
        updates.push(`lifecycle = NULL`)
      } else {
        try {
          const parsed = parseLifecycleInput(lifecycle, (ownerRow.rows[0] as { lifecycle?: unknown }).lifecycle, {
            actorEmail: actorEmail || null,
            assignableEmails: new Set([ownerEmail, ...membersAfter].filter(Boolean)),
          })
          changes = diffLifecycle((ownerRow.rows[0] as { lifecycle?: unknown }).lifecycle, parsed)
          updates.push(`lifecycle = $${idx++}::jsonb`)
          values.push(JSON.stringify(parsed))
        } catch (e) {
          if (e instanceof LifecycleValidationError) return res.status(400).json({ error: e.message })
          throw e
        }
      }
    }
    if (updates.length <= 1) return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    values.push(id)
    await query(`UPDATE ai_portal.projects SET ${updates.join(", ")} WHERE id = $${idx}::uuid`, values)

    // Mời: thông báo cho email mới thêm
    if (wantsMembers) {
      const newEmails = membersAfter.filter((e) => !prevTeam.includes(e))
      await notifyInvited(id, projectName, userId, newEmails, rolesAfter).catch((e) => console.warn("[projects] gửi thông báo mời lỗi:", e?.message))
      for (const e of newEmails) await logProjectActivity(id, actorEmail, "member_added", { email: e, role: rolesAfter[e] ?? "viewer" })
      for (const e of prevTeam.filter((x) => !membersAfter.includes(x))) await logProjectActivity(id, actorEmail, "member_removed", { email: e })
      for (const e of membersAfter) {
        if (prevTeam.includes(e) && (prevRoles[e] ?? "viewer") !== (rolesAfter[e] ?? "viewer")) {
          await logProjectActivity(id, actorEmail, "member_role", { email: e, role: rolesAfter[e] ?? "viewer" })
        }
      }
    }
    // Vòng đời: nhật ký + thông báo giao việc
    for (const c of changes) {
      if (c.kind === "stage_status") await logProjectActivity(id, actorEmail, "stage_status", { stage: c.stageName, status: c.status })
      else if (c.kind === "item_done") await logProjectActivity(id, actorEmail, "item_done", { stage: c.stageName, text: c.text })
      else if (c.kind === "item_assigned") {
        await logProjectActivity(id, actorEmail, "item_assigned", { stage: c.stageName, text: c.text, assignee: c.assignee })
        if (c.assignee && c.assignee !== actorEmail) {
          const target = await query(`SELECT id FROM ai_portal.users WHERE lower(email) = $1 LIMIT 1`, [c.assignee])
          const tid = (target.rows[0] as { id?: string } | undefined)?.id
          if (tid) {
            await query(
              `INSERT INTO ai_portal.notifications (user_id, type, title, body, payload)
               VALUES ($1::uuid, 'project_task', $2, $3, $4::jsonb)`,
              [tid, "Bạn được giao việc trong dự án", `«${c.text}» (${c.stageName}) — dự án "${projectName}".`, JSON.stringify({ project_id: id, project_name: projectName, stage: c.stageName, text: c.text, by: actorEmail })]
            ).catch(() => undefined)
          }
        }
      }
    }

    const row = await query(`SELECT ${PROJECT_COLUMNS} FROM ai_portal.projects WHERE id = $1::uuid`, [id])
    const [decorated] = await decorateProjects(row.rows, userId, actorEmail)
    res.json({ project: decorated })
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
router.post("/ensure", adminOnly, async (req: Request, res: Response) => {
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
