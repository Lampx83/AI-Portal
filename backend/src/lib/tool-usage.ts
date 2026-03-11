/**
 * Thống kê số lần mở app (tool) — lưu theo ngày, dùng cho Admin Overview.
 */
import { query } from "./db"

let tableEnsured = false

async function ensureTable(): Promise<void> {
  if (tableEnsured) return
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ai_portal.tool_daily_usage (
        tool_alias  TEXT NOT NULL,
        usage_date  DATE NOT NULL DEFAULT current_date,
        open_count  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (tool_alias, usage_date)
      )
    `)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_tool_daily_usage_usage_date
      ON ai_portal.tool_daily_usage(usage_date)
    `)
    tableEnsured = true
  } catch (e: unknown) {
    console.warn("[tool-usage] ensureTable:", (e as Error)?.message || e)
  }
}

/**
 * Ghi nhận một lần mở app (gọi khi user vào /tools/:alias).
 */
export async function recordToolOpen(alias: string): Promise<void> {
  const a = (alias || "").trim().toLowerCase()
  if (!a) return
  try {
    await ensureTable()
    await query(
      `INSERT INTO ai_portal.tool_daily_usage (tool_alias, usage_date, open_count, updated_at)
       VALUES ($1, current_date, 1, now())
       ON CONFLICT (tool_alias, usage_date)
       DO UPDATE SET open_count = ai_portal.tool_daily_usage.open_count + 1, updated_at = now()`,
      [a]
    )
  } catch (e: unknown) {
    console.warn("[tool-usage] recordToolOpen:", (e as Error)?.message || e)
  }
}

/**
 * Tổng số lần mở theo từng tool (toàn thời gian). Dùng cho Admin Overview.
 */
export async function getToolOpensByAlias(): Promise<{ tool_alias: string; count: number }[]> {
  try {
    await ensureTable()
    const result = await query<{ tool_alias: string; count: string }>(
      `SELECT tool_alias, COALESCE(SUM(open_count), 0)::text AS count
       FROM ai_portal.tool_daily_usage
       GROUP BY tool_alias
       ORDER BY count DESC`
    )
    return result.rows.map((r) => ({
      tool_alias: r.tool_alias || "",
      count: parseInt(r.count, 10) || 0,
    }))
  } catch (e: unknown) {
    console.warn("[tool-usage] getToolOpensByAlias:", (e as Error)?.message || e)
    return []
  }
}
