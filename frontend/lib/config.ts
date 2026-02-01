// lib/config.ts
// Tự động detect môi trường để set baseUrl phù hợp
const getBaseUrl = () => {
  // Ưu tiên sử dụng NEXT_PUBLIC_API_BASE_URL nếu có (từ environment variable)
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL
  }
  
  // Development mode: dùng localhost
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001"
  }
  
  // Production: dùng production URL
  return "https://research.neu.edu.vn"
}

export const API_CONFIG = {
    baseUrl: getBaseUrl()
}