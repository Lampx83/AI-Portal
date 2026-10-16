/**
 * Đọc nội dung tệp cho trợ lý: văn bản thô (UTF-8), .docx/.xlsx (fflate), .pdf (unpdf/pdf.js).
 * Văn bản trả về đã chuẩn hoá xuống dòng thành "\n"; thông tin BOM/CRLF giữ lại để ghi trả đúng kiểu.
 */
import fs from "fs"
import { extOf } from "../fileTypes"
import { extractDocxText, extractXlsxText } from "./docx"
import { AGENT_LIMITS, EXTRACT_EXTENSIONS } from "./writePolicy"

export type AgentFileFormat = "text" | "docx" | "xlsx" | "pdf"

export interface AgentFileContent {
  format: AgentFileFormat
  text: string
  /** Kích thước tệp (byte). */
  size: number
  /** true nếu tệp văn bản lớn hơn giới hạn đọc và đã bị cắt. */
  truncated: boolean
  /** Văn bản gốc dùng CRLF. */
  crlf: boolean
  bom: boolean
}

export class ExtractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExtractError"
  }
}

export function formatOf(relPath: string): AgentFileFormat {
  const ext = extOf(relPath)
  if (ext === "docx" || ext === "xlsx" || ext === "pdf") return ext
  return "text"
}

export function decodeText(buf: Buffer): { text: string; crlf: boolean; bom: boolean } {
  if (buf.subarray(0, 8192).includes(0)) throw new ExtractError("Tệp không phải văn bản (nhị phân) — trợ lý không đọc được")
  let text = buf.toString("utf8")
  const bom = text.charCodeAt(0) === 0xfeff
  if (bom) text = text.slice(1)
  const crlfCount = (text.match(/\r\n/g) ?? []).length
  const lfCount = (text.match(/\n/g) ?? []).length
  const crlf = crlfCount > 0 && crlfCount >= lfCount / 2
  return { text: text.replace(/\r\n?/g, "\n"), crlf, bom }
}

/** Chuyển văn bản "\n" về bytes theo kiểu của tệp gốc. */
export function encodeText(text: string, style: { crlf: boolean; bom: boolean }): Buffer {
  let t = text.replace(/\r\n?/g, "\n")
  if (style.crlf) t = t.replace(/\n/g, "\r\n")
  const body = Buffer.from(t, "utf8")
  return style.bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]) : body
}

async function extractPdf(buf: Buffer): Promise<string> {
  // unpdf có bản CJS (index.cjs) tự import bản pdf.js đóng gói sẵn.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const unpdf = require("unpdf") as typeof import("unpdf")
  const pdf = await unpdf.getDocumentProxy(new Uint8Array(buf))
  const pages = Math.min(pdf.numPages, 300)
  const out: string[] = []
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    let line = ""
    const lines: string[] = []
    for (const it of tc.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof it.str !== "string") continue
      line += it.str
      if (it.hasEOL) {
        lines.push(line)
        line = ""
      }
    }
    if (line) lines.push(line)
    out.push(`--- Trang ${i} ---\n${lines.join("\n").replace(/[ \t]+\n/g, "\n").trim()}`)
  }
  if (pdf.numPages > pages) out.push(`… (còn ${pdf.numPages - pages} trang chưa đọc)`)
  await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => {})
  const text = out.join("\n\n")
  if (!text.replace(/--- Trang \d+ ---/g, "").trim()) throw new ExtractError("PDF không có lớp văn bản (có thể là bản quét ảnh) — trợ lý chưa đọc được")
  return text
}

/** Đọc nội dung một tệp (absPath đã qua pathGuard). */
export async function readForAgent(absPath: string, relPath: string): Promise<AgentFileContent> {
  const st = fs.statSync(absPath)
  if (!st.isFile()) throw new ExtractError("Không phải tệp")
  const format = formatOf(relPath)
  if (EXTRACT_EXTENSIONS.has(format)) {
    if (st.size > AGENT_LIMITS.maxExtractBytes) throw new ExtractError(`Tệp quá lớn để trích văn bản (${Math.round(st.size / 1048576)} MB)`)
    const buf = fs.readFileSync(absPath)
    let text: string
    if (format === "docx") text = extractDocxText(buf)
    else if (format === "xlsx") text = extractXlsxText(buf)
    else text = await extractPdf(buf)
    return { format, text, size: st.size, truncated: false, crlf: false, bom: false }
  }
  const len = Math.min(st.size, AGENT_LIMITS.maxReadBytes)
  const buf = Buffer.alloc(len)
  const fd = fs.openSync(absPath, "r")
  try {
    fs.readSync(fd, buf, 0, len, 0)
  } finally {
    fs.closeSync(fd)
  }
  const d = decodeText(buf)
  return { format: "text", text: d.text, size: st.size, truncated: st.size > len, crlf: d.crlf, bom: d.bom }
}
