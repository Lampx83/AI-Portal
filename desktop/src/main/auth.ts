/**
 * Token của ứng dụng (giai đoạn 2) — chỉ sống trong tiến trình chính.
 *
 * - Xin token: tiến trình chính gọi POST /api/desktop/token bằng cookie đăng nhập web trong partition của app
 *   (session.fetch) + header X-NEU-Desktop-Client. Token KHÔNG đi qua trang web.
 * - Lưu: mã hoá bằng safeStorage (macOS Keychain / Windows DPAPI) vào `neu-desktop-auth.json` trong userData,
 *   tách theo origin máy chủ. Máy không có kho khoá (Linux thiếu keyring) → chỉ giữ trong bộ nhớ.
 * - Access token ngắn hạn, tự làm mới bằng refresh token (xoay vòng). Bị thu hồi/hết hạn → xoá, báo ngắt kết nối.
 *
 * Không phụ thuộc trực tiếp Electron (tiêm các hàm) — kiểm thử đơn vị được.
 */
import fs from "fs"
import path from "path"

export interface SecretCodec {
  available(): boolean
  encrypt(plain: string): Buffer
  decrypt(data: Buffer): string
}

export interface StoredTokens {
  tokenId: string
  accessToken: string
  accessExpiresAt: string
  refreshToken: string
  refreshExpiresAt: string
  user: { id: string; email: string; name: string | null }
}

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<Response>

