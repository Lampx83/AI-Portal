/**
 * Cắt lịch sử hội thoại gửi cho Trợ lý chính theo ngân sách ký tự.
 *
 * Lỗi cũ: vòng lặp `break` ngay khi MỘT lượt vượt ngân sách (6.000 ký tự). Câu trả lời gần nhất của trợ lý hay dài
 * hơn thế → lịch sử gửi đi RỖNG → trợ lý «quên sạch» cuộc trò chuyện (người dùng báo 30/10/2026).
 *
 * Quy tắc mới:
 *  - mỗi lượt bị rút gọn (giữ đầu + cuối) nếu quá dài, thay vì bị loại cả lượt;
 *  - luôn giữ ít nhất `minTurns` lượt gần nhất (dù đã rút gọn);
 *  - lượt cũ hơn tiếp tục được thêm cho tới khi hết ngân sách.
 */
export interface ClipTurn {
  role: string
  content: string
}

export interface ClipOptions {
  /** Tổng số ký tự tối đa của lịch sử (mặc định 10.000 ≈ 5 nghìn token tiếng Việt). */
  maxChars?: number
  /** Số lượt gần nhất luôn được giữ (đã rút gọn nếu cần). */
  minTurns?: number
  /** Giới hạn mỗi lượt người dùng. */
  maxUserChars?: number
  /** Giới hạn mỗi lượt trợ lý (câu trả lời dài bị rút gọn). */
  maxAssistantChars?: number
}

const MARK = "\n…[đã rút gọn phần giữa]…\n"

/** Giữ ~75% đầu và ~25% cuối khi vượt giới hạn. */
export function shrinkText(text: string, max: number): string {
  if (text.length <= max) return text
  const room = Math.max(0, max - MARK.length)
  const head = Math.ceil(room * 0.75)
  const tail = room - head
  return text.slice(0, head).trimEnd() + MARK + (tail > 0 ? text.slice(text.length - tail).trimStart() : "")
}

export function clipHistory<T extends ClipTurn>(turns: T[], opts: ClipOptions = {}): T[] {
  const maxChars = opts.maxChars ?? 10000
  const minTurns = opts.minTurns ?? 2
  const maxUser = opts.maxUserChars ?? 3000
  const maxAssistant = opts.maxAssistantChars ?? 4500
  const out: T[] = []
  let used = 0
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i]
    const raw = t.content ?? ""
    const content = shrinkText(raw, t.role === "assistant" ? maxAssistant : maxUser)
    const keepAnyway = out.length < minTurns
    if (!keepAnyway && used + content.length > maxChars) break
    out.push(content === raw ? t : { ...t, content })
    used += content.length
  }
  return out.reverse()
}
