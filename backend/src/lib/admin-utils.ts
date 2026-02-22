import { getSetting } from "./settings"

/** Accounts that always have admin (independent of DB). Configure in Admin → Settings (ADMIN_EMAILS). Default empty — admin only from DB (role/is_admin) or when ADMIN_EMAILS is set. */
export function isAlwaysAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  const raw = getSetting("ADMIN_EMAILS", "")
  if (!raw || !raw.trim()) return false
  const e = String(email).trim().toLowerCase()
  const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.includes(e)
}
