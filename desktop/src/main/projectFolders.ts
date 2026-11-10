/**
 * Dịch vụ thư mục dự án: liên kết projectId ↔ thư mục, liệt kê và đọc tệp (chỉ đọc ở giai đoạn 1).
 * Không phụ thuộc Electron — kiểm thử đơn vị được.
 *
 * Điểm mở rộng giai đoạn 2: thêm `proposeWrite(projectId, relPath, newContent)` và `applyChange(changeId)`
 * dùng chung `resolveFolder()` + `resolveInside(..., { mustExist: false })`.
 */
import fs from "fs"
import os from "os"
import path from "path"
import type { FileEntry, FilePreview, LinkedFolderInfo, ListFilesOptions, ListFilesResult, ReadTextFileResult, RecentFolder } from "../shared/api"
import type { ConfigStore } from "./config"
import { extOf, IMAGE_MIME, isIgnoredName, isIgnoredRelPath, openBlockedReason } from "./fileTypes"
import { forbiddenRootReason, PathAccessError, resolveInside, toRelPath } from "./pathGuard"
import { readForAgent } from "./agent/extract"
import { EXTRACT_EXTENSIONS, TEXT_EXTENSIONS } from "./agent/writePolicy"
import { imageSize } from "./agent/office"

export const LIMITS = {
  /** Số mục tối đa trả về cho một thư mục (mặc định một trang). */
  maxEntries: 2000,
  /** Trang lớn nhất khi phân trang (0.3.0). */
  maxPage: 5000,
  /** Đọc tên tối đa chừng này mục trong một thư mục (để sắp xếp + phân trang). */
  maxDirents: 100_000,
  /** Dung lượng tối đa đọc một tệp văn bản (byte). */
  maxReadBytes: 1024 * 1024,
  /** Xem trước: văn bản tối đa (ký tự). */
  previewChars: 200_000,
  /** Xem trước ảnh tối đa (byte). */
  previewImageBytes: 8 * 1024 * 1024,
  /** Số thư mục gần đây giữ lại. */
  recentFolders: 12,
}

const PROJECT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

export function assertProjectId(projectId: unknown): string {
  const id = typeof projectId === "number" ? String(projectId) : projectId
  if (typeof id !== "string" || !PROJECT_ID_RE.test(id)) throw new Error("Mã dự án không hợp lệ")
  return id
}

export class ProjectFolderService {
  constructor(
    private readonly config: ConfigStore,
    /** origin hệ thống hiện tại — liên kết được tách theo origin. */
    private readonly getOriginKey: () => string,
    private readonly homeDir: string = os.homedir(),
  ) {}

  private records() {
    const key = this.getOriginKey()
    const all = this.config.get().linkedFolders
    return all[key] ?? {}
  }

  /** Kiểm tra thư mục người dùng vừa chọn có dùng làm thư mục dự án được không; trả về realpath. */
  validateFolderChoice(dir: string): string {
    if (typeof dir !== "string" || !path.isAbsolute(dir)) throw new Error("Đường dẫn thư mục không hợp lệ")
    let real: string
    try {
      real = fs.realpathSync.native(dir)
    } catch {
      throw new Error("Thư mục không tồn tại")
    }
    if (!fs.statSync(real).isDirectory()) throw new Error("Đây không phải thư mục")
    const reason = forbiddenRootReason(real, fs.realpathSync.native(this.homeDir))
    if (reason) throw new Error(reason)
    return real
  }

  link(projectId: unknown, dir: string): LinkedFolderInfo {
    const id = assertProjectId(projectId)
    const real = this.validateFolderChoice(dir)
    const key = this.getOriginKey()
    this.config.update((c) => {
      c.linkedFolders[key] = { ...(c.linkedFolders[key] ?? {}), [id]: { path: real, linkedAt: new Date().toISOString() } }
    })
    this.rememberRecent(real)
    return this.get(id)!
  }

  // ───────────── 0.3.0: thư mục gần đây ─────────────
  /** Ghi nhớ thư mục người dùng vừa TỰ chọn (hộp thoại / kéo-thả / liên kết). */
  rememberRecent(dir: string): void {
    this.config.update((c) => {
      const list = (c.recentFolders ?? []).filter((r) => r.path !== dir)
      c.recentFolders = [{ path: dir, usedAt: new Date().toISOString() }, ...list].slice(0, LIMITS.recentFolders)
    })
  }

  listRecent(): RecentFolder[] {
    return (this.config.get().recentFolders ?? []).map((r) => {
      let exists = false
      try {
        exists = fs.statSync(r.path).isDirectory()
      } catch {
        exists = false
      }
      return { path: r.path, name: path.basename(r.path), usedAt: r.usedAt, exists }
    })
  }

