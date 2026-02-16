import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly, allowAdmin } from "./middleware"

const ONLINE_ACTIVITY_MINUTES = 15
const ONLINE_LOGIN_MINUTES = 60
const router = Router()

router.get("/logins-per-day", adminOnly, async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)
    const result = await query<{ day: string; count: string }>(
      `
      SELECT
        to_char((login_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*)::text AS count
      FROM ai_portal.login_events
      WHERE login_at >= NOW() - (($1::text || ' days')::interval)
      GROUP BY (login_at AT TIME ZONE 'UTC')::date
      ORDER BY day
      `,
      [days]
    )
    const data = result.rows.map((r) => ({ day: r.day, count: parseInt(r.count, 10) }))
    res.json({ data })
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
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)
    const result = await query<{ day: string; count: string }>(
      `
      SELECT 
        to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*)::text AS count
      FROM ai_portal.messages
      WHERE created_at >= (NOW() AT TIME ZONE 'UTC' - ($1::text || ' days')::interval)
      GROUP BY (created_at AT TIME ZONE 'UTC')::date
      ORDER BY day
      `,
      [days]
    )
    const data = result.rows.map((r) => ({ day: r.day, count: parseInt(r.count, 10) }))
    res.json({ data })
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
    const result = await query<{ source: string; count: string }>(
      `
      SELECT COALESCE(s.source, 'web') AS source, COUNT(*)::text AS count
      FROM ai_portal.messages m
      JOIN ai_portal.chat_sessions s ON s.id = m.session_id
      GROUP BY s.source
      `
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
    const result = await query<{ assistant_alias: string; count: string }>(
      `
      SELECT COALESCE(s.assistant_alias, 'central') AS assistant_alias, COUNT(*)::text AS count
      FROM ai_portal.messages m
      JOIN ai_portal.chat_sessions s ON s.id = m.session_id
      GROUP BY s.assistant_alias
      ORDER BY count DESC
      `
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
