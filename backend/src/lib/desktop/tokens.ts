/**
 * Token cho ứng dụng máy tính NEU Research (Electron).
 *
 * - Access token ngắn hạn (mặc định 1 giờ) + refresh token (mặc định 30 ngày, xoay vòng mỗi lần làm mới).
 * - Phiên thiết bị có hạn tuyệt đối (mặc định 180 ngày): hết hạn thì người dùng đăng nhập web lại trong app.
 * - CSDL chỉ lưu SHA-256 của token. Token gốc chỉ trả về MỘT lần cho tiến trình chính của app.
 * - Dùng lại refresh token cũ (đã xoay) → coi như bị lộ: thu hồi cả phiên thiết bị.
 * - Tài khoản khách / tài khoản hệ thống dùng chung không được cấp token.
 *
 * Phần lưu trữ tách thành interface `DesktopTokenStore` để kiểm thử không cần Postgres.
 */
import crypto from "crypto"
import { GUEST_USER_ID, SYSTEM_USER_ID } from "../chat/constants"

export const ACCESS_PREFIX = "neuda_"
export const REFRESH_PREFIX = "neudr_"

function envInt(name: string, def: number, min: number, max: number): number {
  const raw = process.env[name]
  const n = raw == null || raw.trim() === "" ? def : Number(raw)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.round(n)))
}

export interface TokenPolicy {
  accessTtlSec: number
  refreshTtlSec: number
  absoluteTtlSec: number
  /** Số phiên thiết bị còn hiệu lực tối đa cho một người dùng; vượt thì thu hồi phiên cũ nhất. */
  maxActivePerUser: number
}

export function tokenPolicy(): TokenPolicy {
  return {
    accessTtlSec: envInt("DESKTOP_ACCESS_TTL_SEC", 3600, 60, 24 * 3600),
    refreshTtlSec: envInt("DESKTOP_REFRESH_TTL_SEC", 30 * 24 * 3600, 3600, 180 * 24 * 3600),
    absoluteTtlSec: envInt("DESKTOP_ABSOLUTE_TTL_SEC", 180 * 24 * 3600, 3600, 365 * 24 * 3600),
    maxActivePerUser: envInt("DESKTOP_MAX_DEVICES", 10, 1, 100),
  }
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex")
}

export function newToken(prefix: string): string {
  return prefix + crypto.randomBytes(32).toString("base64url")
}

const TOKEN_RE = /^neud[ar]_[A-Za-z0-9_-]{43}$/

export function looksLikeToken(s: unknown, prefix?: string): s is string {
  return typeof s === "string" && TOKEN_RE.test(s) && (!prefix || s.startsWith(prefix))
}

/** Tài khoản không được cấp token: khách, bucket hệ thống, tài khoản khách theo thiết bị. */
export function isGuestLike(user: { id?: string | null; email?: string | null }): boolean {
  const id = (user.id || "").toLowerCase()
  const email = (user.email || "").trim().toLowerCase()
  if (!id) return true
  if (id === GUEST_USER_ID || id === SYSTEM_USER_ID) return true
  if (!email) return true
  if (email.endsWith("@portal.local") || email.endsWith("@local")) return true
  if (/^guest[-_@]/.test(email)) return true
  return false
}

export interface DesktopTokenRow {
  id: string
  user_id: string
  device_name: string | null
  platform: string | null
  app_version: string | null
  access_hash: string
  access_expires_at: Date
  refresh_hash: string
  refresh_expires_at: Date
  prev_refresh_hash: string | null
  absolute_expires_at: Date
  created_at: Date
  last_used_at: Date | null
  revoked_at: Date | null
  revoked_reason: string | null
}

export interface DesktopUser {
  id: string
  email: string
  name: string | null
}

export interface DesktopTokenStore {
  insert(row: Omit<DesktopTokenRow, "id" | "created_at" | "last_used_at" | "revoked_at" | "revoked_reason">): Promise<DesktopTokenRow>
  findByAccessHash(hash: string): Promise<DesktopTokenRow | null>
  findByRefreshHash(hash: string): Promise<DesktopTokenRow | null>
  findByPrevRefreshHash(hash: string): Promise<DesktopTokenRow | null>
  /** Xoay vòng: chỉ thành công nếu refresh_hash hiện tại vẫn là `expectRefreshHash` (chống làm mới song song). */
  rotate(
    id: string,
    expectRefreshHash: string,
    next: Pick<DesktopTokenRow, "access_hash" | "access_expires_at" | "refresh_hash" | "refresh_expires_at" | "prev_refresh_hash">,
  ): Promise<boolean>
  touch(id: string): Promise<void>
  revoke(id: string, reason: string): Promise<void>
  listByUser(userId: string): Promise<DesktopTokenRow[]>
  getUser(userId: string): Promise<DesktopUser | null>
}

