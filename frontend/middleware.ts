// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const allowedOrigins = [process.env.NEXTAUTH_URL || "http://localhost:3000", "http://localhost:3000"]
// Phải trùng với backend (auth.ts). Nếu backend lấy NEXTAUTH_SECRET từ Admin → Cài đặt (DB), cần set cùng giá trị vào env của frontend/container.
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "change-me-in-admin"

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
            const setupRes = await fetch(`${backend}/api/setup/status`, { cache: "no-store" })
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
    // pathname có thể là /admin (dev) hoặc /admission/admin (prod với basePath — nextUrl.pathname giữ full path)
    const routePath = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname
    const callbackPath = basePath && !pathname.startsWith(basePath) ? basePath + pathname : pathname
    const isAdminRoute = routePath === "/admin" || routePath.startsWith("/admin/")

    // Admin page: require login and is_admin — always ask backend (do not trust JWT so SSO/normal user cannot access)
    // Dùng URL tuyệt đối để tránh Next.js/proxy thêm basePath lần nữa → /admission/admission/login
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
        try {
            // Gọi thẳng backend khi có BACKEND_URL (Docker: http://backend:3001) để cookie luôn được chuyển đúng; tránh gọi qua URL công khai có thể mất cookie
            const backendUrl = (process.env.BACKEND_URL || "").replace(/\/$/, "")
            const useBackendDirect = backendUrl && (backendUrl.includes("backend") || backendUrl.includes("localhost") || backendUrl.startsWith("http://127"))
            const adminCheckUrl = useBackendDirect
                ? `${backendUrl}/api/auth/admin-check`
                : (() => {
                    const base = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "")
                    if (base && !base.includes("localhost") && !base.includes("127.0.0.1")) return `${base}/api/auth/admin-check`
                    return new URL("/api/auth/admin-check", req.url).toString()
                })()
            const checkRes = await fetch(adminCheckUrl, {
                headers: { cookie: req.headers.get("cookie") ?? "" },
                cache: "no-store",
            })
            const data = (await checkRes.json().catch(() => ({}))) as { is_admin?: boolean }
            if (data.is_admin !== true) {
                if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG_AUTH === "1") {
                    console.warn("[middleware] /admin redirect to login: backend says not admin")
                }
                const search = new URLSearchParams(req.nextUrl.searchParams)
                search.set("callbackUrl", callbackPath + req.nextUrl.search)
                search.set("error", "unauthorized")
                const redirectRes = NextResponse.redirect(buildLoginUrl(search))
                redirectRes.headers.set("X-Admin-Redirect-Reason", "not-admin")
                return redirectRes
            }
        } catch (err) {
            if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG_AUTH === "1") {
                console.warn("[middleware] /admin redirect to login: admin-check failed", err)
            }
            const search = new URLSearchParams(req.nextUrl.searchParams)
            search.set("callbackUrl", callbackPath + req.nextUrl.search)
            search.set("error", "unauthorized")
            const redirectRes = NextResponse.redirect(buildLoginUrl(search))
            redirectRes.headers.set("X-Admin-Redirect-Reason", "admin-check-error")
            return redirectRes
        }
    }

// Allow unauthenticated users on home and assistants; Login button in Header goes to /login
  // if (!token && (pathname === "/" || pathname.startsWith("/assistants"))) { ... redirect to login ... } — removed

    return res
}

export const config = {
    matcher: ["/", "/welcome", "/welcome/:path*", "/assistants/:path*", "/apps", "/apps/:path*", "/admin", "/admin/:path*", "/embed/:path*", "/login", "/setup", "/setup/:path*", "/api/:path*"],
}
