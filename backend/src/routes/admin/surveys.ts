import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query, withTransaction } from "../../lib/db"
import { getSetting } from "../../lib/settings"
import { parseCookies } from "../../lib/parse-cookies"
import { adminOnly } from "./middleware"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

const router = Router()

type DisplayConfig = {
  audience?: "all" | "logged_in" | "guest"
  trigger?: { type: "on_load" | "after_seconds" | "after_n_visits" | "on_exit_intent"; value?: number }
  position?: "center" | "bottom_right" | "bottom_bar" | "top_bar"
  frequency?: { type: "once" | "once_per_n_days" | "until_answered" | "every_session"; value?: number }
  /** Hỏi lại sau N ngày kể từ lần trả lời gần nhất. Mặc định 15; 0 = không hỏi lại. */
  reask_days?: number
  dismissible?: boolean
  max_dismissals?: number
  cooldown_days_after_dismiss?: number
  pages_include?: string[]
  pages_exclude?: string[]
}

type QuestionInput = {
  id?: string
  order_index?: number
  type?: "single_choice" | "multi_choice" | "text"
  title: string
  description?: string | null
  is_required?: boolean
  options: Array<{ id: string; label: string; allow_text?: boolean }>
}

type SurveyInput = {
  slug: string
  name: string
  description?: string | null
  is_active?: boolean
  priority?: number
  start_at?: string | null
  end_at?: string | null
  thank_you_message?: string | null
  display_config?: DisplayConfig
  questions: QuestionInput[]
}

const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  audience: "all",
  trigger: { type: "after_seconds", value: 5 },
  position: "center",
  frequency: { type: "once", value: 0 },
  reask_days: 15,
  dismissible: true,
  max_dismissals: 3,
  cooldown_days_after_dismiss: 7,
  pages_include: [],
  pages_exclude: [],
}

function sanitizeDisplayConfig(input: any): DisplayConfig {
  const dc: DisplayConfig = { ...DEFAULT_DISPLAY_CONFIG, ...(input || {}) }
  if (input?.trigger) dc.trigger = { ...DEFAULT_DISPLAY_CONFIG.trigger!, ...input.trigger }
  if (input?.frequency) dc.frequency = { ...DEFAULT_DISPLAY_CONFIG.frequency!, ...input.frequency }
  const reask = Number(dc.reask_days)
  dc.reask_days = Number.isFinite(reask) ? Math.max(0, Math.floor(reask)) : 15
  if (!Array.isArray(dc.pages_include)) dc.pages_include = []
  if (!Array.isArray(dc.pages_exclude)) dc.pages_exclude = []
  return dc
}

function validateSurveyInput(body: SurveyInput): string | null {
  if (!body || typeof body !== "object") return "Body không hợp lệ"
  const slug = String(body.slug || "").trim().toLowerCase()
  if (!slug || !SLUG_RE.test(slug) || slug.length > 80) return "slug không hợp lệ (chỉ a-z, 0-9, -)"
  if (!body.name || String(body.name).trim().length < 2) return "Tên khảo sát quá ngắn"
  if (!Array.isArray(body.questions) || body.questions.length === 0) return "Cần ít nhất 1 câu hỏi"
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i]
    if (!q || !q.title || String(q.title).trim().length < 1) return `Câu ${i + 1}: thiếu tiêu đề`
    const type = q.type || "single_choice"
    if (type !== "single_choice" && type !== "multi_choice" && type !== "text") return `Câu ${i + 1}: loại không hợp lệ`
    if (type === "single_choice" || type === "multi_choice") {
      if (!Array.isArray(q.options) || q.options.length < 2) return `Câu ${i + 1}: cần ít nhất 2 lựa chọn`
      const optIds = new Set<string>()
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j]
        if (!opt || !opt.id || !opt.label) return `Câu ${i + 1}, lựa chọn ${j + 1}: thiếu id hoặc nhãn`
        if (optIds.has(opt.id)) return `Câu ${i + 1}: option id "${opt.id}" trùng`
        optIds.add(opt.id)
      }
    }
  }
  return null
}

async function getAdminUserId(req: Request): Promise<string | null> {
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({ req: { cookies, headers: req.headers } as any, secret })
  return (token as { id?: string })?.id ?? null
}