export interface IssuedTokens {
  token_id: string
  access_token: string
  access_expires_at: string
  refresh_token: string
  refresh_expires_at: string
}

export class DesktopTokenError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
  }
}

function clip(s: unknown, n: number): string | null {
  if (typeof s !== "string") return null
  const t = s.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
  return t ? t.slice(0, n) : null
}

export class DesktopTokenService {
  constructor(
    private readonly store: DesktopTokenStore,
    private readonly policy: () => TokenPolicy = tokenPolicy,
    private readonly now: () => number = Date.now,
  ) {}

  async issue(user: { id: string; email: string | null }, meta: { device_name?: unknown; platform?: unknown; app_version?: unknown }): Promise<IssuedTokens> {
    if (isGuestLike(user)) throw new DesktopTokenError("Tài khoản khách không dùng được ứng dụng máy tính. Hãy đăng nhập bằng tài khoản NEU.", 403, "guest_not_allowed")
    const dbUser = await this.store.getUser(user.id)
    if (!dbUser || isGuestLike(dbUser)) throw new DesktopTokenError("Không tìm thấy tài khoản", 403, "user_not_found")
    const p = this.policy()
    const now = this.now()
    const access = newToken(ACCESS_PREFIX)
    const refresh = newToken(REFRESH_PREFIX)
    const absolute = new Date(now + p.absoluteTtlSec * 1000)
    const refreshExp = new Date(Math.min(now + p.refreshTtlSec * 1000, absolute.getTime()))
    const row = await this.store.insert({
      user_id: dbUser.id,
      device_name: clip(meta.device_name, 120),
      platform: clip(meta.platform, 32),
      app_version: clip(meta.app_version, 32),
      access_hash: sha256(access),
      access_expires_at: new Date(Math.min(now + p.accessTtlSec * 1000, refreshExp.getTime())),
      refresh_hash: sha256(refresh),
      refresh_expires_at: refreshExp,
      prev_refresh_hash: null,
      absolute_expires_at: absolute,
    })
    // Giới hạn số thiết bị: thu hồi phiên cũ nhất.
    const active = (await this.store.listByUser(dbUser.id)).filter((r) => this.isActive(r))
    if (active.length > p.maxActivePerUser) {
      const old = active.sort((a, b) => a.created_at.getTime() - b.created_at.getTime()).slice(0, active.length - p.maxActivePerUser)
      for (const r of old) if (r.id !== row.id) await this.store.revoke(r.id, "max_devices")
    }
    return {
      token_id: row.id,
      access_token: access,
      access_expires_at: row.access_expires_at.toISOString(),
      refresh_token: refresh,
      refresh_expires_at: row.refresh_expires_at.toISOString(),
    }
  }

  private isActive(r: DesktopTokenRow): boolean {
    const now = this.now()
    return !r.revoked_at && r.refresh_expires_at.getTime() > now && r.absolute_expires_at.getTime() > now
  }

  /** Xác thực access token (header Authorization: Bearer). */
  async verifyAccess(token: unknown): Promise<{ row: DesktopTokenRow; user: DesktopUser }> {
    if (!looksLikeToken(token, ACCESS_PREFIX)) throw new DesktopTokenError("Thiếu hoặc sai token ứng dụng", 401, "invalid_token")
    const row = await this.store.findByAccessHash(sha256(token))
    if (!row) throw new DesktopTokenError("Token ứng dụng không hợp lệ", 401, "invalid_token")
    if (row.revoked_at) throw new DesktopTokenError("Token ứng dụng đã bị thu hồi", 401, "revoked")
    const now = this.now()
    if (row.access_expires_at.getTime() <= now || row.absolute_expires_at.getTime() <= now) {
      throw new DesktopTokenError("Token ứng dụng đã hết hạn", 401, "expired")
    }
    const user = await this.store.getUser(row.user_id)
    if (!user || isGuestLike(user)) throw new DesktopTokenError("Tài khoản không còn hiệu lực", 401, "user_not_found")
    // Ghi last_used_at thưa (không chặn yêu cầu).
    if (!row.last_used_at || now - row.last_used_at.getTime() > 60_000) void this.store.touch(row.id).catch(() => {})
    return { row, user }
  }

