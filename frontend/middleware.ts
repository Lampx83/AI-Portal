// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const allowedOrigins = [process.env.NEXTAUTH_URL || "http://localhost:3000", "http://localhost:3000"]
// Same default as backend (auth.ts) so JWT verifies when running npm run dev without env set
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
                const url = req.nextUrl.clone()
                url.pathname = "/setup"
                return NextResponse.redirect(url)
            }
        } catch {
            // Backend unreachable (not running, network error): still go to /setup so user sees setup instructions
            const url = req.nextUrl.clone()
            url.pathname = "/setup"
            return NextResponse.redirect(url)
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
    const isAdminRoute = pathname.startsWith("/admin")

    // Admin page: require login and is_admin — always ask backend (do not trust JWT so SSO/normal user cannot access)
    if (isAdminRoute) {
        if (!token) {
            const url = req.nextUrl.clone()
            url.pathname = "/login"
            url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
            return NextResponse.redirect(url)
        }
        try {
            const adminCheckUrl = new URL("/api/auth/admin-check", req.url)
            const checkRes = await fetch(adminCheckUrl.toString(), {
                headers: { cookie: req.headers.get("cookie") ?? "" },
                cache: "no-store",
            })
            const data = (await checkRes.json().catch(() => ({}))) as { is_admin?: boolean }
            if (data.is_admin !== true) {
                const url = req.nextUrl.clone()
                url.pathname = "/"
                url.searchParams.set("error", "unauthorized")
                return NextResponse.redirect(url)
            }
        } catch {
            const url = req.nextUrl.clone()
            url.pathname = "/"
            url.searchParams.set("error", "unauthorized")
            return NextResponse.redirect(url)
        }
    }

// Allow unauthenticated users on home and assistants; Login button in Header goes to /login
  // if (!token && (pathname === "/" || pathname.startsWith("/assistants"))) { ... redirect to login ... } — removed

    return res
}

export const config = {
    matcher: ["/", "/welcome", "/welcome/:path*", "/assistants/:path*", "/apps", "/apps/:path*", "/admin", "/admin/:path*", "/embed/:path*", "/login", "/setup", "/setup/:path*", "/api/:path*"],
}
