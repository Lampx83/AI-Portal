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
import type { FileEntry, LinkedFolderInfo, ListFilesResult, ReadTextFileResult } from "../shared/api"
import type { ConfigStore } from "./config"
import { extOf, isIgnoredName, openBlockedReason } from "./fileTypes"
import { forbiddenRootReason, PathAccessError, resolveInside, toRelPath } from "./pathGuard"

export const LIMITS = {
  /** Số mục tối đa trả về cho một thư mục. */
  maxEntries: 2000,
  /** Dung lượng tối đa đọc một tệp văn bản (byte). */
  maxReadBytes: 1024 * 1024,
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
    return this.get(id)!
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

  listFiles(projectId: unknown, subPath?: unknown): ListFilesResult {
    const root = this.resolveFolder(projectId)
    const target = resolveInside(root, subPath ?? "")
    const st = fs.statSync(target.absPath)
    if (!st.isDirectory()) throw new Error("Không phải thư mục")
    const dirents = fs.readdirSync(target.absPath, { withFileTypes: true })
    const entries: FileEntry[] = []
    let truncated = false
    for (const d of dirents) {
      if (isIgnoredName(d.name)) continue
      if (entries.length >= LIMITS.maxEntries) {
        truncated = true
        break
      }
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
    entries.sort((a, b) => (a.type !== b.type ? (a.type === "dir" ? -1 : 1) : a.name.localeCompare(b.name, "vi", { numeric: true })))
    return { subPath: target.relPath, entries, truncated }
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
