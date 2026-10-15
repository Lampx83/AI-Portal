/**
 * Thống kê sử dụng cho Admin → «Thống kê sử dụng» (GET /api/admin/usage-stats).
 * Mọi mốc ngày tính theo giờ Asia/Ho_Chi_Minh. Truy vấn lọc theo khoảng thời gian trên các cột có index
 * (login_events.login_at, page_views.created_at, messages.created_at, users.created_at — xem migration 024).
 * Phần tính toán thuần (tỉ lệ quay lại, thang Likert, tỉ lệ lỗi) tách riêng để kiểm thử.
 */
import { query } from "../db"
import { SYSTEM_USER_ID, GUEST_USER_ID } from "../chat/constants"
import { MONITOR_TZ, addDays, diffDays, listDays, vnDateOf, type DateRange } from "./time"

// ─── Phần tính toán thuần ───────────────────────────────────────────────────

export interface ActivityPair {
  /** Khoá định danh (user_id hoặc guest_device_id). */
  k: string
  /** Ngày hoạt động YYYY-MM-DD (giờ VN). */
  d: string
}

export interface RetentionDay {
  day: string
  active: number
  returned: number
  rate: number | null
}

export interface RetentionResult {
  /** Tổng số (người, ngày) đủ điều kiện xét — ngày hôm sau đã trọn vẹn. */
  cohort: number
  returned: number
  rate: number | null
  series: RetentionDay[]
}

/**
 * Tỉ lệ quay lại ngày hôm sau: trong số người hoạt động ngày D (D trong [from, to]),
 * bao nhiêu người cũng hoạt động ngày D+1. Chỉ xét D khi D+1 đã trọn ngày (D+1 < hôm nay),
 * để không làm tụt tỉ lệ vì hôm nay chưa hết.
 */
export function computeNextDayRetention(pairs: ActivityPair[], from: string, to: string, today: string): RetentionResult {
  const byDay = new Map<string, Set<string>>()
  for (const p of pairs) {
    if (!p || !p.k || !p.d) continue
    let s = byDay.get(p.d)
    if (!s) byDay.set(p.d, (s = new Set()))
    s.add(p.k)
  }
  let cohort = 0
  let returned = 0
  const series: RetentionDay[] = []
  for (const day of listDays(from, to)) {
    const next = addDays(day, 1)
    const act = byDay.get(day) ?? new Set<string>()
    const eligible = diffDays(next, today) > 0
    if (!eligible) {
      series.push({ day, active: act.size, returned: 0, rate: null })
      continue
    }
    const nextSet = byDay.get(next) ?? new Set<string>()
    let r = 0
    for (const k of act) if (nextSet.has(k)) r++
    cohort += act.size
    returned += r
    series.push({ day, active: act.size, returned: r, rate: act.size > 0 ? r / act.size : null })
  }
  return { cohort, returned, rate: cohort > 0 ? returned / cohort : null, series }
}

/** Đếm số khoá khác nhau theo từng ngày + tổng khoá khác nhau trong [from, to]. */
export function countActiveByDay(pairs: ActivityPair[], from: string, to: string): { perDay: Map<string, number>; distinct: number } {
  const byDay = new Map<string, Set<string>>()
  const all = new Set<string>()
  for (const p of pairs) {
    if (!p?.k || !p?.d || p.d < from || p.d > to) continue
    let s = byDay.get(p.d)
    if (!s) byDay.set(p.d, (s = new Set()))
    s.add(p.k)
    all.add(p.k)
  }
  const perDay = new Map<string, number>()
  for (const [d, s] of byDay) perDay.set(d, s.size)
  return { perDay, distinct: all.size }
}

export interface SurveyQuestionRow {
  id: string
  survey_id: string
  title: string
  type: string
  order_index: number
  options: unknown
}

export interface LikertItem {
  question_id: string
  title: string
  n: number
  avg: number | null
  /** Phân bố số phiếu cho mức 1..5 (chỉ số 0 = mức 1). */
  dist: [number, number, number, number, number]
}

/**
 * Câu thang 1–5: chọn một, có đủ các phương án id "1".."5" (thứ tự tuỳ ý), không có phương án số nào khác;
 * cho phép thêm tối đa 2 phương án không phải số (vd. "na" = Tôi chưa sử dụng — không tính vào điểm).
 */
