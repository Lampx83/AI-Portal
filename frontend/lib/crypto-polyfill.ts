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
