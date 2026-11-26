/**
 * Đọc / sửa / tạo tệp Word (.docx) gọn nhẹ bằng fflate (không cần Word hay LibreOffice).
 *
 * - Trích văn bản: mỗi đoạn (w:p) trong word/document.xml là một dòng; <w:tab/> → tab.
 * - Sửa: thay một cụm văn bản NẰM TRONG MỘT ĐOẠN. Chỉ các thẻ w:t bị chạm tới thay đổi, nên định dạng
 *   (đậm, nghiêng, kiểu đoạn, bảng, hình…) của phần còn lại được giữ nguyên.
 * - Tạo mới: tài liệu đơn giản từ văn bản (dòng "# " → Heading 1, "## " → Heading 2, "### " → Heading 3).
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from "fflate"

const DOC_PATH = "word/document.xml"

export class DocxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DocxError"
  }
}

export function decodeXml(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e: string) => {
    const k = e.toLowerCase()
    if (k === "lt") return "<"
    if (k === "gt") return ">"
    if (k === "amp") return "&"
    if (k === "quot") return '"'
    if (k === "apos") return "'"
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : m
  })
}

export function encodeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Một đoạn văn bản (w:t) hoặc ký tự đặc biệt (tab/xuống dòng) trong một đoạn văn. */
interface Segment {
  kind: "t" | "special"
  text: string
  /** Vị trí thẻ mở w:t (cả thẻ) trong XML. */
  start: number
  end: number
  openTag: string
}

interface Paragraph {
  segments: Segment[]
  text: string
  /** Đoạn chứa đoạn lồng (hộp văn bản) → không sửa. */
  nested: boolean
}

const TOKEN_RE = /<w:p(?=[\s>/])[^>]*?\/>|<w:p(?=[\s>])[^>]*>|<\/w:p>|<w:t(?=[\s>])[^>]*?\/>|(<w:t(?=[\s>])[^>]*>)([^<]*)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)(?=[\s/])[^>]*\/>/g

function parseParagraphs(xml: string): Paragraph[] {
  const out: Paragraph[] = []
  const stack: Paragraph[] = []
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(xml))) {
    const tok = m[0]
    if (tok.startsWith("<w:p") && tok.endsWith("/>") && !tok.startsWith("<w:pP")) {
      out.push({ segments: [], text: "", nested: false })
      continue
    }
    if (tok.startsWith("<w:p")) {
      if (stack.length) stack[stack.length - 1].nested = true
      const p: Paragraph = { segments: [], text: "", nested: false }
      stack.push(p)
      out.push(p)
      continue
    }
    if (tok === "</w:p>") {
      stack.pop()
      continue
    }
    const cur = stack[stack.length - 1]
    if (!cur) continue
    if (m[1] !== undefined) {
      const text = decodeXml(m[2] ?? "")
      cur.segments.push({ kind: "t", text, start: m.index, end: m.index + tok.length, openTag: m[1] })
      cur.text += text
    } else if (tok.startsWith("<w:t") && !tok.startsWith("<w:tab")) {
      // <w:t/> rỗng
      continue
    } else {
      const text = tok.startsWith("<w:tab") ? "\t" : "\n"
      cur.segments.push({ kind: "special", text, start: m.index, end: m.index + tok.length, openTag: "" })
      cur.text += text
    }
  }
  return out
}

function readDocumentXml(buf: Uint8Array): { files: Unzipped; xml: string } {
  let files: Unzipped
  try {
    files = unzipSync(buf)
  } catch {
    throw new DocxError("Tệp .docx bị hỏng hoặc không phải định dạng Word mới (.docx)")
  }
  const doc = files[DOC_PATH]
  if (!doc) throw new DocxError("Tệp .docx thiếu word/document.xml")
  return { files, xml: strFromU8(doc) }
}

/** Trích văn bản: mỗi đoạn một dòng (xuống dòng mềm trong đoạn giữ là "\n" — hiếm). */
export function extractDocxText(buf: Uint8Array): string {
  const { xml } = readDocumentXml(buf)
  return parseParagraphs(xml)
    .map((p) => p.text.replace(/\n/g, " "))
    .join("\n")
}

export interface TextEdit {
  old_text: string
  new_text: string
}

/** Đếm số lần xuất hiện (không chồng lấn). */
export function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let i = 0
  while ((i = hay.indexOf(needle, i)) >= 0) {
    n++
    i += needle.length
  }
  return n
}

