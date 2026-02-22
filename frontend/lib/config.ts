// lib/config.ts
// Auto-detect environment to set baseUrl
const getBaseUrl = () => {
  // Prefer NEXT_PUBLIC_API_BASE_URL if set (from environment variable)
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL
  }

  // Development: use same-origin (empty string) so requests go through Next.js proxy to backend,
  // session cookie is sent → API auth (users, ...) works correctly
  if (process.env.NODE_ENV === "development") {
    return ""
  }

  // Production: use env or same-origin (empty)
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