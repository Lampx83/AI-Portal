// routes/feedback.ts - User feedback and suggestions for the system
import { Router, Request, Response } from "express"
import rateLimit from "express-rate-limit"
import { query, withTransaction } from "../lib/db"
import { GUEST_USER_ID } from "../lib/chat/constants"
import { getAssistantConfigs } from "../lib/assistants"
import { getSetting } from "../lib/settings"

const router = Router()

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(";").map((s) => {
      const i = s.indexOf("=")
      const key = decodeURIComponent(s.slice(0, i).trim())
      const value = decodeURIComponent(s.slice(i + 1).trim().replace(/^"|"$/g, ""))
      return [key, value]
    })
  )
}

async function getCurrentUserId(req: Request): Promise<string | null> {
  const { getToken } = await import("next-auth/jwt")
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  return (token as { id?: string })?.id ?? null
}

// POST /api/feedback - Submit feedback/suggestions
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "feedback.loginRequired" })
    }
    const body = req.body as { content?: string; assistant_alias?: string | null }
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    if (!content || content.length < 5) {
      return res.status(400).json({ error: "feedback.minLength" })
    }
    if (content.length > 4000) {
      return res.status(400).json({ error: "feedback.maxLength" })
    }
    let assistantAlias: string | null = null
    if (body?.assistant_alias != null && typeof body.assistant_alias === "string") {
      const alias = body.assistant_alias.trim()
      if (alias) {
        const configs = await getAssistantConfigs()
        const assistantExists = configs.some((c) => c.alias === alias)
        let toolExists = false
        if (!assistantExists) {
          const toolRow = await query<{ alias: string }>(
            `SELECT alias
             FROM ai_portal.tools
             WHERE alias = $1 AND is_active = true
             LIMIT 1`,
            [alias]
          )
          toolExists = toolRow.rows.length > 0
        }
        if (!assistantExists && !toolExists) {
          return res.status(400).json({ error: "feedback.assistantNotFound" })
        }
        assistantAlias = alias
      }
    }
    await query(
      `INSERT INTO ai_portal.user_feedback (user_id, content, assistant_alias)
       VALUES ($1::uuid, $2, $3)`,
      [userId, content, assistantAlias]
    )
    return res.status(201).json({ success: true, message: "feedback.thankYou" })
  } catch (err: any) {
    console.error("POST /api/feedback error:", err)
    res.status(500).json({
      error: "feedback.sendError",
      message: getSetting("DEBUG") === "true" ? err.message : undefined,
    })
  }
})

// ───────────── Đánh giá nhanh công cụ (1–5 sao + 1 câu tuỳ chọn) ─────────────
// Lưu vào user_feedback (assistant_alias = alias công cụ, content = "[★4] câu góp ý", cột rating — migration 021).
// Mỗi người (hoặc mỗi thiết bị khách) tối đa 1 đánh giá / công cụ / ngày (giờ VN); gửi lại trong ngày = sửa đánh giá đó.

const RATING_MAX_COMMENT = 500
/** Chống spam: mỗi IP tối đa 20 lần gửi đánh giá / giờ (khách và người đăng nhập). */
const ratingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "feedback.rating.rateLimited" },
})
/** Khách: tối đa 30 đánh giá mới / ngày cho toàn bộ tài khoản Khách (chặn tạo hàng loạt bằng mã thiết bị giả). */
const GUEST_DAILY_CAP = 30

function getGuestDeviceId(req: Request): string | null {
  const v = req.headers["x-guest-device-id"]
  if (typeof v !== "string") return null
  const id = v.trim().slice(0, 100)
  return /^[A-Za-z0-9_-]{8,100}$/.test(id) && id !== "anonymous" ? id : null
}

let ensureRatingColumnsPromise: Promise<void> | null = null
/** Lưới an toàn nếu migration 021 chưa chạy (idempotent). */
function ensureRatingColumns(): Promise<void> {
  if (!ensureRatingColumnsPromise) {
    ensureRatingColumnsPromise = query(
      `ALTER TABLE ai_portal.user_feedback ADD COLUMN IF NOT EXISTS rating SMALLINT;
       ALTER TABLE ai_portal.user_feedback ADD COLUMN IF NOT EXISTS guest_device_id TEXT;`
    )
      .then(() => undefined)
      .catch((e) => {
        ensureRatingColumnsPromise = null
        throw e
      })
  }
  return ensureRatingColumnsPromise
}

const VN_TODAY_START = `(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')`

async function toolExists(alias: string): Promise<boolean> {
  const r = await query(`SELECT 1 FROM ai_portal.tools WHERE alias = $1 AND is_active = true LIMIT 1`, [alias])
  return r.rows.length > 0
}

