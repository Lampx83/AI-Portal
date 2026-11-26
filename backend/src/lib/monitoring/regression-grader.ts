/**
 * Chấm điểm tự động một câu kiểm thử hồi quy Central (thuần — không I/O, có kiểm thử đơn vị).
 */
import { hasCjk } from "../llm-guard"
import {
  DEFAULT_MAX_MS,
  DEFAULT_TOOL_MAX_MS,
  MIN_ANSWER_CHARS,
  type RegressionCase,
} from "./regression-cases"

export interface CaseOutcome {
  /** Nhận được câu trả lời hợp lệ (HTTP ok + status success). */
  ok: boolean
  answer: string
  functionsCalled: string[]
  latencyMs: number
  error?: string | null
}

export interface CheckResult {
  name: string
  passed: boolean
  detail?: string
}

export interface CaseGrade {
  passed: boolean
  /** 0–100: tỉ lệ tiêu chí đạt. */
  score: number
  checks: CheckResult[]
}

/** Chuẩn hoá để so khớp: chữ thường, bỏ dấu tiếng Việt, đ→d, gộp khoảng trắng. */
export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
}

// So khớp trên chữ thường CÓ dấu (NFC) để phân biệt "đồng" (tiền) với "dòng", "ngàn" với "ngân"…
const NUMERIC_CLAIM_PATTERNS: { name: string; re: RegExp }[] = [
  // Số tiền: 500 triệu, 1,5 tỷ, 20.000 USD, 10.000 đồng…
  { name: "money", re: /\d[\d.,]*\s*(?:usd|vnđ|vnd|đồng(?!\s*(?:ý|nghiệp|tác|thời|bộ|hành|hồ|đẳng))|triệu|tỷ(?!\s*lệ)|nghìn|ngàn|eur\b|euro|gbp|\$)/gu },
  { name: "money", re: /(?:\$|€|£|usd\s?)\s?\d[\d.,]*/gu },
  // Phần trăm
  { name: "percent", re: /\d+(?:[.,]\d+)?\s*%/gu },
  // Ngày cụ thể: 15/11/2026, 15-11-2026, "ngày 15 tháng 11"
  { name: "date", re: /(?<![\d/-])\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?![\d/-])/gu },
  { name: "date", re: /ngày\s+\d{1,2}\s*(?:tháng|\/)\s*\d{1,2}/gu },
  // Chỉ số trắc lượng: impact factor, h-index, citescore, sjr kèm số
  { name: "metric", re: /(?:impact factor|(?<![\p{L}])if(?![\p{L}])|h-index|h index|chỉ số h|citescore|(?<![\p{L}])sjr(?![\p{L}]))[^0-9\n]{0,15}\d+(?:[.,]\d+)?/gu },
]

/** Liệt kê các "số liệu cụ thể" trong câu trả lời (năm đơn thuần như 2026, hay Q1/Q2 KHÔNG tính). */
export function findNumericClaims(text: string): string[] {
  const n = (text || "").normalize("NFC").toLowerCase()
  const out: string[] = []
  for (const { re } of NUMERIC_CLAIM_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(n))) {
      out.push(m[0].trim())
      if (out.length >= 10) return out
    }
  }
  return out
}

function safeRegex(src: string): RegExp | null {
  try {
    return new RegExp(src, "i")
  } catch {
    return null
  }
}

const short = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s)

