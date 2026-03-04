/**
 * Polyfill crypto.randomUUID cho môi trường không secure (HTTP) hoặc trình duyệt cũ.
 * Chạy khi import – gọi sớm trong embed layout để tránh lỗi "crypto.randomUUID is not a function".
 */
if (typeof window !== "undefined" && typeof crypto !== "undefined" && !crypto.randomUUID) {
  ;(crypto as Crypto & { randomUUID?: () => string }).randomUUID = function randomUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}

/** Fallback UUID khi crypto.randomUUID không có (HTTP, trình duyệt cũ). */
function fallbackUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Trả về UUID an toàn trên mọi môi trường (kể cả khi chưa chạy polyfill).
 * Dùng thay cho crypto.randomUUID() trong frontend để tránh lỗi khi deploy (HTTP / trình duyệt cũ).
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return fallbackUUID()
}
