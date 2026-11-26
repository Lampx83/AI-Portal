// lib/chat/reply-meta.ts — siêu dữ liệu lưu kèm tin trả lời (cột messages.refs) và xử lý lỗi/hết giờ của trợ lý.
//
// messages.refs (JSONB) của tin trả lời có dạng:
//   {
//     v: 1,
//     stream?: true,                       // trả lời qua luồng SSE (Trợ lý chính)
//     agents?: string[],                   // alias trợ lý con đã trả lời (điều phối)
//     tools_used?: string[],               // công cụ Trợ lý chính nhắc tới/dùng (meta.tools_used)
//     functions_called?: string[],         // hàm công cụ đã gọi (meta.functions_called, orchestrator executeToolCalls)
//     error?: { code, message?, step?, http_status? }   // khi status = 'error' | 'partial'
//   }
// Trạng thái tin trả lời: 'ok' (bình thường), 'error' (trợ lý lỗi / hết giờ — nội dung là thông báo lỗi ngắn),
// 'partial' (người dùng bấm dừng: refs.error.code = 'aborted'). getRecentTurns chỉ lấy status 'ok' nên tin lỗi
// không lọt vào lịch sử gửi cho mô hình.

export type ReplyErrorCode =
  | "upstream_error" // trợ lý trả sự kiện/JSON lỗi
  | "upstream_http" // trợ lý trả mã HTTP lỗi
  | "agent_failed" // trợ lý trả status khác success
  | "timeout" // quá thời gian chờ
  | "network" // không kết nối được trợ lý / luồng bị đứt
  | "aborted" // người dùng huỷ (đóng kết nối)
  | "empty" // luồng kết thúc mà không có nội dung

export type ReplyError = {
  code: ReplyErrorCode
  message?: string
  step?: string
  http_status?: number
}

export type ReplyRefs = {
  v: 1
  stream?: true
  agents?: string[]
  tools_used?: string[]
  functions_called?: string[]
  error?: ReplyError
}

const MAX_LIST = 20
const MAX_ERR_MSG = 500

function strList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && typeof (x as any).alias === "string" ? (x as any).alias : ""))
    .map((s) => s.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, MAX_LIST)
  return out.length ? Array.from(new Set(out)) : undefined
}

/** Cắt ngắn thông điệp lỗi (bỏ xuống dòng thừa) để lưu DB. */
export function shortErrorMessage(v: unknown): string | undefined {
  if (v == null) return undefined
  const s = String(typeof v === "string" ? v : (v as any)?.message ?? v)
    .replace(/\s+/g, " ")
    .trim()
  return s ? s.slice(0, MAX_ERR_MSG) : undefined
}

/** Dựng refs từ meta của trợ lý (agents, tools_used, functions_called) và lỗi (nếu có). Không bao giờ ném lỗi. */
export function buildReplyRefs(input: { meta?: any; stream?: boolean; error?: ReplyError | null }): ReplyRefs {
  const meta = input.meta && typeof input.meta === "object" ? input.meta : {}
  const refs: ReplyRefs = { v: 1 }
  if (input.stream) refs.stream = true
  const agents = strList(meta.agents)
  if (agents) refs.agents = agents
  const tools = strList(meta.tools_used)
  if (tools) refs.tools_used = tools
  const fns = strList(meta.functions_called)
  if (fns) refs.functions_called = fns
  if (input.error) {
    const e: ReplyError = { code: input.error.code }
    const msg = shortErrorMessage(input.error.message)
    if (msg) e.message = msg
    if (typeof input.error.step === "string" && input.error.step.trim()) e.step = input.error.step.trim().slice(0, 60)
    if (Number.isInteger(input.error.http_status)) e.http_status = input.error.http_status
    refs.error = e
  }
  return refs
}

