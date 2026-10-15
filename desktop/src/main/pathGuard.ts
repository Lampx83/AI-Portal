/**
 * Kiểm soát đường dẫn: mọi truy cập tệp từ trang web đều đi qua đây.
 *
 * Nguyên tắc:
 *  - Trang web chỉ gửi đường dẫn TƯƠNG ĐỐI so với thư mục đã liên kết; đường dẫn tuyệt đối,
 *    ký tự NUL, ổ đĩa Windows, UNC đều bị từ chối.
 *  - Sau khi chuẩn hoá, kiểm tra nằm trong thư mục gốc (chặn `..`).
 *  - Sau đó phân giải symlink (realpath) và kiểm tra LẠI — chặn symlink trỏ ra ngoài.
 *  - Với đường dẫn chưa tồn tại (giai đoạn 2: ghi tệp mới), phân giải tổ tiên gần nhất có thật.
 */
import fs from "fs"
import path from "path"

export class PathAccessError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_PATH" | "OUTSIDE_ROOT" | "NOT_FOUND" | "ROOT_MISSING",
  ) {
    super(message)
    this.name = "PathAccessError"
  }
}

/** So sánh đường dẫn: Windows và macOS (mặc định) không phân biệt hoa/thường. */
function samePathCase(platform: NodeJS.Platform): boolean {
  return platform === "linux"
}

/** true nếu `child` là `root` hoặc nằm bên trong `root` (cả hai đã là đường dẫn tuyệt đối, chuẩn hoá). */
export function isInside(root: string, child: string, platform: NodeJS.Platform = process.platform): boolean {
  const p = platform === "win32" ? path.win32 : path.posix
  let r = p.resolve(root)
  let c = p.resolve(child)
  if (!samePathCase(platform)) {
    r = r.toLowerCase()
    c = c.toLowerCase()
  }
  if (r === c) return true
  const rel = p.relative(r, c)
  return rel !== "" && !rel.startsWith("..") && !p.isAbsolute(rel)
}

/**
 * Kiểm tra cú pháp đường dẫn tương đối do trang web gửi lên và trả về dạng các đoạn.
 * Không đụng tới hệ thống tệp.
 */
export function parseRelativePath(rel: unknown): string[] {
  if (rel === undefined || rel === null || rel === "") return []
  if (typeof rel !== "string") throw new PathAccessError("Đường dẫn không hợp lệ", "INVALID_PATH")
  if (rel.length > 4096) throw new PathAccessError("Đường dẫn quá dài", "INVALID_PATH")
  if (rel.includes("\0")) throw new PathAccessError("Đường dẫn chứa ký tự không hợp lệ", "INVALID_PATH")
  // Tuyệt đối kiểu POSIX, Windows (C:\, C:/, \\server\share, \\?\), hoặc "~".
  if (/^[\\/]/.test(rel) || /^[a-zA-Z]:/.test(rel) || rel.startsWith("~")) {
    throw new PathAccessError("Chỉ chấp nhận đường dẫn tương đối trong thư mục dự án", "INVALID_PATH")
  }
  const parts = rel.split(/[\\/]+/).filter((s) => s !== "" && s !== ".")
  for (const part of parts) {
    if (part === "..") throw new PathAccessError("Không được truy cập ra ngoài thư mục dự án", "OUTSIDE_ROOT")
    // Windows: tên kết thúc bằng dấu chấm/khoảng trắng hoặc chứa ":" (alternate data stream) có thể bị diễn giải khác.
    if (part.includes(":")) throw new PathAccessError("Đường dẫn chứa ký tự không hợp lệ", "INVALID_PATH")
  }
  return parts
}

/** Phân giải realpath của `p`; nếu `p` chưa tồn tại thì phân giải tổ tiên gần nhất rồi nối phần còn lại. */
function realpathAllowMissing(p: string): { real: string; exists: boolean } {
  try {
    return { real: fs.realpathSync.native(p), exists: true }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT" && (e as NodeJS.ErrnoException).code !== "ENOTDIR") throw e
  }
  const parent = path.dirname(p)
  if (parent === p) return { real: p, exists: false }
  const { real } = realpathAllowMissing(parent)
  return { real: path.join(real, path.basename(p)), exists: false }
}

