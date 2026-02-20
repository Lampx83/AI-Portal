/**
 * Quản lý ứng dụng bundled được mount (không spawn process).
 * Mount routes tại /api/apps/:alias và serve static tại /embed/:alias.
 */
import fs from "fs"
import path from "path"
import express, { Request, Response } from "express"
import { query, getDatabaseName } from "./db"
import { getBootstrapEnv } from "./settings"
import { getToken } from "next-auth/jwt"
import { parseCookies } from "./parse-cookies"
import { getSetting } from "./settings"

const BACKEND_ROOT = path.join(__dirname, "..", "..")
const APPS_DIR = path.join(BACKEND_ROOT, "data", "apps")

const routerCache = new Map<string, express.Router>()
const mountCache = new Set<string>()
const deletedBundledApps = new Set<string>()

/** Lấy user Portal từ JWT session */
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
      const { query: q } = await import("./db")
      const r = await q<{ display_name?: string; full_name?: string }>(
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

function buildPortalDatabaseUrl(): string {
  const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
  const port = getBootstrapEnv("POSTGRES_PORT", "5432")
  const user = getBootstrapEnv("POSTGRES_USER", "postgres")
  const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || ""
  const db = getDatabaseName()
  const ssl = getBootstrapEnv("POSTGRES_SSL", "").toLowerCase() === "true"
  const enc = encodeURIComponent
  return `postgresql://${enc(user)}:${enc(password)}@${host}:${port}/${enc(db)}${ssl ? "?sslmode=require" : ""}`
}

/** Load router từ app đã extract (Write: dist/embed.js) */
function loadAppRouter(alias: string): express.Router | null {
  const cached = routerCache.get(alias)
  if (cached) return cached
  const appDir = path.join(APPS_DIR, alias)
  const embedPath = path.join(appDir, "dist", "embed.js")
  if (!fs.existsSync(embedPath)) return null
  try {
    const dbUrl = buildPortalDatabaseUrl()
    process.env.PORTAL_DATABASE_URL = dbUrl
    // Do not set process.env.DATABASE_URL so Portal's own DB config is not overwritten
    process.env.DB_SCHEMA = "ai_portal"
    process.env.AUTH_MODE = "portal"
    process.env.RUN_MODE = "embedded"
    const mod = require(embedPath)
    const createRouter = mod.createEmbedRouter || mod.default
    if (typeof createRouter !== "function") return null
    const router = createRouter()
    routerCache.set(alias, router)
    return router
  } catch (e: any) {
    console.warn("[mounted-apps] Failed to load", alias, e?.message)
    return null
  }
}

const GUEST_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getGuestFromRequest(req: Request): { id: string; email: string; name: string } | null {
  const guestId = (req.headers["x-guest-id"] as string)?.trim()
  if (guestId && GUEST_UUID_RE.test(guestId)) {
    return { id: guestId, email: "guest@local", name: "Khách" }
  }
  return null
}

/** Tạo UUID guest một lần cho request (khi iframe không gửi cookie/X-Guest-Id). */
function randomGuestId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Middleware: thêm X-User-* và xử lý GET /api/auth/me */
function createMountedMiddleware(alias: string) {
  return async (req: Request, res: Response, next: express.NextFunction) => {
    if (deletedBundledApps.has(alias)) {
      return res.status(404).json({ error: "Ứng dụng đã bị gỡ" })
    }
    let user = await getPortalUser(req)
    if (!user) {
      const guest = getGuestFromRequest(req)
      if (guest) user = guest
    }
    if (!user) {
      user = { id: randomGuestId(), email: "guest@local", name: "Khách" }
    }
    if (user) {
      ;(req as express.Request & { portalUser?: { id: string; email?: string; name?: string } }).portalUser = user
      req.headers["x-user-id"] = user.id
      req.headers["x-user-email"] = user.email ?? ""
      req.headers["x-user-name"] = user.name ?? ""
    }
    const relPath = req.path || "/"
    if (relPath === "/api/auth/me" && req.method === "GET") {
      if (!user) return res.status(401).json({ error: "Chưa đăng nhập" })
      return res.json({
        user: { id: user.id, email: user.email ?? "", name: user.name ?? "" },
      })
    }
    next()
  }
}

/**
 * Mount app tại /api/apps/:alias (chỉ cache router + alias; request do mountedAppsDispatcher xử lý).
 * Gọi từ server khi cài đặt hoặc khởi động. Không dùng app.use() để tránh route đăng ký sau /api/apps
 * khiến request bị proxy thay vì vào app đã mount.
 */
export function mountBundledApp(_app: express.Express, alias: string): boolean {
  if (mountCache.has(alias)) return true
  const router = loadAppRouter(alias)
  if (!router) return false
  mountCache.add(alias)
  console.log("[mounted-apps] Mounted", alias, "at /api/apps/" + alias)
  return true
}

/**
 * Middleware dispatcher: với mỗi request /api/apps/:alias/*, nếu alias đã mount thì chạy app đó, không thì next() sang proxy.
 * Cần đăng ký trước appsProxyRouter để app vừa cài (runtime) cũng nhận request ngay.
 */
export function mountedAppsDispatcher(): express.RequestHandler {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const pathSegments = (req.path || req.url || "").split("/").filter(Boolean)
    const alias = pathSegments[0]?.trim().toLowerCase()
    if (!alias || !mountCache.has(alias)) return next()
    if (deletedBundledApps.has(alias)) return next()
    const router = loadAppRouter(alias)
    if (!router) return next()
    const restPath = "/" + pathSegments.slice(1).join("/") || "/"
    const originalUrl = req.url
    req.url = restPath
    const mw = createMountedMiddleware(alias)
    mw(req, res, (err: unknown) => {
      if (err) {
        req.url = originalUrl
        return next(err as Error)
      }
      router(req, res, (err2: unknown) => {
        req.url = originalUrl
        if (err2) return next(err2 as Error)
        if (!res.headersSent) next()
      })
    })
  }
}

