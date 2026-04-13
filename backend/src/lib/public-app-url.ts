/**
 * NEXTAUTH_URL chuẩn (next-auth v4 + basePath) có dạng https://host/base/api/auth.
 * Các redirect trang (/login) và URL public cần base https://host/base (bỏ /api/auth).
 */
export function publicAppBaseFromNextAuthUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, "")
  if (!t) return t
  try {
    const u = new URL(t)
    let path = (u.pathname || "").replace(/\/+$/, "") || ""
    if (path.endsWith("/api/auth")) path = path.slice(0, -"/api/auth".length).replace(/\/+$/, "") || ""
    return path && path !== "/" ? `${u.origin}${path}`.replace(/\/+$/, "") : u.origin
  } catch {
    return t
  }
}
