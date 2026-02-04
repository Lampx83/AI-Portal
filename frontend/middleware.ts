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

    // Cho phép nhúng iframe: trang chủ và trang embed (tránh lỗi "frame-ancestors 'none'" khi embed từ website khác)
    if (pathname === "/") {
        res.headers.set("Content-Security-Policy", "frame-ancestors *")
    }

    // Trang embed: set CSP frame-ancestors theo cấu hình domain cho phép nhúng của agent
    if (pathname.startsWith("/embed")) {
        const embedMatch = pathname.match(/^\/embed\/([^/]+)/)
        const alias = embedMatch?.[1]
        if (alias) {
            try {
                const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"
                const configUrl = `${apiBase.replace(/\/+$/, "")}/api/research-assistants/embed-config/${encodeURIComponent(alias)}`
                const configRes = await fetch(configUrl, { cache: "no-store" })
                if (configRes.ok) {
                    const config = (await configRes.json()) as { embed_allow_all?: boolean; embed_allowed_domains?: string[] }
                    if (config.embed_allow_all === true) {
                        res.headers.set("Content-Security-Policy", "frame-ancestors *")
                    } else if (Array.isArray(config.embed_allowed_domains) && config.embed_allowed_domains.length > 0) {
                        const domains = config.embed_allowed_domains.filter((d) => typeof d === "string" && d.trim().length > 0)
                        if (domains.length > 0) {
                            const list = ["'self'", ...domains.map((d) => d.trim())].join(" ")
                            res.headers.set("Content-Security-Policy", `frame-ancestors ${list}`)
                        } else {
                            // Chưa cấu hình domain → mặc định cho phép nhúng mọi nơi (để mã embed hoạt động)
                            res.headers.set("Content-Security-Policy", "frame-ancestors *")
                        }
                    } else {
                        // Chưa cấu hình embed → mặc định cho phép nhúng mọi nơi
                        res.headers.set("Content-Security-Policy", "frame-ancestors *")
                    }
                } else {
                    // API lỗi/404 → vẫn cho phép nhúng để embed không bị chặn
                    res.headers.set("Content-Security-Policy", "frame-ancestors *")
                }
            } catch {
                res.headers.set("Content-Security-Policy", "frame-ancestors *")
            }
        } else {
            res.headers.set("Content-Security-Policy", "frame-ancestors *")
        }
        return res
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
    matcher: ["/", "/assistants/:path*", "/admin", "/admin/:path*", "/embed/:path*", "/login", "/api/:path*"],
}
