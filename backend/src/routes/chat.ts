// routes/chat.ts — config from Admin → Settings
import { Router, Request, Response } from "express"
import { query, withTransaction } from "../lib/db"
import { getSetting } from "../lib/settings"
import {
  UUID_RE,
  GUEST_USER_ID,
  GUEST_LOGIN_MESSAGE,
  SYSTEM_USER_ID,
  getCurrentUserId,
  getOrCreateUserByEmail,
  createSessionIfMissing,
  getRecentTurns,
  appendMessage,
  insertAttachments,
  checkUserDailyLimit,
  checkAgentDailyLimit,
  checkEmbedDailyLimit,
  checkGuestDailyLimit,
} from "../lib/chat"
import type { HistTurn } from "../lib/chat"

const router = Router()

// GET /api/chat/sessions
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string | undefined
    const projectId = req.query.project_id as string | undefined
    const assistantAlias = req.query.assistant_alias as string | undefined
    const q = req.query.q as string | undefined
    const limit = Math.min(Number(req.query.limit ?? 20), 100)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)

    const where: string[] = []
    const params: any[] = []

    if (userId) {
      if (UUID_RE.test(userId)) {
        params.push(userId)
        where.push(`cs.user_id = $${params.length}::uuid`)
      } else {
        params.push(userId.toLowerCase())
        where.push(`cs.user_id IN (SELECT id FROM ai_portal.users WHERE email = $${params.length})`)
      }
    }

    if (projectId !== undefined && projectId !== "") {
      if (UUID_RE.test(projectId)) {
        params.push(projectId)
        where.push(`cs.project_id = $${params.length}::uuid`)
      } else {
        where.push(`cs.project_id IS NULL`)
      }
    } else if (projectId === "") {
      where.push(`cs.project_id IS NULL`)
    }

    if (assistantAlias != null && assistantAlias !== "") {
      params.push(assistantAlias)
      where.push(`cs.assistant_alias = $${params.length}`)
    }

    if (q) {
      params.push(`%${q}%`)
      where.push(`(cs.title ILIKE $${params.length})`)
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const paramCount = params.length
    const sql = `
      WITH msg_counts AS (
        SELECT session_id, COUNT(*) AS message_count
        FROM ai_portal.messages
        GROUP BY session_id
      )
      SELECT
        cs.id,
        cs.user_id,
        cs.project_id,
        cs.created_at,
        cs.updated_at,
        cs.title,
        cs.assistant_alias,
        COALESCE(mc.message_count, 0) AS message_count
      FROM ai_portal.chat_sessions cs
      LEFT JOIN msg_counts mc ON mc.session_id = cs.id
      ${whereSql}
      ORDER BY cs.updated_at DESC NULLS LAST, cs.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM ai_portal.chat_sessions cs
      ${whereSql}
    `

    const finalParams = [...params, limit, offset]


    const [rowsRes, countRes] = await Promise.all([
      query(sql, finalParams),
      query<{ total: number }>(countSql, params),
    ])

    res.json({
      data: rowsRes.rows,
      page: { limit, offset, total: countRes.rows[0]?.total ?? 0 },
    })
  } catch (err: any) {
    console.error("❌ GET /api/chat/sessions error:", err)
    console.error("   Error message:", err.message)
    console.error("   Error stack:", err.stack)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: getSetting("DEBUG") === "true" ? err.message : undefined
    })
  }
})

// GET /api/chat/sessions/:sessionId
router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    if (!UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" })
    }
    const r = await query(
      `SELECT id, user_id, project_id, created_at, updated_at, title, assistant_alias
       FROM ai_portal.chat_sessions WHERE id = $1::uuid LIMIT 1`,
      [sessionId]
    )
    if (!r.rows[0]) {
      return res.status(404).json({ error: "Session not found" })
    }
    res.json({ data: r.rows[0] })
  } catch (err: any) {
    console.error("❌ GET /api/chat/sessions/:sessionId error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

// POST /api/chat/sessions
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { user_id = null, title = null, assistant_alias = null, source: bodySource = null, project_id = null } = req.body ?? {}
    
    // user_id NOT NULL; use system user when anonymous
    const finalUserId = user_id || SYSTEM_USER_ID
    const finalAssistantAlias = assistant_alias || "central"
    const finalSource = bodySource === "embed" ? "embed" : "web"
    const finalProjectId = project_id && UUID_RE.test(project_id) ? project_id : null

    const sql = `
      INSERT INTO ai_portal.chat_sessions (user_id, title, assistant_alias, source, project_id, created_at, updated_at)
      VALUES ($1::uuid, $2, $3, $4, $5::uuid, NOW(), NOW())
      RETURNING id, user_id, project_id, created_at, updated_at, title
    `
    const r = await query(sql, [finalUserId, title, finalAssistantAlias, finalSource, finalProjectId])
    res.status(201).json({ data: r.rows[0] })
  } catch (e: any) {
    console.error("❌ POST /api/chat/sessions error:", e)
    console.error("   Error message:", e.message)
    console.error("   Error stack:", e.stack)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: getSetting("DEBUG") === "true" ? e.message : undefined
    })
  }
})

