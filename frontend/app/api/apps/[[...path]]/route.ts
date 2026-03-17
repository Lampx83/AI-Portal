/**
 * Proxy /api/apps/* sang backend và chuyển tiếp Cookie (và headers cần thiết).
 * Giải mã session trên Next.js và gửi X-User-Id xuống backend để truy vấn đúng dữ liệu user.
 */
import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export const dynamic = "force-dynamic"

const BACKEND_URL =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "http://backend:3001")

// Phải trùng với backend (auth) để giải mã session. Nếu backend lấy từ Admin → Cài đặt thì set cùng giá trị vào env frontend.
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ""

const SESSION_COOKIE_BASE = "next-auth.session-token"
const SESSION_COOKIE_SECURE = "__Secure-next-auth.session-token"

/** Parse Cookie header and return session-token chunks for getToken's SessionStore (name + value, đúng thứ tự). */
function getSessionCookieChunks(cookieHeader: string | null): { name: string; value: string }[] {
  if (!cookieHeader) return []
  const result: { name: string; value: string }[] = []
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    const name = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (
      name === SESSION_COOKIE_BASE ||
      name === SESSION_COOKIE_SECURE ||
      name.startsWith(SESSION_COOKIE_BASE + ".") ||
      name.startsWith(SESSION_COOKIE_SECURE + ".")
    ) {
      result.push({ name, value })
    }
  }
  result.sort((a, b) => {
    const aSuffix = a.name.split(".").pop() ?? "0"
    const bSuffix = b.name.split(".").pop() ?? "0"
    return (/\d+/.test(aSuffix) ? parseInt(aSuffix, 10) : 0) - (/\d+/.test(bSuffix) ? parseInt(bSuffix, 10) : 0)
  })
  return result
}

/** Forward request to backend with Cookie and, when session exists, X-User-Id / X-User-Email / X-User-Name. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, await params)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, await params)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, await params)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, await params)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, await params)
}

async function proxy(request: NextRequest, { path }: { path?: string[] }) {
  const pathSegments = path && path.length > 0 ? path : []
  const rest = pathSegments.join("/")
  const url = new URL(request.url)
  const backendPath = `/api/apps${rest ? `/${rest}` : ""}`
  const backendUrl = `${BACKEND_URL}${backendPath}${url.search}`
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower === "host" || lower === "connection") return
    headers.set(key, value)
  })
  const cookie = request.headers.get("cookie")
  if (cookie) headers.set("cookie", cookie)

  // Giải mã session: truyền chunks từ Cookie header vào getToken (NextRequest.cookies có thể không có .0/.1/.2).
  let forwardedUserId: string | null = null
  if (JWT_SECRET) {
    try {
      const chunks = getSessionCookieChunks(request.headers.get("cookie"))
      const reqForToken =
        chunks.length > 0
          ? ({ cookies: { getAll: () => chunks }, headers: request.headers } as NextRequest)
          : request
      const token = await getToken({ req: reqForToken, secret: JWT_SECRET })
      const id = (token as { id?: string })?.id
      if (id && typeof id === "string") {
        forwardedUserId = id
        headers.set("x-user-id", id)
        const email = (token as { email?: string })?.email
        const name = (token as { name?: string })?.name
        if (email != null) headers.set("x-user-email", String(email))
        if (name != null) headers.set("x-user-name", String(name))
      } else if (process.env.NODE_ENV === "development" && chunks.length > 0) {
        console.warn("[api/apps] Session cookie chunks present but getToken returned no id. Check NEXTAUTH_SECRET matches backend.")
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[api/apps] getToken error:", (e as Error)?.message ?? e)
      }
    }
  } else if (process.env.NODE_ENV === "development") {
    const chunks = getSessionCookieChunks(request.headers.get("cookie"))
    if (chunks.length > 0) {
      console.warn("[api/apps] NEXTAUTH_SECRET not set; cannot forward user. Set NEXTAUTH_SECRET in .env.local (same as backend).")
    }
  }

  try {
    const body = request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined
    const res = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    })
    const resBody = await res.text()
    const resHeaders = new Headers()
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === "transfer-encoding" || lower === "connection") return
      resHeaders.set(key, value)
    })
    // Debug: cho biết proxy đã gửi user id xuống backend hay chưa (xem trong DevTools → Response Headers).
    resHeaders.set("x-proxy-user-id", forwardedUserId ?? "")
    return new NextResponse(resBody, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    })
  } catch (e) {
    console.error("[api/apps proxy] fetch error:", e)
    return NextResponse.json(
      { error: "Backend unavailable", message: (e as Error)?.message ?? "Fetch failed" },
      { status: 502 }
    )
  }
}
