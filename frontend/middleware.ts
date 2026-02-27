// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const allowedOrigins = [process.env.NEXTAUTH_URL || "http://localhost:3000", "http://localhost:3000"]
// Phải trùng với backend (auth.ts). Nếu backend lấy NEXTAUTH_SECRET từ Admin → Cài đặt (DB), cần set cùng giá trị vào env của frontend/container.
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "change-me-in-admin"

/** Fetch với timeout để tránh treo khi backend chậm/không phản hồi (gây ResponseAborted, loading vô hạn). */
const FETCH_TIMEOUT_MS = 8000
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

export async function middleware(req: NextRequest) {
    const token = await getToken({
        req,
        secret: JWT_SECRET,
    })
    const { pathname } = req.nextUrl

// ───────────── Setup: not installed (no DB, empty DB, fresh app) → go to /setup instead of /welcome ─────────────
  // Only redirect document navigation, not API requests (next-auth needs /api/auth/* to return JSON, not HTML)
    const isPageNavigation = !pathname.startsWith("/api/")
    if (isPageNavigation && !pathname.startsWith("/setup")) {
        try {
            const backend = process.env.BACKEND_URL || "http://localhost:3001"
            const setupRes = await fetchWithTimeout(`${backend}/api/setup/status`, { cache: "no-store" })
            const data = (await setupRes.json().catch(() => ({}))) as { needsSetup?: boolean }
            // Redirect when setup needed (even when backend returns 500 due to no DB)
            if (data.needsSetup === true) {
                const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
                const setupPath = base ? `${base}/setup` : "/setup"
                return NextResponse.redirect(new URL(setupPath, req.nextUrl.origin))
            }
        } catch {
            // Backend unreachable (not running, network error): still go to /setup so user sees setup instructions
            const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
            const setupPath = base ? `${base}/setup` : "/setup"
            return NextResponse.redirect(new URL(setupPath, req.nextUrl.origin))
        }
    }

    // ───────────── CORS Headers ─────────────
    const origin = req.headers.get("origin") ?? ""
    const isAllowedOrigin = allowedOrigins.includes(origin)
    const res = NextResponse.next()

    if (isAllowedOrigin) {
        res.headers.set("Access-Control-Allow-Origin", origin)
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
    if (pathname.startsWith("/embed")) {
        res.headers.set("Content-Security-Policy", "frame-ancestors *")
        return res
    }

    // ───────────── Auth Guard ─────────────
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
    // pathname có thể là /admin (dev) hoặc /tuyen-sinh/admin (prod với basePath — nextUrl.pathname giữ full path)
    const routePath = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname
    const callbackPath = basePath && !pathname.startsWith(basePath) ? basePath + pathname : pathname
    const isAdminRoute = routePath === "/admin" || routePath.startsWith("/admin/")

    // Admin page: require login and is_admin — always ask backend (do not trust JWT so SSO/normal user cannot access)
    // Dùng URL tuyệt đối để tránh Next.js/proxy thêm basePath lần nữa → /tuyen-sinh/tuyen-sinh/login
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

// Allow unauthenticated users on home and assistants; Login button in Header goes to /login
  // if (!token && (pathname === "/" || pathname.startsWith("/assistants"))) { ... redirect to login ... } — removed

    return res
}

export const config = {
    matcher: ["/", "/welcome", "/welcome/:path*", "/assistants/:path*", "/tools", "/tools/:path*", "/admin", "/admin/:path*", "/embed/:path*", "/login", "/setup", "/setup/:path*", "/api/:path*"],
}