export interface DesktopAuthDeps {
  file: string
  codec: SecretCodec
  /** Origin + URL gốc của hệ thống hiện tại. */
  getPortal(): { origin: string; url: string }
  /** fetch MANG cookie đăng nhập web (Electron session.fetch) — chỉ dùng cho bước xin token. */
  cookieFetch: FetchLike
  /** fetch KHÔNG mang cookie (Electron net.fetch hoặc fetch của Node). */
  fetch: FetchLike
  device: { name: string; platform: string; version: string }
  now?: () => number
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 0,
  ) {
    super(message)
    this.name = "AuthError"
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export class DesktopAuth {
  private memory = new Map<string, StoredTokens>()
  private refreshing: Promise<StoredTokens> | null = null
  private readonly now: () => number

  constructor(private readonly deps: DesktopAuthDeps) {
    this.now = deps.now ?? Date.now
  }

  private key(): string {
    return this.deps.getPortal().origin + new URL(this.deps.getPortal().url).pathname.replace(/\/+$/, "")
  }

  apiUrl(p: string): string {
    return this.deps.getPortal().url.replace(/\/+$/, "") + p
  }

  // ───────────── lưu trữ mã hoá ─────────────
  private readFile(): Record<string, string> {
    try {
      const raw = JSON.parse(fs.readFileSync(this.deps.file, "utf8")) as { v?: number; entries?: Record<string, string> }
      return raw && typeof raw.entries === "object" && raw.entries ? raw.entries : {}
    } catch {
      return {}
    }
  }

  private writeFile(entries: Record<string, string>): void {
    fs.mkdirSync(path.dirname(this.deps.file), { recursive: true })
    const tmp = `${this.deps.file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, entries }), { encoding: "utf8", mode: 0o600 })
    fs.renameSync(tmp, this.deps.file)
  }

  load(): StoredTokens | null {
    const k = this.key()
    const mem = this.memory.get(k)
    if (mem) return mem
    if (!this.deps.codec.available()) return null
    const enc = this.readFile()[k]
    if (!enc) return null
    try {
      const t = JSON.parse(this.deps.codec.decrypt(Buffer.from(enc, "base64"))) as StoredTokens
      if (!t?.accessToken || !t?.refreshToken) return null
      this.memory.set(k, t)
      return t
    } catch {
      return null
    }
  }

  private store(t: StoredTokens | null): void {
    const k = this.key()
    if (t) this.memory.set(k, t)
    else this.memory.delete(k)
    if (!this.deps.codec.available()) return
    const entries = this.readFile()
    if (t) entries[k] = this.deps.codec.encrypt(JSON.stringify(t)).toString("base64")
    else delete entries[k]
    this.writeFile(entries)
  }

  secureStorage(): boolean {
    return this.deps.codec.available()
  }

  user(): StoredTokens["user"] | null {
    return this.load()?.user ?? null
  }

  // ───────────── xin / làm mới / thu hồi ─────────────
  async connect(): Promise<StoredTokens> {
    const res = await this.deps.cookieFetch(this.apiUrl("/api/desktop/token"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-NEU-Desktop-Client": "1" },
      body: JSON.stringify({ device_name: this.deps.device.name, platform: this.deps.device.platform, app_version: this.deps.device.version }),
    })
    const body = await readJson(res)
    if (!res.ok) {
      const code = String(body.code ?? "")
      const msg =
        res.status === 401
          ? "Bạn cần đăng nhập hệ thống (tài khoản NEU) trong ứng dụng trước."
          : code === "guest_not_allowed"
            ? "Tài khoản khách không dùng được trợ lý thư mục. Hãy đăng nhập bằng tài khoản NEU."
            : String(body.error ?? `Máy chủ từ chối (HTTP ${res.status})`)
      throw new AuthError(msg, code || "connect_failed", res.status)
    }
    const user = body.user as StoredTokens["user"] | undefined
    if (typeof body.access_token !== "string" || typeof body.refresh_token !== "string" || !user?.id) {
      throw new AuthError("Phản hồi cấp token không hợp lệ", "bad_response", res.status)
    }
    const t: StoredTokens = {
      tokenId: String(body.token_id ?? ""),
      accessToken: body.access_token,
      accessExpiresAt: String(body.access_expires_at),
      refreshToken: body.refresh_token,
      refreshExpiresAt: String(body.refresh_expires_at),
      user: { id: user.id, email: user.email, name: user.name ?? null },
    }
    this.store(t)
    return t
  }

  private async doRefresh(cur: StoredTokens): Promise<StoredTokens> {
    const res = await this.deps.fetch(this.apiUrl("/api/desktop/token/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: cur.refreshToken }),
    })
    const body = await readJson(res)
    if (!res.ok) {
      if (res.status === 401) {
        this.store(null)
        throw new AuthError("Phiên của ứng dụng đã hết hạn hoặc bị thu hồi. Hãy kết nối lại.", String(body.code ?? "expired"), 401)
      }
      throw new AuthError(String(body.error ?? `Không làm mới được token (HTTP ${res.status})`), "refresh_failed", res.status)
    }
    const next: StoredTokens = {
      ...cur,
      accessToken: String(body.access_token),
      accessExpiresAt: String(body.access_expires_at),
      refreshToken: String(body.refresh_token),
      refreshExpiresAt: String(body.refresh_expires_at),
    }
    this.store(next)
    return next
  }

  /** Access token còn hạn (tự làm mới nếu sắp hết). */
  async accessToken(force = false): Promise<string> {
    const cur = this.load()
    if (!cur) throw new AuthError("Ứng dụng chưa kết nối với tài khoản", "not_connected")
    if (!force && Date.parse(cur.accessExpiresAt) - this.now() > 60_000) return cur.accessToken
    if (!this.refreshing) {
      this.refreshing = this.doRefresh(cur).finally(() => {
        this.refreshing = null
      })
    }
    return (await this.refreshing).accessToken
  }

  /** Gọi API của app với Bearer; 401 → làm mới một lần rồi thử lại. */
  async authorizedFetch(p: string, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {}): Promise<Response> {
    let tok = await this.accessToken()
    let res = await this.deps.fetch(this.apiUrl(p), { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${tok}` } })
    if (res.status === 401) {
      tok = await this.accessToken(true)
      res = await this.deps.fetch(this.apiUrl(p), { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${tok}` } })
      if (res.status === 401) this.store(null)
    }
    return res
  }

  async disconnect(): Promise<void> {
    const cur = this.load()
    this.store(null)
    if (!cur) return
    try {
      await this.deps.fetch(this.apiUrl("/api/desktop/token/revoke"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: cur.refreshToken }),
      })
    } catch {
      /* mất mạng: token đã xoá khỏi máy; máy chủ sẽ tự hết hạn */
    }
  }
}
