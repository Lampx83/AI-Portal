/**
 * Quyền truy cập dự án nghiên cứu: chủ (owner) / biên tập (editor) / xem (viewer).
 *
 * Nguồn dữ liệu (giữ tương thích với mọi nơi đang đọc team_members):
 *   - projects.user_id        → chủ dự án
 *   - projects.team_members   → JSONB mảng email thành viên (luôn chữ thường)
 *   - projects.member_roles   → JSONB { "<email>": "editor" | "viewer" }; thiếu khoá = "viewer" (hành vi cũ: chỉ xem)
 *   - projects.file_meta      → JSONB { "<khoá tệp>": { name, size, mime, folder, by, at } }
 *   - project_activity        → nhật ký hoạt động ngắn
 */
import { query } from "./db"

export type ProjectRole = "owner" | "editor" | "viewer"
export type MemberRole = "editor" | "viewer"

export const MAX_MEMBERS = 30
export const MAX_FILES_PER_PROJECT = 200
export const MAX_FILE_BYTES = 25 * 1024 * 1024

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : ""
}

export function isMemberRole(v: unknown): v is MemberRole {
  return v === "editor" || v === "viewer"
}

/**
 * Chuẩn hóa danh sách thành viên từ client. Chấp nhận:
 *   members: [{ email, role }]   (mới)
 *   team_members: ["a@x", ...]   (cũ; vai = defaultRole, nhưng nếu đã có vai ở `existingRoles` thì giữ)
 * Trả về email chữ thường, không trùng, bỏ email của chủ, tối đa MAX_MEMBERS.
 */
export function parseMembersInput(
  body: { members?: unknown; team_members?: unknown },
  opts: { ownerEmail?: string | null; defaultRole: MemberRole; existingRoles?: Record<string, MemberRole> }
): { emails: string[]; roles: Record<string, MemberRole>; invalid: string[] } {
  const owner = normEmail(opts.ownerEmail)
  const emails: string[] = []
  const roles: Record<string, MemberRole> = {}
  const invalid: string[] = []
  const push = (rawEmail: unknown, rawRole: unknown) => {
    const email = normEmail(rawEmail)
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      invalid.push(String(rawEmail).slice(0, 80))
      return
    }
    if (email === owner || email in roles) return
    emails.push(email)
    roles[email] = isMemberRole(rawRole) ? rawRole : opts.existingRoles?.[email] ?? opts.defaultRole
  }
  if (Array.isArray(body.members)) {
    for (const m of body.members) {
      if (typeof m === "string") push(m, undefined)
      else if (m && typeof m === "object") push((m as { email?: unknown }).email, (m as { role?: unknown }).role)
    }
  } else if (Array.isArray(body.team_members)) {
    for (const e of body.team_members) push(e, undefined)
  }
  return { emails: emails.slice(0, MAX_MEMBERS), roles, invalid }
}