  async refresh(refreshToken: unknown): Promise<IssuedTokens> {
    if (!looksLikeToken(refreshToken, REFRESH_PREFIX)) throw new DesktopTokenError("Refresh token không hợp lệ", 401, "invalid_token")
    const h = sha256(refreshToken)
    const row = await this.store.findByRefreshHash(h)
    if (!row) {
      const reused = await this.store.findByPrevRefreshHash(h)
      if (reused && !reused.revoked_at) await this.store.revoke(reused.id, "refresh_reuse")
      throw new DesktopTokenError("Refresh token không hợp lệ", 401, reused ? "refresh_reuse" : "invalid_token")
    }
    if (row.revoked_at) throw new DesktopTokenError("Thiết bị đã bị ngắt kết nối", 401, "revoked")
    const p = this.policy()
    const now = this.now()
    if (row.refresh_expires_at.getTime() <= now || row.absolute_expires_at.getTime() <= now) {
      throw new DesktopTokenError("Phiên ứng dụng đã hết hạn, hãy kết nối lại", 401, "expired")
    }
    const user = await this.store.getUser(row.user_id)
    if (!user || isGuestLike(user)) throw new DesktopTokenError("Tài khoản không còn hiệu lực", 401, "user_not_found")
    const access = newToken(ACCESS_PREFIX)
    const refresh = newToken(REFRESH_PREFIX)
    const refreshExp = new Date(Math.min(now + p.refreshTtlSec * 1000, row.absolute_expires_at.getTime()))
    const accessExp = new Date(Math.min(now + p.accessTtlSec * 1000, refreshExp.getTime()))
    const ok = await this.store.rotate(row.id, h, {
      access_hash: sha256(access),
      access_expires_at: accessExp,
      refresh_hash: sha256(refresh),
      refresh_expires_at: refreshExp,
      prev_refresh_hash: h,
    })
    if (!ok) throw new DesktopTokenError("Refresh token vừa được dùng, hãy thử lại", 409, "conflict")
    return {
      token_id: row.id,
      access_token: access,
      access_expires_at: accessExp.toISOString(),
      refresh_token: refresh,
      refresh_expires_at: refreshExp.toISOString(),
    }
  }

  /** Thu hồi theo access hoặc refresh token (app tự ngắt kết nối). */
  async revokeByToken(token: unknown): Promise<boolean> {
    if (!looksLikeToken(token)) return false
    const h = sha256(token)
    const row = token.startsWith(ACCESS_PREFIX) ? await this.store.findByAccessHash(h) : await this.store.findByRefreshHash(h)
    if (!row) return false
    if (!row.revoked_at) await this.store.revoke(row.id, "app_signout")
    return true
  }

  /** Người dùng (đăng nhập web) thu hồi một thiết bị của chính mình. */
  async revokeForUser(userId: string, tokenId: string): Promise<boolean> {
    const rows = await this.store.listByUser(userId)
    const row = rows.find((r) => r.id === tokenId)
    if (!row) return false
    if (!row.revoked_at) await this.store.revoke(row.id, "user_revoked")
    return true
  }

  async listForUser(userId: string): Promise<
    { id: string; device_name: string | null; platform: string | null; app_version: string | null; created_at: string; last_used_at: string | null; active: boolean }[]
  > {
    const rows = await this.store.listByUser(userId)
    return rows
      .filter((r) => !r.revoked_at)
      .map((r) => ({
        id: r.id,
        device_name: r.device_name,
        platform: r.platform,
        app_version: r.app_version,
        created_at: r.created_at.toISOString(),
        last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
        active: this.isActive(r),
      }))
  }
}

/** Bộ nhớ trong — dùng cho kiểm thử. */
export class MemoryDesktopTokenStore implements DesktopTokenStore {
  rows: DesktopTokenRow[] = []
  users = new Map<string, DesktopUser>()

  async insert(row: Omit<DesktopTokenRow, "id" | "created_at" | "last_used_at" | "revoked_at" | "revoked_reason">): Promise<DesktopTokenRow> {
    const full: DesktopTokenRow = { ...row, id: crypto.randomUUID(), created_at: new Date(), last_used_at: null, revoked_at: null, revoked_reason: null }
    this.rows.push(full)
    return { ...full }
  }
  async findByAccessHash(hash: string) {
    return this.rows.find((r) => r.access_hash === hash) ?? null
  }
  async findByRefreshHash(hash: string) {
    return this.rows.find((r) => r.refresh_hash === hash) ?? null
  }
  async findByPrevRefreshHash(hash: string) {
    return this.rows.find((r) => r.prev_refresh_hash === hash) ?? null
  }
  async rotate(id: string, expect: string, next: Pick<DesktopTokenRow, "access_hash" | "access_expires_at" | "refresh_hash" | "refresh_expires_at" | "prev_refresh_hash">) {
    const r = this.rows.find((x) => x.id === id)
    if (!r || r.refresh_hash !== expect || r.revoked_at) return false
    Object.assign(r, next)
    return true
  }
  async touch(id: string) {
    const r = this.rows.find((x) => x.id === id)
    if (r) r.last_used_at = new Date()
  }
  async revoke(id: string, reason: string) {
    const r = this.rows.find((x) => x.id === id)
    if (r && !r.revoked_at) {
      r.revoked_at = new Date()
      r.revoked_reason = reason
    }
  }
  async listByUser(userId: string) {
    return this.rows.filter((r) => r.user_id === userId)
  }
  async getUser(userId: string) {
    return this.users.get(userId) ?? null
  }
}
