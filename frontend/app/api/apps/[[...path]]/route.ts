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

const DEV_TIMING = process.env.NODE_ENV === "development"

/** Cache getToken result theo cookie để giảm gọi getToken trên mỗi request (getToken có thể chậm 100–500ms). TTL 2s. */
const SESSION_CACHE_TTL_MS = 2000
const sessionCache = new Map<string, { id: string; email?: string; name?: string; expires: number }>()
function getCachedSession(cookieKey: string): { id: string; email?: string; name?: string } | null {
  const ent = sessionCache.get(cookieKey)
  if (!ent || Date.now() > ent.expires) {
    if (ent) sessionCache.delete(cookieKey)
    return null
  }
  return { id: ent.id, email: ent.email, name: ent.name }
}
function setCachedSession(cookieKey: string, id: string, email?: string, name?: string): void {
  sessionCache.set(cookieKey, {
    id,
    email,
    name,
    expires: Date.now() + SESSION_CACHE_TTL_MS,
  })
  if (sessionCache.size > 500) {
    const now = Date.now()
    for (const [k, v] of sessionCache) {
      if (v.expires < now) sessionCache.delete(k)
    }
  }
}

async function proxy(request: NextRequest, { path }: { path?: string[] }) {
  const t0 = DEV_TIMING ? Date.now() : 0
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

  // Giải mã session: dùng cache 2s để tránh getToken chậm trên mỗi request; fallback getToken.
  let forwardedUserId: string | null = null
  if (JWT_SECRET) {
    try {
      const chunks = getSessionCookieChunks(request.headers.get("cookie"))
      const cookieKey = chunks.length ? chunks.map((c) => c.name + "=" + c.value).sort().join(";") : ""
      const cached = cookieKey ? getCachedSession(cookieKey) : null
      if (cached) {
        forwardedUserId = cached.id
        headers.set("x-user-id", cached.id)
        if (cached.email != null) headers.set("x-user-email", String(cached.email))
        if (cached.name != null) headers.set("x-user-name", String(cached.name))
        if (DEV_TIMING) console.log("[api/apps] getToken (cached):", Date.now() - t0, "ms")
      } else {
        const reqForToken =
          chunks.length > 0
            ? ({ cookies: { getAll: () => chunks }, headers: request.headers } as NextRequest)
            : request
        const token = await getToken({ req: reqForToken, secret: JWT_SECRET })
        if (DEV_TIMING) console.log("[api/apps] getToken:", Date.now() - t0, "ms")
        const id = (token as { id?: string })?.id
        if (id && typeof id === "string") {
          forwardedUserId = id
          const email = (token as { email?: string })?.email
          const name = (token as { name?: string })?.name
          if (cookieKey) setCachedSession(cookieKey, id, email != null ? String(email) : undefined, name != null ? String(name) : undefined)
          headers.set("x-user-id", id)
          if (email != null) headers.set("x-user-email", String(email))
          if (name != null) headers.set("x-user-name", String(name))
        } else if (process.env.NODE_ENV === "development" && chunks.length > 0) {
          console.warn("[api/apps] Session cookie chunks present but getToken returned no id. Check NEXTAUTH_SECRET matches backend.")
        }
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
    const tFetch = DEV_TIMING ? Date.now() : 0
    const res = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    })
    if (DEV_TIMING) console.log("[api/apps] fetch(backend):", Date.now() - tFetch, "ms")
    const resBody = await res.text()
    if (DEV_TIMING) console.log("[api/apps] total:", Date.now() - t0, "ms")
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