/** Lỗi từ fetch/AbortController có phải do hết giờ chờ không. */
export function isTimeoutError(err: unknown, timedOutFlag?: boolean): boolean {
  if (timedOutFlag) return true
  const name = (err as any)?.name
  return name === "TimeoutError" || (name === "AbortError" && /timeout/i.test(String((err as any)?.message ?? "")))
}

/** Thời gian chờ mặc định theo alias (ms). Trợ lý Tạp chí, hội thảo (publish) p99 ~228 s → cắt ở 90 s. */
const DEFAULT_TIMEOUT_BY_ALIAS: Record<string, number> = {
  publish: 90_000,
}
/** Trần chung cho trợ lý gọi không qua luồng (trước đây chờ vô hạn). Thấp hơn SEND_TIMEOUT_MS 120 s của giao diện để người dùng nhận thông báo rõ ràng thay vì yêu cầu bị cắt im lặng. */
export const DEFAULT_AGENT_TIMEOUT_MS = 110_000
const MIN_TIMEOUT_MS = 5_000
const MAX_TIMEOUT_MS = 600_000

/**
 * Thời gian chờ trợ lý (ms): config_json.request_timeout_ms (Admin chỉnh được) → mặc định theo alias → trần chung.
 */
export function resolveAgentTimeoutMs(alias: string | null | undefined, configJson?: Record<string, unknown> | null): number {
  const raw = configJson ? (configJson as any).request_timeout_ms : undefined
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN
  if (Number.isFinite(n) && n > 0) return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(n)))
  const a = String(alias ?? "").trim().toLowerCase()
  return DEFAULT_TIMEOUT_BY_ALIAS[a] ?? DEFAULT_AGENT_TIMEOUT_MS
}

function isVi(lang: unknown): boolean {
  const l = typeof lang === "string" ? lang.trim().toLowerCase() : ""
  return !l || l.startsWith("vi")
}

/** Thông báo thân thiện khi trợ lý quá thời gian chờ (hiện cho người dùng và lưu làm nội dung tin lỗi). */
export function timeoutMessage(alias: string | null | undefined, timeoutMs: number, lang?: unknown): string {
  const secs = Math.round(timeoutMs / 1000)
  const a = String(alias ?? "").trim().toLowerCase()
  if (isVi(lang)) {
    if (a === "publish") {
      return `Trợ lý Tạp chí, hội thảo chưa tìm xong sau ${secs} giây nên đã dừng để bạn không phải chờ lâu. Bạn hãy thử thu hẹp câu hỏi (ví dụ nêu rõ lĩnh vực, chỉ mục Scopus/WoS, hạng Q hoặc khoảng thời gian) rồi gửi lại.`
    }
    return `Trợ lý chưa trả lời xong sau ${secs} giây nên đã dừng để bạn không phải chờ lâu. Bạn hãy thử hỏi ngắn gọn, cụ thể hơn rồi gửi lại.`
  }
  if (a === "publish") {
    return `The Journals & Conferences assistant did not finish within ${secs} seconds, so the request was stopped. Please narrow your question (e.g. field, Scopus/WoS indexing, quartile or time range) and try again.`
  }
  return `The assistant did not finish within ${secs} seconds, so the request was stopped. Please try a shorter, more specific question.`
}

/** Nội dung lưu cho tin lỗi (khi không có thông báo riêng). */
export function errorReplyText(code: ReplyErrorCode, lang?: unknown): string {
  const vi = isVi(lang)
  switch (code) {
    case "aborted":
      return vi ? "(Đã dừng trả lời)" : "(Response stopped)"
    case "empty":
      return vi ? "Trợ lý không trả về nội dung. Bạn hãy thử gửi lại." : "The assistant returned no content. Please try again."
    case "network":
      return vi ? "Không kết nối được tới trợ lý. Bạn hãy thử lại sau ít phút." : "Could not reach the assistant. Please try again in a few minutes."
    default:
      return vi ? "Trợ lý gặp lỗi khi trả lời. Bạn hãy thử lại sau ít phút." : "The assistant ran into an error. Please try again in a few minutes."
  }
}
