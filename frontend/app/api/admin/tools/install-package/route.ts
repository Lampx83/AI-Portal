/**
 * Proxy POST /api/admin/tools/install-package sang backend với timeout dài (5 phút).
 * Hỗ trợ streaming: gửi header X-Stream-Progress: 1 để nhận tiến trình từng bước (NDJSON).
 *
 * Dùng stream body (không parse formData) để tránh giới hạn body mặc định của Next.js → giảm lỗi 413
 * khi request đi qua frontend (vd. truy cập qua :3000 hoặc proxy gửi /api về frontend).
 *
 * Nginx: client_max_body_size 50m; trong location /api/ (và cả server nếu cần).
 */
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "http://backend:3001")
).replace(/\/+$/, "")
const TIMEOUT_MS = 300_000 // 5 minutes

export async function POST(request: NextRequest) {
  const backendUrl = `${BACKEND_URL}/api/admin/tools/install-package`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // Đọc body thành buffer trước khi fetch → tránh lỗi "controller[kState].transformAlgorithm is not a function"
    // (request.body stream không tương thích khi truyền trực tiếp vào fetch trong Node/Next.js)
    const contentType = request.headers.get("content-type")
    if (!contentType?.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Thiếu file gói (package). Gửi form multipart với field 'package'." }, { status: 400 })
    }

    let body: ArrayBuffer
    try {
      body = await request.arrayBuffer()
    } catch {
      return NextResponse.json({ error: "Không đọc được body request." }, { status: 400 })
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      Cookie: request.headers.get("cookie") || "",
      "X-Stream-Progress": request.headers.get("x-stream-progress") || "",
    }
    if (headers["X-Stream-Progress"] === "") delete headers["X-Stream-Progress"]

    const res = await fetch(backendUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const ct = res.headers.get("content-type") || ""
    if (ct.includes("application/x-ndjson")) {
      return new Response(res.body, {
        status: res.status,
        headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
      })
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    clearTimeout(timeoutId)
    if ((e as Error)?.name === "AbortError") {
      return NextResponse.json(
        { error: "Cài đặt quá thời gian (5 phút). Thử lại hoặc cài thủ công." },
        { status: 504 }
      )
    }
    const err = e as Error & { cause?: { code?: string } }
    const cause = err.cause?.code || err.message
    console.error("[install-package] proxy error:", err.message, "cause:", cause)
    const isConnectionRefused =
      cause === "ECONNREFUSED" ||
      err.message?.includes("fetch failed") ||
      (typeof cause === "string" && cause.includes("ECONNREFUSED"))
    const hint = isConnectionRefused
      ? ` Backend chưa chạy. Khởi động: mở terminal mới, chạy \`cd backend && npm run dev\` (hoặc \`cd AI-Portal/backend && npm run dev\`). Sau đó thử lại.`
      : ` Kiểm tra backend đang chạy tại ${BACKEND_URL}.`
    return NextResponse.json(
      { error: "Lỗi kết nối backend." + hint, message: err.message },
      { status: 502 }
    )
  }
}
