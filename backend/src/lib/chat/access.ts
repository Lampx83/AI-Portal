/**
 * Kiểm soát truy cập phiên hội thoại (chat_sessions / messages).
 *
 * Trước đây các điểm cuối /api/chat/sessions* không xác thực: ai cũng liệt kê được phiên của mọi người dùng,
 * đọc tin nhắn, sửa tiêu đề và xoá phiên chỉ bằng UUID (phát hiện qua kiểm thử NEU-Research 09/2026, mã D1).
 *
 * Quy tắc:
 *  - Quản trị viên (JWT is_admin / role admin) được truy cập mọi phiên.
 *  - Người dùng đăng nhập chỉ truy cập phiên của chính mình.
 *  - Phiên thuộc “bucket công khai” (SYSTEM_USER_ID: nhúng ẩn danh; GUEST_USER_ID: tài khoản Khách) truy cập được bằng UUID
 *    (mô hình capability — UUID không đoán được và không còn xuất hiện trong danh sách công khai).
 */
import type { Request, Response } from "express"
import { query } from "../db"
import { getSetting } from "../settings"
import { parseCookies } from "../parse-cookies"
import { isAlwaysAdmin } from "../admin-utils"
import { UUID_RE, SYSTEM_USER_ID, GUEST_USER_ID } from "./constants"

export interface Caller {
  id: string | null
  email: string | null
  isAdmin: boolean
}

export async function getCaller(req: Request): Promise<Caller> {
  try {
    const { getToken } = await import("next-auth/jwt")
    const secret = getSetting("NEXTAUTH_SECRET")
    if (!secret) return { id: null, email: null, isAdmin: false }
    const token = (await getToken({ req: { cookies: parseCookies(req.headers.cookie), headers: req.headers } as any, secret })) as
      | { id?: string; email?: string; is_admin?: boolean }
      | null
    if (!token?.id) return { id: null, email: null, isAdmin: false }
    let isAdmin = token.is_admin === true || isAlwaysAdmin(token.email)
    if (!isAdmin) {
      try {
        const r = await query<{ role?: string; is_admin?: boolean }>(`SELECT COALESCE(role,'user') AS role, is_admin FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`, [token.id])
        const row = r.rows[0]
        isAdmin = !!row && (row.role === "admin" || row.role === "developer" || !!row.is_admin)
      } catch {
        /* fail-closed */
      }
    }
    return { id: token.id, email: token.email ?? null, isAdmin }
  } catch {
    return { id: null, email: null, isAdmin: false }
  }
}

const PUBLIC_BUCKETS = new Set([SYSTEM_USER_ID, GUEST_USER_ID])

/** Quyết định truy cập một phiên theo chủ sở hữu. */
export function canAccessOwner(caller: Caller, ownerId: string | null): boolean {
  if (caller.isAdmin) return true
  if (!ownerId) return false
  if (caller.id && caller.id === ownerId) return true
  return PUBLIC_BUCKETS.has(ownerId)
}

/** Kiểm tra quyền với một phiên; tự trả 404/403 và trả false nếu không được phép. */
export async function authorizeSessionAccess(
  req: Request,
  res: Response,
  sessionId: string,
  opts?: { allowMissing?: boolean }
): Promise<boolean> {
  if (!UUID_RE.test(sessionId)) return true // để route tự trả 400
  let owner: string | null = null
  try {
    const r = await query<{ user_id: string }>(`SELECT user_id FROM ai_portal.chat_sessions WHERE id = $1::uuid LIMIT 1`, [sessionId])
    if (!r.rows[0]) {
      // Chat mới: UUID do client sinh, phiên chỉ được tạo khi gửi tin nhắn đầu tiên.
      if (opts?.allowMissing) return true
      res.status(404).json({ error: "Session not found" })
      return false
    }
    owner = r.rows[0].user_id
  } catch {
    res.status(500).json({ error: "Internal Server Error" })
    return false
  }
  const caller = await getCaller(req)
  if (canAccessOwner(caller, owner)) return true
  res.status(caller.id ? 403 : 401).json({ error: caller.id ? "Forbidden" : "Authentication required" })
  return false
}

/** Ràng buộc bộ lọc liệt kê phiên theo người gọi. Trả về user_id được phép dùng (hoặc undefined = không giới hạn cho admin) hoặc null nếu bị từ chối. */
export async function resolveListingUser(req: Request, requested: string | undefined): Promise<{ allowed: boolean; userId?: string; status?: number }> {
  const caller = await getCaller(req)
  const req_ = (requested || "").trim().toLowerCase()
  if (caller.isAdmin) return { allowed: true, userId: requested }
  // Không liệt kê danh sách phiên của bucket công khai (khách/nhúng ẩn danh): tiêu đề phiên là câu hỏi của người khác.
  if (!caller.id) return { allowed: false, status: 401 }
  if (!req_ || req_ === caller.id.toLowerCase() || (caller.email && req_ === caller.email.toLowerCase())) return { allowed: true, userId: caller.id }
  return { allowed: false, status: 403 }
}

export { UUID_RE }

/** Yêu cầu đến từ bên ngoài (qua nginx/gateway) — gọi nội bộ giữa các tầng backend không có các header này. */
export function isExternalRequest(req: Request): boolean {
  return !!(req.headers["x-forwarded-for"] || req.headers["x-real-ip"])
}

/**
 * Với yêu cầu từ bên ngoài tới Trợ lý chính: bỏ mọi thông tin danh tính/dự án do client tự khai trong context
 * (user_url, user_profile, project_info, project_id) và chỉ giữ lại những gì khớp với phiên đăng nhập (JWT).
 * Nhờ đó người ngoài không thể hỏi Trợ lý chính để lấy hồ sơ hay dự án của người khác.
 */
export async function sanitizeExternalAskBody<T extends { context?: Record<string, unknown> }>(req: Request, body: T): Promise<T> {
  if (!isExternalRequest(req) || !body || typeof body !== "object") return body
  const ctx: Record<string, unknown> = { ...(body.context ?? {}) }
  const requestedProject = typeof ctx.project_id === "string" ? ctx.project_id.trim() : ""
  delete ctx.user_url
  delete ctx.user_profile
  delete ctx.project_info
  delete ctx.project_id
  const caller = await getCaller(req)
  if (caller.email) ctx.user_url = `/api/users/email/${encodeURIComponent(caller.email.toLowerCase())}`
  if (requestedProject && UUID_RE.test(requestedProject) && (caller.id || caller.isAdmin)) {
    try {
      const r = await query<{ user_id: string; team_members: unknown }>(
        `SELECT user_id, team_members FROM ai_portal.projects WHERE id = $1::uuid LIMIT 1`,
        [requestedProject]
      )
      const row = r.rows[0]
      if (row) {
        const members = JSON.stringify(row.team_members ?? []).toLowerCase()
        const ok =
          caller.isAdmin ||
          row.user_id === caller.id ||
          (!!caller.email && members.includes(caller.email.toLowerCase()))
        if (ok) ctx.project_id = requestedProject
      }
    } catch {
      /* không xác minh được → bỏ project_id */
    }
  }
  return { ...body, context: ctx }
}