/**
 * Áp các thay thế lên .docx. Mỗi `old_text` phải xuất hiện ĐÚNG MỘT lần trong toàn văn bản và nằm gọn trong một đoạn.
 * Trả về bytes mới + văn bản sau khi sửa (để hiện diff).
 */
export function applyDocxEdits(buf: Uint8Array, edits: TextEdit[]): { bytes: Uint8Array; text: string } {
  const { files } = readDocumentXml(buf)
  let xml = strFromU8(files[DOC_PATH])
  for (const [idx, e] of edits.entries()) {
    const label = edits.length > 1 ? ` (sửa #${idx + 1})` : ""
    if (!e.old_text) throw new DocxError(`old_text rỗng${label}`)
    if (/\n/.test(e.new_text) || /\n/.test(e.old_text)) {
      throw new DocxError(`Với .docx, mỗi lần sửa chỉ nằm trong MỘT đoạn (không chứa xuống dòng)${label}. Hãy tách thành nhiều sửa đổi.`)
    }
    const paras = parseParagraphs(xml)
    const fullText = paras.map((p) => p.text).join("\n")
    const total = countOccurrences(fullText, e.old_text)
    if (total === 0) throw new DocxError(`Không tìm thấy đoạn văn bản cần sửa${label}. Hãy đọc lại tệp và chép đúng nguyên văn.`)
    if (total > 1) throw new DocxError(`Đoạn cần sửa xuất hiện ${total} lần${label}. Hãy đưa thêm ngữ cảnh để chỉ còn một chỗ khớp.`)
    const p = paras.find((x) => x.text.includes(e.old_text))
    if (!p) throw new DocxError(`Đoạn cần sửa trải qua nhiều đoạn văn${label}. Hãy sửa từng đoạn một.`)
    if (p.nested) throw new DocxError(`Không sửa được văn bản trong hộp văn bản (text box)${label}.`)
    const from = p.text.indexOf(e.old_text)
    const to = from + e.old_text.length
    // Xác định các segment bị chạm.
    let pos = 0
    const touched: { seg: Segment; segFrom: number; segTo: number }[] = []
    for (const seg of p.segments) {
      const s0 = pos
      const s1 = pos + seg.text.length
      pos = s1
      if (s1 <= from || s0 >= to) continue
      touched.push({ seg, segFrom: Math.max(from, s0) - s0, segTo: Math.min(to, s1) - s0 })
    }
    if (touched.length === 0) throw new DocxError(`Không định vị được đoạn cần sửa${label}`)
    if (touched.some((t) => t.seg.kind !== "t")) {
      throw new DocxError(`Đoạn cần sửa chứa ký tự tab/ngắt dòng của Word${label}. Hãy chọn cụm ngắn hơn, không chứa tab.`)
    }
    // Viết lại: segment đầu nhận văn bản mới; các segment giữa/cuối bỏ phần bị thay.
    const replacements: { start: number; end: number; xml: string }[] = []
    touched.forEach((t, i) => {
      const s = t.seg.text
      let next: string
      if (i === 0) next = s.slice(0, t.segFrom) + e.new_text + (touched.length === 1 ? s.slice(t.segTo) : "")
      else if (i === touched.length - 1) next = s.slice(t.segTo)
      else next = ""
      const open = /xml:space=/.test(t.seg.openTag) ? t.seg.openTag : t.seg.openTag.replace(/^<w:t/, '<w:t xml:space="preserve"')
      replacements.push({ start: t.seg.start, end: t.seg.end, xml: `${open}${encodeXml(next)}</w:t>` })
    })
    for (const r of replacements.sort((a, b) => b.start - a.start)) xml = xml.slice(0, r.start) + r.xml + xml.slice(r.end)
  }
  files[DOC_PATH] = strToU8(xml)
  const bytes = zipSync(files, { level: 6 })
  const text = parseParagraphs(xml)
    .map((p) => p.text.replace(/\n/g, " "))
    .join("\n")
  return { bytes, text }
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
const heading = (id: string, name: string, size: number) =>
  `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${Number(id.slice(-1)) - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${heading("Heading1", "heading 1", 32)}${heading("Heading2", "heading 2", 28)}${heading("Heading3", "heading 3", 26)}</w:styles>`

/** Tạo .docx đơn giản từ văn bản. */
export function createDocxFromText(text: string): Uint8Array {
  const paras = text.replace(/\r\n?/g, "\n").split("\n").map((line) => {
    const m = /^(#{1,3})\s+(.*)$/.exec(line)
    const style = m ? `Heading${m[1].length}` : null
    let body = m ? m[2] : line
    if (!m && /^\s*[-*]\s+/.test(body)) body = body.replace(/^\s*[-*]\s+/, "• ")
    const runs = body
      .split("\t")
      .map((part, i) => (i > 0 ? "<w:r><w:tab/></w:r>" : "") + (part ? `<w:r><w:t xml:space="preserve">${encodeXml(part)}</w:t></w:r>` : ""))
      .join("")
    return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${runs}</w:p>`
  })
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`
  return zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "_rels/.rels": strToU8(ROOT_RELS),
      "word/_rels/document.xml.rels": strToU8(DOC_RELS),
      "word/document.xml": strToU8(doc),
      "word/styles.xml": strToU8(STYLES),
    },
    { level: 6 },
  )
}

/** Trích bảng tính .xlsx thành văn bản dạng CSV theo từng trang tính. */
export function extractXlsxText(buf: Uint8Array, opts: { maxRows?: number; maxCols?: number } = {}): string {
  const maxRows = opts.maxRows ?? 300
  const maxCols = opts.maxCols ?? 40
  let files: Unzipped
  try {
    files = unzipSync(buf, { filter: (f) => f.name.startsWith("xl/") && f.name.endsWith(".xml") || f.name.endsWith(".rels") })
  } catch {
    throw new DocxError("Tệp .xlsx bị hỏng")
  }
  const shared: string[] = []
  const ss = files["xl/sharedStrings.xml"]
  if (ss) {
    const x = strFromU8(ss)
    for (const si of x.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
      shared.push(decodeXml((si.match(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")))
    }
  }
  const wb = files["xl/workbook.xml"] ? strFromU8(files["xl/workbook.xml"]) : ""
  const rels = files["xl/_rels/workbook.xml.rels"] ? strFromU8(files["xl/_rels/workbook.xml.rels"]) : ""
  const relMap = new Map<string, string>()
  for (const r of rels.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = /Id="([^"]+)"/.exec(r)?.[1]
    const target = /Target="([^"]+)"/.exec(r)?.[1]
    if (id && target) relMap.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""))
  }
  const sheets: { name: string; path: string }[] = []
  for (const s of wb.match(/<sheet\b[^>]*>/g) ?? []) {
    const name = decodeXml(/name="([^"]*)"/.exec(s)?.[1] ?? "Sheet")
    const rid = /r:id="([^"]+)"/.exec(s)?.[1]
    const target = rid ? relMap.get(rid) : undefined
    if (target) sheets.push({ name, path: `xl/${target}` })
  }
  const colIndex = (ref: string) => {
    const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A"
    let n = 0
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
  }
  const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const out: string[] = []
  for (const sh of sheets) {
    const data = files[sh.path]
    if (!data) continue
    const x = strFromU8(data)
    out.push(`## Trang tính: ${sh.name}`)
    let rowCount = 0
    let more = false
    for (const row of x.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
      if (rowCount >= maxRows) {
        more = true
        break
      }
      const cells: string[] = []
      for (const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
        const ref = /\br="([A-Z]+)\d+"/.exec(c)?.[1] ?? ""
        const t = /\bt="([^"]+)"/.exec(c)?.[1] ?? "n"
        const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1]
        let val = ""
        if (t === "s" && v !== undefined) val = shared[Number(v)] ?? ""
        else if (t === "inlineStr") val = decodeXml((c.match(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g) ?? []).map((q) => q.replace(/<[^>]+>/g, "")).join(""))
        else if (t === "b") val = v === "1" ? "TRUE" : "FALSE"
        else if (v !== undefined) val = decodeXml(v)
        const ci = ref ? colIndex(ref) : cells.length
        if (ci >= maxCols) continue
        while (cells.length < ci) cells.push("")
        cells[ci] = csvCell(val)
      }
      out.push(cells.join(","))
      rowCount++
    }
    if (more) out.push(`… (còn thêm dòng, chỉ hiện ${maxRows} dòng đầu)`)
    out.push("")
  }
  return out.join("\n").trim()
}