/**
 * Gỡ bundled app (đánh dấu đã xoá, dừng phục vụ API ngay).
 * Gọi khi admin xoá ứng dụng.
 */
export function unmountBundledApp(alias: string): void {
  deletedBundledApps.add(alias)
  routerCache.delete(alias)
  mountCache.delete(alias)
  console.log("[mounted-apps] Unmounted", alias)
}

/**
 * Mount tất cả apps có bundledPath khi khởi động.
 */
export async function mountAllBundledApps(app: express.Express): Promise<void> {
  try {
    const result = await query<{ alias: string }>(
      `SELECT alias FROM ai_portal.tools
       WHERE is_active = true AND config_json->>'bundledPath' IS NOT NULL`
    )
    for (const row of result.rows) {
      mountBundledApp(app, row.alias)
    }
  } catch (e: any) {
    console.warn("[mounted-apps] mountAllBundledApps failed:", e?.message)
  }
}

/**
 * Router để serve static files tại /embed/:alias.
 * Inject window.__WRITE_API_BASE__ (write) hoặc __DATA_API_BASE__ (data) vào index.html.
 */
export function createEmbedStaticRouter(): express.Router {
  const router = express.Router()
  function serveIndexHtml(alias: string, html: string, apiBase: string, baseHref: string, theme?: string): string {
    const baseTag = `<base href="${baseHref}">`
    const scriptTag = `<script>window.__WRITE_API_BASE__='${apiBase}';</script>`
    let themeVal: "dark" | "light" | null = theme === "dark" || theme === "light" ? theme : null
    // Writium và Datium luôn dùng light theme khi nhúng trong Portal
    if (alias === "writium" || alias === "datium") themeVal = "light"
    const themeScript =
      themeVal === null
        ? ""
        : `<script>window.__PORTAL_THEME__='${themeVal}';document.documentElement.classList.remove('light','dark');document.documentElement.classList.add('${themeVal}');</script>`
    const inject = `<head>${baseTag}${scriptTag}${themeScript}`
    if (!html.includes("__WRITE_API_BASE__")) {
      return html.replace("<head>", inject)
    }
    return html.replace("<head>", inject)
  }

  router.get("/:alias", (req: Request, res: Response, next: express.NextFunction) => {
    const alias = String(req.params.alias ?? "").trim().toLowerCase()
    if (!alias) return res.status(400).json({ error: "Missing alias" })
    const indexPath = path.join(APPS_DIR, alias, "public", "index.html")
    if (!fs.existsSync(indexPath)) return next()
    let html = fs.readFileSync(indexPath, "utf-8")
    const apiBase = `/api/apps/${alias}`
    const baseHref = `/embed/${alias}/`
    const theme = typeof req.query.theme === "string" ? req.query.theme.trim().toLowerCase() : undefined
    html = serveIndexHtml(alias, html, apiBase, baseHref, theme === "dark" || theme === "light" ? theme : undefined)
    res.type("html").send(html)
  })
  router.get("/:alias/", (req: Request, res: Response, next: express.NextFunction) => {
    const alias = String(req.params.alias ?? "").trim().toLowerCase()
    if (!alias) return res.status(400).json({ error: "Missing alias" })
    const indexPath = path.join(APPS_DIR, alias, "public", "index.html")
    if (!fs.existsSync(indexPath)) return next()
    let html = fs.readFileSync(indexPath, "utf-8")
    const apiBase = `/api/apps/${alias}`
    const baseHref = `/embed/${alias}/`
    const theme = typeof req.query.theme === "string" ? req.query.theme.trim().toLowerCase() : undefined
    html = serveIndexHtml(alias, html, apiBase, baseHref, theme === "dark" || theme === "light" ? theme : undefined)
    res.type("html").send(html)
  })
  // Nhiều segment (vd. _next/static/...) — phải đăng ký trước /:alias/:file
  router.get(/^\/([^/]+)\/(.+)$/, (req: Request, res: Response, next: express.NextFunction) => {
    const alias = String((req.params as any)[0] ?? "").trim().toLowerCase()
    let rest = String((req.params as any)[1] ?? "").trim()
    if (!alias || !rest) return next()
    let filePath = path.join(APPS_DIR, alias, "public", rest)
    // Một số build có thể request "next/static/..." thay vì "_next/static/..." — thử _next
    if (!fs.existsSync(filePath) && rest.startsWith("next/")) {
      rest = "_next/" + rest.slice(5)
      filePath = path.join(APPS_DIR, alias, "public", rest)
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next()
    res.sendFile(path.resolve(filePath))
  })
  // Một segment (vd. favicon.ico)
  router.get("/:alias/:file", (req: Request, res: Response, next: express.NextFunction) => {
    const alias = String(req.params.alias ?? "").trim().toLowerCase()
    const file = String(req.params.file ?? "").trim()
    if (!alias || !file) return next()
    const filePath = path.join(APPS_DIR, alias, "public", file)
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next()
    res.sendFile(path.resolve(filePath))
  })
  return router
}

