/**
 * Cổng phát luồng cho Trợ lý chính khi có công cụ (function-calling).
 *
 * Vì sao cần: trước đây nhánh có công cụ dồn TOÀN BỘ lượt 1 vào bộ đệm rồi mới ghi một cục (người dùng thấy chờ rồi hiện cả đoạn,
 * không «gõ từng chữ»). Lý do dồn: mô hình đôi khi kể «tôi cần gọi hàm …» rồi mới gọi hàm, không được lộ tên hàm nội bộ.
 *
 * Cách làm: giữ ngắn (holdMs hoặc holdChars, cái nào tới trước) để bắt các câu kể lể đầu lượt; nếu tới lúc đó chưa có lệnh gọi hàm
 * thì xả bộ đệm và phát trực tiếp phần còn lại. Nếu lệnh gọi hàm tới SAU khi đã phát, báo `reset` (giao diện xoá phần đã hiện),
 * bỏ phần chữ lượt 1 và để lượt 2 (trả lời từ kết quả hàm) phát trực tiếp.
 */
export type GateAction = { emit?: string; reset?: boolean }

export class LiveStreamGate {
  private held = ""
  private startedAt: number | null = null
  private open = false          // đã xả bộ đệm, đang phát trực tiếp
  private dead = false          // đã thấy lệnh gọi hàm: bỏ chữ lượt 1
  constructor(private readonly holdMs = 900, private readonly holdChars = 120, private readonly now: () => number = Date.now) {}

  /** Có thêm chữ từ mô hình. Trả về phần cần ghi ra ngay (có thể rỗng). */
  push(delta: string): GateAction {
    if (this.dead || !delta) return {}
    if (this.open) return { emit: delta }
    if (this.startedAt === null) this.startedAt = this.now()
    this.held += delta
    if (this.held.length >= this.holdChars || this.now() - this.startedAt >= this.holdMs) {
      this.open = true
      const out = this.held
      this.held = ""
      return { emit: out }
    }
    return {}
  }

  /** Mô hình yêu cầu gọi hàm. Nếu đã phát chữ ra giao diện thì cần `reset`. */
  toolCallSeen(): GateAction {
    if (this.dead) return {}
    this.dead = true
    const wasOpen = this.open
    this.held = ""
    return wasOpen ? { reset: true } : {}
  }

  /** Hết lượt 1 mà không có lệnh gọi hàm: trả phần còn giữ trong bộ đệm. */
  drain(): string {
    if (this.dead) return ""
    const out = this.held
    this.held = ""
    this.open = true
    return out
  }

  get isDead(): boolean { return this.dead }
}
