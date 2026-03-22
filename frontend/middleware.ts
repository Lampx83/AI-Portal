// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
const appOrigin = (process.env.APP_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")
const devOrigins = process.env.NODE_ENV === "development"
  ? ["http://localhost:3000", "http://127.0.0.1:3000"]
  : []
const allowedOrigins = [appOrigin, ...devOrigins].filter(Boolean)
/** Origin của request luôn được coi là allowed (vào bằng URL nào thì CORS chấp nhận origin đó). */
function isAllowedOrigin(origin: string, req: NextRequest): boolean {
  if (allowedOrigins.includes(origin)) return true
  const requestOrigin = req.nextUrl.origin
  if (requestOrigin && origin === requestOrigin) return true
  return false
}
// Phải trùng với backend (auth.ts). Nếu backend lấy NEXTAUTH_SECRET từ Admin → Cài đặt (DB), cần set cùng giá trị vào env của frontend/container.
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "change-me-in-admin"

/** Cache setup status để tránh mỗi request đều gọi backend → treo lâu khi basePath/production. */
const SETUP_CACHE_TTL_MS = 30_000
const SETUP_CACHE_STALE_MS = 60_000
let setupCache: { needsSetup: boolean; guest_login_enabled?: boolean; timestamp: number } | null = null

/** Fetch với timeout để tránh treo khi backend chậm/không phản hồi (gây ResponseAborted, loading vô hạn). */
const FETCH_TIMEOUT_MS = 2500
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

function isConnectionRefused(e: unknown): boolean {
  if (!e) return false
  const err = e as { code?: string; cause?: { code?: string }; message?: string; errors?: Array<{ code?: string }> }
  if (err.code === "ECONNREFUSED") return true
  if (err.cause && typeof err.cause === "object" && (err.cause as { code?: string }).code === "ECONNREFUSED") return true
  if (Array.isArray(err.errors) && err.errors.some((x) => x?.code === "ECONNREFUSED")) return true
  const msg = String(err.message ?? "")
  if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) return true
  return false
}

