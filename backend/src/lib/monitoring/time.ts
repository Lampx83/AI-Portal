/** Tiện ích ngày theo múi giờ Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè). */
export const MONITOR_TZ = "Asia/Ho_Chi_Minh"
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Ngày (YYYY-MM-DD) theo giờ Việt Nam của một thời điểm. */
export function vnDateOf(d: Date = new Date()): string {
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10)
}

/** Giờ (0–23) theo giờ Việt Nam. */
export function vnHourOf(d: Date = new Date()): number {
  return new Date(d.getTime() + TZ_OFFSET_MS).getUTCHours()
}

export function isValidDateStr(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false
  const t = Date.parse(`${s}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s
}

/** Cộng n ngày vào chuỗi ngày YYYY-MM-DD. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Số ngày từ a tới b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

/** Danh sách ngày liên tục [from, to]. */
export function listDays(from: string, to: string): string[] {
  const out: string[] = []
  const n = diffDays(from, to)
  for (let i = 0; i <= n; i++) out.push(addDays(from, i))
  return out
}

export interface DateRange {
  from: string
  to: string
  days: number
}

export const DEFAULT_RANGE_DAYS = 7
export const MAX_RANGE_DAYS = 366

/**
 * Chuẩn hoá khoảng ngày (theo giờ VN). Mặc định 7 ngày gần nhất tính cả hôm nay.
 * - ?days=N (1..366) khi không có from/to.
 * - from/to sai định dạng → bỏ qua; from > to → đổi chỗ; to không vượt quá hôm nay; tối đa 366 ngày.
 */
export function parseDateRange(
  q: { from?: unknown; to?: unknown; days?: unknown },
  today: string = vnDateOf()
): DateRange {
  let to = isValidDateStr(q.to) ? (q.to as string) : today
  if (diffDays(today, to) > 0) to = today
  let from: string
  if (isValidDateStr(q.from)) {
    from = q.from as string
  } else {
    const n = Number(q.days)
    const days = Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), MAX_RANGE_DAYS) : DEFAULT_RANGE_DAYS
    from = addDays(to, -(days - 1))
  }
  if (diffDays(from, to) < 0) [from, to] = [to, from]
  if (diffDays(today, to) > 0) to = today
  if (diffDays(from, to) < 0) from = to
  if (diffDays(from, to) + 1 > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1))
  return { from, to, days: diffDays(from, to) + 1 }
}