export function isLikertQuestion(q: Pick<SurveyQuestionRow, "type" | "options">): boolean {
  if (q.type !== "single_choice" || !Array.isArray(q.options)) return false
  const ids = (q.options as Array<{ id?: unknown }>).map((o) => String(o?.id ?? "").trim())
  if (!["1", "2", "3", "4", "5"].every((x) => ids.includes(x))) return false
  const others = ids.filter((x) => !["1", "2", "3", "4", "5"].includes(x))
  if (others.some((x) => /^\d+$/.test(x))) return false
  return others.length <= 2
}

function likertValue(ans: unknown): number | null {
  if (ans == null) return null
  const raw = typeof ans === "object" ? (ans as { option?: unknown }).option : ans
  const n = Number(String(raw ?? "").trim())
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

/** Điểm trung bình từng câu thang 1–5 từ danh sách phiếu (answers: {questionId: {option}}). */
export function aggregateLikert(questions: SurveyQuestionRow[], answersList: unknown[]): LikertItem[] {
  const likert = questions.filter(isLikertQuestion).sort((a, b) => a.order_index - b.order_index)
  return likert.map((q) => {
    const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0]
    let sum = 0
    let n = 0
    for (const a of answersList) {
      if (!a || typeof a !== "object") continue
      const v = likertValue((a as Record<string, unknown>)[q.id])
      if (v == null) continue
      dist[v - 1]++
      sum += v
      n++
    }
    return { question_id: q.id, title: q.title, n, avg: n > 0 ? Math.round((sum / n) * 100) / 100 : null, dist }
  })
}

/** Tỉ lệ lỗi = (câu không được trả lời + câu trả lời trạng thái lỗi/dở dang) / số câu hỏi. */
export function errorRate(questions: number, unanswered: number, errored: number): number | null {
  if (!questions || questions <= 0) return null
  return Math.min(1, Math.max(0, (unanswered + errored) / questions))
}

// ─── Truy vấn ────────────────────────────────────────────────────────────────

const TZ = MONITOR_TZ
/** Người dùng thật: loại tài khoản khách (guest-…@local, guest-bucket) và người dùng hệ thống. */
const realUser = (a: string) =>
  `(${a}.email NOT ILIKE 'guest-%' AND ${a}.id NOT IN ('${SYSTEM_USER_ID}'::uuid, '${GUEST_USER_ID}'::uuid))`
const dayOf = (col: string) => `to_char((${col} AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD')`
/** $1 = from (date), $2 = to (date, bao gồm). lo/hi là timestamptz theo giờ VN. */
const BOUNDS = `b AS (SELECT ($1::date)::timestamp AT TIME ZONE '${TZ}' AS lo, (($2::date) + 1)::timestamp AT TIME ZONE '${TZ}' AS hi)`

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface UsageStats {
  range: DateRange & { timezone: string; today: string }
  totals: {
    new_users: number
    new_guest_accounts: number
    active_users: number
    active_guest_devices: number
    logins: number
    questions: number
    tool_views: number
    survey_responses: number
    feedback_new: number
    feedback_open: number
  }
  daily: Array<{
    day: string
    new_users: number
    new_guest_accounts: number
    active_users: number
    active_guest_devices: number
    logins: number
    questions: number
  }>
  logins_by_provider: Array<{ provider: string; logins: number; users: number }>
  tools: Array<{ alias: string; views: number; users: number; guest_devices: number; opens_counter: number }>
  assistants: Array<{
    alias: string
    questions: number
    answered: number
    unanswered: number
    errored: number
    error_rate: number | null
    avg_ms: number | null
    p95_ms: number | null
    askers: number
  }>
  surveys: Array<{
    survey_id: string
    name: string
    responses: number
    from_users: number
    from_guests: number
    shown: number
    completed: number
    likert: LikertItem[]
  }>
  feedback: {
    new_in_range: number
    open_total: number
    resolved_in_range: number
    message_likes: number
    message_dislikes: number
    open_dislikes: number
  }
  retention: {
    users: RetentionResult
    guests: RetentionResult
  }
  generated_ms: number
}

