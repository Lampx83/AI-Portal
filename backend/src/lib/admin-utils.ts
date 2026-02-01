/** Tài khoản luôn có quyền admin (không phụ thuộc DB). Có thể thêm qua env ADMIN_EMAILS. */
export function isAlwaysAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  const e = String(email).trim().toLowerCase()
  const list = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : ["lampx@neu.edu.vn"]
  return list.includes(e)
}
