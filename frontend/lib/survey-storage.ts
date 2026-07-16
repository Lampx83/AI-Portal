/**
 * Client-side state cho survey popup. Lưu trên localStorage để áp dụng tần suất / cooldown
 * cho cả guest (chưa đăng nhập) — backend đã track "đã trả lời" qua user_id/guest_device_id,
 * còn dismiss/cooldown / "mỗi N ngày" thì giữ ở client để giảm tải server.
 */

const KEY = "ai_portal_survey_state_v1"
const VISIT_KEY = "ai_portal_visit_count"

type SurveyState = {
  // surveyId -> state
  [surveyId: string]: {
    lastShownAt?: number
    lastDismissedAt?: number
    dismissCount?: number
    completed?: boolean
    /** Thời điểm trả lời gần nhất (ms). Dùng để tính chu kỳ "hỏi lại sau N ngày". */
    completedAt?: number
    sessionShownAt?: number
  }
}

function read(): SurveyState {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function write(state: SurveyState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

export function getSurveyState(surveyId: string) {
  return read()[surveyId] ?? {}
}

export function markShown(surveyId: string): void {
  const state = read()
  state[surveyId] = {
    ...state[surveyId],
    lastShownAt: Date.now(),
    sessionShownAt: Date.now(),
  }
  write(state)
}

export function markDismissed(surveyId: string): void {
  const state = read()
  state[surveyId] = {
    ...state[surveyId],
    lastDismissedAt: Date.now(),
    dismissCount: (state[surveyId]?.dismissCount ?? 0) + 1,
  }
  write(state)
}

export function markCompleted(surveyId: string): void {
  const state = read()
  // Đánh dấu đã trả lời + mốc thời gian; đồng thời xoá trạng thái "nag" (đã hiện/đã đóng) của
  // chu kỳ hiện tại để lần "hỏi lại" kế tiếp (sau reask_days ngày) bắt đầu sạch, không bị
  // tần suất "once" / cooldown cũ chặn.
  state[surveyId] = {
    completed: true,
    completedAt: Date.now(),
  }
  write(state)
}

/** Tăng visit count mỗi lần app mount (1 lần / page reload). */
export function bumpVisitCount(): number {
  if (typeof window === "undefined") return 0
  try {
    const cur = Number(localStorage.getItem(VISIT_KEY) || "0") + 1
    localStorage.setItem(VISIT_KEY, String(cur))
    return cur
  } catch {
    return 0
  }
}

export function getVisitCount(): number {
  if (typeof window === "undefined") return 0
  try {
    return Number(localStorage.getItem(VISIT_KEY) || "0")
  } catch {
    return 0
  }
}
