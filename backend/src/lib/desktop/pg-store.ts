/**
 * Lưu token ứng dụng máy tính + nhật ký sử dụng trong Postgres (ai_portal.desktop_tokens / desktop_usage).
 * Bảng được tạo bằng migration 025; `ensureDesktopTables()` chạy lại cùng tệp SQL (idempotent) phòng trường hợp
 * runner bỏ qua do trùng số phiên bản với nhánh khác.
 */
import fs from "fs"
import path from "path"
import { query } from "../db"
import { getBackendRoot } from "../paths"
import type { DesktopTokenRow, DesktopTokenStore, DesktopUser } from "./tokens"

const MIGRATION_FILE = "025_desktop_tokens.sql"
let ensured: Promise<boolean> | null = null

export function ensureDesktopTables(): Promise<boolean> {
  if (!ensured) {
    ensured = (async () => {
      try {
        const candidates = [
          path.join(getBackendRoot(), "migrations", MIGRATION_FILE),
          path.join(__dirname, "..", "..", "..", "migrations", MIGRATION_FILE),
        ]
        const file = candidates.find((f) => fs.existsSync(f))
        if (!file) throw new Error(`${MIGRATION_FILE} not found`)
        await query(fs.readFileSync(file, "utf8"))
        return true
      } catch (e: any) {
        console.warn("[desktop] ensure tables failed:", e?.message ?? e)
        ensured = null
        return false
      }
    })()
  }
  return ensured
}

const COLS = `id, user_id, device_name, platform, app_version, access_hash, access_expires_at, refresh_hash, refresh_expires_at,
  prev_refresh_hash, absolute_expires_at, created_at, last_used_at, revoked_at, revoked_reason`

export class PgDesktopTokenStore implements DesktopTokenStore {
  private async one(sql: string, params: unknown[]): Promise<DesktopTokenRow | null> {
    await ensureDesktopTables()
    const r = await query<DesktopTokenRow>(sql, params)
    return r.rows[0] ?? null
  }

  async insert(row: Omit<DesktopTokenRow, "id" | "created_at" | "last_used_at" | "revoked_at" | "revoked_reason">): Promise<DesktopTokenRow> {
    const r = await this.one(
      `INSERT INTO ai_portal.desktop_tokens
         (user_id, device_name, platform, app_version, access_hash, access_expires_at, refresh_hash, refresh_expires_at, prev_refresh_hash, absolute_expires_at)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${COLS}`,
      [
        row.user_id,
        row.device_name,
        row.platform,
        row.app_version,
        row.access_hash,
        row.access_expires_at,
        row.refresh_hash,
        row.refresh_expires_at,
        row.prev_refresh_hash,
        row.absolute_expires_at,
      ],
    )
    if (!r) throw new Error("insert desktop token failed")
    return r
  }
  findByAccessHash(hash: string) {
    return this.one(`SELECT ${COLS} FROM ai_portal.desktop_tokens WHERE access_hash = $1 LIMIT 1`, [hash])
  }
  findByRefreshHash(hash: string) {
    return this.one(`SELECT ${COLS} FROM ai_portal.desktop_tokens WHERE refresh_hash = $1 LIMIT 1`, [hash])
  }
  findByPrevRefreshHash(hash: string) {
    return this.one(`SELECT ${COLS} FROM ai_portal.desktop_tokens WHERE prev_refresh_hash = $1 LIMIT 1`, [hash])
  }
  async rotate(
    id: string,
    expect: string,
    next: Pick<DesktopTokenRow, "access_hash" | "access_expires_at" | "refresh_hash" | "refresh_expires_at" | "prev_refresh_hash">,
  ): Promise<boolean> {
    await ensureDesktopTables()
    const r = await query(
      `UPDATE ai_portal.desktop_tokens
          SET access_hash = $3, access_expires_at = $4, refresh_hash = $5, refresh_expires_at = $6, prev_refresh_hash = $7, last_used_at = now()
        WHERE id = $1::uuid AND refresh_hash = $2 AND revoked_at IS NULL`,
      [id, expect, next.access_hash, next.access_expires_at, next.refresh_hash, next.refresh_expires_at, next.prev_refresh_hash],
    )
    return (r.rowCount ?? 0) > 0
  }
  async touch(id: string): Promise<void> {
    await query(`UPDATE ai_portal.desktop_tokens SET last_used_at = now() WHERE id = $1::uuid`, [id])
  }
  async revoke(id: string, reason: string): Promise<void> {
    await ensureDesktopTables()
    await query(
      `UPDATE ai_portal.desktop_tokens SET revoked_at = now(), revoked_reason = $2 WHERE id = $1::uuid AND revoked_at IS NULL`,
      [id, reason],
    )
  }
  async listByUser(userId: string): Promise<DesktopTokenRow[]> {
    await ensureDesktopTables()
    const r = await query<DesktopTokenRow>(
      `SELECT ${COLS} FROM ai_portal.desktop_tokens WHERE user_id = $1::uuid ORDER BY created_at DESC LIMIT 200`,
      [userId],
    )
    return r.rows
  }
  async getUser(userId: string): Promise<DesktopUser | null> {
    const r = await query<{ id: string; email: string; name: string | null }>(
      `SELECT id::text AS id, email::text AS email, COALESCE(NULLIF(full_name,''), display_name) AS name FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
      [userId],
    )
    return r.rows[0] ?? null
  }
}

export interface UsageRecord {
  user_id: string
  token_id: string | null
  model: string | null
  status: string
  prompt_tokens: number
  completion_tokens: number
  input_chars: number
  tool_calls: number
  duration_ms: number
}

export interface DesktopUsageLog {
  record(u: UsageRecord): Promise<void>
  /** Tổng token đã dùng trong 24 giờ gần nhất. */
  tokensLast24h(userId: string): Promise<number>
}

export class PgDesktopUsageLog implements DesktopUsageLog {
  async record(u: UsageRecord): Promise<void> {
    await ensureDesktopTables()
    await query(
      `INSERT INTO ai_portal.desktop_usage (user_id, token_id, model, status, prompt_tokens, completion_tokens, input_chars, tool_calls, duration_ms)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)`,
      [u.user_id, u.token_id, u.model, u.status, u.prompt_tokens, u.completion_tokens, u.input_chars, u.tool_calls, u.duration_ms],
    )
  }
  async tokensLast24h(userId: string): Promise<number> {
    await ensureDesktopTables()
    const r = await query<{ s: string }>(
      `SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0)::text AS s FROM ai_portal.desktop_usage
        WHERE user_id = $1::uuid AND created_at > now() - interval '24 hours'`,
      [userId],
    )
    return Number(r.rows[0]?.s ?? 0)
  }
}

export class MemoryDesktopUsageLog implements DesktopUsageLog {
  records: (UsageRecord & { at: number })[] = []
  async record(u: UsageRecord) {
    this.records.push({ ...u, at: Date.now() })
  }
  async tokensLast24h(userId: string) {
    const since = Date.now() - 24 * 3600 * 1000
    return this.records.filter((r) => r.user_id === userId && r.at > since).reduce((s, r) => s + r.prompt_tokens + r.completion_tokens, 0)
  }
}
