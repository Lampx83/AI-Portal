// routes/chat.ts
import { Router, Request, Response } from "express"
import { query, withTransaction } from "../lib/db"
import crypto from "crypto"

const router = Router()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// GET /api/chat/sessions
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    console.log("🔍 GET /api/chat/sessions")
    const userId = req.query.user_id as string | undefined
    const q = req.query.q as string | undefined
    const limit = Math.min(Number(req.query.limit ?? 20), 100)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)

    console.log("🔍 Query params - userId:", userId, "q:", q, "limit:", limit, "offset:", offset)

    const where: string[] = []
    const params: any[] = []

    if (userId) {
      // Nếu userId là UUID hợp lệ, dùng trực tiếp
      // Nếu không, coi như email và join với bảng users
      if (UUID_RE.test(userId)) {
        params.push(userId)
        where.push(`cs.user_id = $${params.length}::uuid`)
      } else {
        // userId là email, join với bảng users để filter
        params.push(userId.toLowerCase())
        where.push(`cs.user_id IN (SELECT id FROM research_chat.users WHERE email = $${params.length})`)
      }
    }

    if (q) {
      params.push(`%${q}%`)
      where.push(`(cs.title ILIKE $${params.length})`)
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

    // Note: schema has user_id as NOT NULL, but we allow filtering by it
    // Also, schema doesn't have assistant_alias in chat_sessions, so we remove it from query
    // Build SQL with proper parameter placeholders
    const paramCount = params.length
    const sql = `
      WITH msg_counts AS (
        SELECT session_id, COUNT(*) AS message_count
        FROM research_chat.messages
        GROUP BY session_id
      )
      SELECT
        cs.id,
        cs.user_id,
        cs.created_at,
        cs.updated_at,
        cs.title,
        COALESCE(mc.message_count, 0) AS message_count
      FROM research_chat.chat_sessions cs
      LEFT JOIN msg_counts mc ON mc.session_id = cs.id
      ${whereSql}
      ORDER BY cs.updated_at DESC NULLS LAST, cs.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM research_chat.chat_sessions cs
      ${whereSql}
    `

    const finalParams = [...params, limit, offset]
    console.log("🔍 Executing SQL query:")
    console.log("   SQL:", sql.replace(/\s+/g, ' ').trim())
    console.log("   Params:", finalParams)

    const [rowsRes, countRes] = await Promise.all([
      query(sql, finalParams),
      query<{ total: number }>(countSql, params),
    ])

    console.log("✅ Query successful, rows:", rowsRes.rows.length, "total:", countRes.rows[0]?.total ?? 0)

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
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    })
  }
})

// POST /api/chat/sessions
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    console.log("🔍 POST /api/chat/sessions")
    const { user_id = null, title = null, assistant_alias = null } = req.body ?? {}
    
    // Schema requires user_id to be NOT NULL, so we need a default user or handle it differently
    // For now, if user_id is null, we'll use a default system user UUID
    // TODO: Create a system user or handle anonymous sessions differently
    const finalUserId = user_id || "00000000-0000-0000-0000-000000000000"
    const finalAssistantAlias = assistant_alias || "main"
    
    console.log("🔍 Inserting session - user_id:", finalUserId, "title:", title, "assistant_alias:", finalAssistantAlias)
    
    const sql = `
      INSERT INTO research_chat.chat_sessions (user_id, title, assistant_alias, created_at, updated_at)
      VALUES ($1::uuid, $2, $3, NOW(), NOW())
      RETURNING id, user_id, created_at, updated_at, title
    `
    const r = await query(sql, [finalUserId, title, finalAssistantAlias])
    console.log("✅ Session created:", r.rows[0]?.id)
    res.status(201).json({ data: r.rows[0] })
  } catch (e: any) {
    console.error("❌ POST /api/chat/sessions error:", e)
    console.error("   Error message:", e.message)
    console.error("   Error stack:", e.stack)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? e.message : undefined
    })
  }
})

