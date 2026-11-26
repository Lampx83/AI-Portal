/**
 * Theo dõi thay đổi trong thư mục dự án bằng fs.watch (recursive: FSEvents trên macOS,
 * ReadDirectoryChangesW trên Windows). Gom sự kiện (debounce) rồi báo một lần.
 */
import fs from "fs"
import { isIgnoredRelPath } from "./fileTypes"

export interface WatchHandle {
  close(): void
}

export function watchFolder(
  root: string,
  onChange: (paths: string[]) => void,
  opts: { debounceMs?: number; maxPaths?: number } = {},
): WatchHandle {
  const debounceMs = opts.debounceMs ?? 300
  const maxPaths = opts.maxPaths ?? 50
  let pending = new Set<string>()
  let unknown = false
  let timer: NodeJS.Timeout | null = null
  let closed = false

  const flush = () => {
    timer = null
    if (closed) return
    const paths = [...pending].slice(0, maxPaths)
    const fire = paths.length > 0 || unknown
    pending = new Set()
    unknown = false
    if (fire) onChange(paths)
  }

  let watcher: fs.FSWatcher
  try {
    watcher = fs.watch(root, { recursive: true, persistent: false }, (_event, filename) => {
      if (closed) return
      if (filename) {
        const rel = String(filename).split(/[\\/]+/).join("/")
        if (isIgnoredRelPath(rel)) return
        pending.add(rel)
      } else {
        unknown = true
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, debounceMs)
    })
  } catch {
    // Một số hệ thống tệp (ổ mạng) không hỗ trợ theo dõi — giao diện vẫn có nút «Làm mới».
    return { close() {} }
  }
  watcher.on("error", () => {
    /* thư mục bị xoá/ngắt kết nối: bỏ qua, giao diện sẽ báo khi liệt kê lại */
  })
  return {
    close() {
      closed = true
      if (timer) clearTimeout(timer)
      watcher.close()
    },
  }
}
