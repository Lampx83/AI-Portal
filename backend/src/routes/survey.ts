// routes/survey.ts - Public survey endpoints (active survey, impression log, submit response)
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import { getSetting } from "../lib/settings"
import { parseCookies } from "../lib/parse-cookies"

const router = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getCurrentUserId(req: Request): Promise<string | null> {
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({ req: { cookies, headers: req.headers } as any, secret })
  return (token as { id?: string })?.id ?? null
}

function getDeviceId(req: Request): string | null {
  const fromHeader = req.headers["x-guest-device-id"]
  if (typeof fromHeader === "string" && fromHeader.trim()) return fromHeader.trim().slice(0, 100)
  return null
}

type DisplayConfig = {
  audience?: "all" | "logged_in" | "guest"
}

router.get("/active", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    const deviceId = getDeviceId(req)
    const isLoggedIn = !!userId

    // Lấy danh sách survey active, ưu tiên priority cao nhất
    const sRes = await query(
      `SELECT id, slug, name, description, priority, start_at, end_at,
              thank_you_message, display_config
       FROM ai_portal.surveys
       WHERE is_active = true
         AND (start_at IS NULL OR start_at <= now())
         AND (end_at IS NULL OR end_at >= now())
       ORDER BY priority DESC, created_at DESC`
    )
    if (sRes.rows.length === 0) return res.json({ survey: null })

    const candidates = sRes.rows as any[]
    for (const s of candidates) {
      const dc: DisplayConfig = s.display_config || {}
      // audience filter
      if (dc.audience === "logged_in" && !isLoggedIn) continue
      if (dc.audience === "guest" && isLoggedIn) continue

      // đã trả lời?
      if (isLoggedIn) {
        const answered = await query(
          `SELECT 1 FROM ai_portal.survey_responses WHERE survey_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
          [s.id, userId]
        )
        if (answered.rows.length) continue
      } else if (deviceId) {
        const answered = await query(
          `SELECT 1 FROM ai_portal.survey_responses WHERE survey_id = $1::uuid AND guest_device_id = $2 LIMIT 1`,
          [s.id, deviceId]
        )
        if (answered.rows.length) continue
      } else {
        // guest mà không có device id thì không thể track — bỏ qua nếu audience yêu cầu guest
        if (dc.audience === "guest" || dc.audience === "all") {
          // vẫn cho hiện 1 lần (không track được)
        }
      }

      // load câu hỏi
      const qRes = await query(
        `SELECT id, order_index, type, title, description, is_required, options
         FROM ai_portal.survey_questions WHERE survey_id = $1::uuid ORDER BY order_index ASC, id ASC`,
        [s.id]
      )
      if (qRes.rows.length === 0) continue
      return res.json({
        survey: {
          id: s.id,
          slug: s.slug,
          name: s.name,
          description: s.description,
          thank_you_message: s.thank_you_message,
          display_config: dc,
          questions: qRes.rows,
        },
      })
    }
    res.json({ survey: null })
  } catch (err: any) {
    console.error("GET /api/survey/active error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

router.post("/:id/impression", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const event = String((req.body as any)?.event || "").toLowerCase()
    if (!["shown", "dismissed", "completed"].includes(event)) {
      return res.status(400).json({ error: "Invalid event" })
    }
    const userId = await getCurrentUserId(req)
    const deviceId = getDeviceId(req)
    await query(
      `INSERT INTO ai_portal.survey_impressions (survey_id, user_id, guest_device_id, event)
       VALUES ($1::uuid, $2, $3, $4)`,
      [id, userId, deviceId, event]
    )
    res.json({ success: true })
  } catch (err: any) {
    console.error("POST /api/survey/:id/impression error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

router.post("/:id/response", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const userId = await getCurrentUserId(req)
    const deviceId = getDeviceId(req)
    if (!userId && !deviceId) {
      return res.status(400).json({ error: "Thiếu user hoặc device id" })
    }
    const answers = (req.body as any)?.answers
    if (!answers || typeof answers !== "object") return res.status(400).json({ error: "Thiếu answers" })

    // Validate answers theo questions
    const sRes = await query(
      `SELECT s.is_active, s.start_at, s.end_at FROM ai_portal.surveys s WHERE s.id = $1::uuid`,
      [id]
    )
    if (sRes.rows.length === 0) return res.status(404).json({ error: "Khảo sát không tồn tại" })
    const s = sRes.rows[0] as any
    if (!s.is_active) return res.status(400).json({ error: "Khảo sát không hoạt động" })
    if (s.start_at && new Date(s.start_at) > new Date()) return res.status(400).json({ error: "Chưa đến thời gian khảo sát" })
    if (s.end_at && new Date(s.end_at) < new Date()) return res.status(400).json({ error: "Khảo sát đã kết thúc" })

    const qRes = await query(
      `SELECT id, type, is_required, options FROM ai_portal.survey_questions WHERE survey_id = $1::uuid`,
      [id]
    )
    const cleanedAnswers: Record<string, { option?: string; text?: string }> = {}
    for (const q of qRes.rows as any[]) {
      const ans = answers[q.id]
      const qType = q.type === "text" ? "text" : "single_choice"
      if (qType === "text") {
        const text = ans == null ? "" : String(ans?.text ?? ans ?? "").trim().slice(0, 4000)
        if (!text) {
          if (q.is_required) return res.status(400).json({ error: "Câu hỏi bắt buộc chưa trả lời" })
          continue
        }
        cleanedAnswers[q.id] = { text }
        continue
      }
      // single_choice
      const optionId = typeof ans === "string" ? ans : ans?.option
      const text = typeof ans === "object" && ans?.text ? String(ans.text).trim().slice(0, 4000) : ""
      if (!optionId) {
        if (q.is_required) return res.status(400).json({ error: "Câu hỏi bắt buộc chưa trả lời" })
        continue
      }
      const opts = q.options as any[]
      const opt = opts.find((o) => o.id === optionId)
      if (!opt) return res.status(400).json({ error: "Câu trả lời không hợp lệ" })
      if (opt.allow_text && !text && q.is_required) {
        return res.status(400).json({ error: `Vui lòng nhập nội dung cho lựa chọn "${opt.label}"` })
      }
      cleanedAnswers[q.id] = opt.allow_text && text ? { option: optionId, text } : { option: optionId }
    }

    const userAgent = (req.headers["user-agent"] as string | undefined)?.slice(0, 500) || null

    try {
      await query(
        `INSERT INTO ai_portal.survey_responses (survey_id, user_id, guest_device_id, answers, user_agent)
         VALUES ($1::uuid, $2, $3, $4::jsonb, $5)`,
        [id, userId, userId ? null : deviceId, JSON.stringify(cleanedAnswers), userAgent]
      )
    } catch (e: any) {
      // Unique violation: đã trả lời rồi
      if (e?.code === "23505") return res.status(409).json({ error: "Bạn đã trả lời khảo sát này rồi" })
      throw e
    }

    await query(
      `INSERT INTO ai_portal.survey_impressions (survey_id, user_id, guest_device_id, event)
       VALUES ($1::uuid, $2, $3, 'completed')`,
      [id, userId, deviceId]
    )
    res.status(201).json({ success: true })
  } catch (err: any) {
    console.error("POST /api/survey/:id/response error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

export default router