export async function middleware(req: NextRequest) {
    const token = await getToken({
        req,
        secret: JWT_SECRET,
    })
    const { pathname } = req.nextUrl
    const routePath = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname

// ───────────── Setup: not installed (no DB, empty DB, fresh app) → go to /setup instead of /welcome ─────────────
  // Chỉ kiểm tra setup khi vào đúng root của app: không basePath thì / hoặc ""; có basePath thì /basePath hoặc /basePath/ (tránh path "/" gọi backend → treo khi curl).
    const isPageNavigation = !pathname.startsWith("/api/")
    const basePathForSetup = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
    const isErrorPage = basePathForSetup ? pathname === `${basePathForSetup}/error` : pathname === "/error"
    const isRootRoute = basePathForSetup
      ? (pathname === basePathForSetup || pathname === basePathForSetup + "/")
      : (pathname === "" || pathname === "/")
    if (isPageNavigation && !pathname.startsWith("/setup") && !isErrorPage && isRootRoute) {
        const now = Date.now()
        const cached = setupCache && (now - setupCache.timestamp) < SETUP_CACHE_TTL_MS ? setupCache : null
        if (cached) {
            if (cached.needsSetup) {
                const setupPath = basePathForSetup ? `${basePathForSetup}/setup` : "/setup"
                return NextResponse.redirect(new URL(setupPath, req.nextUrl.origin))
            }
        } else {
        try {
            const backend =
              process.env.BACKEND_URL ||
              (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "")
            const setupRes = await fetchWithTimeout(`${backend}/api/setup/status`, { cache: "no-store" })
            const status = setupRes.status
            if (status === 502 || status === 504) {
              const errorPath = basePathForSetup ? `${basePathForSetup}/error` : "/error"
              return NextResponse.redirect(new URL(errorPath, req.nextUrl.origin))
            }
            if (status === 503) {
              const errorPath = basePathForSetup ? `${basePathForSetup}/error` : "/error"
              const url = new URL(errorPath, req.nextUrl.origin)
              url.searchParams.set("reason", "database")
              return NextResponse.redirect(url)
            }
            const data = (await setupRes.json().catch(() => ({}))) as { needsSetup?: boolean; guest_login_enabled?: boolean }
            const needsSetup = data.needsSetup === true
            const guest_login_enabled = data.needsSetup === false ? (data.guest_login_enabled !== false) : true
            setupCache = { needsSetup, guest_login_enabled, timestamp: now }
            if (needsSetup) {
                const setupPath = basePathForSetup ? `${basePathForSetup}/setup` : "/setup"
                return NextResponse.redirect(new URL(setupPath, req.nextUrl.origin))
            }
        } catch (err) {
            const errorPath = basePathForSetup ? `${basePathForSetup}/error` : "/error"
            if (isConnectionRefused(err)) {
              return NextResponse.redirect(new URL(errorPath, req.nextUrl.origin))
            }
            const stale = setupCache && (now - setupCache.timestamp) < SETUP_CACHE_STALE_MS ? setupCache : null
            if (stale?.needsSetup) {
                const setupPath = basePathForSetup ? `${basePathForSetup}/setup` : "/setup"
                return NextResponse.redirect(new URL(setupPath, req.nextUrl.origin))
            }
            return NextResponse.redirect(new URL(errorPath, req.nextUrl.origin))
        }
        }
    }

    // ───────────── CORS Headers ─────────────
    const origin = req.headers.get("origin") ?? ""
    const isAllowedOriginResult = isAllowedOrigin(origin, req)
    const res = NextResponse.next()

    if (isAllowedOriginResult) {
        const allowOrigin = origin || req.nextUrl.origin
        if (allowOrigin) res.headers.set("Access-Control-Allow-Origin", allowOrigin)
    }
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

    // Return immediately if request is preflight
    if (req.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: res.headers })
    }

    // Allow embedding iframe: home and embed page (avoid "frame-ancestors 'none'" when embedded from other site)
    if (pathname === "/") {
        res.headers.set("Content-Security-Policy", "frame-ancestors *")
    }

    // Embed page: set CSP immediately, do not call backend (avoid blocking request → embed loads fast)
    if (routePath.startsWith("/embed") || routePath.startsWith("/assistant-embed")) {
        res.headers.set("Content-Security-Policy", "frame-ancestors *")
        return res
    }

    // ───────────── Auth Guard ─────────────
    // pathname có thể là /admin (dev) hoặc /basePath/admin (prod với basePath — nextUrl.pathname giữ full path)
    const callbackPath = basePath && !pathname.startsWith(basePath) ? basePath + pathname : pathname
    const isAdminRoute = routePath === "/admin" || routePath.startsWith("/admin/")

    // Admin page: require login and is_admin — always ask backend (do not trust JWT so SSO/normal user cannot access)
    // Dùng URL tuyệt đối để tránh Next.js/proxy thêm basePath lần nữa (vd. /basePath/basePath/login)
    const loginPath = basePath ? `${basePath}/login` : "/login"
    const buildLoginUrl = (search: URLSearchParams) => {
        const q = search.toString()
        const path = q ? `${loginPath}?${q}` : loginPath
        return new URL(path, req.nextUrl.origin)
    }
    if (isAdminRoute) {
        if (!token) {
            const cookieHeader = req.headers.get("cookie") ?? ""
            const hasCookie = cookieHeader.length > 0
            const hasNextAuthCookie = /next-auth\.session-token|__Secure-next-auth\.session-token/i.test(cookieHeader)
            if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG_AUTH === "1") {
                console.warn("[middleware] /admin redirect to login: no token", {
                    hasCookie,
                    hasNextAuthCookie,
                    cookieCount: cookieHeader ? cookieHeader.split(";").length : 0,
                })
            }
            const search = new URLSearchParams(req.nextUrl.searchParams)
            search.set("callbackUrl", callbackPath + req.nextUrl.search)
            const redirectRes = NextResponse.redirect(buildLoginUrl(search))
            redirectRes.headers.set("X-Admin-Redirect-Reason", "no-token")
            redirectRes.headers.set("X-Admin-Redirect-Debug", hasCookie ? "has-cookie" : "no-cookie")
            return redirectRes
        }
        // Đã có token: để layout client gọi admin-check (tránh mỗi request/tab chuyển đều gọi backend → chậm, tab spinner)
        return res
    }

    // When guest_login_enabled is false: unauthenticated users must be redirected to login for protected routes
    if (!token) {
        const isProtectedRoute =
            routePath === "/" ||
            routePath === "/welcome" ||
            routePath.startsWith("/welcome/") ||
            routePath === "/assistants" ||
            routePath.startsWith("/assistants/") ||
            routePath === "/tools" ||
            routePath.startsWith("/tools") ||
            routePath === "/store" ||
            routePath.startsWith("/store/")
        if (isProtectedRoute) {
            let guestAllowed = true
            const now = Date.now()
            if (setupCache && (now - setupCache.timestamp) < SETUP_CACHE_STALE_MS && setupCache.guest_login_enabled !== undefined) {
                guestAllowed = setupCache.guest_login_enabled
            } else {
                try {
                    const backend =
                        process.env.BACKEND_URL ||
                        (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "")
                    const setupRes = await fetchWithTimeout(`${backend}/api/setup/status`, { cache: "no-store" })
                    const data = (await setupRes.json().catch(() => ({}))) as { needsSetup?: boolean; guest_login_enabled?: boolean }
                    guestAllowed = data.needsSetup === true || data.guest_login_enabled !== false
                    if (data.needsSetup === false) {
                        setupCache = {
                            needsSetup: false,
                            guest_login_enabled: data.guest_login_enabled !== false,
                            timestamp: now,
                        }
                    }
                } catch {
                    guestAllowed = true
                }
            }
            if (!guestAllowed) {
                const search = new URLSearchParams(req.nextUrl.searchParams)
                search.set("callbackUrl", callbackPath + req.nextUrl.search)
                return NextResponse.redirect(buildLoginUrl(search))
            }
        }
    }

    return res
}

export const config = {
    matcher: ["/", "/welcome", "/welcome/:path*", "/assistants/:path*", "/tools", "/tools/:path*", "/store", "/store/:path*", "/admin", "/admin/:path*", "/embed/:path*", "/assistant-embed/:path*", "/login", "/setup", "/setup/:path*", "/error", "/api/:path*"],
}
