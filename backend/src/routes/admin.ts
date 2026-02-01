// routes/admin.ts
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import path from "path"
import fs from "fs"

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

// Cho phép admin routes nếu:
// 1. NODE_ENV === "development"
// 2. Hoặc ENABLE_ADMIN_ROUTES === "true"
const isDevelopment = process.env.NODE_ENV === "development"
const adminEnabled = process.env.ENABLE_ADMIN_ROUTES === "true"
const allowAdmin = isDevelopment || adminEnabled

function hasValidAdminSecret(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return true
  const cookieMatch = req.headers.cookie?.match(/admin_secret=([^;]+)/)
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null
  const fromHeader = req.headers["x-admin-secret"] as string | undefined
  return fromCookie === secret || fromHeader === secret
}

// GET /api/admin/enter - Vào trang quản trị: nếu đã đăng nhập frontend và user có is_admin thì set admin cookie và redirect về /
router.get("/enter", async (req: Request, res: Response) => {
  if (!allowAdmin) {
    return res.status(403).json({
      error: "Trang quản trị chưa được bật",
      hint: "Đặt ENABLE_ADMIN_ROUTES=true và NODE_ENV=production",
    })
  }
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return res.status(503).json({ error: "NEXTAUTH_SECRET chưa cấu hình" })
  }
  const cookies = parseCookies(req.headers.cookie)
  try {
    const token = await getToken({
      req: { cookies, headers: req.headers } as any,
      secret,
    })
    if (!token?.id) {
      const loginUrl = process.env.NEXTAUTH_URL
        ? `${process.env.NEXTAUTH_URL}/login?callbackUrl=${encodeURIComponent(req.originalUrl || "/api/admin/enter")}`
        : "/login"
      return res.redirect(302, loginUrl)
    }
    const r = await query(
      `SELECT is_admin FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
      [token.id]
    )
    const isAdmin = !!r.rows[0]?.is_admin
    if (!isAdmin) {
      return res.status(403).json({
        error: "Bạn không có quyền truy cập trang quản trị",
      })
    }
    const adminSecret = process.env.ADMIN_SECRET
    if (adminSecret) {
      res.cookie("admin_secret", adminSecret, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      })
    }
    // Khi không có ADMIN_SECRET, hasValidAdminSecret() trả về true nên vẫn vào được trang quản trị
    // Production: redirect về /admin (proxy route). Dev: redirect về /
    const redirectPath = process.env.ADMIN_REDIRECT_PATH || (process.env.NODE_ENV === "production" ? "/admin" : "/")
    return res.redirect(302, redirectPath)
  } catch (err: any) {
    console.error("[admin/enter] error:", err?.message ?? err)
    return res.redirect(302, process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/login` : "/login")
  }
})

// POST /api/admin/auth - Đăng nhập quản trị (gửi mã ADMIN_SECRET, set cookie)
router.post("/auth", (req: Request, res: Response) => {
  const secret = (req.body?.secret ?? req.query?.secret) as string | undefined
  const expected = process.env.ADMIN_SECRET
  const authRedirectPath = process.env.ADMIN_REDIRECT_PATH || (process.env.NODE_ENV === "production" ? "/admin" : "/")
  if (!expected || secret !== expected) {
    return res.redirect(`${authRedirectPath}?error=invalid`)
  }
  res.cookie("admin_secret", secret, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    path: "/",
  })
  return res.redirect(authRedirectPath)
})

// Middleware kiểm tra quyền truy cập admin (bật tính năng + mã quản trị nếu có)
const adminOnly = (req: Request, res: Response, next: any) => {
  if (!allowAdmin) {
    return res.status(403).json({ 
      error: "Admin routes chỉ khả dụng trong development mode hoặc khi ENABLE_ADMIN_ROUTES=true",
      hint: "Đặt NODE_ENV=development hoặc ENABLE_ADMIN_ROUTES=true trong .env để kích hoạt"
    })
  }
  if (process.env.ADMIN_SECRET && !hasValidAdminSecret(req)) {
    return res.status(403).json({ 
      error: "Mã quản trị không hợp lệ hoặc hết hạn",
      hint: "Truy cập / để đăng nhập quản trị"
    })
  }
  next()
}

// Sample files cho test Agent (pdf, docx, xlsx, xls, txt, md)
const SAMPLE_FILES = ["sample.pdf", "sample.docx", "sample.xlsx", "sample.xls", "sample.csv", "sample.txt", "sample.md"]

// GET /api/admin/sample-files - Danh sách file mẫu với URL
router.get("/sample-files", adminOnly, (req: Request, res: Response) => {
  const base = `${req.protocol}://${req.get("host") || "localhost:3001"}`
  const baseUrl = process.env.BACKEND_URL || base
  const files = SAMPLE_FILES.map((f) => {
    const ext = f.replace(/^.*\./, "")
    return {
      filename: f,
      format: ext,
      url: `${baseUrl}/api/admin/sample-files/${f}`,
    }
  })
  res.json({ files })
})

