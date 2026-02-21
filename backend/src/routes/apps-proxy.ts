/**
 * Proxy /api/apps/:alias/* → ứng dụng bên ngoài (vd. Write app) với header X-User-* từ session Portal.
 * Ứng dụng mounted (bundledPath) được gắn trước bởi mounted-apps, không qua proxy.
 */
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { parseCookies } from "../lib/parse-cookies"
import { getSetting } from "../lib/settings"
import { query } from "../lib/db"
import { getToolConfigs } from "../lib/tools"

const router = Router()

function getAppOrigin(baseUrl: string, domainUrl?: string | null): string {
  const d = (domainUrl ?? "").trim()
  if (d) return d.replace(/\/+$/, "")
  return baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "")
}

/** Lấy user Portal (id, email, name) từ JWT để gửi sang app. */
async function getPortalUser(req: Request): Promise<{ id: string; email?: string; name?: string } | null> {
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  const id = (token as { id?: string })?.id
  if (!id) return null
  const email = (token as { email?: string })?.email as string | undefined
  let name: string | undefined = (token as { name?: string })?.name as string | undefined
  if (!name && id) {
    try {
      const r = await query<{ display_name?: string; full_name?: string }>(
        "SELECT COALESCE(full_name, display_name) AS display_name, full_name FROM ai_portal.users WHERE id = $1::uuid LIMIT 1",
        [id]
      )
      name = r.rows[0]?.full_name ?? r.rows[0]?.display_name ?? undefined
    } catch {
      name = email?.split("@")[0]
    }
  }
  return { id, email, name: name ?? email?.split("@")[0] }
}

const GUEST_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Lấy guest user từ header X-Guest-Id (khi chưa đăng nhập Portal). */
function getGuestUserFromRequest(req: Request): { id: string; email: string; name: string } | null {
  const guestId = (req.headers["x-guest-id"] as string)?.trim()
  if (guestId && GUEST_UUID_RE.test(guestId)) {
    return { id: guestId, email: "guest@local", name: "Khách" }
  }
  return null
}

function randomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// /api/apps/:alias/*  - proxy ra app bên ngoài (mounted apps đã được gắn trước)
router.all("/:alias/*", async (req: Request, res: Response) => {
  const alias = typeof req.params.alias === "string" ? req.params.alias : (req.params.alias as string[])?.[0] ?? ""
  const pathRest = (req.params as { 0?: string })[0] ?? ""
  if (!alias) return res.status(400).json({ error: "Missing app alias" })

  const configs = await getToolConfigs()
  const config = configs.find((c) => c.alias === alias)
  if (!config) return res.status(404).json({ error: "App not found", message: `No app with alias: ${alias}` })

  const { getEffectiveToolBaseUrl } = await import("../lib/tools")
  const rawBase: string = getEffectiveToolBaseUrl(config.alias, config.configJson)
  // Dùng base_url cho API proxy; domain_url chỉ dùng cho embed (iframe), không dùng cho fetch API
  const appOrigin = getAppOrigin(rawBase, null)
  if (!appOrigin) return res.status(400).json({ error: "App not configured", message: "base_url or domain_url required" })

  let user = await getPortalUser(req)
  if (!user) {
    const guest = getGuestUserFromRequest(req)
    if (guest) user = guest
    else user = { id: randomUUID(), email: "guest@local", name: "Khách" }
  }

  const targetPath = (pathRest.startsWith("api/") || pathRest.startsWith("v1")) ? `/${pathRest}` : `/api/${pathRest}`
  const targetUrl = `${appOrigin}${targetPath}`
  const headers: Record<string, string> = {
    "Content-Type": req.headers["content-type"] ?? "application/json",
    "X-User-Id": user.id,
    "X-User-Email": user.email ?? "",
    "X-User-Name": user.name ?? "",
  }
  if (req.headers.accept) headers["Accept"] = req.headers.accept as string

  try {
    let body: string | undefined
    if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body)
    }
    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    })
    const contentType = fetchRes.headers.get("content-type") ?? ""
    const isJson = contentType.includes("application/json")
    const blob = await fetchRes.arrayBuffer()
    if (fetchRes.headers.get("content-disposition")) {
      res.setHeader("Content-Disposition", fetchRes.headers.get("content-disposition")!)
    }
    if (contentType) res.setHeader("Content-Type", contentType)
    res.status(fetchRes.status)
    if (isJson) {
      try {
        const data = JSON.parse(Buffer.from(blob).toString("utf-8"))
        return res.json(data)
      } catch {
        return res.send(Buffer.from(blob))
      }
    }
    return res.send(Buffer.from(blob))
  } catch (err: unknown) {
    console.error("[apps-proxy] fetch error:", (err as Error)?.message, targetUrl)
    return res.status(502).json({ error: "App request failed", message: (err as Error)?.message })
  }
})

export default router