export async function getUsageStats(range: DateRange, today: string = vnDateOf()): Promise<UsageStats> {
  const t0 = Date.now()
  const { from, to } = range
  // Lấy hoạt động tới hết ngày to+1 để xét quay lại của ngày cuối khoảng.
  const toPlus1 = addDays(to, 1)
  const p = [from, to]

  const [newUsersQ, userPairsQ, guestPairsQ, loginsDayQ, providerQ, toolsQ, toolCounterQ, assistantsQ, questionsDayQ, surveyQ, feedbackQ] =
    await Promise.all([
      query<{ day: string; new_users: string; new_guest_accounts: string }>(
        `WITH ${BOUNDS}
         SELECT ${dayOf("u.created_at")} AS day,
                COUNT(*) FILTER (WHERE ${realUser("u")})::text AS new_users,
                COUNT(*) FILTER (WHERE u.email ILIKE 'guest-%@local' AND u.email <> 'guest-bucket@portal.local')::text AS new_guest_accounts
         FROM ai_portal.users u, b
         WHERE u.created_at >= b.lo AND u.created_at < b.hi
         GROUP BY 1`,
        p
      ),
      query<{ k: string; d: string }>(
        `WITH ${BOUNDS},
         act AS (
           SELECT le.user_id, le.login_at AS ts FROM ai_portal.login_events le, b
             WHERE le.login_at >= b.lo AND le.login_at < b.hi
           UNION ALL
           SELECT pv.user_id, pv.created_at FROM ai_portal.page_views pv, b
             WHERE pv.user_id IS NOT NULL AND pv.created_at >= b.lo AND pv.created_at < b.hi
           UNION ALL
           SELECT s.user_id, m.created_at FROM ai_portal.messages m
             JOIN ai_portal.chat_sessions s ON s.id = m.session_id, b
             WHERE m.role = 'user' AND m.created_at >= b.lo AND m.created_at < b.hi
         )
         SELECT DISTINCT a.user_id::text AS k, ${dayOf("a.ts")} AS d
         FROM act a JOIN ai_portal.users u ON u.id = a.user_id
         WHERE ${realUser("u")}`,
        [from, toPlus1]
      ),
      query<{ k: string; d: string }>(
        `WITH ${BOUNDS}
         SELECT DISTINCT pv.guest_device_id AS k, ${dayOf("pv.created_at")} AS d
         FROM ai_portal.page_views pv, b
         WHERE pv.user_id IS NULL AND pv.guest_device_id IS NOT NULL AND pv.guest_device_id <> ''
           AND pv.created_at >= b.lo AND pv.created_at < b.hi`,
        [from, toPlus1]
      ),
      query<{ day: string; logins: string }>(
        `WITH ${BOUNDS}
         SELECT ${dayOf("le.login_at")} AS day, COUNT(*)::text AS logins
         FROM ai_portal.login_events le, b
         WHERE le.login_at >= b.lo AND le.login_at < b.hi
         GROUP BY 1`,
        p
      ),
      query<{ provider: string; logins: string; users: string }>(
        `WITH ${BOUNDS}
         SELECT COALESCE(NULLIF(le.provider, ''), 'unknown') AS provider,
                COUNT(*)::text AS logins, COUNT(DISTINCT le.user_id)::text AS users
         FROM ai_portal.login_events le, b
         WHERE le.login_at >= b.lo AND le.login_at < b.hi
         GROUP BY 1 ORDER BY COUNT(*) DESC`,
        p
      ),
      query<{ alias: string; views: string; users: string; guest_devices: string }>(
        `WITH ${BOUNDS}
         SELECT split_part(pv.path, '/', 3) AS alias,
                COUNT(*)::text AS views,
                COUNT(DISTINCT pv.user_id)::text AS users,
                COUNT(DISTINCT pv.guest_device_id) FILTER (WHERE pv.user_id IS NULL)::text AS guest_devices
         FROM ai_portal.page_views pv, b
         WHERE pv.created_at >= b.lo AND pv.created_at < b.hi
           AND pv.path LIKE '/tools/_%'
           -- chỉ công cụ đang có (bỏ đường dẫn gõ sai/rác)
           AND split_part(pv.path, '/', 3) IN (SELECT t.alias FROM ai_portal.tools t)
         GROUP BY 1
         ORDER BY COUNT(*) DESC`,
        p
      ),
      query<{ alias: string; opens: string }>(
        `SELECT tool_alias AS alias, COALESCE(SUM(open_count), 0)::text AS opens
         FROM ai_portal.tool_daily_usage
         WHERE usage_date >= $1::date AND usage_date <= $2::date
         GROUP BY 1`,
        p
      ).catch(() => ({ rows: [] as { alias: string; opens: string }[] })),
      query<{
        alias: string
        questions: string
        answered: string
        unanswered: string
        errored: string
        avg_ms: string | null
        p95_ms: string | null
        askers: string
      }>(
        `WITH ${BOUNDS},
         m AS (
           SELECT m.role::text AS role, m.status::text AS status, m.response_time_ms, m.created_at,
                  COALESCE(NULLIF(m.assistant_alias, ''), NULLIF(s.assistant_alias, ''), 'central') AS alias,
                  s.user_id,
                  LEAD(m.role::text) OVER (PARTITION BY m.session_id ORDER BY m.created_at, m.role, m.id) AS next_role
           FROM ai_portal.messages m
           JOIN ai_portal.chat_sessions s ON s.id = m.session_id, b
           -- lấy dư 1 giờ sau mốc cuối để câu hỏi sát nửa đêm vẫn thấy câu trả lời của nó
           WHERE m.created_at >= b.lo AND m.created_at < b.hi + interval '1 hour'
             AND m.role IN ('user', 'assistant')
         )
         SELECT m.alias,
                COUNT(*) FILTER (WHERE m.role = 'user')::text AS questions,
                COUNT(*) FILTER (WHERE m.role = 'user' AND m.next_role = 'assistant')::text AS answered,
                COUNT(*) FILTER (WHERE m.role = 'user' AND m.next_role IS DISTINCT FROM 'assistant')::text AS unanswered,
                COUNT(*) FILTER (WHERE m.role = 'assistant' AND m.status <> 'ok')::text AS errored,
                ROUND(AVG(m.response_time_ms) FILTER (WHERE m.role = 'assistant'))::text AS avg_ms,
                ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY m.response_time_ms)
                       FILTER (WHERE m.role = 'assistant' AND m.response_time_ms IS NOT NULL))::numeric)::text AS p95_ms,
                COUNT(DISTINCT m.user_id) FILTER (WHERE m.role = 'user')::text AS askers
         FROM m, b
         WHERE m.created_at < b.hi
         GROUP BY m.alias
         ORDER BY COUNT(*) FILTER (WHERE m.role = 'user') DESC`,
        p
      ),
      query<{ day: string; questions: string }>(
        `WITH ${BOUNDS}
         SELECT ${dayOf("m.created_at")} AS day, COUNT(*)::text AS questions
         FROM ai_portal.messages m, b
         WHERE m.role = 'user' AND m.created_at >= b.lo AND m.created_at < b.hi
         GROUP BY 1`,
        p
      ),
      loadSurveys(from, to),
      query<{
        new_in_range: string
        open_total: string
        resolved_in_range: string
        message_likes: string
        message_dislikes: string
        open_dislikes: string
      }>(
        `WITH ${BOUNDS}
         SELECT
           (SELECT COUNT(*) FROM ai_portal.user_feedback f WHERE f.created_at >= b.lo AND f.created_at < b.hi)::text AS new_in_range,
           (SELECT COUNT(*) FROM ai_portal.user_feedback f WHERE f.resolved = false)::text AS open_total,
           (SELECT COUNT(*) FROM ai_portal.user_feedback f WHERE f.resolved_at >= b.lo AND f.resolved_at < b.hi)::text AS resolved_in_range,
           (SELECT COUNT(*) FROM ai_portal.message_feedback mf WHERE mf.feedback = 'like' AND mf.created_at >= b.lo AND mf.created_at < b.hi)::text AS message_likes,
           (SELECT COUNT(*) FROM ai_portal.message_feedback mf WHERE mf.feedback = 'dislike' AND mf.created_at >= b.lo AND mf.created_at < b.hi)::text AS message_dislikes,
           (SELECT COUNT(*) FROM ai_portal.message_feedback mf WHERE mf.feedback = 'dislike' AND mf.resolved = false)::text AS open_dislikes
         FROM b`,
        p
      ),
    ])

  const userPairs = userPairsQ.rows
  const guestPairs = guestPairsQ.rows
  const usersActive = countActiveByDay(userPairs, from, to)
  const guestsActive = countActiveByDay(guestPairs, from, to)

  const newMap = new Map(newUsersQ.rows.map((r) => [r.day, r]))
  const loginMap = new Map(loginsDayQ.rows.map((r) => [r.day, num(r.logins)]))
  const qMap = new Map(questionsDayQ.rows.map((r) => [r.day, num(r.questions)]))
  const daily = listDays(from, to).map((day) => ({
    day,
    new_users: num(newMap.get(day)?.new_users),
    new_guest_accounts: num(newMap.get(day)?.new_guest_accounts),
    active_users: usersActive.perDay.get(day) ?? 0,
    active_guest_devices: guestsActive.perDay.get(day) ?? 0,
    logins: loginMap.get(day) ?? 0,
    questions: qMap.get(day) ?? 0,
  }))

  const counter = new Map(toolCounterQ.rows.map((r) => [String(r.alias || "").toLowerCase(), num(r.opens)]))
  const tools = toolsQ.rows.map((r) => ({
    alias: r.alias,
    views: num(r.views),
    users: num(r.users),
    guest_devices: num(r.guest_devices),
    opens_counter: counter.get(String(r.alias).toLowerCase()) ?? 0,
  }))

  const assistants = assistantsQ.rows.map((r) => {
    const questions = num(r.questions)
    const unanswered = num(r.unanswered)
    const errored = num(r.errored)
    return {
      alias: r.alias,
      questions,
      answered: num(r.answered),
      unanswered,
      errored,
      error_rate: errorRate(questions, unanswered, errored),
      avg_ms: r.avg_ms != null ? num(r.avg_ms) : null,
      p95_ms: r.p95_ms != null ? num(r.p95_ms) : null,
      askers: num(r.askers),
    }
  })

  const fb = feedbackQ.rows[0]
  const feedback = {
    new_in_range: num(fb?.new_in_range),
    open_total: num(fb?.open_total),
    resolved_in_range: num(fb?.resolved_in_range),
    message_likes: num(fb?.message_likes),
    message_dislikes: num(fb?.message_dislikes),
    open_dislikes: num(fb?.open_dislikes),
  }

  const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0)

  return {
    range: { ...range, timezone: TZ, today },
    totals: {
      new_users: sum(daily, (d) => d.new_users),
      new_guest_accounts: sum(daily, (d) => d.new_guest_accounts),
      active_users: usersActive.distinct,
      active_guest_devices: guestsActive.distinct,
      logins: sum(daily, (d) => d.logins),
      questions: sum(daily, (d) => d.questions),
      tool_views: sum(tools, (t) => t.views),
      survey_responses: sum(surveyQ, (s) => s.responses),
      feedback_new: feedback.new_in_range,
      feedback_open: feedback.open_total,
    },
    daily,
    logins_by_provider: providerQ.rows.map((r) => ({ provider: r.provider, logins: num(r.logins), users: num(r.users) })),
    tools,
    assistants,
    surveys: surveyQ,
    feedback,
    retention: {
      users: computeNextDayRetention(userPairs, from, to, today),
      guests: computeNextDayRetention(guestPairs, from, to, today),
    },
    generated_ms: Date.now() - t0,
  }
}

