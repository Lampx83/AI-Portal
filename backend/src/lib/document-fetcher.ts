/**
 * Fetch and parse file content from MinIO/URL to send to OpenAI.
 * Supports: PDF, DOCX, Excel (.xlsx, .xls), TXT/MD/CSV (text), images (base64 for Vision API)
 */
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { Readable } from "stream"
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

/** Parse an already-downloaded buffer by its (file)name extension. Shared by the HTTP-fetch and direct-S3 paths. */
async function parseBufferByExt(buf: Buffer, nameForExt: string): Promise<ParsedDocument> {
  if (buf.length > MAX_FILE_SIZE) {
    return { type: "error", error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }
  }

  const filename = nameForExt.split("/").pop()?.split("?")[0] || "file"
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)(\?|$)/)?.[1] || ""

  // Ảnh: base64 cho Vision API
  if (IMAGE_EXT.test(nameForExt)) {
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

  // Plain text file
  if (TEXT_EXT.test(nameForExt)) {
    const content = buf.toString("utf-8")
    return { type: "text", content, filename }
  }

  // PDF: extract text
  if (PDF_EXT.test(nameForExt)) {
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

  // DOCX: extract text with mammoth
  if (DOCX_EXT.test(nameForExt)) {
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

  // Excel (.xlsx, .xls): extract table data to text
  if (EXCEL_EXT.test(nameForExt)) {
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
}

/**
 * Rewrite MinIO URL from public to internal so backend can fetch (when public IP not reachable from container).
 * E.g. http://203.113.132.48:8008/... -> http://10.2.11.23:8008/...
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

/**
 * File đính kèm được lưu qua proxy Portal `/api/storage/download/<key>` với host CÔNG KHAI
 * (vd https://research.neu.edu.vn/...). Từ trong container, host công khai thường không gọi được
 * (hairpin) → fetch treo/timeout. Vì proxy này chính là Portal, ta trỏ thẳng về loopback nội bộ.
 */
function rewritePortalStorageUrlForInternalFetch(url: string): string {
  try {
    const u = new URL(url)
    if (!u.pathname.startsWith("/api/storage/download/")) return url
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return url
    const port = getSetting("PORT", "3001")
    return `http://127.0.0.1:${port}${u.pathname}${u.search}`
  } catch {
    return url
  }
}

const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^192\.0\.0\./, /^198\.1[89]\./, /^2(2[4-9]|[3-5]\d)\./,
]
function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === "::1" || v === "::" || v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) return true
  const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const v4 = m ? m[1] : v
  return PRIVATE_V4.some((re) => re.test(v4))
}

/**
 * BẢO MẬT (SSRF): URL tệp đính kèm do client gửi. Chỉ cho phép (1) đường dẫn tải của Portal /api/storage/download/…,
 * (2) host MinIO đã cấu hình, (3) host công khai KHÔNG phân giải về IP nội bộ/loopback/link-local. Không theo redirect.
 */
async function isSafeDocumentUrl(raw: string): Promise<boolean> {
  try {
    const u = new URL(raw)
    if (u.protocol !== "http:" && u.protocol !== "https:") return false
    if (u.pathname.startsWith("/api/storage/download/")) return true
    const minioHosts = [getSetting("MINIO_ENDPOINT_PUBLIC"), getSetting("MINIO_ENDPOINT")].filter(Boolean) as string[]
    if (minioHosts.includes(u.hostname)) return true
    const host = u.hostname.replace(/^\[|\]$/g, "")
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false
    const { lookup } = await import("dns/promises")
    const addrs = await lookup(host, { all: true })
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address))
  } catch {
    return false
  }
}

export async function fetchAndParseDocument(url: string): Promise<ParsedDocument> {
  try {
    if (!(await isSafeDocumentUrl(url))) return { type: "error", error: "URL tệp không được phép" }
    const fetchUrl = rewritePortalStorageUrlForInternalFetch(rewriteMinioUrlForInternalFetch(url))
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { Accept: "*/*" },
      redirect: "error",
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return { type: "error", error: `HTTP ${res.status}: ${res.statusText}` }
    }

    const buf = Buffer.from(await res.arrayBuffer())
    return await parseBufferByExt(buf, url)
  } catch (e: any) {
    const msg = e?.message || e?.name || String(e)
    if (e?.name === "AbortError") {
      return { type: "error", error: "Timeout khi tải file" }
    }
    return { type: "error", error: msg }
  }
}

function getUsersS3Client(): S3Client {
  const endpoint = getSetting("MINIO_ENDPOINT", "localhost")
  const port = getSetting("MINIO_PORT", "9000")
  const region = getSetting("AWS_REGION", "us-east-1")
  const accessKey = getSetting("MINIO_ACCESS_KEY")
  const secretKey = getSetting("MINIO_SECRET_KEY")
  return new S3Client({
    endpoint: `http://${endpoint}:${port}`,
    region,
    credentials: { accessKeyId: accessKey || "", secretAccessKey: secretKey || "" },
    forcePathStyle: true,
  })
}
function getUsersBucketName(): string {
  return getSetting("MINIO_BUCKET_NAME", "portal")
}

/**
 * Đọc THẲNG một file dự án (bucket users, key dạng `projects/<userId>/...`) qua S3 nội bộ —
 * KHÔNG qua HTTP. Route `/api/users/projects/files/:key` yêu cầu session cookie nên orchestrator
 * (gọi server-to-server, không có cookie) sẽ luôn nhận 401 nếu tự fetch qua URL đó; đồng thời URL đó
 * cũng bị coi là "invalid" (isValidUrl) nếu build tương đối, và có thể dính hairpin nếu build tuyệt đối.
 * CHỈ gọi hàm này SAU KHI đã tự kiểm tra quyền sở hữu/chia sẻ project ở nơi gọi — hàm này không kiểm tra.
 */
export async function fetchProjectFileByKey(key: string): Promise<ParsedDocument> {
  try {
    const response = await getUsersS3Client().send(new GetObjectCommand({ Bucket: getUsersBucketName(), Key: key }))
    const body = response.Body
    let buf: Buffer
    if (body instanceof Readable) {
      const chunks: Buffer[] = []
      for await (const chunk of body as any) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      buf = Buffer.concat(chunks)
    } else if (body) {
      buf = Buffer.from(await (body as any).transformToByteArray())
    } else {
      return { type: "error", error: "File trống" }
    }
    return await parseBufferByExt(buf, key)
  } catch (e: any) {
    if (e?.name === "NoSuchKey") return { type: "error", error: "Không tìm thấy file" }
    return { type: "error", error: e?.message || "Lỗi đọc file dự án" }
  }
}

const PARALLEL_FETCH_LIMIT = 10

export async function fetchAllDocuments(
  urls: string[]
): Promise<{ texts: string[]; images: { base64: string; mimeType: string }[]; errors: string[] }> {
  const texts: string[] = []
  const images: { base64: string; mimeType: string }[] = []
  const errors: string[] = []

  for (let i = 0; i < urls.length; i += PARALLEL_FETCH_LIMIT) {
    const batch = urls.slice(i, i + PARALLEL_FETCH_LIMIT)
    const results = await Promise.all(batch.map((url) => fetchAndParseDocument(url)))
    for (let j = 0; j < results.length; j++) {
      const parsed = results[j]
      const url = batch[j]
      if (parsed.type === "text") {
        texts.push(parsed.content)
      } else if (parsed.type === "image") {
        images.push({ base64: parsed.base64, mimeType: parsed.mimeType })
      } else {
        errors.push(`${parsed.filename || url}: ${parsed.error}`)
      }
    }
  }

  return { texts, images, errors }
}
