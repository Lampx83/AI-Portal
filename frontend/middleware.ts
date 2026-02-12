// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const allowedOrigins = ["https://research.neu.edu.vn", "http://localhost:3000"]

// Cache embed-config theo alias để tránh gọi backend mỗi request (TTL 60s)
const EMBED_CONFIG_CACHE_TTL_MS = 60_000
const embedConfigCache = new Map<string, { csp: string; expiry: number }>()

function getCachedEmbedConfig(alias: string): string | null {
  const entry = embedConfigCache.get(alias)
  if (!entry || Date.now() > entry.expiry) return null
  return entry.csp
}

function setCachedEmbedConfig(alias: string, csp: string) {
  embedConfigCache.set(alias, { csp, expiry: Date.now() + EMBED_CONFIG_CACHE_TTL_MS })
}

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

    // Trang embed: set CSP frame-ancestors theo cấu hình domain cho phép nhúng của agent (có cache TTL 60s)
    if (pathname.startsWith("/embed")) {
        const embedMatch = pathname.match(/^\/embed\/([^/]+)/)
        const alias = embedMatch?.[1]
        if (alias) {
            let csp = getCachedEmbedConfig(alias)
            if (!csp) {
                try {
                    const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"
                    const configUrl = `${apiBase.replace(/\/+$/, "")}/api/research-assistants/embed-config/${encodeURIComponent(alias)}`
                    const configRes = await fetch(configUrl, { cache: "no-store" })
                    if (configRes.ok) {
                        const config = (await configRes.json()) as { embed_allow_all?: boolean; embed_allowed_domains?: string[] }
                        if (config.embed_allow_all === true) {
                            csp = "frame-ancestors *"
                        } else if (Array.isArray(config.embed_allowed_domains) && config.embed_allowed_domains.length > 0) {
                            const domains = config.embed_allowed_domains.filter((d) => typeof d === "string" && d.trim().length > 0)
                            csp = domains.length > 0 ? `frame-ancestors 'self' ${domains.map((d) => d.trim()).join(" ")}` : "frame-ancestors *"
                        } else {
                            csp = "frame-ancestors *"
                        }
                    } else {
                        csp = "frame-ancestors *"
                    }
                    setCachedEmbedConfig(alias, csp)
                } catch {
                    csp = "frame-ancestors *"
                }
            }
            res.headers.set("Content-Security-Policy", csp)
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

    // Cho phép người chưa đăng nhập dùng trang chủ và assistants; nút Đăng nhập trên Header dẫn tới /login
    // if (!token && (pathname === "/" || pathname.startsWith("/assistants"))) { ... redirect to login ... } — đã bỏ

    return res
}

export const config = {
    matcher: ["/", "/assistants/:path*", "/admin", "/admin/:path*", "/embed/:path*", "/login", "/api/:path*"],
}