let ensureP: Promise<void> | null = null
/** Lưới an toàn cho migration 026 (idempotent, an toàn khi nhiều bản sao backend khởi động cùng lúc). */
export function ensureProjectTeamwork(): Promise<void> {
  if (!ensureP) {
    ensureP = (async () => {
      await query(`ALTER TABLE ai_portal.projects ADD COLUMN IF NOT EXISTS member_roles JSONB NOT NULL DEFAULT '{}'::jsonb`)
      await query(`ALTER TABLE ai_portal.projects ADD COLUMN IF NOT EXISTS file_meta JSONB NOT NULL DEFAULT '{}'::jsonb`)
      await query(
        `CREATE TABLE IF NOT EXISTS ai_portal.project_activity (
           id          BIGSERIAL PRIMARY KEY,
           project_id  UUID NOT NULL REFERENCES ai_portal.projects(id) ON DELETE CASCADE,
           actor_email TEXT,
           kind        TEXT NOT NULL,
           detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
           created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      )
      await query(
        `CREATE INDEX IF NOT EXISTS idx_project_activity_project ON ai_portal.project_activity (project_id, created_at DESC)`
      )
    })().catch((e) => {
      ensureP = null
      throw e
    })
  }
  return ensureP
}

export interface ProjectAccessRow {
  id: string
  user_id: string
  name: string
  team_members: unknown
  member_roles: unknown
  file_keys: unknown
  file_meta: unknown
  lifecycle: unknown
}

export function memberEmailsOf(row: { team_members?: unknown }): string[] {
  return Array.isArray(row.team_members) ? row.team_members.map(normEmail).filter(Boolean) : []
}

export function memberRolesOf(row: { member_roles?: unknown }): Record<string, MemberRole> {
  const out: Record<string, MemberRole> = {}
  const raw = row.member_roles
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (isMemberRole(v)) out[normEmail(k)] = v
    }
  }
  return out
}

export function roleOf(row: { user_id: string; team_members?: unknown; member_roles?: unknown }, userId: string, email?: string | null): ProjectRole | null {
  if (row.user_id === userId) return "owner"
  const e = normEmail(email)
  if (!e) return null
  if (!memberEmailsOf(row).includes(e)) return null
  return memberRolesOf(row)[e] ?? "viewer"
}

/** Một hàm quyền duy nhất cho mọi route dự án. null = không thuộc dự án (hoặc không tồn tại). */
export async function getProjectAccess(
  projectId: string,
  userId: string,
  email?: string | null
): Promise<{ role: ProjectRole; row: ProjectAccessRow } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null
  await ensureProjectTeamwork()
  const r = await query<ProjectAccessRow>(
    `SELECT id, user_id, name, team_members, member_roles, file_keys, file_meta, lifecycle
     FROM ai_portal.projects WHERE id = $1::uuid`,
    [projectId]
  )
  const row = r.rows[0]
  if (!row) return null
  const role = roleOf(row, userId, email)
  return role ? { role, row } : null
}

export const canEditContent = (role: ProjectRole) => role === "owner" || role === "editor"

export interface FileMeta {
  name: string
  size: number
  mime: string
  folder: string
  by: string
  at: string
}

/** Thư mục: tối đa 3 cấp, mỗi cấp ≤ 40 ký tự, không "..", không ký tự điều khiển. */
export function cleanFolder(v: unknown): string {
  if (typeof v !== "string") return ""
  const parts = v
    .split("/")
    // eslint-disable-next-line no-control-regex
    .map((s) => s.replace(/[\u0000-\u001F\u007F\\]/g, "").trim().slice(0, 40))
    .filter((s) => s && s !== "." && s !== "..")
  return parts.slice(0, 3).join("/")
}

export function cleanFileName(v: unknown, fallback = "tệp"): string {
  if (typeof v !== "string") return fallback
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001F\u007F\/\\]/g, "").trim().slice(0, 150)
  return s || fallback
}

/** multer (busboy) giải mã tên tệp theo latin1 → sửa lại thành UTF-8 khi trông như bị vỡ dấu. */
export function fixUploadName(name: string): string {
  if (!/[À-ÿ]/.test(name) || /[^\u0000-ÿ]/.test(name)) return name
  try {
    const fixed = Buffer.from(name, "latin1").toString("utf8")
    return fixed.includes("�") ? name : fixed
  } catch {
    return name
  }
}

export async function logProjectActivity(
  projectId: string,
  actorEmail: string | null | undefined,
  kind: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  try {
    await query(
      `INSERT INTO ai_portal.project_activity (project_id, actor_email, kind, detail) VALUES ($1::uuid, $2, $3, $4::jsonb)`,
      [projectId, actorEmail ?? null, kind, JSON.stringify(detail)]
    )
    // giữ tối đa ~300 dòng mỗi dự án
    await query(
      `DELETE FROM ai_portal.project_activity WHERE project_id = $1::uuid AND id < (
         SELECT COALESCE(MIN(id), 0) FROM (SELECT id FROM ai_portal.project_activity WHERE project_id = $1::uuid ORDER BY id DESC LIMIT 300) t)`,
      [projectId]
    )
  } catch (e) {
    console.warn("[project-activity] ghi nhật ký lỗi:", (e as Error)?.message)
  }
}