// GET /api/chat/daily-usage — daily message limit for user (public). Query: user_id (UUID or email).
router.get("/daily-usage", async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string | undefined
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ error: "user_id là bắt buộc" })
    }
    const resolvedUserId = await getOrCreateUserByEmail(userId.trim())
    const row = await query<{ daily_message_limit: number; extra: number | null; used: string }>(
      `SELECT
         COALESCE(u.daily_message_limit, 10) AS daily_message_limit,
         (SELECT o.extra_messages FROM ai_portal.user_daily_limit_overrides o
          WHERE o.user_id = u.id AND o.override_date = current_date LIMIT 1) AS extra,
         COALESCE((SELECT ud.count::text FROM ai_portal.user_daily_message_sends ud
          WHERE ud.user_id = u.id AND ud.send_date = current_date LIMIT 1), '0') AS used
       FROM ai_portal.users u WHERE u.id = $1::uuid LIMIT 1`,
      [resolvedUserId]
    )
    if (!row.rows[0]) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    const { daily_message_limit: baseLimit, extra, used } = row.rows[0]
    const extraNum = typeof extra === "number" ? extra : (extra != null ? parseInt(String(extra), 10) : 0)
    const limit = Math.max(0, (baseLimit ?? 10) + (Number.isInteger(extraNum) ? extraNum : 0))
    const usedNum = parseInt(used ?? "0", 10)
    res.json({
      limit,
      used: usedNum,
      remaining: Math.max(0, limit - usedNum),
    })
  } catch (err: any) {
    console.error("GET /api/chat/daily-usage error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

// GET /api/chat/sessions/:sessionId/messages
router.get("/sessions/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")

    if (!UUID_RE.test(sessionId)) {
      console.warn("⚠️  Invalid sessionId format:", sessionId)
      return res.status(400).json({ error: "Invalid sessionId" })
    }

    let limit = Number(req.query.limit ?? 100)
    let offset = Number(req.query.offset ?? 0)
    if (!Number.isFinite(limit) || limit <= 0) limit = 100
    if (limit > 200) limit = 200
    if (!Number.isFinite(offset) || offset < 0) offset = 0

    const currentUserId = await getCurrentUserId(req)

    const sql = `
      SELECT
        m.id,
        m.assistant_alias,
        m.role,
        m.content_type,
        m.content,
        m.model_id,
        m.prompt_tokens,
        m.completion_tokens,
        m.response_time_ms,
        m.refs,
        m.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'file_name', ma.file_name,
              'file_url', ma.file_url
            )
          ) FILTER (WHERE ma.id IS NOT NULL),
          '[]'::json
        ) AS attachments,
        (SELECT mf.feedback FROM ai_portal.message_feedback mf WHERE mf.message_id = m.id AND mf.user_id = $4::uuid LIMIT 1) AS feedback
      FROM ai_portal.messages m
      LEFT JOIN ai_portal.message_attachments ma ON ma.message_id = m.id
      WHERE m.session_id = $1::uuid
      GROUP BY m.id, m.created_at, m.role
      ORDER BY m.created_at ASC, (CASE m.role WHEN 'user' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END) ASC
      LIMIT $2 OFFSET $3
    `

    const result = await query(sql, [sessionId, limit, offset, currentUserId ?? null])
    res.json({ data: result.rows })
  } catch (err: any) {
    console.error("❌ GET /api/chat/sessions/:sessionId/messages error:", err)
    console.error("   Error message:", err.message)
    console.error("   Error stack:", err.stack)
    console.error("   Error code:", err.code)
    
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.message?.includes("connect")) {
      console.error("❌ Database connection error detected!")
      return res.status(500).json({ 
        error: "Database Connection Error",
        message: getSetting("DEBUG") === "true" 
          ? `Cannot connect to database: ${err.message}` 
          : "Cannot connect to database. Please check database configuration."
      })
    }
    
    res.status(500).json({ 
      error: "Internal Server Error",
      message: getSetting("DEBUG") === "true" ? err.message : undefined
    })
  }
})

