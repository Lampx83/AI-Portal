/**
 * Tóm tắt bảng tính (Excel/CSV) để đưa vào ngữ cảnh Trợ lý chính.
 *
 * Trước đây mỗi sheet chỉ bị cắt còn 120 dòng đầu: mô hình không biết tệp thật có bao nhiêu dòng, cột nào là số,
 * giá trị nằm trong khoảng nào — nên hay trả lời như thể 120 dòng đó là toàn bộ dữ liệu.
 * Giờ với sheet lớn ta gửi TÓM TẮT CẤU TRÚC (số dòng, số cột, tên cột, kiểu dữ liệu đoán được, thống kê đơn giản cho
 * cột số, vài giá trị phổ biến cho cột chữ) + 20 dòng mẫu. Sheet nhỏ vẫn gửi đầy đủ như cũ.
 *
 * Hàm thuần (không I/O) để kiểm thử được.
 */

/** Sheet có tối đa chừng này dòng dữ liệu (không tính dòng tiêu đề) thì gửi nguyên bảng. */
export const SMALL_SHEET_MAX_ROWS = 60
/** Số dòng mẫu gửi kèm tóm tắt của sheet lớn. */
export const SAMPLE_ROWS = 20
/** Số cột tối đa đưa vào (bảng rất rộng: cột thừa được đếm nhưng không mô tả). */
export const MAX_COLS = 40
/** Độ dài tối đa một ô khi in. */
const MAX_CELL_CHARS = 80

/** Dấu hiệu nhận biết văn bản đã được tóm tắt (orchestrator dùng để nhắc người dùng mở Quantis). */
export const LARGE_TABLE_MARKER = "[BẢNG TÍNH LỚN — TÓM TẮT CẤU TRÚC]"

export type ColumnType = "số" | "ngày" | "đúng/sai" | "chữ" | "trống"

export interface ColumnSummary {
  name: string
  type: ColumnType
  nonEmpty: number
  missing: number
  distinct: number
  min?: number
  max?: number
  mean?: number
  median?: number
  /** Giá trị hay gặp nhất (cột chữ / đúng-sai), dạng "giá trị (số lần)". */
  top?: string[]
  /** Mỗi dòng một giá trị khác nhau (cột mã/định danh/họ tên) — top khi đó là vài ví dụ. */
  unique?: boolean
}

export interface SheetSummary {
  sheetName: string
  /** Số dòng dữ liệu (không tính dòng tiêu đề). */
  rowCount: number
  colCount: number
  columns: ColumnSummary[]
  large: boolean
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10)
  return String(v).replace(/[\t\r\n]+/g, " ").trim()
}

function clip(s: string, max = MAX_CELL_CHARS): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s
}

/** Chuỗi có phải số không (chấp nhận "1.234,5" kiểu Việt, "1,234.5", "12%", khoảng trắng). */
export function parseNumeric(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "boolean" || v === null || v === undefined || v instanceof Date) return null
  let s = String(v).trim().replace(/\s+/g, "")
  if (!s) return null
  let pct = false
  if (s.endsWith("%")) {
    pct = true
    s = s.slice(0, -1)
  }
  if (!/^[-+]?[\d.,]+$/.test(s)) return null
  const lastDot = s.lastIndexOf(".")
  const lastComma = s.lastIndexOf(",")
  if (lastDot >= 0 && lastComma >= 0) {
    // dấu xuất hiện sau cùng là dấu thập phân
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  } else if (lastComma >= 0) {
    // "1,5" → 1.5 ; "1,234,567" → 1234567
    s = /^[-+]?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".")
  } else if (lastDot >= 0 && /^[-+]?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, "") // "1.234.567" kiểu Việt
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return pct ? n / 100 : n
}

const DATE_RE = /^(\d{4}-\d{1,2}-\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})$/
const BOOL_VALUES = new Set(["true", "false", "đúng", "sai", "có", "không", "yes", "no", "x"])