async function loadSurveyFull(id: string) {
  const sRes = await query(
    `SELECT id, slug, name, description, is_active, priority, start_at, end_at,
            thank_you_message, display_config, created_at, updated_at, created_by
     FROM ai_portal.surveys WHERE id = $1::uuid`,
    [id]
  )
  if (sRes.rows.length === 0) return null
  const survey = sRes.rows[0]
  const qRes = await query(
    `SELECT id, order_index, type, title, description, is_required, options
     FROM ai_portal.survey_questions WHERE survey_id = $1::uuid ORDER BY order_index ASC, id ASC`,
    [id]
  )
  return { ...survey, questions: qRes.rows }
}

router.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT s.id, s.slug, s.name, s.description, s.is_active, s.priority,
              s.start_at, s.end_at, s.created_at, s.updated_at,
              (SELECT COUNT(*)::int FROM ai_portal.survey_questions q WHERE q.survey_id = s.id) AS question_count,
              (SELECT COUNT(*)::int FROM ai_portal.survey_responses r WHERE r.survey_id = s.id) AS response_count
       FROM ai_portal.surveys s
       ORDER BY s.is_active DESC, s.priority DESC, s.created_at DESC`
    )
    res.json({ data: r.rows })
  } catch (err: any) {
    console.error("GET /api/admin/surveys error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.get("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const survey = await loadSurveyFull(id)
    if (!survey) return res.status(404).json({ error: "Khảo sát không tồn tại" })
    res.json({ survey })
  } catch (err: any) {
    console.error("GET /api/admin/surveys/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const body = req.body as SurveyInput
    const err = validateSurveyInput(body)
    if (err) return res.status(400).json({ error: err })
    const adminUserId = await getAdminUserId(req)
    const dc = sanitizeDisplayConfig(body.display_config)
    const slug = String(body.slug).trim().toLowerCase()
    const dupe = await query(`SELECT 1 FROM ai_portal.surveys WHERE slug = $1`, [slug])
    if (dupe.rows.length) return res.status(409).json({ error: "Slug đã tồn tại" })
    const surveyId = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO ai_portal.surveys
         (slug, name, description, is_active, priority, start_at, end_at, thank_you_message, display_config, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
         RETURNING id`,
        [
          slug,
          String(body.name).trim(),
          body.description?.toString().trim() || null,
          !!body.is_active,
          Number(body.priority) || 0,
          body.start_at || null,
          body.end_at || null,
          body.thank_you_message?.toString().trim() || null,
          JSON.stringify(dc),
          adminUserId,
        ]
      )
      const newId = ins.rows[0].id as string
      for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i]
        const qType = q.type === "text" ? "text" : q.type === "multi_choice" ? "multi_choice" : "single_choice"
        await client.query(
          `INSERT INTO ai_portal.survey_questions
           (survey_id, order_index, type, title, description, is_required, options)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            newId,
            Number(q.order_index ?? i),
            qType,
            String(q.title).trim(),
            q.description?.toString().trim() || null,
            q.is_required !== false,
            JSON.stringify(qType === "text" ? [] : q.options),
          ]
        )
      }
      return newId
    })
    const survey = await loadSurveyFull(surveyId)
    res.status(201).json({ survey })
  } catch (err: any) {
    console.error("POST /api/admin/surveys error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.put("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const body = req.body as SurveyInput
    const err = validateSurveyInput(body)
    if (err) return res.status(400).json({ error: err })
    const slug = String(body.slug).trim().toLowerCase()
    const dupe = await query(`SELECT 1 FROM ai_portal.surveys WHERE slug = $1 AND id != $2::uuid`, [slug, id])
    if (dupe.rows.length) return res.status(409).json({ error: "Slug đã tồn tại" })
    const dc = sanitizeDisplayConfig(body.display_config)
    await withTransaction(async (client) => {
      const upd = await client.query(
        `UPDATE ai_portal.surveys SET
           slug = $1, name = $2, description = $3, is_active = $4, priority = $5,
           start_at = $6, end_at = $7, thank_you_message = $8, display_config = $9::jsonb,
           updated_at = now()
         WHERE id = $10::uuid`,
        [
          slug,
          String(body.name).trim(),
          body.description?.toString().trim() || null,
          !!body.is_active,
          Number(body.priority) || 0,
          body.start_at || null,
          body.end_at || null,
          body.thank_you_message?.toString().trim() || null,
          JSON.stringify(dc),
          id,
        ]
      )
      if ((upd.rowCount ?? 0) === 0) throw new Error("not_found")

      // Upsert questions theo id để giữ UUID — không phá huỷ FK của câu trả lời cũ trong JSONB.
      // Tham khảo lỗi cũ: DELETE+INSERT lại sinh UUID mới khiến answers (lưu question_id/option_id) trở thành mồ côi.
      const existing = await client.query(
        `SELECT id FROM ai_portal.survey_questions WHERE survey_id = $1::uuid`,
        [id]
      )
      const existingIds = new Set((existing.rows as { id: string }[]).map((r) => r.id))
      const keepIds = new Set<string>()

      for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i]
        const qType = q.type === "text" ? "text" : q.type === "multi_choice" ? "multi_choice" : "single_choice"
        const title = String(q.title).trim()
        const description = q.description?.toString().trim() || null
        const isRequired = q.is_required !== false
        const optionsJson = JSON.stringify(qType === "text" ? [] : q.options)
        const orderIndex = Number(q.order_index ?? i)
        const incomingId = typeof q.id === "string" && UUID_RE.test(q.id) ? q.id : null

        if (incomingId && existingIds.has(incomingId)) {
          await client.query(
            `UPDATE ai_portal.survey_questions
             SET order_index = $1, type = $2, title = $3, description = $4,
                 is_required = $5, options = $6::jsonb
             WHERE id = $7::uuid AND survey_id = $8::uuid`,
            [orderIndex, qType, title, description, isRequired, optionsJson, incomingId, id]
          )
          keepIds.add(incomingId)
        } else {
          const ins = await client.query(
            `INSERT INTO ai_portal.survey_questions
             (survey_id, order_index, type, title, description, is_required, options)
             VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)
             RETURNING id`,
            [id, orderIndex, qType, title, description, isRequired, optionsJson]
          )
          const newId = (ins.rows[0] as { id: string }).id
          keepIds.add(newId)
        }
      }

      // Xoá những câu hỏi không còn trong payload (admin chủ động bỏ).
      const toDelete = [...existingIds].filter((qid) => !keepIds.has(qid))
      if (toDelete.length > 0) {
        await client.query(
          `DELETE FROM ai_portal.survey_questions WHERE survey_id = $1::uuid AND id = ANY($2::uuid[])`,
          [id, toDelete]
        )
      }
    })
    const survey = await loadSurveyFull(id)
    if (!survey) return res.status(404).json({ error: "Khảo sát không tồn tại" })
    res.json({ survey })
  } catch (err: any) {
    if (err?.message === "not_found") return res.status(404).json({ error: "Khảo sát không tồn tại" })
    console.error("PUT /api/admin/surveys/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.delete("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const r = await query(`DELETE FROM ai_portal.surveys WHERE id = $1::uuid`, [id])
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "Khảo sát không tồn tại" })
    res.json({ success: true })
  } catch (err: any) {
    console.error("DELETE /api/admin/surveys/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.get("/:id/printable", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const survey = await loadSurveyFull(id)
    if (!survey) return res.status(404).json({ error: "Khảo sát không tồn tại" })
    const format = String(req.query.format || "docx").toLowerCase()

    if (format === "txt") {
      const lines: string[] = []
      lines.push(survey.name)
      lines.push("=".repeat(Math.max(10, Math.min(80, survey.name.length))))
      if (survey.description) {
        lines.push("")
        lines.push(survey.description)
      }
      lines.push("")
      lines.push("Họ và tên: ____________________________________________")
      lines.push("Email/SĐT: _____________________________________________")
      lines.push("Ngày trả lời: ___/___/______")
      lines.push("")
      lines.push("-".repeat(60))
      lines.push("")
      survey.questions.forEach((q: any, qi: number) => {
        const required = q.is_required ? " *" : ""
        const hint =
          q.type === "multi_choice"
            ? "  [Có thể chọn nhiều phương án]"
            : q.type === "single_choice"
            ? "  [Chọn 1 phương án]"
            : ""
        lines.push(`Câu ${qi + 1}. ${q.title}${required}${hint}`)
        if (q.description) lines.push(`   (${q.description})`)
        if (q.type === "text") {
          for (let i = 0; i < 4; i++) lines.push("   " + ".".repeat(70))
        } else {
          ;(q.options as any[]).forEach((opt) => {
            const suffix = opt.allow_text ? "  (vui lòng ghi rõ): " + ".".repeat(40) : ""
            lines.push(`   [ ] ${opt.label}${suffix}`)
          })
        }
        lines.push("")
      })
      lines.push("-".repeat(60))
      if (survey.thank_you_message) {
        lines.push("")
        lines.push(survey.thank_you_message)
      }
      const text = lines.join("\n") + "\n"
      res.setHeader("Content-Type", "text/plain; charset=utf-8")
      res.setHeader("Content-Disposition", `attachment; filename="phieu-${survey.slug}.txt"`)
      res.send("﻿" + text)
      return
    }

    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      HeadingLevel,
      AlignmentType,
    } = await import("docx")

    const titlePara = new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: survey.name, bold: true })],
    })
    const introChildren: any[] = []
    if (survey.description) {
      introChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: survey.description, italics: true })],
          spacing: { after: 200 },
        })
      )
    }
    introChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: "Họ và tên: ", bold: true }),
          new TextRun({ text: "............................................................." }),
        ],
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: "Email/Số điện thoại: ", bold: true }),
          new TextRun({ text: "....................................................." }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: "Ngày trả lời: ", bold: true }),
          new TextRun({ text: "........./........../...........  " }),
          new TextRun({ text: "        " }),
        ],
        spacing: { after: 300 },
      })
    )

    const questionParas: any[] = []
    survey.questions.forEach((q: any, qi: number) => {
      const required = q.is_required ? " *" : ""
      questionParas.push(
        new Paragraph({
          spacing: { before: 240, after: 80 },
          children: [
            new TextRun({ text: `Câu ${qi + 1}. `, bold: true }),
            new TextRun({ text: q.title, bold: true }),
            new TextRun({ text: required, bold: true, color: "C00000" }),
            ...(q.type === "multi_choice"
              ? [new TextRun({ text: "  [Có thể chọn nhiều phương án]", italics: true, color: "595959" })]
              : []),
          ],
        })
      )
      if (q.description) {
        questionParas.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: q.description, italics: true, color: "595959" })],
          })
        )
      }
      if (q.type === "text") {
        for (let i = 0; i < 4; i++) {
          questionParas.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text:
                    "............................................................................................................................................",
                }),
              ],
            })
          )
        }
      } else {
        ;(q.options as any[]).forEach((opt) => {
          const checkbox = "☐  "
          const suffix = opt.allow_text ? " (vui lòng ghi rõ): ......................................................" : ""
          questionParas.push(
            new Paragraph({
              spacing: { after: 60 },
              indent: { left: 360 },
              children: [
                new TextRun({ text: checkbox }),
                new TextRun({ text: opt.label }),
                new TextRun({ text: suffix }),
              ],
            })
          )
        })
      }
    })

    const footer = [
      new Paragraph({
        spacing: { before: 400 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: survey.thank_you_message || "Cảm ơn bạn đã tham gia khảo sát!",
            italics: true,
          }),
        ],
      }),
    ]

    const doc = new Document({
      creator: "AI Portal – Survey",
      title: survey.name,
      sections: [
        {
          children: [titlePara, ...introChildren, ...questionParas, ...footer],
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    res.setHeader("Content-Disposition", `attachment; filename="survey-${survey.slug}.docx"`)
    res.send(buffer)
  } catch (err: any) {
    console.error("GET /api/admin/surveys/:id/printable error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.get("/:id/export", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const survey = await loadSurveyFull(id)
    if (!survey) return res.status(404).json({ error: "Khảo sát không tồn tại" })
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      survey: {
        slug: survey.slug,
        name: survey.name,
        description: survey.description,
        is_active: false,
        priority: survey.priority,
        start_at: survey.start_at,
        end_at: survey.end_at,
        thank_you_message: survey.thank_you_message,
        display_config: survey.display_config,
      },
      questions: (survey.questions as any[]).map((q) => ({
        order_index: q.order_index,
        type: q.type || "single_choice",
        title: q.title,
        description: q.description,
        is_required: q.is_required,
        options: q.options,
      })),
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="survey-${survey.slug}.json"`)
    res.send(JSON.stringify(payload, null, 2))
  } catch (err: any) {
    console.error("GET /api/admin/surveys/:id/export error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.post("/import", adminOnly, async (req: Request, res: Response) => {
  try {
    const body = req.body as { version?: number; survey?: any; questions?: any[] }
    if (!body || !body.survey || !Array.isArray(body.questions)) {
      return res.status(400).json({ error: "File import không hợp lệ" })
    }
    const baseSlug = String(body.survey.slug || "imported").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 70) || "imported"
    let slug = baseSlug
    let suffix = 1
    while (true) {
      const existed = await query(`SELECT 1 FROM ai_portal.surveys WHERE slug = $1`, [slug])
      if (!existed.rows.length) break
      suffix++
      slug = `${baseSlug}-${suffix}`
      if (suffix > 50) return res.status(409).json({ error: "Không tạo được slug không trùng" })
    }
    const input: SurveyInput = {
      slug,
      name: String(body.survey.name || "Imported survey").trim(),
      description: body.survey.description ?? null,
      is_active: false,
      priority: Number(body.survey.priority) || 0,
      start_at: body.survey.start_at ?? null,
      end_at: body.survey.end_at ?? null,
      thank_you_message: body.survey.thank_you_message ?? null,
      display_config: body.survey.display_config || {},
      questions: body.questions.map((q: any, i: number) => ({
        order_index: Number(q.order_index ?? i),
        type: q.type === "text" ? "text" : q.type === "multi_choice" ? "multi_choice" : "single_choice",
        title: String(q.title || "").trim(),
        description: q.description ?? null,
        is_required: q.is_required !== false,
        options: Array.isArray(q.options)
          ? q.options.map((o: any) => ({
              id: String(o.id || ""),
              label: String(o.label || ""),
              allow_text: !!o.allow_text,
            }))
          : [],
      })),
    }
    const err = validateSurveyInput(input)
    if (err) return res.status(400).json({ error: `Import lỗi: ${err}` })
    const adminUserId = await getAdminUserId(req)
    const dc = sanitizeDisplayConfig(input.display_config)
    const surveyId = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO ai_portal.surveys
         (slug, name, description, is_active, priority, start_at, end_at, thank_you_message, display_config, created_by)
         VALUES ($1, $2, $3, false, $4, $5, $6, $7, $8::jsonb, $9)
         RETURNING id`,
        [
          input.slug,
          input.name,
          input.description,
          input.priority,
          input.start_at,
          input.end_at,
          input.thank_you_message,
          JSON.stringify(dc),
          adminUserId,
        ]
      )
      const newId = ins.rows[0].id as string
      for (let i = 0; i < input.questions.length; i++) {
        const q = input.questions[i]
        const qType = q.type === "text" ? "text" : q.type === "multi_choice" ? "multi_choice" : "single_choice"
        await client.query(
          `INSERT INTO ai_portal.survey_questions
           (survey_id, order_index, type, title, description, is_required, options)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            newId,
            Number(q.order_index ?? i),
            qType,
            q.title,
            q.description,
            q.is_required,
            JSON.stringify(qType === "text" ? [] : q.options),
          ]
        )
      }
      return newId
    })
    const survey = await loadSurveyFull(surveyId)
    res.status(201).json({ survey })
  } catch (err: any) {
    console.error("POST /api/admin/surveys/import error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.get("/:id/responses", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const format = String(req.query.format || "json").toLowerCase()
    const limit = Math.min(Number(req.query.limit ?? 200), 1000)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)
    const survey = await loadSurveyFull(id)
    if (!survey) return res.status(404).json({ error: "Khảo sát không tồn tại" })
    // Toàn bộ rows để tính stats / export CSV (không bị limit)
    const allRes = await query(
      `SELECT r.id, r.user_id, r.guest_device_id, r.answers, r.user_agent, r.submitted_at,
              u.email AS user_email, u.display_name AS user_display_name
       FROM ai_portal.survey_responses r
       LEFT JOIN ai_portal.users u ON u.id = r.user_id
       WHERE r.survey_id = $1::uuid
       ORDER BY r.submitted_at DESC`,
      [id]
    )
    const allRows = allRes.rows as any[]
    const total = allRows.length
    // Rows phân trang cho bảng Chi tiết
    const pagedRows = format === "csv" ? allRows : allRows.slice(offset, offset + limit)

    const formatAnswerCell = (q: any, ans: any): string => {
      if (ans == null) return ""
      if (q.type === "text") return String(ans?.text ?? "")
      if (q.type === "multi_choice") {
        const optionIds: string[] = Array.isArray(ans?.options) ? ans.options : []
        const labels = optionIds.map((oid) => {
          const opt = (q.options as any[]).find((o) => o.id === oid)
          return opt?.label ?? oid
        })
        const text = ans?.text ? ` — ${ans.text}` : ""
        return labels.join("; ") + text
      }
      const opt = (q.options as any[]).find((o) => o.id === ans?.option)
      const label = opt?.label ?? ans?.option ?? ""
      const text = ans?.text ? ` — ${ans.text}` : ""
      return `${label}${text}`
    }

    if (format === "csv") {
      const questions = survey.questions as any[]
      const headers = [
        "submitted_at",
        "user_email",
        "user_display_name",
        "guest_device_id",
        ...questions.map((q) => `Q: ${q.title}`),
      ]
      const escape = (v: any) => {
        const s = v == null ? "" : String(v)
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
      }
      const lines = [headers.map(escape).join(",")]
      for (const row of allRows) {
        const ans = row.answers || {}
        const cols = [
          row.submitted_at,
          row.user_email || "",
          row.user_display_name || "",
          row.guest_device_id || "",
          ...questions.map((q) => formatAnswerCell(q, ans[q.id])),
        ]
        lines.push(cols.map(escape).join(","))
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8")
      res.setHeader("Content-Disposition", `attachment; filename="survey-${survey.slug}-responses.csv"`)
      res.send("﻿" + lines.join("\n"))
      return
    }

    // Stats
    const stats = (survey.questions as any[]).map((q: any) => {
      if (q.type === "text") {
        const samples: string[] = []
        let count = 0
        for (const row of allRows) {
          const ans = row.answers?.[q.id]
          if (ans?.text && String(ans.text).trim()) {
            count++
            if (samples.length < 20) samples.push(String(ans.text))
          }
        }
        return {
          question_id: q.id,
          type: "text",
          title: q.title,
          options: [],
          total_answers: count,
          text_samples: samples,
        }
      }
      const counts: Record<string, number> = {}
      for (const opt of q.options as any[]) counts[opt.id] = 0
      const otherTexts: Record<string, string[]> = {}
      let respondents = 0
      for (const row of allRows) {
        const ans = row.answers?.[q.id]
        if (!ans) continue
        const ids: string[] =
          q.type === "multi_choice"
            ? Array.isArray(ans.options)
              ? ans.options
              : []
            : ans.option
            ? [ans.option]
            : []
        if (ids.length === 0) continue
        respondents++
        for (const optId of ids) {
          if (counts[optId] !== undefined) counts[optId]++
        }
        if (ans?.text && String(ans.text).trim()) {
          for (const optId of ids) {
            const opt = (q.options as any[]).find((o) => o.id === optId)
            if (opt?.allow_text) {
              if (!otherTexts[optId]) otherTexts[optId] = []
              if (otherTexts[optId].length < 20) otherTexts[optId].push(String(ans.text))
            }
          }
        }
      }
      // % cho multi tính theo respondents (mỗi người trả lời = 1), single theo tổng selection (= respondents)
      const denom = q.type === "multi_choice" ? respondents : Object.values(counts).reduce((a, b) => a + b, 0)
      return {
        question_id: q.id,
        type: q.type,
        title: q.title,
        options: (q.options as any[]).map((o: any) => ({
          id: o.id,
          label: o.label,
          allow_text: !!o.allow_text,
          count: counts[o.id],
          percent: denom > 0 ? Math.round((counts[o.id] / denom) * 1000) / 10 : 0,
          text_samples: otherTexts[o.id] || [],
        })),
        total_answers: respondents,
      }
    })

    res.json({ data: pagedRows, page: { limit, offset, total }, stats })
  } catch (err: any) {
    console.error("GET /api/admin/surveys/:id/responses error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.delete("/:id/responses", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    await query(`DELETE FROM ai_portal.survey_responses WHERE survey_id = $1::uuid`, [id])
    await query(`DELETE FROM ai_portal.survey_impressions WHERE survey_id = $1::uuid`, [id])
    res.json({ success: true })
  } catch (err: any) {
    console.error("DELETE /api/admin/surveys/:id/responses error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

export default router
