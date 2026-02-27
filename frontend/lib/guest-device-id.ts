/** Key trong localStorage để lưu device id cho khách (chưa đăng nhập). Backend dùng để giới hạn 1 tin/ngày/thiết bị/trợ lý. */
const GUEST_DEVICE_ID_KEY = "ai_portal_guest_device_id"

/** Prefix key: đã gửi tin nhắn dùng thử cho trợ lý (alias) trên thiết bị này → không cho gửi tiếp, yêu cầu đăng nhập. */
const GUEST_SENT_PREFIX = "ai_portal_guest_sent_"

export function getOrCreateGuestDeviceId(): string {
  if (typeof window === "undefined") return "anonymous"
  try {
    let id = localStorage.getItem(GUEST_DEVICE_ID_KEY)
    if (!id || id.trim() === "") {
      id = crypto.randomUUID()
      localStorage.setItem(GUEST_DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return "anonymous"
  }
}

/** Đánh dấu khách đã gửi tin cho trợ lý này (sau khi gửi thành công). */
export function setGuestAlreadySentForAssistant(alias: string): void {
  if (typeof window === "undefined" || !alias?.trim()) return
  try {
    localStorage.setItem(GUEST_SENT_PREFIX + alias.trim(), "1")
  } catch {
    // ignore
  }
}