/** Ai đang đánh giá: người đăng nhập (user_id) hoặc khách (GUEST_USER_ID + mã thiết bị). */
async function resolveRater(req: Request): Promise<{ userId: string; deviceId: string | null; isGuest: boolean } | null> {
  const userId = await getCurrentUserId(req).catch(() => null)
  if (userId && userId !== GUEST_USER_ID) return { userId, deviceId: null, isGuest: false }
  const deviceId = getGuestDeviceId(req)
  if (!deviceId) return null
  return { userId: GUEST_USER_ID, deviceId, isGuest: true }
}

// GET /api/feedback/rating/:alias — đánh giá hôm nay của người/thiết bị hiện tại (để hiện lại số sao đã chọn)
router.get("/rating/:alias", async (req: Request, res: Response) => {
  try {
    const alias = String(req.params.alias || "").trim().toLowerCase().slice(0, 100)
    const rater = await resolveRater(req)
    if (!alias || !rater) return res.json({ rated: false })
    await ensureRatingColumns()
    const r = await query<{ rating: number; content: string }>(
      `SELECT rating, content FROM ai_portal.user_feedback
        WHERE assistant_alias = $1 AND rating IS NOT NULL AND created_at >= ${VN_TODAY_START}
          AND user_id = $2::uuid AND ($3::text IS NULL OR guest_device_id = $3)
        ORDER BY created_at DESC LIMIT 1`,
      [alias, rater.userId, rater.deviceId]
    )
    const row = r.rows[0]
    if (!row) return res.json({ rated: false })
    return res.json({ rated: true, rating: row.rating, comment: String(row.content || "").replace(/^\[★\d\]\s*/, "") })
  } catch (err: any) {
    console.error("GET /api/feedback/rating error:", err?.message ?? err)
    res.json({ rated: false })
  }
})

// POST /api/feedback/rating — { alias, rating: 1..5, comment? }
router.post("/rating", ratingLimiter, async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as { alias?: unknown; rating?: unknown; comment?: unknown }
    const alias = typeof body.alias === "string" ? body.alias.trim().toLowerCase().slice(0, 100) : ""
    const rating = Number(body.rating)
    const comment = typeof body.comment === "string" ? body.comment.replace(/\s+/g, " ").trim().slice(0, RATING_MAX_COMMENT) : ""
    if (!alias || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "feedback.rating.invalid" })
    }
    const rater = await resolveRater(req)
    if (!rater) return res.status(400).json({ error: "feedback.rating.deviceRequired" })
    if (!(await toolExists(alias))) return res.status(400).json({ error: "feedback.assistantNotFound" })
    await ensureRatingColumns()
    const content = `[★${rating}]${comment ? ` ${comment}` : ""}`

    const result = await withTransaction(async (client) => {
      // Khoá theo (người/thiết bị, công cụ) để hai lần bấm liên tiếp không tạo 2 bản ghi.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`rating:${rater.userId}:${rater.deviceId ?? ""}:${alias}`])
      const existing: { rows: { id: string }[] } = await client.query(
        `SELECT id FROM ai_portal.user_feedback
          WHERE assistant_alias = $1 AND rating IS NOT NULL AND created_at >= ${VN_TODAY_START}
            AND user_id = $2::uuid AND ($3::text IS NULL OR guest_device_id = $3)
          ORDER BY created_at DESC LIMIT 1`,
        [alias, rater.userId, rater.deviceId]
      )
      if (existing.rows[0]) {
        await client.query(`UPDATE ai_portal.user_feedback SET rating = $1, content = $2 WHERE id = $3::uuid`, [
          rating,
          content,
          existing.rows[0].id,
        ])
        return { updated: true }
      }
      if (rater.isGuest) {
        const cnt: { rows: { n: string }[] } = await client.query(
          `SELECT COUNT(*)::text AS n FROM ai_portal.user_feedback
            WHERE user_id = $1::uuid AND rating IS NOT NULL AND created_at >= ${VN_TODAY_START}`,
          [GUEST_USER_ID]
        )
        if (Number(cnt.rows[0]?.n ?? 0) >= GUEST_DAILY_CAP) return { limited: true }
      }
      await client.query(
        `INSERT INTO ai_portal.user_feedback (user_id, content, assistant_alias, rating, guest_device_id)
         VALUES ($1::uuid, $2, $3, $4, $5)`,
        [rater.userId, content, alias, rating, rater.deviceId]
      )
      return { updated: false }
    })
    if ((result as { limited?: boolean }).limited) return res.status(429).json({ error: "feedback.rating.rateLimited" })
    return res.status(201).json({ success: true, updated: !!(result as { updated?: boolean }).updated })
  } catch (err: any) {
    console.error("POST /api/feedback/rating error:", err?.message ?? err)
    res.status(500).json({ error: "feedback.sendError" })
  }
})

export default router
