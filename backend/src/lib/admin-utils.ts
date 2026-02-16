import { getSetting } from "./settings"

/** Tài khoản luôn có quyền admin (không phụ thuộc DB). Cấu hình tại Admin → Settings (ADMIN_EMAILS). */
export function isAlwaysAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  const e = String(email).trim().toLowerCase()
  const raw = getSetting("ADMIN_EMAILS", "lampx@neu.edu.vn")
  const list = raw ? raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : ["lampx@neu.edu.vn"]
  return list.includes(e)
}
