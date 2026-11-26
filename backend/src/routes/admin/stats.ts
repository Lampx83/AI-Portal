import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly, allowAdmin } from "./middleware"

const ONLINE_ACTIVITY_MINUTES = 15
const ONLINE_LOGIN_MINUTES = 60
const MAX_RANGE_DAYS = 3650

/** Khoảng thời gian thống kê: ?days=7..3650 (days=0 hoặc "all" = toàn bộ lịch sử). Mặc định 30. */
function parseRangeDays(raw: unknown): number {
  if (raw === "all" || raw === "0" || raw === 0) return MAX_RANGE_DAYS
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 30
  return Math.min(Math.max(Math.floor(n), 7), MAX_RANGE_DAYS)
}

/** Gom nhóm theo độ dài khoảng: <=90 ngày theo ngày, <=400 ngày theo tuần (thứ Hai), dài hơn theo tháng. */
function granularityFor(days: number): "day" | "week" | "month" {
  if (days <= 90) return "day"
  if (days <= 400) return "week"
  return "month"
}

const router = Router()

router.get("/logins-per-day", adminOnly, async (req: Request, res: Response) => {
  try {
    const days = parseRangeDays(req.query.days)
    const g = granularityFor(days)
    const result = await query<{ day: string; count: string }>(
      `
      SELECT
        to_char(date_trunc('${g}', login_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*)::text AS count
      FROM ai_portal.login_events
      WHERE login_at >= NOW() - (($1::text || ' days')::interval)
      GROUP BY 1
      ORDER BY day
      `,
      [days]
    )
    const data = result.rows.map((r) => ({ day: r.day, count: parseInt(r.count, 10) }))
    res.json({ data, granularity: g, days })
  } catch (err: any) {
    console.error("Error fetching logins-per-day:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined,
    })
  }
})

router.get("/messages-per-day", adminOnly, async (req: Request, res: Response) => {
  try {
    const days = parseRangeDays(req.query.days)
    const g = granularityFor(days)
    const result = await query<{ day: string; count: string }>(
      `
      SELECT 
        to_char(date_trunc('${g}', created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*)::text AS count
      FROM ai_portal.messages
      WHERE created_at >= (NOW() AT TIME ZONE 'UTC' - ($1::text || ' days')::interval)
      GROUP BY 1
      ORDER BY day
      `,
      [days]
    )
    const data = result.rows.map((r) => ({ day: r.day, count: parseInt(r.count, 10) }))
    res.json({ data, granularity: g, days })
  } catch (err: any) {
    console.error("Error fetching messages-per-day:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined,
    })
  }
})

router.get("/messages-by-source", adminOnly, async (req: Request, res: Response) => {
  try {
    const days = req.query.days != null ? parseRangeDays(req.query.days) : null
    const result = await query<{ source: string; count: string }>(
      `
      SELECT COALESCE(s.source, 'web') AS source, COUNT(*)::text AS count
      FROM ai_portal.messages m
      JOIN ai_portal.chat_sessions s ON s.id = m.session_id
      ${days != null ? "WHERE m.created_at >= NOW() - (($1::text || ' days')::interval)" : ""}
      GROUP BY s.source
      `,
      days != null ? [days] : []
    )
    const data = result.rows.map((r) => ({
      source: r.source === "embed" ? "embed" : "web",
      count: parseInt(r.count, 10),
    }))
    res.json({ data })
  } catch (err: any) {
    console.error("Error fetching messages-by-source:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined,
    })
  }
})

router.get("/messages-by-agent", adminOnly, async (req: Request, res: Response) => {
  try {
    const days = req.query.days != null ? parseRangeDays(req.query.days) : null
    const result = await query<{ assistant_alias: string; count: string }>(
      `
      SELECT COALESCE(m.assistant_alias, s.assistant_alias, 'central') AS assistant_alias,
             COUNT(*)::text AS count
      FROM ai_portal.messages m
      JOIN ai_portal.chat_sessions s ON s.id = m.session_id
      ${days != null ? "WHERE m.created_at >= NOW() - (($1::text || ' days')::interval)" : ""}
      GROUP BY COALESCE(m.assistant_alias, s.assistant_alias, 'central')
      ORDER BY count DESC
      `,
      days != null ? [days] : []
    )
    const data = result.rows.map((r) => ({
      assistant_alias: r.assistant_alias || "central",
      count: parseInt(r.count, 10),
    }))
    res.json({ data })
  } catch (err: any) {
    console.error("Error fetching messages-by-agent:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined,
    })
  }
})

router.get("/tool-opens-by-alias", adminOnly, async (req: Request, res: Response) => {
  try {
    const { getToolOpensByAlias } = await import("../../lib/tool-usage")
    const days = req.query.days != null ? parseRangeDays(req.query.days) : undefined
    const data = await getToolOpensByAlias(days)
    res.json({ data })
  } catch (err: any) {
    console.error("Error fetching tool-opens-by-alias:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined,
    })
  }
})

router.get("/pageviews-per-day", adminOnly, async (req: Request, res: Response) => {
  try {
    const days = parseRangeDays(req.query.days)
    const g = granularityFor(days)
    const result = await query<{ day: string; count: string; unique_visitors: string }>(
      `
      SELECT
        to_char(date_trunc('${g}', created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*)::text AS count,
        COUNT(DISTINCT COALESCE(user_id::text, guest_device_id, ''))::text AS unique_visitors
      FROM ai_portal.page_views
      WHERE created_at >= NOW() - (($1::text || ' days')::interval)
      GROUP BY 1
      ORDER BY day
      `,
      [days]
    )
    const data = result.rows.map((r) => ({
      day: r.day,
      count: parseInt(r.count, 10),
      unique_visitors: parseInt(r.unique_visitors, 10),
    }))
    res.json({ data, granularity: g, days })
  } catch (err: any) {
    console.error("Error fetching pageviews-per-day:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined,
    })
  }
})

router.get("/online-users", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query<{ user_id: string }>(
      `
      SELECT DISTINCT user_id FROM (
        SELECT s.user_id
        FROM ai_portal.chat_sessions s
        WHERE (
            s.updated_at > now() - ($1::text || ' minutes')::interval
            OR s.created_at > now() - ($1::text || ' minutes')::interval
          )
          AND s.user_id IS NOT NULL
          AND s.user_id != '00000000-0000-0000-0000-000000000000'::uuid
        UNION
        SELECT u.id AS user_id
        FROM ai_portal.users u
        WHERE u.last_login_at > now() - ($2::text || ' minutes')::interval
          AND u.id IS NOT NULL
          AND u.id != '00000000-0000-0000-0000-000000000000'::uuid
      ) t
      `,
      [ONLINE_ACTIVITY_MINUTES, ONLINE_LOGIN_MINUTES]
    )
    const user_ids = result.rows.map((r) => r.user_id)
    res.json({ count: user_ids.length, user_ids })
  } catch (err: any) {
    console.error("Error fetching online-users:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined,
    })
  }
})

export default router
