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

    if (!res.ok && !isJson) {
      return NextResponse.json(
        { error: res.statusText || "Auth error" },
        { status: res.status }
      )
    }

    if (isJson) {
      const data = await res.json()
      return NextResponse.json(data, { status: res.status, headers: res.headers })
    }

    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: new Headers(res.headers),
    })
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
