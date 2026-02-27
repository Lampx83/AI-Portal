"use client"

import { useEffect } from "react"

/** Bắt lỗi ở root layout (vd. SessionProvider / "Connection closed"). Thay thế toàn bộ layout khi bắt được. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Global error boundary]", error?.message, error)
  }, [error])

  const isConnectionClosed =
    error?.message?.includes("Connection closed") ||
    error?.message?.toLowerCase().includes("connection closed") ||
    error?.message?.includes("CLIENT_FETCH_ERROR")

  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
            {isConnectionClosed ? "Kết nối bị gián đoạn" : "Đã xảy ra lỗi"}
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>
            {isConnectionClosed
              ? "Phiên đăng nhập hoặc kết nối tới máy chủ bị ngắt. Vui lòng tải lại trang."
              : "Một lỗi không mong muốn đã xảy ra. Vui lòng tải lại trang."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginRight: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, color: "#fff", background: "#0f172a", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Thử lại
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: "10px 16px", fontSize: 14, fontWeight: 500, color: "#0f172a", background: "transparent", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer" }}
          >
            Tải lại trang
          </button>
        </div>
      </body>
    </html>
  )
}