export interface ResolvedPath {
  /** Đường dẫn tuyệt đối thật (đã phân giải symlink). */
  absPath: string
  /** Đường dẫn tương đối chuẩn hoá, dùng "/". */
  relPath: string
  exists: boolean
}

/**
 * Phân giải `rel` bên trong `root` một cách an toàn.
 * @param root thư mục dự án đã liên kết (tuyệt đối)
 * @param rel  đường dẫn tương đối do trang web gửi
 * @param opts.mustExist mặc định true — giai đoạn 1 chỉ đọc nên tệp phải tồn tại
 */
export function resolveInside(root: string, rel: unknown, opts: { mustExist?: boolean } = {}): ResolvedPath {
  const mustExist = opts.mustExist ?? true
  const parts = parseRelativePath(rel)
  let rootReal: string
  try {
    rootReal = fs.realpathSync.native(root)
  } catch {
    throw new PathAccessError("Thư mục dự án không còn tồn tại trên máy", "ROOT_MISSING")
  }
  const candidate = path.join(rootReal, ...parts)
  // Lớp 1: kiểm tra cú pháp sau khi nối.
  if (!isInside(rootReal, candidate)) throw new PathAccessError("Không được truy cập ra ngoài thư mục dự án", "OUTSIDE_ROOT")
  // Lớp 2: phân giải symlink và kiểm tra lại.
  const { real, exists } = realpathAllowMissing(candidate)
  if (!isInside(rootReal, real)) throw new PathAccessError("Liên kết (symlink) trỏ ra ngoài thư mục dự án", "OUTSIDE_ROOT")
  if (mustExist && !exists) throw new PathAccessError("Không tìm thấy tệp", "NOT_FOUND")
  return { absPath: real, relPath: parts.join("/"), exists }
}

/** Chuyển đường dẫn tuyệt đối (bên trong root) sang tương đối dạng "/". */
export function toRelPath(rootReal: string, abs: string): string {
  return path.relative(rootReal, abs).split(path.sep).join("/")
}

/**
 * Thư mục quá rộng hoặc thuộc hệ thống — không cho liên kết làm thư mục dự án
 * (giai đoạn 2 AI sẽ được ghi vào đây, phải giới hạn phạm vi).
 */
export function forbiddenRootReason(dir: string, home: string, platform: NodeJS.Platform = process.platform): string | null {
  const p = platform === "win32" ? path.win32 : path.posix
  const d = p.resolve(dir)
  const norm = (s: string) => (samePathCase(platform) ? s : s.toLowerCase())
  if (p.parse(d).root === d || p.dirname(d) === d) return "Không thể liên kết cả ổ đĩa / thư mục gốc"
  if (norm(d) === norm(p.resolve(home))) return "Không thể liên kết toàn bộ thư mục người dùng — hãy chọn một thư mục con"
  if (isInside(d, home, platform)) return "Thư mục này chứa cả thư mục người dùng — hãy chọn thư mục nhỏ hơn"
  const systemDirs =
    platform === "win32"
      ? ["C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\ProgramData"]
      : platform === "darwin"
        ? ["/System", "/Library", "/Applications", "/usr", "/bin", "/sbin", "/etc", "/private/etc", "/cores", "/Volumes"]
        : ["/usr", "/bin", "/sbin", "/etc", "/var", "/opt", "/proc", "/sys", "/dev", "/boot"]
  for (const s of systemDirs) {
    if (platform === "darwin" && s === "/Volumes") {
      // Cho phép thư mục con trong ổ ngoài (/Volumes/USB/DuAn), chặn chính /Volumes và gốc ổ (/Volumes/USB).
      if (norm(d) === "/volumes" || norm(p.dirname(d)) === "/volumes") return "Không thể liên kết cả ổ đĩa — hãy chọn một thư mục con"
      continue
    }
    if (isInside(s, d, platform)) return "Không thể liên kết thư mục hệ thống"
  }
  if (platform === "darwin" && isInside(p.join(home, "Library"), d, platform)) return "Không thể liên kết thư mục hệ thống"
  return null
}