// GET /api/chat/sessions/:sessionId/messages
router.get("/sessions/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    console.log("🔍 GET /api/chat/sessions/:sessionId/messages - sessionId:", sessionId)
    
    if (!UUID_RE.test(sessionId)) {
      console.warn("⚠️  Invalid sessionId format:", sessionId)
      return res.status(400).json({ error: "Invalid sessionId" })
    }

    let limit = Number(req.query.limit ?? 100)
    let offset = Number(req.query.offset ?? 0)
    if (!Number.isFinite(limit) || limit <= 0) limit = 100
    if (limit > 200) limit = 200
    if (!Number.isFinite(offset) || offset < 0) offset = 0

    console.log("🔍 Query params - limit:", limit, "offset:", offset)

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
        ) AS attachments
      FROM research_chat.messages m
      LEFT JOIN research_chat.message_attachments ma ON ma.message_id = m.id
      WHERE m.session_id = $1::uuid
      GROUP BY m.id, m.created_at
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `

    console.log("🔍 Executing SQL query...")
    const result = await query(sql, [sessionId, limit, offset])
    console.log("✅ Query successful, rows:", result.rows.length)
    res.json({ data: result.rows })
  } catch (err: any) {
    console.error("❌ GET /api/chat/sessions/:sessionId/messages error:", err)
    console.error("   Error message:", err.message)
    console.error("   Error stack:", err.stack)
    console.error("   Error code:", err.code)
    
    // Kiểm tra nếu lỗi liên quan đến database connection
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.message?.includes("connect")) {
      console.error("❌ Database connection error detected!")
      return res.status(500).json({ 
        error: "Database Connection Error",
        message: process.env.NODE_ENV === "development" 
          ? `Cannot connect to database: ${err.message}` 
          : "Cannot connect to database. Please check database configuration."
      })
    }
    
    res.status(500).json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
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
      INSERT INTO research_chat.messages (
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
      `UPDATE research_chat.chat_sessions SET updated_at = NOW() WHERE id = $1`,
      [sessionId]
    )

    res.status(201).json({ data: r.rows[0] })
  } catch (e) {
    console.error("POST /api/chat/sessions/:sessionId/messages error:", e)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

// POST /api/chat/sessions/:sessionId/send
type HistTurn = { role: "user" | "assistant"; content: string }

async function getRecentTurns(sessionId: string, limit = 5): Promise<HistTurn[]> {
  const { rows } = await query(
    `
    SELECT role, content
    FROM research_chat.messages
    WHERE session_id = $1::uuid
      AND status = 'ok'
      AND role IN ('user','assistant')
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [sessionId, limit]
  )
  return rows.reverse().map((r: any) => ({
    role: r.role,
    content: String(r.content ?? ""),
  }))
}

type AppendMessageInput = {
  role: "user" | "assistant"
  content: string
  content_type?: "markdown" | "text" | "json"
  model_id?: string | null
  status?: "ok" | "error"
  assistant_alias?: string | null
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
  response_time_ms?: number | null
  refs?: any
}

async function appendMessage(
  sessionId: string,
  m: AppendMessageInput,
  client?: any
): Promise<string | null> {
  const {
    role,
    content,
    content_type = "markdown",
    model_id = null,
    status = "ok",
    assistant_alias = null,
    prompt_tokens = null,
    completion_tokens = null,
    total_tokens = null,
    response_time_ms = null,
    refs = null,
  } = m

  const queryFn = client ? client.query.bind(client) : query

  const r = await queryFn(
    `
    INSERT INTO research_chat.messages (
      session_id, assistant_alias,
      role, status, content_type, content,
      model_id, prompt_tokens, completion_tokens, total_tokens,
      response_time_ms, refs
    )
    VALUES (
      $1::uuid, $2,
      $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12
    )
    RETURNING id
  `,
    [
      sessionId,
      assistant_alias,
      role,
      status,
      content_type,
      String(content ?? ""),
      model_id,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      response_time_ms,
      refs,
    ]
  )
  return r?.rows?.[0]?.id ?? null
}

async function insertAttachments(
  messageId: string,
  docs: { url: string; name?: string }[],
  client?: any
) {
  if (!docs?.length) return
  const queryFn = client ? client.query.bind(client) : query
  for (const doc of docs) {
    const url = String(doc.url || "").trim()
    if (!url) continue
    const name = doc.name ?? url.split("/").pop()?.split("?")[0] ?? null
    await queryFn(
      `INSERT INTO research_chat.message_attachments (message_id, file_url, file_name)
       VALUES ($1::uuid, $2, $3)`,
      [messageId, url, name]
    )
  }
}

