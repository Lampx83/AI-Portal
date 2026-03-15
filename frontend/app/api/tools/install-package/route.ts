/**
 * Proxy POST /api/tools/install-package (user install) to backend.
 * User phải đăng nhập; tool cài ra chỉ hiển thị cho tài khoản đó.
 */
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "http://backend:3001")
).replace(/\/+$/, "")
const TIMEOUT_MS = 120_000

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type")
  if (!contentType?.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Thiếu file gói. Gửi form multipart với field 'package' (file .zip)." },
      { status: 400 }
    )
  }

  let body: ArrayBuffer
  try {
    body = await request.arrayBuffer()
  } catch {
    return NextResponse.json({ error: "Không đọc được body." }, { status: 400 })
  }

  const backendUrl = `${BACKEND_URL}/api/tools/install-package`
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    Cookie: request.headers.get("cookie") || "",
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    clearTimeout(timeoutId)
    if ((e as Error)?.name === "AbortError") {
      return NextResponse.json(
        { error: "Cài đặt quá thời gian. Thử lại." },
        { status: 504 }
      )
    }
    console.error("[tools/install-package] proxy error:", e)
    return NextResponse.json(
      { error: "Lỗi kết nối backend.", message: (e as Error)?.message },
      { status: 502 }
    )
  }
}
