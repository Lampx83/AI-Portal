// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const allowedOrigins = [process.env.NEXTAUTH_URL || "http://localhost:3000", "http://localhost:3000"]
// Cùng giá trị mặc định với backend (auth.ts) để JWT verify đúng khi chạy npm run dev không set env
const JWT_SECRET = process.env.NEXTAUTH_SECRET || "change-me-in-admin"

export async function middleware(req: NextRequest) {
    const token = await getToken({
        req,
        secret: JWT_SECRET,
    })
    const { pathname } = req.nextUrl

    // ───────────── Setup: chưa cài đặt (không DB, DB trống, mới tải app) thì chuyển sang /setup thay vì /welcome ─────────────
    // Chỉ redirect điều hướng trang (document), không redirect request API (next-auth cần /api/auth/* trả JSON, không phải HTML)
    const isPageNavigation = !pathname.startsWith("/api/")
    if (isPageNavigation && !pathname.startsWith("/setup")) {
        try {
            const backend = process.env.BACKEND_URL || "http://localhost:3001"
            const setupRes = await fetch(`${backend}/api/setup/status`, { cache: "no-store" })
            const data = (await setupRes.json().catch(() => ({}))) as { needsSetup?: boolean }
            // Redirect khi cần cài đặt (kể cả khi backend trả 500 do chưa có DB)
            if (data.needsSetup === true) {
                const url = req.nextUrl.clone()
                url.pathname = "/setup"
                return NextResponse.redirect(url)
            }
        } catch {
            // Backend không gọi được (chưa chạy, lỗi mạng): vẫn chuyển sang /setup để user thấy hướng dẫn cài đặt
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

    // Trả về luôn nếu request là preflight
    if (req.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: res.headers })
    }

    // Cho phép nhúng iframe: trang chủ và trang embed (tránh lỗi "frame-ancestors 'none'" khi embed từ website khác)
    if (pathname === "/") {
        res.headers.set("Content-Security-Policy", "frame-ancestors *")
    }

    // Trang embed: set CSP ngay, không gọi backend (tránh chặn request → embed tải nhanh)
    if (pathname.startsWith("/embed")) {
        res.headers.set("Content-Security-Policy", "frame-ancestors *")
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
    matcher: ["/", "/welcome", "/welcome/:path*", "/assistants/:path*", "/admin", "/admin/:path*", "/embed/:path*", "/login", "/setup", "/setup/:path*", "/api/:path*"],
}
