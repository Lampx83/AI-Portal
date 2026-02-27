/**
 * Proxy /api/auth/* sang backend. Khi backend lỗi hoặc không phản hồi, luôn trả JSON
 * để tránh NextAuth client báo CLIENT_FETCH_ERROR (Unexpected token '<' khi nhận HTML 502).
 * Khi có basePath: pathname từ Next.js thường đã bỏ basePath; strip thêm để chắc chắn backend nhận đúng /api/auth/...
 */
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001"
const AUTH_FETCH_TIMEOUT_MS = 15000

/** Path gửi sang backend: luôn không có basePath (phòng trường hợp pathname vẫn chứa basePath). */
function pathForBackend(pathname: string): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  if (basePath && pathname.startsWith(basePath)) {
    const p = pathname.slice(basePath.length) || "/"
    return p
  }
  return pathname
}

/** GET /api/auth/session (hoặc .../session) — khi backend down trả về session rỗng để app không throw "Connection closed". */
function isSessionRequest(pathname: string, method: string): boolean {
  if (method !== "GET") return false
  const p = pathForBackend(pathname)
  return p === "/api/auth/session" || p.endsWith("/session")
}

async function proxyAuth(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search
  const pathForBack = pathForBackend(pathname)
  const backendUrl = `${BACKEND_URL}${pathForBack}${search}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS)

  try {
    const headers = new Headers(request.headers)
    // Forward host/origin for NextAuth
    const url = request.nextUrl
    if (!headers.get("x-forwarded-host")) headers.set("x-forwarded-host", url.host)
    if (!headers.get("x-forwarded-proto")) headers.set("x-forwarded-proto", url.protocol.replace(":", ""))

    // Đọc body thành buffer thay vì forward stream → tránh lỗi "controller[kState].transformAlgorithm is not a function" (Node/Edge với request.body + fetch)
    let body: ArrayBuffer | undefined
    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        body = await request.arrayBuffer()
      } catch {
        body = undefined
      }
    }

    const res = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)


    // Backend returns 302 redirect (e.g. after SSO callback) — forward to browser with Set-Cookie so session is valid
    if (res.status >= 301 && res.status <= 308) {
      const location = res.headers.get("location")
      if (location) {
        try {
          const target = new URL(location, request.url)
          const redirectRes = NextResponse.redirect(target.toString(), res.status as 301 | 302 | 303 | 307 | 308)
          if (typeof res.headers.getSetCookie === "function") {
            for (const cookie of res.headers.getSetCookie()) {
              redirectRes.headers.append("Set-Cookie", cookie)
            }
          }
          return redirectRes
        } catch {
          const redirectRes = NextResponse.redirect(location, res.status as 302)
          if (typeof res.headers.getSetCookie === "function") {
            for (const cookie of res.headers.getSetCookie()) {
              redirectRes.headers.append("Set-Cookie", cookie)
            }
          }
          return redirectRes
        }
      }
    }

    const contentType = res.headers.get("content-type") || ""
    const isJson = contentType.includes("application/json")
    const text = await res.text()

    // Always return JSON to client to avoid CLIENT_FETCH_ERROR (NextAuth parses response as JSON)
    const ensureJson = (body: string, status: number) => {
      let errBody = body.trim()
      if (errBody.startsWith("<!") || errBody.startsWith("<html")) {
        errBody = "Auth endpoint returned HTML instead of JSON. Check BACKEND_URL and that the auth service returns JSON."
      }
      if (status >= 400 || !body.trim() || (!body.trimStart().startsWith("{") && !body.trimStart().startsWith("["))) {
        return NextResponse.json(
          { error: errBody || "Auth error" },
          { status }
        )
      }
      try {
        const data = JSON.parse(body)
        return NextResponse.json(data, { status })
      } catch {
        return NextResponse.json({ error: body.trim() || "Auth error" }, { status })
      }
    }

    if (!res.ok && !isJson) {
      return ensureJson(text, res.status)
    }

    if (isJson) {
      try {
        const data = JSON.parse(text)
        // Forward Set-Cookie from backend so session is valid right after login (e.g. after /setup)
        const outHeaders = new Headers()
        res.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie") outHeaders.set(key, value)
        })
        if (typeof res.headers.getSetCookie === "function") {
          for (const cookie of res.headers.getSetCookie()) {
            outHeaders.append("Set-Cookie", cookie)
          }
        }
        return NextResponse.json(data, { status: res.status, headers: outHeaders })
      } catch {
        // Backend sends Content-Type json but body is plain text (e.g. "Internal Server Error")
        return ensureJson(text, res.status)
      }
    }

    return ensureJson(text, res.status)
  } catch (err) {
    clearTimeout(timeoutId)
    // GET /api/auth/session: trả session rỗng thay vì 503 để NextAuth client không throw "Connection closed" → app vẫn load được
    if (isSessionRequest(pathname, request.method)) {
      return NextResponse.json({ user: null, expires: null })
    }
    // Backend down / ECONNREFUSED / timeout → return JSON so client does not parse HTML
    return NextResponse.json(
      { error: "Auth service unavailable" },
      { status: 503 }
    )
  }
}

export async function GET(request: NextRequest) {
  return proxyAuth(request)
}

export async function POST(request: NextRequest) {
  return proxyAuth(request)
}

export async function PUT(request: NextRequest) {
  return proxyAuth(request)
}

export async function PATCH(request: NextRequest) {
  return proxyAuth(request)
}

export async function DELETE(request: NextRequest) {
  return proxyAuth(request)
}
