// lib/config.ts
// Auto-detect environment to set baseUrl. Khi chạy dưới basePath mà không set NEXT_PUBLIC_API_BASE_URL,
// client dùng origin + basePath (cấu hình URL khi deploy, không cần build lại).
const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL
  }
  if (process.env.NODE_ENV === "development") {
    return ""
  }
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  if (basePath && typeof window !== "undefined") {
    return window.location.origin + basePath
  }
  return ""
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
  get baseUrl(): string {
    return getBaseUrl()
  },
}