  /** realpath của `dir` nếu nó nằm trong danh sách gần đây (so đúng đường dẫn đã lưu), ngược lại null. */
  recentMatch(dir: unknown): string | null {
    if (typeof dir !== "string" || !path.isAbsolute(dir)) return null
    const rec = (this.config.get().recentFolders ?? []).find((r) => r.path === dir)
    if (!rec) return null
    try {
      return fs.realpathSync.native(rec.path) === rec.path ? rec.path : null
    } catch {
      return null
    }
  }

  forgetRecent(dir: unknown): boolean {
    const list = this.config.get().recentFolders ?? []
    if (!list.some((r) => r.path === dir)) return false
    this.config.update((c) => {
      c.recentFolders = (c.recentFolders ?? []).filter((r) => r.path !== dir)
    })
    return true
  }

  unlink(projectId: unknown): boolean {
    const id = assertProjectId(projectId)
    const key = this.getOriginKey()
    if (!this.records()[id]) return false
    this.config.update((c) => {
      const m = { ...(c.linkedFolders[key] ?? {}) }
      delete m[id]
      c.linkedFolders[key] = m
    })
    return true
  }

  get(projectId: unknown): LinkedFolderInfo | null {
    const id = assertProjectId(projectId)
    const rec = this.records()[id]
    if (!rec) return null
    let exists = false
    try {
      exists = fs.statSync(rec.path).isDirectory()
    } catch {
      exists = false
    }
    return { projectId: id, path: rec.path, name: path.basename(rec.path), linkedAt: rec.linkedAt, exists }
  }

  /** Thư mục gốc (realpath) của dự án; lỗi nếu chưa liên kết hoặc đã mất. */
  resolveFolder(projectId: unknown): string {
    const info = this.get(projectId)
    if (!info) throw new Error("Dự án chưa liên kết thư mục trên máy")
    try {
      return fs.realpathSync.native(info.path)
    } catch {
      throw new PathAccessError("Thư mục dự án không còn tồn tại trên máy", "ROOT_MISSING")
    }
  }

  listFiles(projectId: unknown, subPath?: unknown, opts?: ListFilesOptions | null): ListFilesResult {
    const root = this.resolveFolder(projectId)
    const target = resolveInside(root, subPath ?? "")
    const st = fs.statSync(target.absPath)
    if (!st.isDirectory()) throw new Error("Không phải thư mục")
    const offset = Math.max(0, Math.floor(Number(opts?.offset) || 0))
    const limit = Math.max(1, Math.min(LIMITS.maxPage, Math.floor(Number(opts?.limit) || LIMITS.maxEntries)))
    // Đọc TÊN mọi mục (rẻ), sắp xếp (thư mục trước), rồi mới stat trang cần hiển thị — thư mục hàng chục nghìn tệp vẫn nhanh.
    const all: fs.Dirent[] = []
    let capped = false
    const dir = fs.opendirSync(target.absPath)
    try {
      for (let d = dir.readSync(); d; d = dir.readSync()) {
        if (isIgnoredName(d.name)) continue
        if (all.length >= LIMITS.maxDirents) {
          capped = true
          break
        }
        all.push(d)
      }
    } finally {
      dir.closeSync()
    }
    const coll = new Intl.Collator("vi", { numeric: true })
    all.sort((a, b) => {
      const da = a.isDirectory() ? 0 : 1
      const db = b.isDirectory() ? 0 : 1
      return da !== db ? da - db : coll.compare(a.name, b.name)
    })
    const entries: FileEntry[] = []
    let i = offset
    for (; i < all.length && entries.length < limit; i++) {
      const d = all[i]
      const abs = path.join(target.absPath, d.name)
      let real = abs
      let s: fs.Stats
      try {
        if (d.isSymbolicLink()) {
          // Symlink: chỉ hiện nếu đích nằm trong thư mục dự án.
          real = fs.realpathSync.native(abs)
          const rel = toRelPath(root, real)
          if (rel.startsWith("..") || path.isAbsolute(rel)) continue
        }
        s = fs.statSync(real)
      } catch {
        continue
      }
      if (!s.isFile() && !s.isDirectory()) continue
      const relPath = target.relPath ? `${target.relPath}/${d.name}` : d.name
      entries.push({
        name: d.name,
        relPath,
        type: s.isDirectory() ? "dir" : "file",
        size: s.isDirectory() ? 0 : s.size,
        mtimeMs: Math.round(s.mtimeMs),
        ext: s.isDirectory() ? "" : extOf(d.name),
      })
    }
    // Symlink được sắp như tệp; sắp lại trang theo loại thật.
    entries.sort((a, b) => (a.type !== b.type ? (a.type === "dir" ? -1 : 1) : coll.compare(a.name, b.name)))
    return { subPath: target.relPath, entries, truncated: capped || i < all.length, total: all.length, offset }
  }

