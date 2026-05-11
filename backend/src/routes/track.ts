// routes/track.ts - Public tracking endpoints (page views)
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import { getSetting } from "../lib/settings"
import { parseCookies } from "../lib/parse-cookies"

const router = Router()

async function getCurrentUserId(req: Request): Promise<string | null> {
  try {
    const secret = getSetting("NEXTAUTH_SECRET")
    if (!secret) return null
    const cookies = parseCookies(req.headers.cookie)
    const token = await getToken({ req: { cookies, headers: req.headers } as any, secret })
    return (token as { id?: string })?.id ?? null
  } catch {
    return null
  }
}

/** Đường dẫn không cần track (admin, login, api proxy noise…) */
function shouldSkipPath(path: string): boolean {
  if (!path) return true
  return (
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/admin") ||
    path.startsWith("/login") ||
    path.startsWith("/setup") ||
    path === "/error" ||
    path === "/favicon.ico"
  )
}

router.post("/pageview", async (req: Request, res: Response) => {
  try {
    const body = req.body as { path?: string; referrer?: string }
    const rawPath = typeof body?.path === "string" ? body.path.trim() : ""
    if (!rawPath) return res.status(400).json({ error: "Missing path" })
    // Cắt query string + hash, giữ pathname để giảm cardinality
    let path = rawPath
    try {
      if (path.startsWith("http")) path = new URL(path).pathname
      else {
        const q = path.indexOf("?")
        if (q >= 0) path = path.slice(0, q)
        const h = path.indexOf("#")
        if (h >= 0) path = path.slice(0, h)
      }
    } catch {
      // ignore
    }
    path = path.slice(0, 500)
    if (shouldSkipPath(path)) return res.json({ skipped: true })

    const userId = await getCurrentUserId(req)
    const deviceHeader = req.headers["x-guest-device-id"]
    const guestDeviceId =
      typeof deviceHeader === "string" && deviceHeader.trim()
        ? deviceHeader.trim().slice(0, 100)
        : null
    const ua = (req.headers["user-agent"] as string | undefined)?.slice(0, 500) || null
    const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 500) : null

    await query(
      `INSERT INTO ai_portal.page_views (path, user_id, guest_device_id, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5)`,
      [path, userId, guestDeviceId, ua, referrer]
    )
    res.json({ success: true })
  } catch (err: any) {
    console.error("POST /api/track/pageview error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

export default router