async function loadSurveys(from: string, to: string): Promise<UsageStats["surveys"]> {
  try {
    const resp = await query<{ survey_id: string; user_id: string | null; answers: unknown }>(
      `WITH ${BOUNDS}
       SELECT r.survey_id::text, r.user_id::text, r.answers
       FROM ai_portal.survey_responses r, b
       WHERE r.submitted_at >= b.lo AND r.submitted_at < b.hi`,
      [from, to]
    )
    const impr = await query<{ survey_id: string; shown: string; completed: string }>(
      `WITH ${BOUNDS}
       SELECT i.survey_id::text,
              COUNT(*) FILTER (WHERE i.event = 'shown')::text AS shown,
              COUNT(*) FILTER (WHERE i.event = 'completed')::text AS completed
       FROM ai_portal.survey_impressions i, b
       WHERE i.created_at >= b.lo AND i.created_at < b.hi
       GROUP BY 1`,
      [from, to]
    )
    const ids = Array.from(new Set([...resp.rows.map((r) => r.survey_id), ...impr.rows.map((r) => r.survey_id)]))
    if (ids.length === 0) return []
    const [surveys, questions] = await Promise.all([
      query<{ id: string; name: string }>(`SELECT id::text, name FROM ai_portal.surveys WHERE id = ANY($1::uuid[])`, [ids]),
      query<SurveyQuestionRow>(
        `SELECT id::text, survey_id::text, title, type, order_index, options
         FROM ai_portal.survey_questions WHERE survey_id = ANY($1::uuid[])`,
        [ids]
      ),
    ])
    const imprMap = new Map(impr.rows.map((r) => [r.survey_id, r]))
    return ids
      .map((sid) => {
        const rs = resp.rows.filter((r) => r.survey_id === sid)
        const qs = questions.rows.filter((q) => q.survey_id === sid)
        return {
          survey_id: sid,
          name: surveys.rows.find((s) => s.id === sid)?.name ?? sid,
          responses: rs.length,
          from_users: rs.filter((r) => !!r.user_id).length,
          from_guests: rs.filter((r) => !r.user_id).length,
          shown: num(imprMap.get(sid)?.shown),
          completed: num(imprMap.get(sid)?.completed),
          likert: aggregateLikert(qs, rs.map((r) => r.answers)),
        }
      })
      .sort((a, b) => b.responses - a.responses)
  } catch (e: any) {
    console.warn("[usage-stats] surveys unavailable:", e?.message ?? e)
    return []
  }
}
