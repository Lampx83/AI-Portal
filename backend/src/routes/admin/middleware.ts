import { Request, Response } from "express"
import { getSetting } from "../../lib/settings"

/** Admin routes always enabled; protected by ADMIN_SECRET (if set) and user is_admin when required. */
export const allowAdmin = true

export function hasValidAdminSecret(req: Request): boolean {
  const secret = getSetting("ADMIN_SECRET")
  if (!secret) return true
  const cookieMatch = req.headers.cookie?.match(/admin_secret=([^;]+)/)
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null
  const fromHeader = req.headers["x-admin-secret"] as string | undefined
  return fromCookie === secret || fromHeader === secret
}

/** Middleware to enforce admin access (admin secret when ADMIN_SECRET is set). */
export function adminOnly(req: Request, res: Response, next: (err?: any) => void): void {
  if (getSetting("ADMIN_SECRET") && !hasValidAdminSecret(req)) {
    res.status(403).json({
      error: "Mã quản trị không hợp lệ hoặc hết hạn",
      hint: "Truy cập / để đăng nhập quản trị",
    })
    return
  }
  next()
}
