// lib/chat/limits.ts
import { query } from "../db"
import { getAgentDailyMessageLimitByAlias, getEmbedDailyLimitByAlias } from "../assistants"
import { GUEST_USER_ID, SYSTEM_USER_ID } from "./constants"

export type LimitResult =
  | { allowed: true }
  | { allowed: false; status: 429; body: Record<string, unknown> }

/** Daily message limit per user (admin/developer exempt). Not applied to system/guest. */
export async function checkUserDailyLimit(resolvedUserId: string): Promise<LimitResult> {
  if (resolvedUserId === SYSTEM_USER_ID || resolvedUserId === GUEST_USER_ID) {
    return { allowed: true }
  }

  const userLimitRow = await query<{
    role?: string
    is_admin?: boolean
    daily_message_limit: number
    extra: string | null
  }>(
    `SELECT COALESCE(u.role, CASE WHEN u.is_admin THEN 'admin' ELSE 'user' END) AS role, u.is_admin, COALESCE(u.daily_message_limit, 10) AS daily_message_limit,
     (SELECT o.extra_messages FROM ai_portal.user_daily_limit_overrides o
      WHERE o.user_id = u.id AND o.override_date = current_date LIMIT 1) AS extra
     FROM ai_portal.users u WHERE u.id = $1::uuid LIMIT 1`,
    [resolvedUserId]
  )

  if (!userLimitRow.rows[0]) return { allowed: true }

  const { role, is_admin, daily_message_limit: baseLimit, extra } = userLimitRow.rows[0]
  const isAdminOrDev = role === "admin" || role === "developer" || !!is_admin
  const extraMessages = typeof extra === "number" ? extra : (extra != null ? parseInt(String(extra), 10) : 0)
  const effectiveUserLimit = Math.max(0, (baseLimit ?? 10) + (Number.isInteger(extraMessages) ? extraMessages : 0))

  if (isAdminOrDev || effectiveUserLimit <= 0) return { allowed: true }

  const userCountRow = await query<{ count: string }>(
    `SELECT COALESCE((SELECT ud.count::text FROM ai_portal.user_daily_message_sends ud
      WHERE ud.user_id = $1::uuid AND ud.send_date = current_date LIMIT 1), '0') AS count`,
    [resolvedUserId]
  )
  const userTodayCount = parseInt(userCountRow.rows[0]?.count ?? "0", 10)
  if (userTodayCount >= effectiveUserLimit) {
    return {
      allowed: false,
      status: 429,
      body: {
        error: "daily_limit_exceeded",
        message: "Bạn đã đạt giới hạn tin nhắn cho ngày hôm nay. Vui lòng thử lại vào ngày mai hoặc liên hệ quản trị viên.",
        limit: effectiveUserLimit,
        used: userTodayCount,
      },
    }
  }
  return { allowed: true }
}

/** Daily message limit per agent (alias). */
export async function checkAgentDailyLimit(assistantAlias: string): Promise<LimitResult> {
  const agentLimit = await getAgentDailyMessageLimitByAlias(assistantAlias)
  if (agentLimit <= 0) return { allowed: true }

  const agentCountRow = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ai_portal.messages m
     JOIN ai_portal.chat_sessions s ON s.id = m.session_id
     WHERE s.assistant_alias = $1 AND m.role = 'user' AND m.created_at >= date_trunc('day', now())`,
    [assistantAlias]
  )
  const agentTodayCount = parseInt(agentCountRow.rows[0]?.count ?? "0", 10)
  if (agentTodayCount >= agentLimit) {
    return {
      allowed: false,
      status: 429,
      body: {
        error: "agent_daily_limit_exceeded",
        message: "Agent đã đạt giới hạn tin nhắn cho ngày hôm nay. Vui lòng thử lại vào ngày mai.",
        limit: agentLimit,
        used: agentTodayCount,
      },
    }
  }
  return { allowed: true }
}

/** Daily message limit for embed (by alias). Call only when source === 'embed'. */
export async function checkEmbedDailyLimit(assistantAlias: string): Promise<LimitResult> {
  const dailyLimit = await getEmbedDailyLimitByAlias(assistantAlias)
  if (dailyLimit == null || dailyLimit <= 0) return { allowed: true }

  const countResult = await query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM ai_portal.messages m
    JOIN ai_portal.chat_sessions s ON s.id = m.session_id
    WHERE s.source = 'embed' AND s.assistant_alias = $1
      AND m.created_at >= date_trunc('day', now())
      AND m.role = 'user'
    `,
    [assistantAlias]
  )
  const todayCount = parseInt(countResult.rows[0]?.count ?? "0", 10)
  if (todayCount >= dailyLimit) {
    return {
      allowed: false,
      status: 429,
      body: {
        error: "daily_limit_exceeded",
        message: "Đã đạt giới hạn tin nhắn cho ngày hôm nay. Vui lòng thử lại vào ngày mai.",
      },
    }
  }
  return { allowed: true }
}

export type GuestLimitResult =
  | { allowed: true }
  | {
      allowed: false
      /** When guest limit exceeded: create session + 2 messages (user + assistant) then return this. */
      status: 429
      body: Record<string, unknown>
    }

/** Guest limit: N messages/day/device/assistant (N from app_settings.guest_daily_message_limit, default 1). Call when isGuest === true. */
export async function checkGuestDailyLimit(
  deviceId: string,
  assistantAlias: string
): Promise<GuestLimitResult> {
  let guestLimit = 1
  try {
    const settingRow = await query<{ value: string }>(
      `SELECT value FROM ai_portal.app_settings WHERE key = 'guest_daily_message_limit' LIMIT 1`
    )
    const v = settingRow.rows[0]?.value
    const n = parseInt(String(v ?? "1"), 10)
    if (Number.isInteger(n) && n >= 0) guestLimit = n
  } catch {
    guestLimit = 1
  }

  const deviceIdForLimit = deviceId || "anonymous"
  const guestUsed = await query<{ message_count: number }>(
    `SELECT COALESCE(message_count, 1) AS message_count FROM ai_portal.guest_device_daily_usage
     WHERE device_id = $1 AND assistant_alias = $2 AND usage_date = current_date LIMIT 1`,
    [deviceIdForLimit, assistantAlias]
  )
  const currentCount = guestUsed.rows[0]?.message_count ?? 0
  if (currentCount >= guestLimit) {
    return {
      allowed: false,
      status: 429,
      body: {},
    }
  }
  return { allowed: true }
}
