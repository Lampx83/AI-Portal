/**
 * Proxy /api/auth/* sang backend. Khi backend lỗi hoặc không phản hồi, luôn trả JSON
 * để tránh NextAuth client báo CLIENT_FETCH_ERROR (Unexpected token '<' khi nhận HTML 502).
 */
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001"

async function proxyAuth(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search
  const backendUrl = `${BACKEND_URL}${pathname}${search}`

  try {
    const headers = new Headers(request.headers)
    // Forward host/origin for NextAuth
    const url = request.nextUrl
    if (!headers.get("x-forwarded-host")) headers.set("x-forwarded-host", url.host)
    if (!headers.get("x-forwarded-proto")) headers.set("x-forwarded-proto", url.protocol.replace(":", ""))

    const res = await fetch(backendUrl, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      duplex: "half",
    } as RequestInit)

    const contentType = res.headers.get("content-type") || ""
    const isJson = contentType.includes("application/json")
    const text = await res.text()

    // Luôn trả JSON cho client để tránh CLIENT_FETCH_ERROR (NextAuth parse response như JSON)
    const ensureJson = (body: string, status: number) => {
      if (status >= 400 || !body.trim() || (!body.trimStart().startsWith("{") && !body.trimStart().startsWith("["))) {
        return NextResponse.json(
          { error: body.trim() || "Auth error" },
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
        // Chuyển tiếp Set-Cookie từ backend để session có hiệu lực ngay sau đăng nhập (vd. sau /setup)
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
        // Backend gửi Content-Type json nhưng body là plain text (vd. "Internal Server Error")
        return ensureJson(text, res.status)
      }
    }

    return ensureJson(text, res.status)
  } catch (err) {
    // Backend down / ECONNREFUSED / timeout → trả JSON để client không parse HTML
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