  /** Xem trước một tệp cho giao diện (0.3.0). Chỉ đọc; không trả nội dung tệp ẩn. */
  async previewFile(projectId: unknown, relPath: unknown): Promise<FilePreview> {
    const root = this.resolveFolder(projectId)
    const target = resolveInside(root, relPath)
    if (!target.relPath) throw new Error("Cần đường dẫn tệp")
    if (isIgnoredRelPath(target.relPath)) throw new Error("Không xem trước tệp ẩn")
    const st = fs.statSync(target.absPath)
    if (!st.isFile()) throw new Error("Không phải tệp")
    const name = path.posix.basename(target.relPath)
    const ext = extOf(name)
    const base: FilePreview = {
      relPath: target.relPath,
      name,
      ext,
      size: st.size,
      mtimeMs: Math.round(st.mtimeMs),
      kind: "unsupported",
      truncated: false,
      openable: !(openBlockedReason(name, st.mode) ?? openBlockedReason(path.basename(target.absPath), st.mode)),
    }
    const mime = IMAGE_MIME[ext]
    if (mime) {
      if (st.size > LIMITS.previewImageBytes) return { ...base, note: "Ảnh lớn hơn 8 MB — hãy mở bằng ứng dụng mặc định." }
      const buf = fs.readFileSync(target.absPath)
      const dims = imageSize(buf)
      return { ...base, kind: "image", dataUrl: `data:${mime};base64,${buf.toString("base64")}`, ...(dims ? { width: dims.width, height: dims.height } : {}) }
    }
    const clip = (t: string) => (t.length > LIMITS.previewChars ? { text: t.slice(0, LIMITS.previewChars), truncated: true } : { text: t, truncated: false })
    if (TEXT_EXTENSIONS.has(ext)) {
      try {
        const c = await readForAgent(target.absPath, target.relPath)
        const kind = ext === "md" || ext === "markdown" || ext === "rmd" || ext === "qmd" ? "markdown" : ext === "csv" || ext === "tsv" ? "csv" : "text"
        const r = clip(c.text)
        return { ...base, kind, text: r.text, truncated: r.truncated || c.truncated }
      } catch (e) {
        return { ...base, note: (e as Error).message }
      }
    }
    if (EXTRACT_EXTENSIONS.has(ext)) {
      try {
        const c = await readForAgent(target.absPath, target.relPath)
        const r = clip(c.text)
        return { ...base, kind: "document", text: r.text, truncated: r.truncated }
      } catch (e) {
        return { ...base, note: (e as Error).message }
      }
    }
    // Đuôi lạ nhưng là văn bản (kịch bản .sh, .bat, cấu hình…): xem như văn bản thô nếu không có byte NUL.
    if (st.size <= LIMITS.maxReadBytes) {
      try {
        const r = this.readTextFile(projectId, target.relPath)
        const c = clip(r.content)
        return { ...base, kind: "text", text: c.text, truncated: c.truncated || r.truncated }
      } catch {
        /* nhị phân */
      }
    }
    return { ...base, note: "Chưa xem trước được loại tệp này — hãy mở bằng ứng dụng mặc định." }
  }

  readTextFile(projectId: unknown, relPath: unknown): ReadTextFileResult {
    const root = this.resolveFolder(projectId)
    const target = resolveInside(root, relPath)
    if (!target.relPath) throw new Error("Cần đường dẫn tệp")
    const st = fs.statSync(target.absPath)
    if (!st.isFile()) throw new Error("Không phải tệp")
    const len = Math.min(st.size, LIMITS.maxReadBytes)
    const buf = Buffer.alloc(len)
    const fd = fs.openSync(target.absPath, "r")
    try {
      fs.readSync(fd, buf, 0, len, 0)
    } finally {
      fs.closeSync(fd)
    }
    // Tệp nhị phân (có byte NUL trong 8 KB đầu) → không trả về như văn bản.
    if (buf.subarray(0, 8192).includes(0)) throw new Error("Tệp không phải văn bản (nhị phân)")
    let content = buf.toString("utf8")
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
    return { relPath: target.relPath, content, size: st.size, truncated: st.size > len }
  }

  /** Đường dẫn tuyệt đối an toàn để «hiện trong thư mục» (không có relPath = chính thư mục dự án). */
  resolveForReveal(projectId: unknown, relPath?: unknown): string {
    const root = this.resolveFolder(projectId)
    if (relPath === undefined || relPath === null || relPath === "") return root
    return resolveInside(root, relPath).absPath
  }

  /** Đường dẫn tuyệt đối an toàn để mở bằng ứng dụng mặc định — chặn tệp thực thi. */
  resolveForOpen(projectId: unknown, relPath: unknown): string {
    const root = this.resolveFolder(projectId)
    const target = resolveInside(root, relPath)
    const st = fs.statSync(target.absPath)
    if (!st.isFile()) throw new Error("Chỉ mở được tệp (thư mục: dùng «Hiện trong thư mục»)")
    // Kiểm tra cả tên trong đường dẫn yêu cầu và tên thật sau khi phân giải symlink.
    const reason =
      openBlockedReason(path.basename(target.relPath), st.mode) ?? openBlockedReason(path.basename(target.absPath), st.mode)
    if (reason) throw new Error(reason)
    return target.absPath
  }
}
