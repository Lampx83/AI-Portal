// lib/config.ts
// Auto-detect environment to set baseUrl. Khi chạy dưới basePath mà không set NEXT_PUBLIC_API_BASE_URL,
// client dùng origin + basePath (cấu hình URL khi deploy, không cần build lại).
const getBaseUrl = (): string => {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  // Trên client: ưu tiên dùng origin hiện tại để tránh CORS khi user mở bằng 127.0.0.1 còn env là localhost (hoặc ngược lại).
  if (basePath && typeof window !== "undefined") {
    const origin = window.location.origin
    const envApi = process.env.NEXT_PUBLIC_API_BASE_URL || ""
    if (envApi) {
      try {
        const u = new URL(envApi)
        const envPort = u.port || (u.protocol === "https:" ? "443" : "80")
        const curPort = window.location.port || (window.location.protocol === "https:" ? "443" : "80")
        const envHost = u.hostname
        const curHost = window.location.hostname
        const sameHost = envHost === curHost || (envHost === "localhost" && curHost === "127.0.0.1") || (envHost === "127.0.0.1" && curHost === "localhost")
        if (sameHost && envPort === curPort) return origin + basePath
      } catch {
        // ignore
      }
    }
    return origin + basePath
  }
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL
  }
  if (process.env.NODE_ENV === "development") {
    return ""
  }
  return ""
}

export const API_CONFIG = {
  get baseUrl(): string {
    return getBaseUrl()
  },
}