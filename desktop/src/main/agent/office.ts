/**
 * Trích văn bản thêm định dạng (0.3.0) — chỉ đọc, không cần Office/LibreOffice:
 *  - .pptx: chữ trong từng trang chiếu + ghi chú người trình bày;
 *  - .odt/.odp (OpenDocument): đoạn văn/tiêu đề trong content.xml;
 *  - .ipynb (Jupyter): mã nguồn + markdown của từng ô (không lấy kết quả chạy);
 *  - ảnh: kích thước (PNG/JPEG/GIF/WebP/BMP) để trợ lý mô tả được tệp — mô hình hiện không «xem» được ảnh.
 */
import { strFromU8, unzipSync, type Unzipped } from "fflate"
import { decodeXml } from "./docx"

export class OfficeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OfficeError"
  }
}

function unzip(buf: Uint8Array, filter: (name: string) => boolean, label: string): Unzipped {
  try {
    return unzipSync(buf, { filter: (f) => filter(f.name) })
  } catch {
    throw new OfficeError(`Tệp ${label} bị hỏng hoặc không đúng định dạng`)
  }
}

/** Văn bản các đoạn <a:p> (DrawingML) — mỗi đoạn một dòng. */
function drawingParagraphs(xml: string): string[] {
  const out: string[] = []
  for (const p of xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? []) {
    const parts: string[] = []
    for (const m of p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>|<a:br\b[^>]*\/>|<a:tab\b[^>]*\/>/g)) {
      if (m[1] !== undefined) parts.push(decodeXml(m[1]))
      else parts.push(m[0].startsWith("<a:br") ? " " : "\t")
    }
    const line = parts.join("").replace(/\s+$/, "")
    if (line.trim()) out.push(line)
  }
  return out
}

export function extractPptxText(buf: Uint8Array, opts: { maxSlides?: number } = {}): string {
  const maxSlides = opts.maxSlides ?? 400
  const files = unzip(buf, (n) => /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/.test(n), ".pptx")
  const num = (n: string) => Number(/(\d+)\.xml$/.exec(n)?.[1] ?? 0)
  const slides = Object.keys(files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => num(a) - num(b))
  if (slides.length === 0) throw new OfficeError("Tệp .pptx không có trang chiếu nào")
  const out: string[] = []
  for (const name of slides.slice(0, maxSlides)) {
    const n = num(name)
    const lines = drawingParagraphs(strFromU8(files[name]))
    out.push(`--- Trang chiếu ${n} ---`)
    out.push(...(lines.length ? lines : ["(không có chữ)"]))
    const notes = files[`ppt/notesSlides/notesSlide${n}.xml`]
    if (notes) {
      // Bỏ số trang chiếu tự động trong ghi chú (chỉ là một con số).
      const nl = drawingParagraphs(strFromU8(notes)).filter((l) => !/^\d+$/.test(l.trim()))
      if (nl.length) out.push("Ghi chú:", ...nl)
    }
    out.push("")
  }
  if (slides.length > maxSlides) out.push(`… (còn ${slides.length - maxSlides} trang chiếu chưa đọc)`)
  return out.join("\n").trim()
}

/** .odt/.odp/.ods: đoạn văn (text:p), tiêu đề (text:h) trong content.xml. */
export function extractOdfText(buf: Uint8Array): string {
  const files = unzip(buf, (n) => n === "content.xml", "OpenDocument")
  const xml = files["content.xml"]
  if (!xml) throw new OfficeError("Tệp OpenDocument thiếu content.xml")
  const s = strFromU8(xml)
  const out: string[] = []
  for (const m of s.matchAll(/<text:(p|h)\b[^>]*?(?:\/>|>([\s\S]*?)<\/text:\1>)/g)) {
    const inner = (m[2] ?? "")
      .replace(/<text:tab\s*\/>/g, "\t")
      .replace(/<text:line-break\s*\/>/g, " ")
      .replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_x, c: string | undefined) => " ".repeat(Math.min(50, Number(c ?? 1))))
      .replace(/<[^>]+>/g, "")
    const line = decodeXml(inner).replace(/\s+$/, "")
    out.push(m[1] === "h" && line ? `# ${line}` : line)
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/** .ipynb: ô markdown giữ nguyên, ô mã bọc ```. */
export function extractIpynbText(raw: string): string {
  let nb: { cells?: { cell_type?: string; source?: string | string[] }[]; metadata?: { kernelspec?: { language?: string } } }
  try {
    nb = JSON.parse(raw)
  } catch {
    throw new OfficeError("Tệp .ipynb không phải JSON hợp lệ")
  }
  const lang = nb.metadata?.kernelspec?.language ?? "python"
  const out: string[] = []
  for (const [i, c] of (nb.cells ?? []).entries()) {
    const src = Array.isArray(c.source) ? c.source.join("") : String(c.source ?? "")
    out.push(`--- Ô ${i + 1} (${c.cell_type ?? "?"}) ---`)
    out.push(c.cell_type === "code" ? "```" + lang + "\n" + src + "\n```" : src)
  }
  return out.join("\n").trim()
}

/** Kích thước ảnh từ phần đầu tệp (không giải mã ảnh). */
export function imageSize(buf: Uint8Array): { width: number; height: number; type: string } | null {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { type: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  if (b.length >= 10 && b.toString("latin1", 0, 3) === "GIF") return { type: "gif", width: b.readUInt16LE(6), height: b.readUInt16LE(8) }
  if (b.length >= 26 && b.toString("latin1", 0, 2) === "BM") return { type: "bmp", width: b.readInt32LE(18), height: Math.abs(b.readInt32LE(22)) }
  if (b.length >= 30 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") {
    const kind = b.toString("latin1", 12, 16)
    if (kind === "VP8X") return { type: "webp", width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) }
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21)
      return { type: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (kind === "VP8 ") return { type: "webp", width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++
        continue
      }
      const marker = b[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2
        continue
      }
      const len = b.readUInt16BE(i + 2)
      // SOF0..SOF15 trừ DHT(C4), JPG(C8), DAC(CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "jpeg", height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
      }
      i += 2 + len
    }
  }
  return null
}
