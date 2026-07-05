import { Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { getSetting } from "../../lib/settings"
import { isAlwaysAdmin } from "../../lib/admin-utils"
import { parseCookies } from "../../lib/parse-cookies"
import { query as dbQuery } from "../../lib/db"

/** Admin routes always enabled; access requires an authenticated admin (JWT is_admin) OR a valid ADMIN_SECRET. */
export const allowAdmin = true

/**
 * True only when ADMIN_SECRET is configured AND the request presents it (cookie/header).
 * Fail-closed: when no ADMIN_SECRET is set, this path grants nothing (admin must come from JWT is_admin).
 */
export function hasValidAdminSecret(req: Request): boolean {
  const secret = getSetting("ADMIN_SECRET")
  if (!secret) return false
  const cookieMatch = req.headers.cookie?.match(/admin_secret=([^;]+)/)
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null
  const fromHeader = req.headers["x-admin-secret"] as string | undefined
  return fromCookie === secret || fromHeader === secret
}

/**
 * Decode the next-auth JWT session and decide whether the caller is an admin.
 * Checks (cheapest first): token.is_admin claim, ADMIN_EMAILS allowlist, then DB role/is_admin.
 * Returns false on any error (fail-closed).
 */
export async function isAuthenticatedAdmin(req: Request): Promise<boolean> {
  try {
    const secret = getSetting("NEXTAUTH_SECRET")
    if (!secret) return false
    const cookies = parseCookies(req.headers.cookie)
    const token = (await getToken({
      req: { cookies, headers: req.headers } as any,
      secret,
    })) as { id?: string; email?: string; is_admin?: boolean } | null
    if (!token) return false
    if (token.is_admin === true) return true
    if (isAlwaysAdmin(token.email)) return true
    if (token.id) {
      const r = await dbQuery<{ role?: string; is_admin?: boolean }>(
        `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
        [token.id]
      )
      const row = r.rows[0]
      return !!row && (row.role === "admin" || row.role === "developer" || !!row.is_admin)
    }
    return false
  } catch {
    return false
  }
}

/**
 * Enforce admin access. Passes when the caller presents a valid ADMIN_SECRET
 * OR is an authenticated admin (JWT is_admin). Fail-closed: otherwise 403.
 */
export async function adminOnly(req: Request, res: Response, next: (err?: any) => void): Promise<void> {
  if (hasValidAdminSecret(req)) {
    next()
    return
  }
  if (await isAuthenticatedAdmin(req)) {
    next()
    return
  }
  res.status(403).json({
    error: "Không có quyền quản trị",
    hint: "Đăng nhập bằng tài khoản quản trị tại / rồi thử lại",
  })
}
