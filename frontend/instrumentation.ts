/**
 * Chạy khi server Next.js khởi động. Trong development, kiểm tra backend có đang chạy không.
 */
export async function register() {
  if (process.env.NODE_ENV !== "development") return
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001"
  const base = backendUrl.replace(/\/+$/, "")
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (_e) {
    console.warn("")
    console.warn("⚠️  Backend không chạy hoặc không kết nối được tại " + base)
    console.warn("   Trang Admin, Cài đặt gói, Surveylab và nhiều API sẽ lỗi (502/ECONNREFUSED).")
    console.warn("   Chạy backend: cd AI-Portal/backend && npm run dev")
    console.warn("   Hoặc chạy cả hai: cd AI-Portal && npm run dev")
    console.warn("")
  }
}
