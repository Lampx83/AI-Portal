/**
 * Chính sách đọc/ghi của trợ lý thư mục (giai đoạn 2).
 *
 * - Chỉ GHI được tệp văn bản/dữ liệu/tài liệu trong danh sách cho phép. Tệp thực thi, kịch bản, mã nguồn
 *   (kể cả .py/.R — có thể bị chạy khi người dùng mở) đều bị chặn ghi. Đọc thì được.
 * - Không đọc/ghi tệp hoặc thư mục ẩn (`.git`, `.neu-research`…), `node_modules`, tệp khoá Office `~$…`.
 * - Kết hợp với pathGuard (chống `..`, đường dẫn tuyệt đối, symlink ra ngoài).
 */
import { extOf, isIgnoredRelPath } from "../fileTypes"

/** Đuôi tệp trợ lý được phép tạo / sửa / đổi tên tới. */
export const WRITABLE_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "org", "adoc",
  "csv", "tsv", "json", "yaml", "yml", "xml",
  "tex", "bib", "ris", "nbib", "enw",
  "log",
  "docx",
])

/** Đuôi tệp đọc trực tiếp như văn bản. */
export const TEXT_EXTENSIONS = new Set([
  ...WRITABLE_EXTENSIONS,
  "py", "r", "rmd", "qmd", "ipynb", "do", "sps", "sas", "m", "jl", "sql", "js", "ts", "html", "htm", "css", "ini", "cfg", "toml",
  "sty", "cls", "bst", "rtf", "srt", "vtt",
])
TEXT_EXTENSIONS.delete("docx")

/** Đuôi tệp trích văn bản bằng thư viện. */
export const EXTRACT_EXTENSIONS = new Set(["docx", "xlsx", "pdf"])

/** Giới hạn của trợ lý. */
export const AGENT_LIMITS = {
  /** Đọc tối đa (byte) một tệp văn bản thô. */
  maxReadBytes: 2 * 1024 * 1024,
  /** Tệp docx/xlsx/pdf tối đa (byte) để trích văn bản. */
  maxExtractBytes: 25 * 1024 * 1024,
  /** Ký tự tối đa trả về cho mô hình trong MỘT lần đọc. */
  maxReadChars: 16_000,
  /** Nội dung tối đa một lần ghi (ký tự). */
  maxWriteChars: 1_000_000,
  /** Tệp tối đa được xoá/đổi tên (để còn sao lưu hoàn tác). */
  maxBackupBytes: 50 * 1024 * 1024,
  /** Số mục tối đa của list_files. */
  maxListEntries: 400,
  /** Số kết quả tối đa của search_text. */
  maxSearchResults: 80,
  /** Số tệp tối đa search_text duyệt qua. */
  maxSearchFiles: 2000,
}

export class WritePolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WritePolicyError"
  }
}

/** Lý do không được ghi tệp `relPath` (null = được phép). */
export function writeBlockedReason(relPath: string): string | null {
  if (!relPath) return "Cần đường dẫn tệp"
  if (isIgnoredRelPath(relPath)) return "Không ghi vào tệp/thư mục ẩn hoặc thư mục hệ thống (.git, .neu-research, node_modules…)"
  const base = relPath.split("/").pop() ?? ""
  if (/[. ]$/.test(base)) return "Tên tệp không được kết thúc bằng dấu chấm hoặc khoảng trắng"
  if (/[<>:"|?*\u0000-\u001f]/.test(base)) return "Tên tệp chứa ký tự không hợp lệ"
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(base)) return "Tên tệp trùng tên thiết bị của Windows"
  const ext = extOf(base)
  if (!ext) return "Tệp không có phần mở rộng — trợ lý chỉ ghi tệp văn bản/tài liệu có đuôi rõ ràng"
  if (!WRITABLE_EXTENSIONS.has(ext)) {
    return `Trợ lý không được ghi tệp .${ext}. Chỉ ghi: ${[...WRITABLE_EXTENSIONS].map((e) => "." + e).join(" ")}`
  }
  return null
}

export function assertWritable(relPath: string): void {
  const r = writeBlockedReason(relPath)
  if (r) throw new WritePolicyError(r)
}

/** Lý do không được đọc (tệp ẩn…). */
export function readBlockedReason(relPath: string): string | null {
  if (relPath && isIgnoredRelPath(relPath)) return "Không đọc tệp/thư mục ẩn hoặc thư mục hệ thống"
  return null
}