// POST /api/chat/sessions/:sessionId/messages
router.post("/sessions/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    if (!UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" })
    }

    const {
      role,
      content,
      model_id = null,
      assistant_alias = null,
      status = "ok",
      content_type = "markdown",
      prompt_tokens = null,
      completion_tokens = null,
      total_tokens = null,
      response_time_ms = null,
      refs = null,
    } = req.body ?? {}

    if (!role) {
      return res.status(400).json({ error: "role is required" })
    }
    const contentStr = content != null ? String(content) : ""

    const insertMsg = `
      INSERT INTO ai_portal.messages (
        session_id, assistant_alias,
        role, status, content_type, content,
        model_id, prompt_tokens, completion_tokens, total_tokens,
        response_time_ms, refs, created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
      )
      RETURNING id, session_id, role, content, model_id, created_at
    `
    const r = await query(insertMsg, [
      sessionId,
      assistant_alias,
      role,
      status,
      content_type,
      contentStr,
      model_id,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      response_time_ms,
      refs,
    ])

    await query(
      `UPDATE ai_portal.chat_sessions SET updated_at = NOW() WHERE id = $1`,
      [sessionId]
    )

    res.status(201).json({ data: r.rows[0] })
  } catch (e) {
    console.error("POST /api/chat/sessions/:sessionId/messages error:", e)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

// POST /api/chat/sessions/:sessionId/send
router.post("/sessions/:sessionId/send", async (req: Request, res: Response) => {
  const t0 = Date.now()

  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    if (!UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" })
    }

    const {
      assistant_base_url,
      model_id,
      prompt,
      user = "anonymous",
      context = {},
      session_title,
      assistant_alias,
      user_id,
      project_id: bodyProjectId,
      source: bodySource,
      guest_device_id: bodyGuestDeviceId,
    } = req.body || {}
    const sourceFromContext = (context as any)?.source
    const projectIdFromContext = (context as any)?.project_id
    const effectiveProjectId = bodyProjectId ?? projectIdFromContext ?? null
    const sessionSource = bodySource === "embed" || sourceFromContext === "embed" ? "embed" : "web"
    const effectiveAlias = assistant_alias || "central"
    const guestDeviceId = typeof bodyGuestDeviceId === "string" && bodyGuestDeviceId.trim() ? bodyGuestDeviceId.trim() : null

    const isGuest = !user_id || (typeof user_id === "string" && user_id.trim() === "")
    const resolvedUserId = isGuest
      ? GUEST_USER_ID
      : await getOrCreateUserByEmail(user_id ?? null)

    const userLimitResult = await checkUserDailyLimit(resolvedUserId)
    if (!userLimitResult.allowed) {
      return res.status(userLimitResult.status).json(userLimitResult.body)
    }

    const agentLimitResult = await checkAgentDailyLimit(effectiveAlias)
    if (!agentLimitResult.allowed) {
      return res.status(agentLimitResult.status).json(agentLimitResult.body)
    }

    if (sessionSource === "embed") {
      const embedLimitResult = await checkEmbedDailyLimit(effectiveAlias)
      if (!embedLimitResult.allowed) {
        return res.status(embedLimitResult.status).json(embedLimitResult.body)
      }
    }

    if (isGuest) {
      const guestLimitResult = await checkGuestDailyLimit(guestDeviceId ?? "anonymous", effectiveAlias)
      if (!guestLimitResult.allowed) {
        await createSessionIfMissing({
          sessionId,
          userId: GUEST_USER_ID,
          assistantAlias: effectiveAlias,
          title: session_title ?? null,
          modelId: model_id ?? null,
          source: sessionSource,
          projectId: effectiveProjectId,
        })
        await withTransaction(async (client) => {
          await appendMessage(
            sessionId,
            {
              role: "user",
              content: String(prompt ?? "").trim() || "(file đính kèm)",
              content_type: "markdown",
              model_id,
              status: "ok",
              assistant_alias: effectiveAlias,
            },
            client
          )
          await appendMessage(
            sessionId,
            {
              role: "assistant",
              content: GUEST_LOGIN_MESSAGE,
              content_type: "text",
              model_id,
              status: "ok",
              assistant_alias: effectiveAlias,
            },
            client
          )
        })
        return res.json({
          status: "success",
          content_markdown: GUEST_LOGIN_MESSAGE,
          meta: { guest_limit_reached: true },
        })
      }
    }

    const rawDocList = Array.isArray((context as any)?.extra_data?.document)
      ? (context as any).extra_data.document
      : []
    const hasAttachments = rawDocList.length > 0
    const hasPrompt = typeof prompt === "string" && prompt.trim().length > 0
    if (!assistant_base_url || !model_id) {
      return res.status(400).json({
        error: "Missing assistant_base_url | model_id",
      })
    }
    if (!hasPrompt && !hasAttachments) {
      return res.status(400).json({
        error: "Cần nhập tin nhắn hoặc đính kèm ít nhất một file",
      })
    }

    let history: HistTurn[] = []
    try {
      history = await getRecentTurns(sessionId, 10)
    } catch (e) {
      console.warn("getRecentTurns failed:", e)
      history = []
    }

    let userUrl: string | null = null
    if (resolvedUserId !== SYSTEM_USER_ID) {
      let userEmail: string | null = null
      if (typeof user === "string" && user.includes("@")) {
        userEmail = user.trim().toLowerCase()
      } else if (user_id && typeof user_id === "string" && user_id.includes("@")) {
        userEmail = String(user_id).trim().toLowerCase()
      } else {
        const emailRow = await query<{ email: string }>(
          `SELECT email FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
          [resolvedUserId]
        )
        userEmail = emailRow.rows[0]?.email ?? null
      }
      if (userEmail) {
        const baseUrl =
          getSetting("BACKEND_URL") ||
          getSetting("NEXTAUTH_URL") ||
          getSetting("API_BASE_URL") ||
          (req.get("host")
            ? req.protocol + "://" + req.get("host")
            : process.env.NODE_ENV === "development"
              ? `http://localhost:${process.env.PORT || "3001"}`
              : "")
        const base = (typeof baseUrl === "string" ? baseUrl : "").replace(/\/+$/, "")
        userUrl = `${base}/api/users/email/${encodeURIComponent(userEmail)}`
      }
    }

    const promptForAgent = hasPrompt ? prompt : (context as any)?.prompt_placeholder ?? "User sent an attachment."
    const aiReqBody = {
      session_id: sessionId,
      model_id,
      user,
      prompt: promptForAgent,
      output_type: "markdown",
      context: {
        ...context,
        ...(userUrl ? { user_url: userUrl } : {}),
        history,
      },
    }

    const agentBase = String(assistant_base_url ?? "").replace(/\/+$/, "")
    const aiRes = await fetch(`${agentBase}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiReqBody),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "")
      let errorPayload: { error: string; error_message?: string; error_step?: string } = {
        error: `Agent error: ${aiRes.status} ${errText}`,
      }
      try {
        const errJson = JSON.parse(errText)
        if (typeof errJson?.error_message === "string") {
          errorPayload.error = errJson.error_message
          errorPayload.error_message = errJson.error_message
          if (errJson.error_step) errorPayload.error_step = errJson.error_step
        }
      } catch (_) {}
      return res.status(aiRes.status >= 400 && aiRes.status < 600 ? aiRes.status : 502).json(errorPayload)
    }

    const aiJson: any = await aiRes.json().catch(() => ({}))

    if (aiJson?.status !== "success") {
      console.error("❌ AI agent returned non-success status:", aiJson)
      return res.status(502).json({ error: aiJson?.error_message || "Agent failed" })
    }

    const contentMarkdown: string = String(aiJson?.content_markdown ?? "")
    const promptTokens: number | null = aiJson?.meta?.prompt_tokens ?? null
    const completionTokens: number | null = aiJson?.meta?.completion_tokens ?? null
    const totalTokens: number | null = aiJson?.meta?.tokens_used ?? null
    const responseTimeMs: number =
      aiJson?.meta?.response_time_ms ?? Math.max(1, Date.now() - t0)
    const metaAgents = aiJson?.meta?.agents
    let assistantMessageId: string | null = null

    try {
      await createSessionIfMissing({
        sessionId,
        userId: resolvedUserId,
        assistantAlias: assistant_alias ?? null,
        title: session_title ?? null,
        modelId: model_id ?? null,
        source: sessionSource,
        projectId: effectiveProjectId,
      })

      await withTransaction(async (client) => {
      
        const userMsgId = await appendMessage(
          sessionId,
          {
            role: "user",
            content: String(prompt),
            content_type: "markdown",
            model_id,
            status: "ok",
            assistant_alias: assistant_alias ?? null,
          },
          client
        )

        if (userMsgId && resolvedUserId !== SYSTEM_USER_ID && resolvedUserId !== GUEST_USER_ID) {
          await client.query(
            `INSERT INTO ai_portal.user_daily_message_sends (user_id, send_date, count)
             VALUES ($1::uuid, current_date, 1)
             ON CONFLICT (user_id, send_date) DO UPDATE
             SET count = ai_portal.user_daily_message_sends.count + 1`,
            [resolvedUserId]
          )
        }

        const rawDocs = Array.isArray((context as any)?.extra_data?.document)
          ? (context as any).extra_data.document
          : []
        const docs = rawDocs.map((d: any) => {
          if (typeof d === "string") return { url: d.trim(), name: d.split("/").pop()?.split("?")[0] }
          if (d && typeof d.url === "string") return { url: d.url.trim(), name: d.name ?? d.file_name ?? d.url.split("/").pop()?.split("?")[0] }
          return null
        }).filter(Boolean) as { url: string; name?: string }[]
        if (userMsgId && docs.length > 0) {
          await insertAttachments(userMsgId, docs, client)
        }

        assistantMessageId = await appendMessage(
          sessionId,
          {
            role: "assistant",
            content: contentMarkdown,
            content_type: "markdown",
            model_id,
            status: "ok",
            assistant_alias: assistant_alias ?? null,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            response_time_ms: responseTimeMs,
          },
          client
        )
      })

      if (isGuest) {
        const deviceIdForUsage = guestDeviceId || "anonymous"
        await query(
          `INSERT INTO ai_portal.guest_device_daily_usage (device_id, assistant_alias, usage_date, message_count)
           VALUES ($1, $2, current_date, 1)
           ON CONFLICT (device_id, assistant_alias, usage_date) DO UPDATE SET message_count = COALESCE(guest_device_daily_usage.message_count, 0) + 1`,
          [deviceIdForUsage, effectiveAlias]
        )
      }
    } catch (e: any) {
      console.error("❌ CRITICAL: Failed to save messages to database")
      console.error("Session ID:", sessionId)
      console.error("Error code:", e?.code)
      console.error("Error message:", e?.message)
      console.error("Error stack:", e?.stack)
      console.error("Error details:", e)
      
      if (e?.code === "23503") {
        console.error("❌ Foreign key violation - Session may not exist or user_id invalid")
      } else if (e?.code === "23505") {
        console.error("❌ Unique constraint violation")
      } else if (e?.code === "23502") {
        console.error("❌ NOT NULL constraint violation")
      }
      
    }

    res.json({
      status: "success",
      content_markdown: contentMarkdown,
      ...(assistantMessageId ? { assistant_message_id: assistantMessageId } : {}),
      meta: {
        model: model_id,
        response_time_ms: responseTimeMs,
        tokens_used: totalTokens,
        ...(Array.isArray(metaAgents) && metaAgents.length > 0 ? { agents: metaAgents } : {}),
      },
    })
  } catch (err: any) {
    console.error("POST /api/chat/sessions/:sessionId/send error:", err)
    res.status(500).json({
      error: err?.message || "Internal Server Error",
      error_message: `Lỗi ở bước xử lý tin nhắn (backend): ${err?.message || "Lỗi không xác định"}`,
      error_step: "backend_send",
    })
  }
})

// PATCH /api/chat/sessions/:sessionId
router.patch("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    if (!UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" })
    }
    const { title } = req.body ?? {}
    if (title == null || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" })
    }

    const result = await query(
      `UPDATE ai_portal.chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING id, title`,
      [title.trim(), sessionId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" })
    }
    res.json({ data: result.rows[0] })
  } catch (err: any) {
    console.error("❌ PATCH /api/chat/sessions/:sessionId error:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: getSetting("DEBUG") === "true" ? err.message : undefined,
    })
  }
})

// DELETE /api/chat/sessions/:sessionId
router.delete("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    if (!UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" })
    }

    await query(
      `DELETE FROM ai_portal.messages WHERE session_id = $1::uuid`,
      [sessionId]
    )
    const result = await query(
      `DELETE FROM ai_portal.chat_sessions WHERE id = $1::uuid RETURNING id`,
      [sessionId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" })
    }
    res.json({ status: "success", message: "Session deleted" })
  } catch (err: any) {
    console.error("❌ DELETE /api/chat/sessions/:sessionId error:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: getSetting("DEBUG") === "true" ? err.message : undefined
    })
  }
})

// DELETE /api/chat/sessions/:sessionId/messages/:messageId
router.delete("/sessions/:sessionId/messages/:messageId", async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    const messageId = String(req.params.messageId).trim().replace(/\/+$/g, "")
    
    if (!UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" })
    }
    if (!UUID_RE.test(messageId)) {
      return res.status(400).json({ error: "Invalid messageId" })
    }

    const result = await query(
      `DELETE FROM ai_portal.messages 
       WHERE id = $1::uuid AND session_id = $2::uuid 
       RETURNING id`,
      [messageId, sessionId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" })
    }

    res.json({ status: "success", message: "Message deleted" })
  } catch (err: any) {
    console.error("❌ DELETE /api/chat/sessions/:sessionId/messages/:messageId error:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: getSetting("DEBUG") === "true" ? err.message : undefined
    })
  }
})

// PUT /api/chat/sessions/:sessionId/messages/:messageId/feedback
router.put("/sessions/:sessionId/messages/:messageId/feedback", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" })
    }
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    const messageId = String(req.params.messageId).trim().replace(/\/+$/g, "")
    const body = req.body as { feedback?: string; comment?: string }
    const feedback = body?.feedback
    const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 2000) : null
    if (feedback !== "like" && feedback !== "dislike" && feedback !== "none") {
      return res.status(400).json({ error: "feedback phải là 'like', 'dislike' hoặc 'none' (để xóa)" })
    }
    if (!UUID_RE.test(sessionId) || !UUID_RE.test(messageId)) {
      return res.status(400).json({ error: "ID không hợp lệ" })
    }
    const sessionRow = await query(
      `SELECT user_id FROM ai_portal.chat_sessions WHERE id = $1::uuid LIMIT 1`,
      [sessionId]
    )
    const session = sessionRow.rows[0] as { user_id: string } | undefined
    if (!session || session.user_id !== userId) {
      return res.status(404).json({ error: "Không có quyền đánh giá tin nhắn trong phiên này" })
    }
    const msgRow = await query(
      `SELECT id, role FROM ai_portal.messages WHERE id = $1::uuid AND session_id = $2::uuid LIMIT 1`,
      [messageId, sessionId]
    )
    const msg = msgRow.rows[0] as { id: string; role: string } | undefined
    if (!msg || msg.role !== "assistant") {
      return res.status(404).json({ error: "Chỉ đánh giá được câu trả lời của trợ lý" })
    }
    if (feedback === "none") {
      await query(
        `DELETE FROM ai_portal.message_feedback WHERE message_id = $1::uuid AND user_id = $2::uuid`,
        [messageId, userId]
      )
      return res.json({ feedback: null })
    }
    await query(
      `INSERT INTO ai_portal.message_feedback (message_id, user_id, feedback, comment)
       VALUES ($1::uuid, $2::uuid, $3, $4)
       ON CONFLICT (message_id, user_id) DO UPDATE SET feedback = $3, comment = $4`,
      [messageId, userId, feedback, feedback === "dislike" ? comment : null]
    )
    res.json({ feedback })
  } catch (err: any) {
    console.error("❌ PUT /api/chat/sessions/:sessionId/messages/:messageId/feedback error:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: getSetting("DEBUG") === "true" ? err.message : undefined
    })
  }
})

// GET /api/chat/messages/:messageId
router.get("/messages/:messageId", async (req: Request, res: Response) => {
  try {
    const messageId = String(req.params.messageId)
    const sql = `
      SELECT
        m.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ma.id,
              'file_name', ma.file_name,
              'file_type', ma.mime_type,
              'file_size', ma.byte_size,
              'storage_url', ma.file_url
            )
          ) FILTER (WHERE ma.id IS NOT NULL),
          '[]'::json
        ) AS attachments
      FROM ai_portal.messages m
      LEFT JOIN ai_portal.message_attachments ma ON ma.message_id = m.id
      WHERE m.id = $1
      GROUP BY m.id
      LIMIT 1
    `
    const result = await query(sql, [messageId])
    if (!result.rowCount) return res.status(404).json({ error: "Not found" })
    res.json({ data: result.rows[0] })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

export default router
