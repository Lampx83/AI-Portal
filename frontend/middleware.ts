// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const allowedOrigins = ["https://research.neu.edu.vn", "http://localhost:3000"]

export async function middleware(req: NextRequest) {
    const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
    })
    const { pathname } = req.nextUrl

    // ───────────── CORS Headers ─────────────
    const origin = req.headers.get("origin") ?? ""
    const isAllowedOrigin = allowedOrigins.includes(origin)
    const res = NextResponse.next()

    if (isAllowedOrigin) {
        res.headers.set("Access-Control-Allow-Origin", origin)
    }
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

    // Trả về luôn nếu request là preflight
    if (req.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: res.headers })
    }

    // ───────────── Auth Guard ─────────────
    const isAdminRoute = pathname.startsWith("/admin")

    // Trang Admin: bắt buộc đăng nhập và có quyền is_admin
    if (isAdminRoute) {
        if (!token) {
            const url = req.nextUrl.clone()
            url.pathname = "/login"
            url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
            return NextResponse.redirect(url)
        }
        const isAdmin = (token as { is_admin?: boolean }).is_admin === true
        if (!isAdmin) {
            const url = req.nextUrl.clone()
            url.pathname = "/"
            url.searchParams.set("error", "unauthorized")
            return NextResponse.redirect(url)
        }
    }

    if (!token && (pathname === "/" || pathname.startsWith("/assistants"))) {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        url.searchParams.set(
            "callbackUrl",
            req.nextUrl.pathname + req.nextUrl.search,
        )
        return NextResponse.redirect(url)
    }

    return res
}

export const config = {
    matcher: ["/", "/assistants/:path*", "/admin", "/admin/:path*", "/login", "/api/:path*"],
}
