/**
 * Proxy POST /api/admin/tools/install-package sang backend với timeout dài (5 phút).
 * Hỗ trợ streaming: gửi header X-Stream-Progress: 1 để nhận tiến trình từng bước (NDJSON).
 *
 * Lỗi 413 (Payload Too Large): Nếu deploy sau reverse proxy (nginx, caddy), cần tăng giới hạn body.
 * Ví dụ nginx: client_max_body_size 50m; (trong server hoặc location /api/admin/tools/install-package).
 */
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:3001").replace(/\/+$/, "")
const TIMEOUT_MS = 300_000 // 5 minutes

export async function POST(request: NextRequest) {
  const backendUrl = `${BACKEND_URL}/api/admin/tools/install-package`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const formData = await request.formData()
    const file = formData.get("package")
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Thiếu file gói (package)" }, { status: 400 })
    }

    const fd = new FormData()
    fd.append("package", file, file instanceof File ? file.name : "package.zip")

    const headers: Record<string, string> = {
      Cookie: request.headers.get("cookie") || "",
      "X-Stream-Progress": request.headers.get("x-stream-progress") || "",
    }
    if (headers["X-Stream-Progress"] === "") delete headers["X-Stream-Progress"]

    const res = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: fd,
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