// Helper function để lấy hoặc tạo user từ email
async function getOrCreateUserByEmail(email: string | null): Promise<string> {
  if (!email) {
    return "00000000-0000-0000-0000-000000000000"
  }

  // Kiểm tra xem có phải UUID không (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (UUID_REGEX.test(email)) {
    return email
  }

  // Nếu là email, tìm hoặc tạo user
  try {
    const found = await query(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (found.rowCount && found.rows[0]?.id) {
      return found.rows[0].id
    }

    // Tạo user mới
    const newId = crypto.randomUUID()
    await query(
      `INSERT INTO research_chat.users (id, email, display_name, created_at, updated_at) 
       VALUES ($1::uuid, $2, $3, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      [newId, email, email.split("@")[0]]
    )

    // Lấy lại user ID (có thể đã tồn tại do conflict)
    const finalCheck = await query(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (finalCheck.rowCount && finalCheck.rows[0]?.id) {
      return finalCheck.rows[0].id
    }
  } catch (err: any) {
    console.error("❌ Failed to get or create user by email:", err)
    console.error("   Email:", email)
  }

  // Fallback về system user nếu có lỗi
  return "00000000-0000-0000-0000-000000000000"
}

async function createSessionIfMissing(opts: {
  sessionId: string
  userId?: string | null
  assistantAlias?: string | null
  title?: string | null
  modelId?: string | null
}) {
  const {
    sessionId,
    userId = null,
    assistantAlias = null,
    title = null,
    modelId = null,
  } = opts
  
  const finalAssistantAlias = assistantAlias || "main"
  
  try {
    // Chuyển đổi userId (có thể là email hoặc UUID) thành UUID
    const finalUserId = await getOrCreateUserByEmail(userId)
    
    // Đảm bảo system user tồn tại nếu đang dùng system user
    if (finalUserId === "00000000-0000-0000-0000-000000000000") {
      await query(
        `
          INSERT INTO research_chat.users (id, email, display_name, created_at, updated_at)
          SELECT 
            '00000000-0000-0000-0000-000000000000'::uuid,
            'system@research.local',
            'System User',
            NOW(),
            NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM research_chat.users WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
          )
        `
      )
    }
    
    const result = await query(
      `
        INSERT INTO research_chat.chat_sessions (id, user_id, assistant_alias, title, model_id)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `,
      [sessionId, finalUserId, finalAssistantAlias, title, modelId]
    )
    if (result.rowCount && result.rowCount > 0) {
      console.log(`✅ Created session ${sessionId}`)
    } else {
      console.log(`ℹ️  Session ${sessionId} already exists`)
    }
  } catch (err: any) {
    console.error("❌ Failed to create session:", err)
    console.error("   Session ID:", sessionId)
    console.error("   User ID (original):", userId)
    console.error("   Assistant Alias:", finalAssistantAlias)
    console.error("   Error code:", err?.code)
    console.error("   Error message:", err?.message)
    throw err
  }
}

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
    } = req.body || {}

    console.log("📥 Received send request:", {
      sessionId,
      assistant_base_url,
      assistant_alias,
      model_id,
      prompt_length: prompt?.length || 0,
      has_user_id: !!user_id,
    })

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

    // Lấy lịch sử
    let history: HistTurn[] = []
    try {
      history = await getRecentTurns(sessionId, 10)
      console.log(`📚 Loaded ${history.length} history turns`)
    } catch (e) {
      console.warn("⚠️ Không lấy được history:", e)
      history = []
    }

    // Gọi AI (cho phép prompt rỗng khi có file đính kèm)
    const promptForAgent = hasPrompt ? prompt : (context as any)?.prompt_placeholder ?? "Người dùng đã gửi file đính kèm."
    const aiReqBody = {
      session_id: sessionId,
      model_id,
      user,
      prompt: promptForAgent,
      context: {
        ...context,
        history,
      },
    }

    console.log(`🤖 Calling AI agent at ${assistant_base_url}/ask...`)
    const aiRes = await fetch(`${assistant_base_url}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiReqBody),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "")
      console.error("❌ AI agent error:", {
        status: aiRes.status,
        statusText: aiRes.statusText,
        errorText: errText.substring(0, 200),
      })
      return res.status(502).json({ error: `Agent error: ${aiRes.status} ${errText}` })
    }

    const aiJson: any = await aiRes.json().catch(() => ({}))
    console.log("🤖 AI agent response:", {
      status: aiJson?.status,
      has_content_markdown: !!aiJson?.content_markdown,
      content_length: aiJson?.content_markdown?.length || 0,
      has_meta: !!aiJson?.meta,
      error_message: aiJson?.error_message,
    })
    
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

    // Lưu vào database
    try {
      await createSessionIfMissing({
        sessionId,
        userId: user_id ?? null,
        assistantAlias: assistant_alias ?? null,
        title: session_title ?? null,
        modelId: model_id ?? null,
      })

      await withTransaction(async (client) => {
        console.log(`💾 Saving messages for session ${sessionId}...`)

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
        console.log("✅ User message saved")

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
          console.log(`✅ ${docs.length} attachment(s) saved`)
        }

        await appendMessage(
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
        console.log("✅ Assistant message saved")
      })

      console.log("✅ All messages saved to database successfully")
    } catch (e: any) {
      console.error("❌ CRITICAL: Failed to save messages to database")
      console.error("Session ID:", sessionId)
      console.error("Error code:", e?.code)
      console.error("Error message:", e?.message)
      console.error("Error stack:", e?.stack)
      console.error("Error details:", e)
      
      // Log thêm thông tin để debug
      if (e?.code === "23503") {
        console.error("❌ Foreign key violation - Session may not exist or user_id invalid")
      } else if (e?.code === "23505") {
        console.error("❌ Unique constraint violation")
      } else if (e?.code === "23502") {
        console.error("❌ NOT NULL constraint violation")
      }
      
      // Vẫn trả về success để không làm gián đoạn user experience
      // Nhưng log chi tiết để admin có thể debug
      // TODO: Có thể thêm monitoring/alerting ở đây
    }

    res.json({
      status: "success",
      content_markdown: contentMarkdown,
      meta: {
        model: model_id,
        response_time_ms: responseTimeMs,
        tokens_used: totalTokens,
      },
    })
  } catch (err: any) {
    console.error("POST /api/chat/sessions/:sessionId/send error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

// DELETE /api/chat/sessions/:sessionId - Xóa session và tất cả messages
router.delete("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim().replace(/\/+$/g, "")
    if (!UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" })
    }

    console.log("🗑️ DELETE /api/chat/sessions/:sessionId - sessionId:", sessionId)

    // Xóa tất cả messages trước (do foreign key constraint)
    await query(
      `DELETE FROM research_chat.messages WHERE session_id = $1::uuid`,
      [sessionId]
    )

    // Xóa session
    const result = await query(
      `DELETE FROM research_chat.chat_sessions WHERE id = $1::uuid RETURNING id`,
      [sessionId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" })
    }

    console.log("✅ Session deleted successfully")
    res.json({ status: "success", message: "Session deleted" })
  } catch (err: any) {
    console.error("❌ DELETE /api/chat/sessions/:sessionId error:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    })
  }
})

// DELETE /api/chat/sessions/:sessionId/messages/:messageId - Xóa một message
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

    console.log("🗑️ DELETE /api/chat/sessions/:sessionId/messages/:messageId - sessionId:", sessionId, "messageId:", messageId)

    // Xóa message
    const result = await query(
      `DELETE FROM research_chat.messages 
       WHERE id = $1::uuid AND session_id = $2::uuid 
       RETURNING id`,
      [messageId, sessionId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" })
    }

    // Trigger sẽ tự động cập nhật message_count trong session
    console.log("✅ Message deleted successfully")
    res.json({ status: "success", message: "Message deleted" })
  } catch (err: any) {
    console.error("❌ DELETE /api/chat/sessions/:sessionId/messages/:messageId error:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
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
      FROM research_chat.messages m
      LEFT JOIN research_chat.message_attachments ma ON ma.message_id = m.id
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
