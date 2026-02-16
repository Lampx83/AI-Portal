import type { RawDataRow } from "./types"

/** Tách một dòng CSV thành mảng giá trị (hỗ trợ dấu phẩy trong ngoặc kép). */
export function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let cur = ""
  let inQuotes = false
  for (let j = 0; j < line.length; j++) {
    const c = line[j]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if ((c === "," && !inQuotes) || (c === "\t" && !inQuotes)) {
      values.push(cur.replace(/^"|"$/g, "").trim())
      cur = ""
    } else {
      cur += c
    }
  }
  values.push(cur.replace(/^"|"$/g, "").trim())
  return values
}

/** Parse CSV text thành mảng object (dòng đầu = header). */
export function parseCSVToRows(text: string): RawDataRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const headerValues = parseCSVLine(lines[0]!)
  const headers = headerValues.map((h, idx) => (h?.trim() ? h.trim() : `C${idx}`))
  const rows: RawDataRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]!)
    const obj: RawDataRow = {}
    headers.forEach((h, j) => (obj[h] = values[j] ?? ""))
    rows.push(obj)
  }
  return rows
}
