"use client"

import { useEffect, useState } from "react"
import { getStoredLocale, t as translate, type Locale } from "@/lib/i18n"

/**
 * Bắt lỗi ở root layout (vd. SessionProvider / "Connection closed"). Thay thế toàn bộ layout khi bắt được,
 * nghĩa là LanguageProvider (và mọi context khác) đã bị unmount — không thể dùng useLanguage() ở đây.
 * Thay vào đó đọc thẳng locale đã lưu (localStorage "neu-locale", cùng cơ chế với lib/i18n) và tra chuỗi
 * qua hàm t() thuần (không qua React context). Nếu không đọc được (vd. localStorage lỗi) getStoredLocale()
 * tự rơi về "en" nên fallback vẫn hợp lý — không cần fallback song ngữ thủ công.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [locale, setLocale] = useState<Locale>("en")

  useEffect(() => {
    console.error("[Global error boundary]", error?.message, error)
    setLocale(getStoredLocale())
  }, [error])

  const tt = (key: string) => translate(locale, key)

  const isConnectionClosed =
    error?.message?.includes("Connection closed") ||
    error?.message?.toLowerCase().includes("connection closed") ||
    error?.message?.includes("CLIENT_FETCH_ERROR")

  return (
    <html lang={String(locale)}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
            {isConnectionClosed ? tt("errorBoundary.connectionTitle") : tt("errorBoundary.genericTitle")}
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>
            {isConnectionClosed
              ? tt("errorBoundary.globalConnectionMessage")
              : tt("errorBoundary.globalGenericMessage")}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginRight: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, color: "#fff", background: "#0f172a", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            {tt("errorBoundary.retry")}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: "10px 16px", fontSize: 14, fontWeight: 500, color: "#0f172a", background: "transparent", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer" }}
          >
            {tt("errorBoundary.reload")}
          </button>
        </div>
      </body>
    </html>
  )
}
