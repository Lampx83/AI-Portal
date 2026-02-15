// lib/config.ts
// Tự động detect môi trường để set baseUrl phù hợp
const getBaseUrl = () => {
  // Ưu tiên sử dụng NEXT_PUBLIC_API_BASE_URL nếu có (từ environment variable)
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL
  }

  // Development: dùng same-origin (chuỗi rỗng) để request đi qua Next.js proxy sang backend,
  // cookie session được gửi kèm → API auth (write-articles, users, ...) hoạt động đúng
  if (process.env.NODE_ENV === "development") {
    return ""
  }

  // Production: dùng env hoặc same-origin (rỗng)
  return process.env.NEXT_PUBLIC_API_BASE_URL || ""
}

/** URL WebSocket cho collaborative editing (gọi khi đã ở client). Trong dev (baseUrl rỗng) mặc định ws://localhost:3001. */
export function getCollabWsUrl(): string {
  if (typeof window === "undefined") return ""
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL
  const base = getBaseUrl()
  if (base.startsWith("https://")) return base.replace(/^https:\/\//, "wss://")
  if (base.startsWith("http://")) return base.replace(/^http:\/\//, "ws://")
  if (!base) return "ws://localhost:3001"
  return (window.location.protocol === "https:" ? "wss:" : "ws:") + "//" + window.location.host
}

export const API_CONFIG = {
  baseUrl: getBaseUrl(),
}