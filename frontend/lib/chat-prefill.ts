// Câu hỏi điền sẵn vào ô nhập của trợ lý (từ tham số ?q= hoặc nút gợi ý ở trang chào / thẻ «Bước tiếp theo»).
// Lưu tạm trong bộ nhớ trang (không lưu trình duyệt) để khung chat dựng lại (đổi phiên, chuyển bố cục) vẫn điền lại được;
// xoá ngay khi người dùng gửi tin nhắn. KHÔNG tự gửi.

export const PREFILL_MAX_CHARS = 500

let pending: { alias: string; text: string; at: number } | null = null
/** Hết hạn sau 10 phút để không điền nhầm vào một cuộc trò chuyện về sau. */
const TTL_MS = 10 * 60 * 1000

export function cleanPrefill(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, PREFILL_MAX_CHARS)
}

export function setPendingPrefill(alias: string, text: string): void {
  const t = cleanPrefill(text)
  pending = t ? { alias, text: t, at: Date.now() } : null
}

export function peekPendingPrefill(alias: string | undefined): string | null {
  if (!pending || !alias || pending.alias !== alias) return null
  if (Date.now() - pending.at > TTL_MS) {
    pending = null
    return null
  }
  return pending.text
}

export function clearPendingPrefill(): void {
  pending = null
}
