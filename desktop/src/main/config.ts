/**
 * Cấu hình ứng dụng lưu trong thư mục userData (`neu-desktop-config.json`).
 * Không chứa bí mật: chỉ địa chỉ máy chủ, kích thước cửa sổ, liên kết dự án → thư mục.
 * Phiên đăng nhập (cookie) do Chromium lưu trong partition riêng, không nằm ở đây.
 */
import fs from "fs"
import path from "path"

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
  zoomLevel?: number
}

export interface LinkedFolderRecord {
  path: string
  linkedAt: string
}

export interface AppConfig {
  version: 1
  /** Địa chỉ hệ thống web. */
  portalUrl: string
  /** Ngôn ngữ menu; không đặt = theo ngôn ngữ hệ điều hành. */
  menuLocale?: "vi" | "en"
  windowState?: WindowState
  /** Thêm máy chủ đăng nhập (ngoài danh sách mặc định) được phép mở ngay trong cửa sổ. */
  extraAuthHosts?: string[]
  /** origin hệ thống → projectId → thư mục. Tách theo origin để dự án trên máy chủ khác nhau không lẫn. */
  linkedFolders: Record<string, Record<string, LinkedFolderRecord>>
}

export const DEFAULT_PORTAL_URL = "https://research.neu.edu.vn"

export function defaultConfig(): AppConfig {
  return { version: 1, portalUrl: DEFAULT_PORTAL_URL, linkedFolders: {} }
}

function sanitize(raw: unknown): AppConfig {
  const base = defaultConfig()
  if (!raw || typeof raw !== "object") return base
  const r = raw as Partial<AppConfig>
  if (typeof r.portalUrl === "string" && r.portalUrl.trim()) base.portalUrl = r.portalUrl.trim()
  if (r.menuLocale === "vi" || r.menuLocale === "en") base.menuLocale = r.menuLocale
  if (r.windowState && typeof r.windowState === "object") {
    const w = r.windowState
    if (Number.isFinite(w.width) && Number.isFinite(w.height)) {
      base.windowState = {
        width: Math.max(400, Math.round(w.width)),
        height: Math.max(300, Math.round(w.height)),
        isMaximized: !!w.isMaximized,
        ...(Number.isFinite(w.x) && Number.isFinite(w.y) ? { x: Math.round(w.x!), y: Math.round(w.y!) } : {}),
        ...(Number.isFinite(w.zoomLevel) ? { zoomLevel: w.zoomLevel } : {}),
      }
    }
  }
  if (Array.isArray(r.extraAuthHosts)) {
    base.extraAuthHosts = r.extraAuthHosts.filter((h): h is string => typeof h === "string" && /^[a-z0-9.-]+$/i.test(h))
  }
  if (r.linkedFolders && typeof r.linkedFolders === "object") {
    for (const [origin, map] of Object.entries(r.linkedFolders)) {
      if (!map || typeof map !== "object") continue
      const clean: Record<string, LinkedFolderRecord> = {}
      for (const [pid, rec] of Object.entries(map)) {
        if (rec && typeof rec === "object" && typeof rec.path === "string" && path.isAbsolute(rec.path)) {
          clean[pid] = { path: rec.path, linkedAt: typeof rec.linkedAt === "string" ? rec.linkedAt : new Date(0).toISOString() }
        }
      }
      base.linkedFolders[origin] = clean
    }
  }
  return base
}

export class ConfigStore {
  private data: AppConfig
  private timer: NodeJS.Timeout | null = null

  constructor(readonly file: string) {
    this.data = ConfigStore.read(file)
  }

  static read(file: string): AppConfig {
    try {
      return sanitize(JSON.parse(fs.readFileSync(file, "utf8")))
    } catch {
      return defaultConfig()
    }
  }

  get(): AppConfig {
    return this.data
  }

  update(mut: (c: AppConfig) => void, opts: { debounce?: boolean } = {}): void {
    mut(this.data)
    if (opts.debounce) {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.flush(), 400)
    } else {
      this.flush()
    }
  }

  /** Ghi nguyên tử: ghi tệp tạm rồi đổi tên (tránh hỏng tệp khi tắt máy giữa chừng). */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { encoding: "utf8", mode: 0o600 })
    fs.renameSync(tmp, this.file)
  }
}
