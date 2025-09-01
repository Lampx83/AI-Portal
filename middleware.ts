// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: "process.env.NEXTAUTH_SECRET=" })
    const { pathname } = req.nextUrl

    const isAuthRoute = pathname === "/login" || pathname.startsWith("/api/auth")

    // Nếu CHƯA đăng nhập: chặn "/" và "/assistants/*"
    if (!token && (pathname === "/" || pathname.startsWith("/assistants"))) {
        const url = req.nextUrl.clone()
        url.pathname = "/login"
        url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
        return NextResponse.redirect(url)
    }

    // // Nếu ĐÃ đăng nhập mà vào /login -> chuyển về callbackUrl (nếu có) hoặc /assistants/main
    // if (token && pathname === "/login") {
    //     const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") || "/assistants/main"
    //     return NextResponse.redirect(new URL(callbackUrl, req.url))
    // }

    return NextResponse.next()
}

export const config = {
    matcher: ["/", "/assistants/:path*", "/login"],
}
