/**
 * Fetch và parse nội dung file từ MinIO/URL để gửi lên OpenAI.
 * Hỗ trợ: PDF, DOCX, Excel (.xlsx, .xls), TXT/MD/CSV (text), ảnh (base64 cho Vision API)
 */
import { getSetting } from "./settings"

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i
const TEXT_EXT = /\.(txt|md|csv|json)(\?|$)/i
const PDF_EXT = /\.pdf(\?|$)/i
const DOCX_EXT = /\.(docx|doc)(\?|$)/i
const EXCEL_EXT = /\.(xlsx|xls)(\?|$)/i

export type ParsedDocument =
  | { type: "text"; content: string; filename?: string }
  | { type: "image"; base64: string; mimeType: string; filename?: string }
  | { type: "error"; filename?: string; error: string }

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const FETCH_TIMEOUT_MS = 30_000

/**
 * Chuyển URL MinIO từ public sang internal để backend fetch được (khi public IP không reachable từ container).
 * VD: http://203.113.132.48:8008/... -> http://10.2.11.23:8008/...
 */
function rewriteMinioUrlForInternalFetch(url: string): string {
  const publicHost = getSetting("MINIO_ENDPOINT_PUBLIC")
  const internalHost = getSetting("MINIO_ENDPOINT", "localhost")
  const port = getSetting("MINIO_PORT", "9000")
  if (!publicHost || !internalHost || publicHost === internalHost) return url
  try {
    const u = new URL(url)
    if (u.hostname === publicHost) {
      u.hostname = internalHost
      u.port = port
      return u.toString()
    }
    return url
  } catch {
    return url
  }
}

export async function fetchAndParseDocument(url: string): Promise<ParsedDocument> {
  try {
    const fetchUrl = rewriteMinioUrlForInternalFetch(url)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { Accept: "*/*" },
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return { type: "error", error: `HTTP ${res.status}: ${res.statusText}` }
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_FILE_SIZE) {
      return { type: "error", error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }
    }

    const filename = url.split("/").pop()?.split("?")[0] || "file"
    const ext = filename.toLowerCase().match(/\.([a-z0-9]+)(\?|$)/)?.[1] || ""

    // Ảnh: base64 cho Vision API
    if (IMAGE_EXT.test(url)) {
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
      }
      const mimeType = mimeMap[ext] || "image/png"
      const base64 = buf.toString("base64")
      return { type: "image", base64, mimeType, filename }
    }

    // File text thuần
    if (TEXT_EXT.test(url)) {
      const content = buf.toString("utf-8")
      return { type: "text", content, filename }
    }

    // PDF: extract text
    if (PDF_EXT.test(url)) {
      try {
        const pdfParse = (await import("pdf-parse")).default
        const data = await pdfParse(buf)
        const text = data?.text?.trim() || ""
        if (!text) {
          return { type: "error", filename, error: "Không trích xuất được text từ PDF" }
        }
        return { type: "text", content: text, filename }
      } catch (e: any) {
        return { type: "error", filename, error: e?.message || "Lỗi parse PDF" }
      }
    }

    // DOCX: extract text bằng mammoth
    if (DOCX_EXT.test(url)) {
      try {
        const mammoth = await import("mammoth")
        const result = await mammoth.default.extractRawText({ buffer: buf })
        const text = result?.value?.trim() || ""
        if (!text) {
          return { type: "error", filename, error: "Không trích xuất được text từ DOCX" }
        }
        return { type: "text", content: text, filename }
      } catch (e: any) {
        return { type: "error", filename, error: e?.message || "Lỗi parse DOCX" }
      }
    }

    // Excel (.xlsx, .xls): extract dữ liệu bảng sang text
    if (EXCEL_EXT.test(url)) {
      try {
        const XLSX = await import("xlsx")
        const workbook = XLSX.default.read(buf, { type: "buffer" })
        const parts: string[] = []

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const data = XLSX.default.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: "",
            blankrows: false,
          }) as unknown[][]

          if (data.length === 0) continue

          parts.push(`[Sheet: ${sheetName}]`)
          const rows = data.map((row) =>
            (Array.isArray(row) ? row : [row])
              .map((c) => String(c ?? "").replace(/\t/g, " ").replace(/\n/g, " "))
              .join("\t")
          )
          parts.push(rows.join("\n"))
          parts.push("")
        }

        const text = parts.join("\n").trim()
        if (!text) {
          return { type: "error", filename, error: "Không trích xuất được dữ liệu từ Excel" }
        }
        return { type: "text", content: text, filename }
      } catch (e: any) {
        return { type: "error", filename, error: e?.message || "Lỗi parse Excel" }
      }
    }

    return { type: "error", filename, error: `Định dạng chưa hỗ trợ: ${ext || "unknown"}` }
  } catch (e: any) {
    const msg = e?.message || e?.name || String(e)
    if (e?.name === "AbortError") {
      return { type: "error", error: "Timeout khi tải file" }
    }
    return { type: "error", error: msg }
  }
}

export async function fetchAllDocuments(
  urls: string[]
): Promise<{ texts: string[]; images: { base64: string; mimeType: string }[]; errors: string[] }> {
  const texts: string[] = []
  const images: { base64: string; mimeType: string }[] = []
  const errors: string[] = []

  for (const url of urls) {
    const parsed = await fetchAndParseDocument(url)
    if (parsed.type === "text") {
      texts.push(parsed.content)
    } else if (parsed.type === "image") {
      images.push({ base64: parsed.base64, mimeType: parsed.mimeType })
    } else {
      errors.push(`${parsed.filename || url}: ${parsed.error}`)
    }
  }

  return { texts, images, errors }
}