export function gradeCase(c: RegressionCase, o: CaseOutcome): CaseGrade {
  const e = c.expect
  const checks: CheckResult[] = []
  const answer = o.answer || ""
  const norm = normalizeText(answer)
  const called = (o.functionsCalled || []).map((f) => String(f))
  const add = (name: string, passed: boolean, detail?: string) => checks.push({ name, passed, ...(detail ? { detail } : {}) })

  add("responded", o.ok && answer.trim().length >= MIN_ANSWER_CHARS, o.ok ? (answer.trim().length < MIN_ANSWER_CHARS ? "câu trả lời quá ngắn/rỗng" : undefined) : short(o.error || "không có phản hồi"))

  if (e.callAny && e.callAny.length > 0) {
    const hit = called.some((f) => e.callAny!.some((x) => f.toLowerCase().includes(x.toLowerCase())))
    add("callAny", hit, hit ? called.join(", ") : `đã gọi: ${called.join(", ") || "(không)"}; cần: ${e.callAny.join(" | ")}`)
  }
  if (e.noCall) {
    add("noCall", called.length === 0, called.length ? `đã gọi: ${called.join(", ")}` : undefined)
  }
  if (e.containsAny && e.containsAny.length > 0) {
    const hit = e.containsAny.find((x) => norm.includes(normalizeText(x)))
    add("containsAny", !!hit, hit ? `có «${hit}»` : `thiếu một trong: ${e.containsAny.join(" | ")}`)
  }
  if (e.containsAll && e.containsAll.length > 0) {
    const missing = e.containsAll.filter((x) => !norm.includes(normalizeText(x)))
    add("containsAll", missing.length === 0, missing.length ? `thiếu: ${missing.join(", ")}` : undefined)
  }
  if (e.notContains && e.notContains.length > 0) {
    const bad = e.notContains.filter((x) => norm.includes(normalizeText(x)))
    add("notContains", bad.length === 0, bad.length ? `có: ${bad.join(", ")}` : undefined)
  }
  if (e.notMatch && e.notMatch.length > 0) {
    const bad: string[] = []
    for (const src of e.notMatch) {
      const re = safeRegex(src)
      const m = re ? answer.match(re) : null
      if (m) bad.push(m[0])
    }
    add("notMatch", bad.length === 0, bad.length ? `khớp: ${bad.map((b) => short(b, 40)).join(", ")}` : undefined)
  }
  if (e.noNumbersWithoutTool) {
    const claims = called.length === 0 ? findNumericClaims(answer) : []
    add("noNumbersWithoutTool", claims.length === 0, claims.length ? `số liệu không có nguồn: ${claims.slice(0, 5).join(", ")}` : undefined)
  }
  // Áp cho mọi câu: không lẫn chữ Hán/Nhật/Hàn.
  add("noCjk", !hasCjk(answer), hasCjk(answer) ? "có chữ Hán/Nhật/Hàn" : undefined)
  if (e.maxChars) add("maxChars", answer.length <= e.maxChars, answer.length > e.maxChars ? `${answer.length} > ${e.maxChars} ký tự` : undefined)
  const maxMs = e.maxMs ?? (e.callAny?.length ? DEFAULT_TOOL_MAX_MS : DEFAULT_MAX_MS)
  add("maxMs", o.latencyMs <= maxMs, o.latencyMs > maxMs ? `${o.latencyMs} ms > ${maxMs} ms` : undefined)

  // Không có phản hồi → mọi tiêu chí coi như trượt (tránh "đạt" giả vì câu trả lời rỗng không chứa gì sai).
  if (!checks[0].passed) {
    for (const ch of checks) ch.passed = false
  }
  const passedCount = checks.filter((x) => x.passed).length
  const score = checks.length ? Math.round((passedCount / checks.length) * 10000) / 100 : 0
  return { passed: passedCount === checks.length, score, checks }
}

export interface RunSummary {
  total: number
  passed: number
  /** Điểm trung bình các câu (0–100). */
  score: number | null
  avgLatencyMs: number | null
}

export function summarizeGrades(items: Array<{ passed: boolean; score: number; latencyMs?: number | null }>): RunSummary {
  if (items.length === 0) return { total: 0, passed: 0, score: null, avgLatencyMs: null }
  const passed = items.filter((x) => x.passed).length
  const score = Math.round((items.reduce((s, x) => s + (Number(x.score) || 0), 0) / items.length) * 100) / 100
  const lat = items.map((x) => x.latencyMs).filter((x): x is number => typeof x === "number" && x >= 0)
  return {
    total: items.length,
    passed,
    score,
    avgLatencyMs: lat.length ? Math.round(lat.reduce((s, x) => s + x, 0) / lat.length) : null,
  }
}

export interface CaseDiff {
  case_id: string
  before: boolean | null
  after: boolean | null
  change: "regressed" | "fixed" | "same_pass" | "same_fail" | "new" | "removed"
}

/** So sánh kết quả 2 lần chạy theo case_id. */
export function compareRuns(
  prev: Array<{ case_id: string; passed: boolean }>,
  cur: Array<{ case_id: string; passed: boolean }>
): { diffs: CaseDiff[]; regressed: number; fixed: number } {
  const p = new Map(prev.map((r) => [r.case_id, r.passed]))
  const c = new Map(cur.map((r) => [r.case_id, r.passed]))
  const ids = Array.from(new Set([...p.keys(), ...c.keys()]))
  const diffs: CaseDiff[] = ids.map((id) => {
    const before = p.has(id) ? !!p.get(id) : null
    const after = c.has(id) ? !!c.get(id) : null
    let change: CaseDiff["change"]
    if (before === null) change = "new"
    else if (after === null) change = "removed"
    else if (before && !after) change = "regressed"
    else if (!before && after) change = "fixed"
    else change = after ? "same_pass" : "same_fail"
    return { case_id: id, before, after, change }
  })
  return {
    diffs,
    regressed: diffs.filter((d) => d.change === "regressed").length,
    fixed: diffs.filter((d) => d.change === "fixed").length,
  }
}
