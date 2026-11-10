/**
 * Theo dõi thay đổi «bên ngoài» trong thư mục dự án (0.3.0): người dùng sửa tệp bằng Word, Finder… trong lúc
 * đang trò chuyện với trợ lý. Lượt kế tiếp, trợ lý được báo danh sách tệp đã đổi để đọc lại thay vì dùng nội dung
 * cũ trong hội thoại. Thay đổi do chính app ghi (Chấp nhận/Hoàn tác) được bỏ qua.
 *
 * Không phụ thuộc Electron — kiểm thử đơn vị được.
 */
import { watchFolder, type WatchHandle } from "./watcher"

const OWN_WRITE_WINDOW_MS = 5000
const MAX_PENDING = 200

interface Entry {
  root: string
  handle: WatchHandle
  changed: Set<string>
  /** Đường dẫn app vừa ghi → hết hạn lúc. */
  own: Map<string, number>
  overflow: boolean
}

export class ExternalChangeTracker {
  private entries = new Map<string, Entry>()

  constructor(
    private readonly resolveRoot: (projectId: string) => string,
    private readonly watch: typeof watchFolder = watchFolder,
    private readonly now: () => number = Date.now,
  ) {}

  /** Bắt đầu theo dõi (nếu chưa) — gọi khi người dùng dùng trợ lý cho dự án. Đổi thư mục liên kết thì theo dõi lại. */
  ensure(projectId: string): void {
    let root: string
    try {
      root = this.resolveRoot(projectId)
    } catch {
      this.stop(projectId)
      return
    }
    const cur = this.entries.get(projectId)
    if (cur && cur.root === root) return
    this.stop(projectId)
    const e: Entry = { root, handle: { close() {} }, changed: new Set(), own: new Map(), overflow: false }
    e.handle = this.watch(root, (paths) => this.record(projectId, paths), { debounceMs: 400, maxPaths: 100 })
    this.entries.set(projectId, e)
  }

  /** App vừa ghi các đường dẫn này (kể cả thư mục: bỏ qua mọi thứ bên trong). */
  markOwn(projectId: string, relPaths: string[]): void {
    const e = this.entries.get(projectId)
    if (!e) return
    const until = this.now() + OWN_WRITE_WINDOW_MS
    for (const p of relPaths) {
      const k = norm(p)
      e.own.set(k, until)
      e.changed.delete(k)
    }
  }

  /** Ghi nhận sự kiện từ bộ theo dõi (công khai để kiểm thử). */
  record(projectId: string, paths: string[]): void {
    const e = this.entries.get(projectId)
    if (!e) return
    const t = this.now()
    for (const [k, until] of e.own) if (until < t) e.own.delete(k)
    for (const p of paths) {
      const k = norm(p)
      if (!k) continue
      let mine = false
      for (const o of e.own.keys()) {
        if (k === o || k.startsWith(o + "/") || o.startsWith(k + "/")) {
          mine = true
          break
        }
      }
      if (mine) continue
      if (e.changed.size >= MAX_PENDING) {
        e.overflow = true
        continue
      }
      e.changed.add(k)
    }
  }

  /** Lấy (và xoá) danh sách thay đổi bên ngoài kể từ lần lấy trước. */
  take(projectId: string): string[] {
    const e = this.entries.get(projectId)
    if (!e) return []
    // Bỏ thư mục cha khi đã có tệp con cụ thể (FSEvents/ReadDirectoryChanges hay báo cả hai).
    const all = [...e.changed]
    const out = all.filter((p) => !all.some((q) => q !== p && q.startsWith(p + "/"))).sort()
    if (e.overflow) out.push("… và nhiều tệp khác (đã thay đổi hàng loạt)")
    e.changed.clear()
    e.overflow = false
    return out
  }

  stop(projectId: string): void {
    const e = this.entries.get(projectId)
    if (!e) return
    e.handle.close()
    this.entries.delete(projectId)
  }

  closeAll(): void {
    for (const id of [...this.entries.keys()]) this.stop(id)
  }
}

function norm(p: string): string {
  return p.normalize("NFC").split(/[\\/]+/).filter(Boolean).join("/")
}
