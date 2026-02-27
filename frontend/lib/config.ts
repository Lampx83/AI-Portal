// lib/config.ts
// Auto-detect environment to set baseUrl. Khi chạy dưới basePath mà không set NEXT_PUBLIC_API_BASE_URL,
// client dùng origin + basePath (cấu hình URL khi deploy, không cần build lại).
const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL
  }
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  // Có basePath thì luôn dùng origin+basePath (kể cả dev), để request đi đúng /tuyen-sinh/api/... và rewrite match
  if (basePath && typeof window !== "undefined") {
    return window.location.origin + basePath
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