// GET /api/admin/sample-files/:filename - Serve file mẫu (không cần admin cho fetch từ orchestrator)
router.get("/sample-files/:filename", (req: Request, res: Response) => {
  const filename = String(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, "")
  if (!SAMPLE_FILES.includes(filename)) {
    return res.status(404).json({ error: "File không tồn tại" })
  }
  const possibleDirs = [
    path.join(process.cwd(), "sample-files"),
    path.join(__dirname, "../../sample-files"),
    path.join(process.cwd(), "backend", "sample-files"),
  ]
  let filePath = ""
  for (const dir of possibleDirs) {
    const fp = path.join(dir, filename)
    if (fs.existsSync(fp)) {
      filePath = fp
      break
    }
  }
  if (!filePath) {
    return res.status(404).json({ error: "File chưa được tạo. Chạy: npm run generate-sample-files" })
  }
  res.sendFile(filePath)
})

// GET /api/admin/db/tables - Lấy danh sách tất cả tables
router.get("/db/tables", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'research_chat'
      ORDER BY table_schema, table_name
    `)
    
    res.json({ 
      tables: result.rows,
      total: result.rows.length
    })
  } catch (err: any) {
    console.error("Error fetching tables:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined
    })
  }
})

// GET /api/admin/db/table/:tableName - Xem dữ liệu từ một table cụ thể
router.get("/db/table/:tableName", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const limit = Math.min(Number(req.query.limit) || 100, 1000)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    
    // Kiểm tra table có tồn tại không
    const tableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'research_chat' AND table_name = $1
    `, [tableName])
    
    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema 'research_chat'` })
    }
    
    // Lấy schema của table
    const schemaResult = await query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'research_chat' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName])
    
    // Kiểm tra xem table có column updated_at không
    const hasUpdatedAt = schemaResult.rows.some((col: any) => col.column_name === "updated_at")
    const hasCreatedAt = schemaResult.rows.some((col: any) => col.column_name === "created_at")
    
    // Xây dựng ORDER BY clause dựa trên columns có sẵn
    let orderBy = ""
    if (hasCreatedAt && hasUpdatedAt) {
      orderBy = "ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST"
    } else if (hasCreatedAt) {
      orderBy = "ORDER BY created_at DESC NULLS LAST"
    } else if (hasUpdatedAt) {
      orderBy = "ORDER BY updated_at DESC NULLS LAST"
    }
    
    // Lấy dữ liệu từ table
    const dataResult = await query(`
      SELECT * FROM research_chat.${tableName}
      ${orderBy}
      LIMIT $1 OFFSET $2
    `, [limit, offset])
    
    // Đếm tổng số rows
    const countResult = await query(`
      SELECT COUNT(*) as total FROM research_chat.${tableName}
    `)
    
    res.json({
      table: tableName,
      schema: schemaResult.rows,
      data: dataResult.rows,
      pagination: {
        limit,
        offset,
        total: Number(countResult.rows[0]?.total || 0)
      }
    })
  } catch (err: any) {
    console.error("Error fetching table data:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined
    })
  }
})

// POST /api/admin/db/query - Thực thi query SQL tùy chỉnh (chỉ SELECT)
router.post("/db/query", adminOnly, async (req: Request, res: Response) => {
  try {
    const { sql } = req.body
    
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ error: "SQL query là bắt buộc" })
    }
    
    // Chỉ cho phép SELECT queries để bảo mật
    const trimmedSql = sql.trim().toUpperCase()
    if (!trimmedSql.startsWith("SELECT")) {
      return res.status(400).json({ error: "Chỉ cho phép SELECT queries" })
    }
    
    // Giới hạn số rows trả về
    let finalSql = sql.trim()
    if (!finalSql.toUpperCase().includes("LIMIT")) {
      finalSql += " LIMIT 1000"
    }
    
    const result = await query(finalSql)
    
    res.json({
      rows: result.rows,
      rowCount: result.rows.length,
      columns: result.rows.length > 0 ? Object.keys(result.rows[0]) : []
    })
  } catch (err: any) {
    console.error("Error executing query:", err)
    res.status(500).json({ 
      error: "Query Error",
      message: err.message,
      code: err.code
    })
  }
})

// GET /api/admin/db/connection-info - Thông tin kết nối Postgres (mật khẩu được mask)
router.get("/db/connection-info", adminOnly, (req: Request, res: Response) => {
  try {
    const host = process.env.POSTGRES_HOST || "(not set)"
    const port = process.env.POSTGRES_PORT || "5432"
    const database = process.env.POSTGRES_DB || "(not set)"
    const user = process.env.POSTGRES_USER || "(not set)"
    const passwordSet = !!process.env.POSTGRES_PASSWORD
    const ssl = process.env.POSTGRES_SSL === "true"
    const connectionString = `postgresql://${user}:****@${host}:${port}/${database}${ssl ? "?sslmode=require" : ""}`
    res.json({
      host,
      port,
      database,
      user,
      password: passwordSet ? "****" : "(not set)",
      ssl,
      connectionString,
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/config - Cấu hình hệ thống (Backend + Frontend)
router.get("/config", adminOnly, (req: Request, res: Response) => {
  try {
    const port = process.env.PORT || "3001"
    const backendUrl = process.env.BACKEND_URL || (process.env.NODE_ENV === "production"
      ? "https://research.neu.edu.vn"
      : `http://localhost:${port}`)
    res.json({
      backend: {
        url: backendUrl,
        port,
        nodeEnv: process.env.NODE_ENV || "development",
        enableAdminRoutes: process.env.ENABLE_ADMIN_ROUTES === "true",
      },
      frontend: {
        url: process.env.NEXTAUTH_URL || process.env.FRONTEND_URL || "(chưa cấu hình)",
        nextPublicApiBase: process.env.NEXT_PUBLIC_API_BASE_URL || "(chưa cấu hình)",
      },
      auth: {
        nextAuthUrl: process.env.NEXTAUTH_URL ? "đã cấu hình" : "chưa cấu hình",
        adminSecret: process.env.ADMIN_SECRET ? "đã cấu hình" : "chưa cấu hình",
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY ? "đã cấu hình" : "chưa cấu hình",
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/users - Danh sách users (có phân quyền is_admin)
router.get("/users", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, email, display_name, is_admin, created_at, last_login_at
      FROM research_chat.users
      ORDER BY created_at DESC
    `)
    res.json({ users: result.rows })
  } catch (err: any) {
    console.error("Error fetching users:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      hint: "Chạy migration: backend/migrations/001_add_is_admin.sql nếu cột is_admin chưa tồn tại"
    })
  }
})

// PATCH /api/admin/users/:id - Cập nhật quyền (is_admin)
router.patch("/users/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim().replace(/[^a-f0-9-]/gi, "")
    if (id.length !== 36) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    const isAdmin = req.body?.is_admin
    if (typeof isAdmin !== "boolean") {
      return res.status(400).json({ error: "Body phải có is_admin (boolean)" })
    }
    await query(
      `UPDATE research_chat.users SET is_admin = $1, updated_at = now() WHERE id = $2::uuid`,
      [isAdmin, id]
    )
    const updated = await query(
      `SELECT id, email, display_name, is_admin, updated_at FROM research_chat.users WHERE id = $1::uuid`,
      [id]
    )
    if (updated.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    res.json({ user: updated.rows[0] })
  } catch (err: any) {
    console.error("Error updating user:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// ============================================
// Agents Management API
// ============================================

// GET /api/admin/agents - Lấy danh sách tất cả agents
router.get("/agents", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM research_chat.research_assistants
       ORDER BY display_order ASC, alias ASC`
    )
    res.json({ agents: result.rows })
  } catch (err: any) {
    console.error("Error fetching agents:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/agents/:id - Lấy một agent theo ID
router.get("/agents/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM research_chat.research_assistants
       WHERE id = $1::uuid`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    res.json({ agent: result.rows[0] })
  } catch (err: any) {
    console.error("Error fetching agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// POST /api/admin/agents - Tạo agent mới
router.post("/agents", adminOnly, async (req: Request, res: Response) => {
  try {
    const { alias, icon, base_url, domain_url, display_order, config_json } = req.body
    
    if (!alias || !base_url) {
      return res.status(400).json({ error: "alias và base_url là bắt buộc" })
    }
    
    const result = await query(
      `INSERT INTO research_chat.research_assistants (alias, icon, base_url, domain_url, display_order, config_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at`,
      [alias, icon || "Bot", base_url, domain_url || null, display_order || 0, JSON.stringify(config_json || {})]
    )
    
    res.status(201).json({ agent: result.rows[0] })
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Agent với alias này đã tồn tại" })
    }
    console.error("Error creating agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// PATCH /api/admin/agents/:id - Cập nhật agent
router.patch("/agents/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const { alias, icon, base_url, domain_url, is_active, display_order, config_json } = req.body
    
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    
    if (alias !== undefined) {
      updates.push(`alias = $${paramIndex++}`)
      values.push(alias)
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`)
      values.push(icon)
    }
    if (base_url !== undefined) {
      updates.push(`base_url = $${paramIndex++}`)
      values.push(base_url)
    }
    if (domain_url !== undefined) {
      updates.push(`domain_url = $${paramIndex++}`)
      values.push(domain_url)
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(is_active)
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`)
      values.push(display_order)
    }
    if (config_json !== undefined) {
      updates.push(`config_json = $${paramIndex++}::jsonb`)
      values.push(JSON.stringify(config_json))
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    }
    
    updates.push(`updated_at = NOW()`)
    values.push(id)
    
    const result = await query(
      `UPDATE research_chat.research_assistants
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}::uuid
       RETURNING id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at`,
      values
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    
    res.json({ agent: result.rows[0] })
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Agent với alias này đã tồn tại" })
    }
    console.error("Error updating agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// Helper: chạy test một endpoint agent, trả về { ok, status, data? }
async function runAgentTestFull(
  baseUrl: string,
  testType: "metadata" | "data" | "ask",
  opts?: { dataType?: string; modelId?: string; prompt?: string; documentUrls?: string[] }
): Promise<{ ok: boolean; status?: number; data?: unknown }> {
  const timeout = testType === "ask" ? 60000 : 30000
  const url = baseUrl.replace(/\/+$/, "")

  if (testType === "metadata") {
    const resp = await fetch(`${url}/metadata`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data }
  }
  if (testType === "data") {
    const type = opts?.dataType || "documents"
    const resp = await fetch(`${url}/data?type=${encodeURIComponent(type)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data }
  }
  if (testType === "ask") {
    const payload: Record<string, unknown> = {
      session_id: `test-${Date.now()}`,
      model_id: opts?.modelId || "gpt-4o-mini",
      user: "admin-test",
      prompt: opts?.prompt || "Xin chào, bạn có thể giúp gì tôi?",
    }
    if (Array.isArray(opts?.documentUrls) && opts.documentUrls.length > 0) {
      payload.context = { extra_data: { document: opts.documentUrls } }
    }
    const resp = await fetch(`${url}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data }
  }
  return { ok: false, status: 0 }
}
function runAgentTest(
  baseUrl: string,
  testType: "metadata" | "data" | "ask",
  opts?: { dataType?: string; modelId?: string; prompt?: string; documentUrls?: string[] }
): Promise<{ ok: boolean }> {
  return runAgentTestFull(baseUrl, testType, opts).then((r) => ({ ok: r.ok }))
}

// POST /api/admin/agents/test-all-stream - SSE stream test từng agent, hiển thị tiến độ real-time
// Body: { agent_ids?: string[] } - nếu có thì chỉ test các agent được chọn; không gửi = test tất cả
router.post("/agents/test-all-stream", adminOnly, async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()
  const send = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    if (typeof (res as any).flush === "function") (res as any).flush()
  }
  const startTime = Date.now()
  try {
    const agentIdsFilter = Array.isArray(req.body?.agent_ids)
      ? (req.body.agent_ids as string[]).filter((id: string) => typeof id === "string" && id.length > 0)
      : null
    const base = `${req.protocol}://${req.get("host") || "localhost:3001"}`
    const backendUrl = process.env.BACKEND_URL || base
    const sampleFileUrl = `${backendUrl}/api/admin/sample-files/sample.pdf`
    let agentsResult: { rows: { id: string; alias: string; base_url: string }[] }
    if (agentIdsFilter && agentIdsFilter.length > 0) {
      agentsResult = await query(
        `SELECT id, alias, base_url FROM research_chat.research_assistants
         WHERE id::text = ANY($1::text[]) OR alias = ANY($1::text[])
         ORDER BY display_order, alias`,
        [agentIdsFilter]
      )
    } else {
      agentsResult = await query(
        `SELECT id, alias, base_url FROM research_chat.research_assistants WHERE is_active = true ORDER BY display_order, alias`
      )
    }
    const agents = agentsResult.rows as { id: string; alias: string; base_url: string }[]
    if (agents.length === 0) {
      send("error", { message: "Không có agent nào được chọn để test" })
      res.end()
      return
    }
    const runResult = await query(
      `INSERT INTO research_chat.agent_test_runs (total_agents, passed_count) VALUES ($1, 0) RETURNING id, run_at`,
      [agents.length]
    )
    const runId = runResult.rows[0].id
    send("start", { run_id: runId, total: agents.length })
    let passedCount = 0
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i]
      const baseUrl = String(agent.base_url || "").replace(/\/+$/, "")
      let metadataPass: boolean | null = null
      let dataDocumentsPass: boolean | null = null
      let dataExpertsPass: boolean | null = null
      let askTextPass: boolean | null = null
      let askFilePass: boolean | null = null
      let errorMsg: string | null = null
      let modelId = "gpt-4o-mini"
      let prompt = "Xin chào, bạn có thể giúp gì tôi?"
      send("agent", { index: i + 1, total: agents.length, alias: agent.alias })
      try {
        send("endpoint", { agent: agent.alias, endpoint: "/metadata", status: "running" })
        const metaRes = await runAgentTestFull(baseUrl, "metadata")
        metadataPass = metaRes.ok
        send("endpoint", {
          agent: agent.alias,
          endpoint: "/metadata",
          pass: metaRes.ok,
          status: metaRes.status,
          result: metaRes.data,
        })
        if (metaRes.ok && metaRes.data) {
          const m = metaRes.data as Record<string, unknown>
          const models = (m?.supported_models as { model_id?: string }[]) || []
          if (models.length > 0 && models[0]?.model_id) modelId = models[0].model_id
          const prompts = (m?.sample_prompts as string[]) || []
          if (prompts.length > 0 && typeof prompts[0] === "string") prompt = prompts[0]
        }
        send("endpoint", { agent: agent.alias, endpoint: "/data?type=documents", status: "running" })
        const docRes = await runAgentTestFull(baseUrl, "data", { dataType: "documents" })
        dataDocumentsPass = docRes.ok
        send("endpoint", {
          agent: agent.alias,
          endpoint: "/data?type=documents",
          pass: docRes.ok,
          status: docRes.status,
          result: docRes.data,
        })
        send("endpoint", { agent: agent.alias, endpoint: "/data?type=experts", status: "running" })
        const expRes = await runAgentTestFull(baseUrl, "data", { dataType: "experts" })
        dataExpertsPass = expRes.ok
        send("endpoint", {
          agent: agent.alias,
          endpoint: "/data?type=experts",
          pass: expRes.ok,
          status: expRes.status,
          result: expRes.data,
        })
        send("endpoint", { agent: agent.alias, endpoint: "/ask (text)", status: "running" })
        const askTextRes = await runAgentTestFull(baseUrl, "ask", { modelId, prompt })
        askTextPass = askTextRes.ok
        send("endpoint", {
          agent: agent.alias,
          endpoint: "/ask (text)",
          pass: askTextRes.ok,
          status: askTextRes.status,
          result: askTextRes.data,
        })
        send("endpoint", { agent: agent.alias, endpoint: "/ask (file)", status: "running" })
        const askFileRes = await runAgentTestFull(baseUrl, "ask", {
          modelId,
          prompt,
          documentUrls: [sampleFileUrl],
        })
        askFilePass = askFileRes.ok
        send("endpoint", {
          agent: agent.alias,
          endpoint: "/ask (file)",
          pass: askFileRes.ok,
          status: askFileRes.status,
          result: askFileRes.data,
        })
        const corePass = metadataPass === true && askTextPass === true
        if (corePass) passedCount++
      } catch (e: any) {
        errorMsg = e?.message || String(e)
        send("endpoint", {
          agent: agent.alias,
          endpoint: "error",
          pass: false,
          error: errorMsg,
        })
      }
      send("agent_result", {
        agent_alias: agent.alias,
        metadata_pass: metadataPass,
        data_documents_pass: dataDocumentsPass,
        data_experts_pass: dataExpertsPass,
        ask_text_pass: askTextPass,
        ask_file_pass: askFilePass,
        error_message: errorMsg,
      })
      await query(
        `INSERT INTO research_chat.agent_test_results
         (run_id, agent_id, agent_alias, base_url, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          runId,
          agent.id,
          agent.alias,
          baseUrl,
          metadataPass,
          dataDocumentsPass,
          dataExpertsPass,
          askTextPass,
          askFilePass,
          errorMsg,
        ]
      )
    }
    await query(`UPDATE research_chat.agent_test_runs SET passed_count = $1 WHERE id = $2`, [
      passedCount,
      runId,
    ])
    const durationMs = Date.now() - startTime
    send("done", {
      run_id: runId,
      total: agents.length,
      passed_count: passedCount,
      duration_ms: durationMs,
      duration_str: `${(durationMs / 1000).toFixed(1)}s`,
    })
  } catch (err: any) {
    send("error", { message: err?.message || String(err) })
  } finally {
    res.end()
  }
})

// POST /api/admin/agents/test-all - Test tất cả agents, lưu kết quả vào DB
router.post("/agents/test-all", adminOnly, async (req: Request, res: Response) => {
  try {
    const base = `${req.protocol}://${req.get("host") || "localhost:3001"}`
    const backendUrl = process.env.BACKEND_URL || base
    const sampleFileUrl = `${backendUrl}/api/admin/sample-files/sample.pdf`

    const agentsResult = await query(
      `SELECT id, alias, base_url FROM research_chat.research_assistants WHERE is_active = true ORDER BY display_order, alias`
    )
    const agents = agentsResult.rows as { id: string; alias: string; base_url: string }[]

    const runResult = await query(
      `INSERT INTO research_chat.agent_test_runs (total_agents, passed_count) VALUES ($1, 0) RETURNING id, run_at`,
      [agents.length]
    )
    const runId = runResult.rows[0].id

    let passedCount = 0
    for (const agent of agents) {
      const baseUrl = String(agent.base_url || "").replace(/\/+$/, "")
      let metadataPass: boolean | null = null
      let dataDocumentsPass: boolean | null = null
      let dataExpertsPass: boolean | null = null
      let askTextPass: boolean | null = null
      let askFilePass: boolean | null = null
      let errorMsg: string | null = null
      let modelId = "gpt-4o-mini"
      let prompt = "Xin chào, bạn có thể giúp gì tôi?"

      try {
        const metaRes = await runAgentTest(baseUrl, "metadata")
        metadataPass = metaRes.ok
        if (metaRes.ok) {
          const metaData = (await fetch(`${baseUrl}/metadata`).then((r) => r.json().catch(() => ({})))) as Record<string, unknown>
          const models = (metaData?.supported_models as { model_id?: string }[]) || []
          if (models.length > 0 && models[0]?.model_id) modelId = models[0].model_id
          const prompts = (metaData?.sample_prompts as string[]) || []
          if (prompts.length > 0 && typeof prompts[0] === "string") prompt = prompts[0]
        }

        const docRes = await runAgentTest(baseUrl, "data", { dataType: "documents" })
        dataDocumentsPass = docRes.ok

        const expRes = await runAgentTest(baseUrl, "data", { dataType: "experts" })
        dataExpertsPass = expRes.ok

        const askTextRes = await runAgentTest(baseUrl, "ask", { modelId, prompt })
        askTextPass = askTextRes.ok

        const askFileRes = await runAgentTest(baseUrl, "ask", {
          modelId,
          prompt,
          documentUrls: [sampleFileUrl],
        })
        askFilePass = askFileRes.ok

        const corePass = metadataPass === true && askTextPass === true
        if (corePass) passedCount++
      } catch (e: any) {
        errorMsg = e?.message || String(e)
      }

      await query(
        `INSERT INTO research_chat.agent_test_results
         (run_id, agent_id, agent_alias, base_url, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          runId,
          agent.id,
          agent.alias,
          baseUrl,
          metadataPass,
          dataDocumentsPass,
          dataExpertsPass,
          askTextPass,
          askFilePass,
          errorMsg,
        ]
      )
    }

    await query(
      `UPDATE research_chat.agent_test_runs SET passed_count = $1 WHERE id = $2`,
      [passedCount, runId]
    )

    const results = await query(
      `SELECT agent_alias, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, error_message
       FROM research_chat.agent_test_results WHERE run_id = $1 ORDER BY agent_alias`,
      [runId]
    )

    res.json({
      ok: true,
      run_id: runId,
      run_at: runResult.rows[0].run_at,
      total: agents.length,
      passed_count: passedCount,
      results: results.rows,
    })
  } catch (err: any) {
    console.error("Agent test-all error:", err)
    res.status(500).json({
      error: "Test thất bại",
      message: err?.message || String(err),
    })
  }
})

// GET /api/admin/agents/test-results - Lấy lịch sử kết quả test
router.get("/agents/test-results", adminOnly, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50)
    const runs = await query(
      `SELECT r.id, r.run_at, r.total_agents, r.passed_count
       FROM research_chat.agent_test_runs r
       ORDER BY r.run_at DESC
       LIMIT $1`,
      [limit]
    )
    const runIds = runs.rows.map((r: { id: string }) => r.id)
    let results: Record<string, unknown[]> = {}
    if (runIds.length > 0) {
      const placeholders = runIds.map((_, i) => `$${i + 1}`).join(",")
      const resRows = await query(
        `SELECT run_id, agent_alias, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, error_message
         FROM research_chat.agent_test_results WHERE run_id IN (${placeholders})
         ORDER BY run_id, agent_alias`,
        runIds
      )
      for (const row of resRows.rows) {
        const rid = row.run_id
        if (!results[rid]) results[rid] = []
        results[rid].push(row)
      }
    }
    res.json({ runs: runs.rows, results })
  } catch (err: any) {
    console.error("Error fetching test results:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// POST /api/admin/agents/test - Test agent endpoints (metadata, data, ask)
router.post("/agents/test", adminOnly, async (req: Request, res: Response) => {
  try {
    const { base_url, test_type, model_id, prompt, document_urls, data_type } = req.body
    if (!base_url || typeof base_url !== "string") {
      return res.status(400).json({ error: "base_url là bắt buộc" })
    }
    const baseUrl = base_url.replace(/\/+$/, "")
    const timeout = 30000

    if (test_type === "metadata") {
      const url = `${baseUrl}/metadata`
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeout),
      })
      const data = await resp.json().catch(() => ({}))
      return res.json({
        ok: resp.ok,
        status: resp.status,
        url,
        data,
      })
    }

    if (test_type === "data") {
      const type = data_type || "documents"
      const url = `${baseUrl}/data?type=${encodeURIComponent(type)}`
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeout),
      })
      const data = await resp.json().catch(() => ({}))
      return res.json({
        ok: resp.ok,
        status: resp.status,
        url,
        data,
      })
    }

    if (test_type === "ask") {
      const url = `${baseUrl}/ask`
      const session_id = `test-${Date.now()}`
      const payload: Record<string, unknown> = {
        session_id,
        model_id: model_id || "gpt-4o-mini",
        user: "admin-test",
        prompt: typeof prompt === "string" ? prompt : "Xin chào, bạn có thể giúp gì tôi?",
      }
      if (Array.isArray(document_urls) && document_urls.length > 0) {
        payload.context = {
          extra_data: {
            document: document_urls.filter((u: unknown) => typeof u === "string"),
          },
        }
      }
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      })
      const data = await resp.json().catch(() => ({}))
      return res.json({
        ok: resp.ok,
        status: resp.status,
        url,
        data,
      })
    }

    return res.status(400).json({ error: "test_type phải là metadata, data, hoặc ask" })
  } catch (err: any) {
    console.error("Agent test error:", err)
    res.status(500).json({
      error: "Test thất bại",
      message: err?.message || String(err),
    })
  }
})

// DELETE /api/admin/agents/:id - Xóa agent (soft delete: set is_active = false)
router.delete("/agents/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `UPDATE research_chat.research_assistants
       SET is_active = false, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, alias`,
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    
    res.json({ message: "Agent đã được vô hiệu hóa", agent: result.rows[0] })
  } catch (err: any) {
    console.error("Error deleting agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/db/stats - Thống kê database
router.get("/db/stats", adminOnly, async (req: Request, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        'users' as table_name, COUNT(*) as row_count FROM research_chat.users
      UNION ALL
      SELECT 
        'chat_sessions', COUNT(*) FROM research_chat.chat_sessions
      UNION ALL
      SELECT 
        'messages', COUNT(*) FROM research_chat.messages
      UNION ALL
      SELECT 
        'message_attachments', COUNT(*) FROM research_chat.message_attachments
      UNION ALL
      SELECT 
        'research_assistants', COUNT(*) FROM research_chat.research_assistants
    `)
    
    res.json({ stats: stats.rows })
  } catch (err: any) {
    console.error("Error fetching stats:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined
    })
  }
})

// GET /api/admin/view - Trang web để xem database
router.get("/view", adminOnly, (req: Request, res: Response) => {
  try {
    // Tìm file HTML từ nhiều vị trí có thể
    const possiblePaths = [
      path.join(__dirname, "admin-view.html"),
      path.join(process.cwd(), "src/routes/admin-view.html"),
      path.join(process.cwd(), "backend/src/routes/admin-view.html"),
    ]
    
    let htmlPath: string | null = null
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        htmlPath = p
        break
      }
    }
    
    if (htmlPath) {
      res.sendFile(htmlPath)
    } else {
      // Fallback: trả về HTML inline nếu không tìm thấy file
      res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Viewer - Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px; }
        h1 { color: #333; margin-bottom: 24px; border-bottom: 2px solid #007bff; padding-bottom: 12px; }
        .tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid #ddd; }
        .tab { padding: 12px 24px; cursor: pointer; border: none; background: none; font-size: 14px; color: #666; border-bottom: 2px solid transparent; }
        .tab:hover { color: #007bff; }
        .tab.active { color: #007bff; border-bottom-color: #007bff; font-weight: 600; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
        .stat-card h3 { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
        .stat-card .value { font-size: 32px; font-weight: bold; }
        .table-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .table-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 16px; cursor: pointer; transition: all 0.2s; }
        .table-card:hover { background: #e9ecef; border-color: #007bff; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .table-card h3 { color: #333; margin-bottom: 8px; font-size: 16px; }
        .table-card .meta { color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; background: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: 600; color: #495057; position: sticky; top: 0; }
        tr:hover { background: #f8f9fa; }
        .loading { text-align: center; padding: 40px; color: #666; }
        .error { background: #fee; color: #c33; padding: 12px; border-radius: 4px; margin: 16px 0; }
        .query-box { margin-bottom: 16px; }
        textarea { width: 100%; min-height: 120px; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 8px; }
        button:hover { background: #0056b3; }
        .pagination { display: flex; gap: 8px; margin-top: 16px; align-items: center; }
        .pagination .info { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🗄️ Database Viewer - Admin Panel</h1>
        <div class="tabs">
            <button class="tab active" onclick="showTab('stats')">Thống kê</button>
            <button class="tab" onclick="showTab('tables')">Tables</button>
            <button class="tab" onclick="showTab('query')">SQL Query</button>
        </div>
        <div id="stats" class="tab-content active">
            <div class="stats-grid" id="statsGrid"><div class="loading">Đang tải thống kê...</div></div>
        </div>
        <div id="tables" class="tab-content">
            <div id="tablesList" class="table-list"><div class="loading">Đang tải danh sách tables...</div></div>
            <div id="tableData"></div>
        </div>
        <div id="query" class="tab-content">
            <div class="query-box">
                <textarea id="sqlQuery" placeholder="SELECT * FROM research_chat.users LIMIT 10;">SELECT * FROM research_chat.users LIMIT 10;</textarea>
                <button onclick="executeQuery()">Thực thi Query</button>
            </div>
            <div id="queryResult"></div>
        </div>
    </div>
    <script>
        const API_BASE = window.location.origin + '/api/admin';
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            if (tabName === 'stats') loadStats();
            if (tabName === 'tables') loadTables();
        }
        async function loadStats() {
            try {
                const res = await fetch(API_BASE + '/db/stats');
                const data = await res.json();
                document.getElementById('statsGrid').innerHTML = data.stats.map(stat => 
                    '<div class="stat-card"><h3>' + stat.table_name + '</h3><div class="value">' + stat.row_count + '</div></div>'
                ).join('');
            } catch (err) {
                document.getElementById('statsGrid').innerHTML = '<div class="error">Lỗi: ' + err.message + '</div>';
            }
        }
        async function loadTables() {
            try {
                const res = await fetch(API_BASE + '/db/tables');
                const data = await res.json();
                document.getElementById('tablesList').innerHTML = data.tables.map(table => 
                    '<div class="table-card" onclick="loadTableData(\\'' + table.table_name + '\\')"><h3>' + table.table_name + '</h3><div class="meta">Schema: ' + table.table_schema + ' • Columns: ' + table.column_count + '</div></div>'
                ).join('');
            } catch (err) {
                document.getElementById('tablesList').innerHTML = '<div class="error">Lỗi: ' + err.message + '</div>';
            }
        }
        async function loadTableData(tableName) {
            document.getElementById('tableData').innerHTML = '<div class="loading">Đang tải dữ liệu...</div>';
            try {
                const res = await fetch(API_BASE + '/db/table/' + tableName + '?limit=100');
                const data = await res.json();
                if (data.data.length === 0) {
                    document.getElementById('tableData').innerHTML = '<div class="error">Không có dữ liệu</div>';
                    return;
                }
                const columns = Object.keys(data.data[0]);
                const header = '<h2>' + data.table + ' (' + data.pagination.total + ' rows)</h2>';
                const tableHeader = '<tr>' + columns.map(col => '<th>' + col + '</th>').join('') + '</tr>';
                const tableRows = data.data.map(row => '<tr>' + columns.map(col => '<td>' + formatValue(row[col]) + '</td>').join('') + '</tr>').join('');
                document.getElementById('tableData').innerHTML = header + '<div style="overflow-x: auto; max-height: 600px; overflow-y: auto;"><table>' + tableHeader + tableRows + '</table></div>';
            } catch (err) {
                document.getElementById('tableData').innerHTML = '<div class="error">Lỗi: ' + err.message + '</div>';
            }
        }
        async function executeQuery() {
            const sql = document.getElementById('sqlQuery').value.trim();
            if (!sql) return;
            document.getElementById('queryResult').innerHTML = '<div class="loading">Đang thực thi query...</div>';
            try {
                const res = await fetch(API_BASE + '/db/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql })
                });
                const data = await res.json();
                if (data.error) {
                    document.getElementById('queryResult').innerHTML = '<div class="error">Lỗi: ' + (data.message || data.error) + '</div>';
                    return;
                }
                if (data.rows.length === 0) {
                    document.getElementById('queryResult').innerHTML = '<div class="error">Không có kết quả</div>';
                    return;
                }
                const columns = data.columns;
                const tableHeader = '<tr>' + columns.map(col => '<th>' + col + '</th>').join('') + '</tr>';
                const tableRows = data.rows.map(row => '<tr>' + columns.map(col => '<td>' + formatValue(row[col]) + '</td>').join('') + '</tr>').join('');
                document.getElementById('queryResult').innerHTML = '<div style="margin-top: 16px;"><div class="pagination info">Kết quả: ' + data.rowCount + ' rows</div><div style="overflow-x: auto; max-height: 600px; overflow-y: auto;"><table>' + tableHeader + tableRows + '</table></div></div>';
            } catch (err) {
                document.getElementById('queryResult').innerHTML = '<div class="error">Lỗi: ' + err.message + '</div>';
            }
        }
        function formatValue(value) {
            if (value === null || value === undefined) return '<em style="color: #999;">null</em>';
            if (typeof value === 'object') return JSON.stringify(value);
            if (typeof value === 'boolean') return value ? '✓' : '✗';
            return String(value);
        }
        loadStats();
    </script>
</body>
</html>
      `)
    }
  } catch (err: any) {
    console.error("Error serving admin view:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

export default router
