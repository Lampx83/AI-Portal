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

  // Production: dùng production URL
  return "https://research.neu.edu.vn"
}

export const API_CONFIG = {
  baseUrl: getBaseUrl(),
}