import { getSetting } from "./settings"

/** Tài khoản luôn có quyền admin (không phụ thuộc DB). Cấu hình tại Admin → Settings (ADMIN_EMAILS). Mặc định rỗng — quyền admin chỉ theo DB (role/is_admin) hoặc khi ADMIN_EMAILS được cấu hình. */
export function isAlwaysAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  const raw = getSetting("ADMIN_EMAILS", "")
  if (!raw || !raw.trim()) return false
  const e = String(email).trim().toLowerCase()
  const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.includes(e)
}