function round(n: number): number {
  if (!Number.isFinite(n)) return n
  const abs = Math.abs(n)
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : 4
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function formatNum(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—"
  return String(round(n))
}

/** Đoán kiểu + thống kê cho một cột (values: các ô của cột, không gồm tiêu đề). */
export function summarizeColumn(name: string, values: unknown[]): ColumnSummary {
  const texts = values.map(cellText)
  const filled = values.filter((_, i) => texts[i] !== "")
  const filledTexts = texts.filter((t) => t !== "")
  const nonEmpty = filled.length
  const missing = values.length - nonEmpty
  const distinct = new Set(filledTexts.map((t) => t.toLowerCase())).size
  const base: ColumnSummary = { name, type: "trống", nonEmpty, missing, distinct }
  if (nonEmpty === 0) return base

  const nums = filled.map(parseNumeric)
  const numCount = nums.filter((n) => n !== null).length
  const dateCount = filled.filter((v, i) => v instanceof Date || DATE_RE.test(filledTexts[i])).length
  const boolCount = filled.filter((v, i) => typeof v === "boolean" || BOOL_VALUES.has(filledTexts[i].toLowerCase())).length

  const topValues = (): string[] => {
    const counts = new Map<string, { label: string; n: number }>()
    for (const t of filledTexts) {
      const k = t.toLowerCase()
      const cur = counts.get(k)
      if (cur) cur.n++
      else counts.set(k, { label: t, n: 1 })
    }
    return [...counts.values()]
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
      .slice(0, 5)
      .map((c) => `${clip(c.label, 40)} (${c.n})`)
  }

  // Ngưỡng 90% để chịu được vài ô ghi chú lẫn trong cột số.
  if (dateCount / nonEmpty >= 0.9 && dateCount > numCount * 0.5) {
    const sorted = filledTexts
      .map((t, i) => (filled[i] instanceof Date ? cellText(filled[i]) : t))
      .sort()
    return { ...base, type: "ngày", top: [`từ ${sorted[0]}`, `đến ${sorted[sorted.length - 1]}`] }
  }
  if (boolCount / nonEmpty >= 0.95 && distinct <= 3) {
    return { ...base, type: "đúng/sai", top: topValues() }
  }
  if (numCount / nonEmpty >= 0.9) {
    const arr = (nums.filter((n) => n !== null) as number[]).sort((a, b) => a - b)
    const sum = arr.reduce((s, n) => s + n, 0)
    const mid = Math.floor(arr.length / 2)
    const median = arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
    return {
      ...base,
      type: "số",
      min: arr[0],
      max: arr[arr.length - 1],
      mean: sum / arr.length,
      median,
      ...(distinct <= 10 ? { top: topValues() } : {}),
    }
  }
  if (distinct === nonEmpty && nonEmpty > 5) {
    return { ...base, type: "chữ", unique: true, top: filledTexts.slice(0, 3).map((t) => clip(t, 40)) }
  }
  return { ...base, type: "chữ", top: topValues() }
}

/** Chỉ số dòng tiêu đề: dòng đầu tiên có ≥ 1 ô không rỗng (sheet_to_json đã bỏ dòng trống). */
function headerIndex(rows: unknown[][]): number {
  const i = rows.findIndex((r) => Array.isArray(r) && r.some((c) => cellText(c) !== ""))
  return i < 0 ? 0 : i
}

export function summarizeSheet(sheetName: string, rows: unknown[][]): SheetSummary {
  const hi = headerIndex(rows)
  const header = (rows[hi] ?? []).map(cellText)
  const data = rows.slice(hi + 1).filter((r) => Array.isArray(r) && r.some((c) => cellText(c) !== ""))
  const colCount = Math.max(header.length, ...data.map((r) => r.length), 0)
  const columns: ColumnSummary[] = []
  for (let c = 0; c < Math.min(colCount, MAX_COLS); c++) {
    const name = header[c] || `Cột ${c + 1}`
    columns.push(summarizeColumn(name, data.map((r) => r[c])))
  }
  return { sheetName, rowCount: data.length, colCount, columns, large: data.length > SMALL_SHEET_MAX_ROWS }
}

function rowLine(row: unknown[], cols: number): string {
  return Array.from({ length: cols }, (_, c) => clip(cellText(row?.[c]))).join("\t")
}

/** Văn bản mô tả một sheet: sheet nhỏ → nguyên bảng; sheet lớn → tóm tắt cấu trúc + 20 dòng mẫu. */
export function renderSheet(sheetName: string, rows: unknown[][]): { text: string; large: boolean } {
  const s = summarizeSheet(sheetName, rows)
  const hi = headerIndex(rows)
  const header = rows[hi] ?? []
  const data = rows.slice(hi + 1).filter((r) => Array.isArray(r) && r.some((c) => cellText(c) !== ""))
  const cols = Math.min(s.colCount, MAX_COLS)
  const lines: string[] = []
  if (!s.large) {
    lines.push(`[Sheet: ${sheetName}] (${s.rowCount} dòng dữ liệu × ${s.colCount} cột — đầy đủ)`)
    lines.push(rowLine(header, cols))
    for (const r of data) lines.push(rowLine(r, cols))
    return { text: lines.join("\n"), large: false }
  }
  lines.push(`[Sheet: ${sheetName}] ${s.rowCount} dòng dữ liệu × ${s.colCount} cột${s.colCount > MAX_COLS ? ` (mô tả ${MAX_COLS} cột đầu)` : ""}`)
  lines.push("Cấu trúc cột (tên | kiểu | số ô có giá trị / thiếu | số giá trị khác nhau | thống kê):")
  for (const c of s.columns) {
    let stats = ""
    if (c.type === "số") {
      stats = `min ${formatNum(c.min)}, max ${formatNum(c.max)}, trung bình ${formatNum(c.mean)}, trung vị ${formatNum(c.median)}`
      if (c.top?.length) stats += `; giá trị: ${c.top.join(", ")}`
    } else if (c.unique) {
      stats = `mỗi dòng một giá trị khác nhau (ví dụ: ${c.top?.join(", ") ?? ""})`
    } else if (c.top?.length) {
      stats = c.type === "ngày" ? c.top.join(" ") : `hay gặp: ${c.top.join(", ")}`
    }
    lines.push(`- ${clip(c.name, 60)} | ${c.type} | ${c.nonEmpty}/${c.missing} | ${c.distinct}${stats ? ` | ${stats}` : ""}`)
  }
  lines.push(`${SAMPLE_ROWS} dòng mẫu đầu tiên (trên tổng ${s.rowCount} dòng):`)
  lines.push(rowLine(header, cols))
  for (const r of data.slice(0, SAMPLE_ROWS)) lines.push(rowLine(r, cols))
  return { text: lines.join("\n"), large: true }
}

/**
 * Ghép mô tả nhiều sheet thành văn bản cho mô hình. Có sheet lớn thì đặt LARGE_TABLE_MARKER ở đầu
 * (để orchestrator biết mà nhắc người dùng dùng công cụ phân tích chuyên dụng).
 */
export function renderWorkbook(sheets: { name: string; rows: unknown[][] }[], fileName?: string): { text: string; large: boolean } {
  const parts: string[] = []
  let large = false
  for (const sh of sheets) {
    if (!sh.rows.length) continue
    const r = renderSheet(sh.name, sh.rows)
    large = large || r.large
    parts.push(r.text)
  }
  if (!parts.length) return { text: "", large: false }
  const head = large
    ? `${LARGE_TABLE_MARKER}${fileName ? ` Tệp ${fileName}.` : ""} Dữ liệu quá lớn để đưa toàn bộ: dưới đây là tóm tắt cấu trúc và dòng mẫu, KHÔNG phải toàn bộ dữ liệu. Các con số thống kê ở đây được tính trên toàn bộ dòng của sheet.\n\n`
    : ""
  return { text: head + parts.join("\n\n"), large }
}
