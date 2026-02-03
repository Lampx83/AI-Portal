// routes/admin.ts
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import { isAlwaysAdmin } from "../lib/admin-utils"
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
    const userEmail = (token as { email?: string }).email as string | undefined
    let isAdmin = isAlwaysAdmin(userEmail)
    if (!isAdmin) {
      const r = await query(
        `SELECT is_admin FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
        [token.id]
      )
      isAdmin = !!r.rows[0]?.is_admin
    }
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
    // Luôn redirect về frontend /admin (React admin page). Dev và prod dùng cùng giao diện.
    const base = process.env.NEXTAUTH_URL || "https://research.neu.edu.vn"
    const adminBase = base.replace(/\/$/, "")
    const redirectPath = process.env.ADMIN_REDIRECT_PATH || `${adminBase}/admin`
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
  const base = process.env.NEXTAUTH_URL || "https://research.neu.edu.vn"
  const adminBase = base.replace(/\/$/, "")
  const authRedirectPath = process.env.ADMIN_REDIRECT_PATH || `${adminBase}/admin`
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

// Helper: URL gốc backend để agent có thể fetch file (phải reachable từ agent khi deploy)
function getBackendBaseUrl(req: Request): string {
  const fromEnv = process.env.BACKEND_URL || process.env.NEXTAUTH_URL || process.env.API_BASE_URL
  if (fromEnv) {
    try {
      const u = new URL(fromEnv)
      return `${u.protocol}//${u.host}`
    } catch {
      return fromEnv.replace(/\/+$/, "")
    }
  }
  const proto = req.get("x-forwarded-proto") || req.protocol || "http"
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost:3001"
  return `${proto}://${host}`
}

// GET /api/admin/sample-files - Danh sách file mẫu với URL (URL phải reachable từ agent trên server)
router.get("/sample-files", adminOnly, (req: Request, res: Response) => {
  const baseUrl = getBackendBaseUrl(req)
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

    // Lấy primary key columns
    const pkResult = await query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'research_chat' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [tableName])
    const primaryKey = (pkResult.rows as { column_name: string }[]).map((r) => r.column_name)
    
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
      primary_key: primaryKey,
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

// Helper: kiểm tra table thuộc research_chat và lấy schema
async function getTableSchema(tableName: string): Promise<{ schema: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]; primaryKey: string[] } | null> {
  const safeName = String(tableName).replace(/[^a-zA-Z0-9_]/g, "")
  const tableCheck = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'research_chat' AND table_name = $1`,
    [safeName]
  )
  if (tableCheck.rows.length === 0) return null
  const schemaResult = await query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema = 'research_chat' AND table_name = $1 ORDER BY ordinal_position`,
    [safeName]
  )
  const pkResult = await query(
    `SELECT kcu.column_name FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema = 'research_chat' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position`,
    [safeName]
  )
  const primaryKey = (pkResult.rows as { column_name: string }[]).map((r) => r.column_name)
  return { schema: schemaResult.rows as any, primaryKey }
}

// POST /api/admin/db/table/:tableName/row - Thêm dòng mới
router.post("/db/table/:tableName/row", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const meta = await getTableSchema(tableName)
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema research_chat` })
    const { schema, primaryKey } = meta
    const row = req.body?.row
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return res.status(400).json({ error: "Body phải có dạng { row: { column: value, ... } }" })
    }
    const columnNames = schema.map((c: any) => c.column_name)
    const allowed = Object.keys(row).filter((k) => columnNames.includes(k))
    if (allowed.length === 0) return res.status(400).json({ error: "Không có cột hợp lệ trong row" })
    const values = allowed.map((col) => row[col])
    const cols = allowed.join(", ")
    const placeholders = allowed.map((_, i) => `$${i + 1}`).join(", ")
    const insertSql = `INSERT INTO research_chat.${tableName} (${cols}) VALUES (${placeholders}) RETURNING *`
    const result = await query(insertSql, values)
    res.status(201).json({ row: result.rows[0], message: "Đã thêm dòng" })
  } catch (err: any) {
    console.error("Error inserting row:", err)
    res.status(500).json({ error: "Lỗi thêm dòng", message: err?.message })
  }
})

// PUT /api/admin/db/table/:tableName/row - Sửa dòng (body: { pk: { col: val }, row: { col: val } })
router.put("/db/table/:tableName/row", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const meta = await getTableSchema(tableName)
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema research_chat` })
    const { schema, primaryKey } = meta
    if (primaryKey.length === 0) return res.status(400).json({ error: "Table không có primary key, không thể sửa theo dòng" })
    const { pk, row: rowData } = req.body || {}
    if (!pk || typeof pk !== "object" || !rowData || typeof rowData !== "object") {
      return res.status(400).json({ error: "Body phải có dạng { pk: { pk_col: value }, row: { column: value, ... } }" })
    }
    const columnNames = schema.map((c: any) => c.column_name)
    const setCols = Object.keys(rowData).filter((k) => columnNames.includes(k) && !primaryKey.includes(k))
    if (setCols.length === 0) return res.status(400).json({ error: "Không có cột nào để cập nhật (không sửa cột primary key)" })
    const setClause = setCols.map((c, i) => `${c} = $${i + 1}`).join(", ")
    const whereClause = primaryKey.map((c, i) => `${c} = $${setCols.length + i + 1}`).join(" AND ")
    const values = [...setCols.map((c) => rowData[c]), ...primaryKey.map((c) => pk[c])]
    const updateSql = `UPDATE research_chat.${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`
    const result = await query(updateSql, values)
    if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy dòng với primary key đã cho" })
    res.json({ row: result.rows[0], message: "Đã cập nhật dòng" })
  } catch (err: any) {
    console.error("Error updating row:", err)
    res.status(500).json({ error: "Lỗi cập nhật dòng", message: err?.message })
  }
})

// DELETE /api/admin/db/table/:tableName/row - Xóa dòng (body: { pk: { col: val } })
router.delete("/db/table/:tableName/row", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const meta = await getTableSchema(tableName)
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema research_chat` })
    const { primaryKey } = meta
    if (primaryKey.length === 0) return res.status(400).json({ error: "Table không có primary key, không thể xóa theo dòng" })
    const pk = req.body?.pk
    if (!pk || typeof pk !== "object") {
      return res.status(400).json({ error: "Body phải có dạng { pk: { pk_col: value } }" })
    }
    const whereClause = primaryKey.map((c, i) => `${c} = $${i + 1}`).join(" AND ")
    const values = primaryKey.map((c) => pk[c])
    const deleteSql = `DELETE FROM research_chat.${tableName} WHERE ${whereClause} RETURNING *`
    const result = await query(deleteSql, values)
    if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy dòng với primary key đã cho" })
    res.json({ deleted: result.rows[0], message: "Đã xóa dòng" })
  } catch (err: any) {
    console.error("Error deleting row:", err)
    res.status(500).json({ error: "Lỗi xóa dòng", message: err?.message })
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

// GET /api/admin/users - Danh sách users (kèm daily_message_limit, daily_used, extra_messages_today)
router.get("/users", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.display_name, u.full_name, u.is_admin, u.created_at, u.last_login_at, u.sso_provider,
             u.position, u.faculty_id, u.intro, u.research_direction,
             COALESCE(u.daily_message_limit, 10) AS daily_message_limit,
             (SELECT o.extra_messages FROM research_chat.user_daily_limit_overrides o
              WHERE o.user_id = u.id AND o.override_date = current_date LIMIT 1) AS extra_messages_today,
             (SELECT COUNT(*)::int FROM research_chat.messages m
              JOIN research_chat.chat_sessions s ON s.id = m.session_id
              WHERE s.user_id = u.id AND m.role = 'user' AND m.created_at >= date_trunc('day', now())) AS daily_used
      FROM research_chat.users u
      ORDER BY u.created_at DESC
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

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

// POST /api/admin/users - Tạo user đăng nhập thông thường (email, display_name, full_name, password)
router.post("/users", adminOnly, async (req: Request, res: Response) => {
  try {
    const { hashPassword } = await import("../lib/password")
    const { email, display_name, full_name, password } = req.body
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "email là bắt buộc" })
    }
    const emailNorm = String(email).trim().toLowerCase()
    const displayName = display_name != null ? String(display_name).trim() || null : null
    const fullName = full_name != null ? String(full_name).trim() || null : null
    const pwd = password != null ? String(password) : ""
    if (!pwd || pwd.length < 6) {
      return res.status(400).json({ error: "password bắt buộc, tối thiểu 6 ký tự" })
    }
    const existing = await query(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [emailNorm]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email đã tồn tại" })
    }
    const id = crypto.randomUUID()
    const passwordHash = hashPassword(pwd)
    await query(
      `INSERT INTO research_chat.users (id, email, display_name, full_name, password_hash, password_algo, password_updated_at, is_admin, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, 'scrypt', now(), false, now(), now())`,
      [id, emailNorm, displayName ?? emailNorm.split("@")[0], fullName, passwordHash]
    )
    const created = await query(
      `SELECT id, email, display_name, full_name, is_admin, created_at, last_login_at, sso_provider FROM research_chat.users WHERE id = $1::uuid`,
      [id]
    )
    res.status(201).json({ user: created.rows[0] })
  } catch (err: any) {
    console.error("Error creating user:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// PATCH /api/admin/users/:id - Cập nhật (is_admin, display_name, full_name, password tùy chọn)
router.patch("/users/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim().replace(/[^a-f0-9-]/gi, "")
    if (id.length !== 36) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    const { is_admin, display_name, full_name, password, daily_message_limit } = req.body
    const updates: string[] = ["updated_at = now()"]
    const values: unknown[] = []
    let idx = 1
    if (typeof is_admin === "boolean") {
      updates.push(`is_admin = $${idx++}`)
      values.push(is_admin)
    }
    if (display_name !== undefined) {
      updates.push(`display_name = $${idx++}`)
      values.push(display_name ? String(display_name).trim() : null)
    }
    if (full_name !== undefined) {
      updates.push(`full_name = $${idx++}`)
      values.push(full_name ? String(full_name).trim() : null)
    }
    if (daily_message_limit !== undefined) {
      const n = Number(daily_message_limit)
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ error: "daily_message_limit phải là số nguyên không âm" })
      }
      updates.push(`daily_message_limit = $${idx++}`)
      values.push(n)
    }
    if (password !== undefined && password !== null && String(password).length > 0) {
      const { hashPassword } = await import("../lib/password")
      const pwd = String(password)
      if (pwd.length < 6) {
        return res.status(400).json({ error: "password tối thiểu 6 ký tự" })
      }
      updates.push(`password_hash = $${idx++}`, `password_algo = 'scrypt'`, `password_updated_at = now()`)
      values.push(hashPassword(pwd))
    }
    if (updates.length <= 1) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    }
    values.push(id)
    await query(
      `UPDATE research_chat.users SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      values
    )
    const updated = await query(
      `SELECT id, email, display_name, full_name, is_admin, daily_message_limit, updated_at, last_login_at, sso_provider FROM research_chat.users WHERE id = $1::uuid`,
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

// POST /api/admin/users/:id/limit-override - Mở thêm tin nhắn cho user trong ngày hôm nay
router.post("/users/:id/limit-override", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim().replace(/[^a-f0-9-]/gi, "")
    if (id.length !== 36) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    const extra_messages = Number(req.body?.extra_messages ?? 0)
    if (!Number.isInteger(extra_messages) || extra_messages < 0) {
      return res.status(400).json({ error: "extra_messages phải là số nguyên không âm" })
    }
    await query(
      `INSERT INTO research_chat.user_daily_limit_overrides (user_id, override_date, extra_messages)
       VALUES ($1::uuid, current_date, $2)
       ON CONFLICT (user_id, override_date) DO UPDATE SET extra_messages = $2`,
      [id, extra_messages]
    )
    const row = await query(
      `SELECT u.id, u.email, COALESCE(u.daily_message_limit, 10) AS base_limit,
              (SELECT o.extra_messages FROM research_chat.user_daily_limit_overrides o
               WHERE o.user_id = u.id AND o.override_date = current_date LIMIT 1) AS extra_today
       FROM research_chat.users u WHERE u.id = $1::uuid LIMIT 1`,
      [id]
    )
    if (row.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    const r = row.rows[0] as { base_limit: number; extra_today: number | null }
    const limit = (r.base_limit ?? 10) + (Number(r.extra_today) || 0)
    res.json({ ok: true, extra_messages, effective_limit_today: limit })
  } catch (err: any) {
    console.error("Error setting limit override:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// PATCH /api/admin/users/bulk - Cập nhật daily_message_limit cho nhiều user (body: { updates: [{ user_id, daily_message_limit }] })
router.patch("/users/bulk", adminOnly, async (req: Request, res: Response) => {
  try {
    const updates = req.body?.updates
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "updates phải là mảng không rỗng, mỗi phần tử { user_id, daily_message_limit }" })
    }
    let affected = 0
    for (const item of updates) {
      const user_id = item?.user_id
      const daily_message_limit = item?.daily_message_limit
      if (!user_id || typeof user_id !== "string") continue
      const n = Number(daily_message_limit)
      if (!Number.isInteger(n) || n < 0) continue
      const id = String(user_id).trim().replace(/[^a-f0-9-]/gi, "")
      if (id.length !== 36) continue
      const r = await query(
        `UPDATE research_chat.users SET daily_message_limit = $1, updated_at = now() WHERE id = $2::uuid`,
        [n, id]
      )
      if (r.rowCount && r.rowCount > 0) affected++
    }
    res.json({ ok: true, updated: affected })
  } catch (err: any) {
    console.error("Error bulk updating users:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// DELETE /api/admin/users/:id - Xóa user (không cho xóa system user)
router.delete("/users/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim().replace(/[^a-f0-9-]/gi, "")
    if (id.length !== 36) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    if (id.toLowerCase() === SYSTEM_USER_ID) {
      return res.status(403).json({ error: "Không được xóa tài khoản system" })
    }
    const result = await query(`DELETE FROM research_chat.users WHERE id = $1::uuid RETURNING id`, [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" })
    }
    res.json({ ok: true })
  } catch (err: any) {
    console.error("Error deleting user:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// ============================================
// Agents Management API
// ============================================

// GET /api/admin/agents - Lấy danh sách tất cả agents (kèm daily_message_limit, daily_used)
router.get("/agents", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM research_chat.research_assistants
       ORDER BY display_order ASC, alias ASC`
    )
    const usageRows = await query(
      `SELECT s.assistant_alias AS alias, COUNT(*)::int AS daily_used
       FROM research_chat.messages m
       JOIN research_chat.chat_sessions s ON s.id = m.session_id
       WHERE m.role = 'user' AND m.created_at >= date_trunc('day', now())
       GROUP BY s.assistant_alias`
    )
    const usageByAlias: Record<string, number> = {}
    for (const row of usageRows.rows as { alias: string; daily_used: number }[]) {
      usageByAlias[row.alias] = row.daily_used ?? 0
    }
    const agents = (result.rows as any[]).map((a) => {
      const config = a.config_json ?? {}
      const daily_message_limit = config.daily_message_limit != null ? Number(config.daily_message_limit) : 100
      return {
        ...a,
        daily_message_limit: Number.isInteger(daily_message_limit) && daily_message_limit >= 0 ? daily_message_limit : 100,
        daily_used: usageByAlias[a.alias] ?? 0,
      }
    })
    res.json({ agents })
  } catch (err: any) {
    console.error("Error fetching agents:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/agents/test-results - Lấy lịch sử kết quả test (all=true: toàn bộ DB, không phân trang)
// Phải đặt trước /agents/:id để "test-results" không bị match thành :id
router.get("/agents/test-results", adminOnly, async (req: Request, res: Response) => {
  try {
    const loadAll = req.query.all === "true" || req.query.all === "1"
    const limit = loadAll ? 100000 : Math.min(Number(req.query.limit) || 20, 100)
    const offset = loadAll ? 0 : Math.max(Number(req.query.offset) || 0, 0)
    const runs = await query(
      loadAll
        ? `SELECT r.id, r.run_at, r.total_agents, r.passed_count
           FROM research_chat.agent_test_runs r
           ORDER BY r.run_at DESC`
        : `SELECT r.id, r.run_at, r.total_agents, r.passed_count
           FROM research_chat.agent_test_runs r
           ORDER BY r.run_at DESC
           LIMIT $1 OFFSET $2`,
      loadAll ? [] : [limit, offset]
    )
    const runIds = runs.rows.map((r: { id: string }) => r.id)
    let results: Record<string, unknown[]> = {}
    if (runIds.length > 0) {
      const placeholders = runIds.map((_, i) => `$${i + 1}`).join(",")
      const resRows = await query(
        `SELECT run_id, agent_alias, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass,
                metadata_ms, data_documents_ms, data_experts_ms, ask_text_ms, ask_file_ms, error_message,
                metadata_details, data_details, ask_text_details, ask_file_details
         FROM research_chat.agent_test_results WHERE run_id IN (${placeholders})
         ORDER BY run_id, agent_alias`,
        runIds
      )
      for (const row of resRows.rows) {
        const rid = String(row.run_id ?? "")
        if (!results[rid]) results[rid] = []
        results[rid].push(row)
      }
    }
    const runsWithStringId = runs.rows.map((r: { id: unknown; run_at: unknown; total_agents: unknown; passed_count: unknown }) => ({
      ...r,
      id: String(r.id ?? ""),
    }))
    res.json({ runs: runsWithStringId, results })
  } catch (err: any) {
    console.error("Error fetching test results:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
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

// PATCH /api/admin/agents/:id - Cập nhật agent (config_json hoặc daily_message_limit)
router.patch("/agents/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const { alias, icon, base_url, domain_url, is_active, display_order, config_json, daily_message_limit } = req.body
    
    let finalConfigJson = config_json
    if (daily_message_limit !== undefined) {
      let base: Record<string, unknown> =
        typeof config_json === "object" && config_json !== null ? { ...config_json } : {}
      if (Object.keys(base).length === 0 || (config_json === undefined && daily_message_limit !== undefined)) {
        const cur = await query(
          `SELECT config_json FROM research_chat.research_assistants WHERE id = $1::uuid LIMIT 1`,
          [id]
        )
        base = ((cur.rows[0] as { config_json?: Record<string, unknown> } | undefined)?.config_json ?? {}) as Record<string, unknown>
      }
      const n = Number(daily_message_limit)
      const value = Number.isInteger(n) && n >= 0 ? n : 100
      finalConfigJson = { ...base, daily_message_limit: value }
    }
    
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
    if (finalConfigJson !== undefined) {
      updates.push(`config_json = $${paramIndex++}::jsonb`)
      values.push(JSON.stringify(finalConfigJson))
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

// Resolve base_url cho internal agents (gọi chính backend) — tránh localhost không reach được trong Docker
function getInternalAgentBaseUrlForTest(alias: string): string {
  const base = (process.env.BACKEND_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/+$/, "")
  const path = alias === "main" ? "main_agent" : `${alias}_agent`
  return `${base}/api/${path}/v1`
}

// Helper: chạy test một endpoint agent, trả về { ok, status, data?, curl? }
async function runAgentTestFull(
  baseUrl: string,
  testType: "metadata" | "data" | "ask",
  opts?: { dataType?: string; modelId?: string; prompt?: string; documentUrls?: string[] }
): Promise<{ ok: boolean; status?: number; data?: unknown; curl?: string }> {
  const timeout = testType === "ask" ? 60000 : 30000
  const url = baseUrl.replace(/\/+$/, "")

  if (testType === "metadata") {
    const fullUrl = `${url}/metadata`
    const curl = `curl -X GET '${fullUrl}' -H 'Content-Type: application/json'`
    const resp = await fetch(fullUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data, curl }
  }
  if (testType === "data") {
    const type = opts?.dataType || "documents"
    const fullUrl = `${url}/data?type=${encodeURIComponent(type)}`
    const curl = `curl -X GET '${fullUrl}' -H 'Content-Type: application/json'`
    const resp = await fetch(fullUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data, curl }
  }
  if (testType === "ask") {
    const payload: Record<string, unknown> = {
      session_id: `test-${Date.now()}`,
      model_id: opts?.modelId || "gpt-4o-mini",
      user: "admin-test",
      prompt: opts?.prompt || "Xin chào, bạn có thể giúp gì tôi?",
      context: Array.isArray(opts?.documentUrls) && opts.documentUrls.length > 0
        ? { extra_data: { document: opts.documentUrls } }
        : {},
    }
    const bodyStr = JSON.stringify(payload)
    const escaped = bodyStr.replace(/'/g, "'\\''")
    const fullUrl = `${url}/ask`
    const curl = `curl -X POST '${fullUrl}' -H 'Content-Type: application/json' -d '${escaped}'`
    const resp = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data, curl }
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

function isNetworkError(e: any): boolean {
  const msg = (e?.message || String(e)).toLowerCase()
  return (
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed") ||
    msg.includes("aborted") ||
    e?.name === "AbortError"
  )
}

async function runWithRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; delayMs?: number; onRetry?: (attempt: number) => void }
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 2
  const delayMs = opts?.delayMs ?? 2000
  let lastErr: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (attempt < maxRetries && isNetworkError(e)) {
        opts?.onRetry?.(attempt + 1)
        await new Promise((r) => setTimeout(r, delayMs))
        continue
      }
      throw e
    }
  }
  throw lastErr
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
    const backendUrl = getBackendBaseUrl(req)
    const sampleUrlsByFormat: Record<string, string> = {}
    SAMPLE_FILES.forEach((f) => {
      const ext = f.replace(/^.*\./, "").toLowerCase()
      sampleUrlsByFormat[ext] = `${backendUrl}/api/admin/sample-files/${f}`
    })
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
    let aborted = false
    let testedCount = 0
    req.on("close", () => {
      aborted = true
    })
    for (let i = 0; i < agents.length; i++) {
      if (aborted) break
      testedCount = i + 1
      const agent = agents[i]
      // Agent "main" gọi nội bộ để tránh container không reach được public URL
      const baseUrl =
        agent.alias === "main"
          ? getInternalAgentBaseUrlForTest(agent.alias)
          : String(agent.base_url || "").replace(/\/+$/, "")
      let metadataPass: boolean | null = null
      let dataDocumentsPass: boolean | null = null
      let dataExpertsPass: boolean | null = null
      let askTextPass: boolean | null = null
      let askFilePass: boolean | null = null
      let metadataMs: number | null = null
      let dataDocumentsMs: number | null = null
      let dataExpertsMs: number | null = null
      let askTextMs: number | null = null
      let askFileMs: number | null = null
      let errorMsg: string | null = null
      let metadataDetails: { curl?: string; response?: unknown } | null = null
      let dataDetails: { type: string; pass: boolean; ms: number; curl?: string; response?: unknown }[] = []
      let askTextDetails: { model_id: string; pass: boolean; ms: number; curl?: string; response?: unknown }[] = []
      let askFileDetails: { format: string; pass: boolean; ms: number; curl?: string; response?: unknown }[] = []
      let modelId = "gpt-4o-mini"
      let prompt = "Xin chào, bạn có thể giúp gì tôi?"
      const supportedModels: { model_id: string; accepted_file_types?: string[] }[] = []
      send("agent", { index: i + 1, total: agents.length, alias: agent.alias })
      try {
        send("endpoint", { agent: agent.alias, endpoint: "/metadata", status: "running" })
        const tMeta = Date.now()
        const metaRes = await runWithRetry(
          () => runAgentTestFull(baseUrl, "metadata"),
          { onRetry: (n) => send("endpoint", { agent: agent.alias, endpoint: "/metadata", status: "retrying", attempt: n }) }
        )
        metadataMs = Date.now() - tMeta
        metadataPass = metaRes.ok
        metadataDetails = { curl: metaRes.curl, response: metaRes.data }
        send("endpoint", {
          agent: agent.alias,
          endpoint: "/metadata",
          pass: metaRes.ok,
          status: metaRes.status,
          result: metaRes.data,
          duration_ms: metadataMs,
        })
        let dataTypes: string[] = ["documents", "experts"]
        if (metaRes.ok && metaRes.data) {
          const m = metaRes.data as Record<string, unknown>
          const models = (m?.supported_models as { model_id?: string; accepted_file_types?: string[] }[]) || []
          supportedModels.length = 0
          models.forEach((mod) => {
            if (mod?.model_id) supportedModels.push({ model_id: mod.model_id, accepted_file_types: mod.accepted_file_types })
          })
          if (supportedModels.length > 0) modelId = supportedModels[0].model_id
          const prompts = (m?.sample_prompts as string[]) || []
          if (prompts.length > 0 && typeof prompts[0] === "string") prompt = prompts[0]
          const pdt = (m?.provided_data_types as { type?: string }[]) || []
          const extracted = pdt.map((dt: { type?: string }) => (typeof dt === "string" ? dt : dt?.type)).filter(Boolean) as string[]
          if (extracted.length > 0) { dataTypes = extracted }
        }
        for (const dataType of dataTypes) {
          send("endpoint", { agent: agent.alias, endpoint: `/data?type=${dataType}`, status: "running" })
          const t0 = Date.now()
          const res = await runWithRetry(
            () => runAgentTestFull(baseUrl, "data", { dataType }),
            { onRetry: (n) => send("endpoint", { agent: agent.alias, endpoint: `/data?type=${dataType}`, status: "retrying", attempt: n }) }
          )
          const ms = Date.now() - t0
          dataDetails.push({ type: dataType, pass: res.ok, ms, curl: res.curl, response: res.data })
          send("endpoint", { agent: agent.alias, endpoint: `/data?type=${dataType}`, pass: res.ok, status: res.status, result: res.data, duration_ms: ms })
        }
        dataDocumentsPass = dataDetails[0]?.pass ?? null
        dataExpertsPass = dataDetails[1]?.pass ?? null
        dataDocumentsMs = dataDetails[0]?.ms ?? null
        dataExpertsMs = dataDetails[1]?.ms ?? null
        for (const mod of supportedModels.length > 0 ? supportedModels : [{ model_id: modelId }]) {
          const mid = mod.model_id || modelId
          send("endpoint", { agent: agent.alias, endpoint: `/ask (text) ${mid}`, status: "running" })
          const t0 = Date.now()
          const res = await runWithRetry(
            () => runAgentTestFull(baseUrl, "ask", { modelId: mid, prompt }),
            { onRetry: (n) => send("endpoint", { agent: agent.alias, endpoint: `/ask (text) ${mid}`, status: "retrying", attempt: n }) }
          )
          const ms = Date.now() - t0
          askTextDetails.push({ model_id: mid, pass: res.ok, ms, curl: res.curl, response: res.data })
          send("endpoint", { agent: agent.alias, endpoint: `/ask (text) ${mid}`, pass: res.ok, status: res.status, duration_ms: ms })
        }
        askTextPass = askTextDetails.length > 0 && askTextDetails.every((d) => d.pass)
        askTextMs = askTextDetails.length > 0 ? Math.round(askTextDetails.reduce((a, d) => a + d.ms, 0) / askTextDetails.length) : null
        const acceptedFormats = new Set<string>()
        supportedModels.forEach((mod) => (mod.accepted_file_types || []).forEach((f: string) => acceptedFormats.add(String(f).toLowerCase().replace(/^\./, ""))))
        const formatsToTest = acceptedFormats.size > 0 ? Array.from(acceptedFormats) : Object.keys(sampleUrlsByFormat)
        for (const format of formatsToTest) {
          const fileUrl = sampleUrlsByFormat[format]
          if (!fileUrl) continue
          send("endpoint", { agent: agent.alias, endpoint: `/ask (file) ${format}`, status: "running" })
          const t0 = Date.now()
          const res = await runWithRetry(
            () => runAgentTestFull(baseUrl, "ask", { modelId, prompt, documentUrls: [fileUrl] }),
            { onRetry: (n) => send("endpoint", { agent: agent.alias, endpoint: `/ask (file) ${format}`, status: "retrying", attempt: n }) }
          )
          const ms = Date.now() - t0
          askFileDetails.push({ format, pass: res.ok, ms, curl: res.curl, response: res.data })
          send("endpoint", { agent: agent.alias, endpoint: `/ask (file) ${format}`, pass: res.ok, status: res.status, duration_ms: ms })
        }
        askFilePass = askFileDetails.length > 0 ? askFileDetails.every((d) => d.pass) : null
        askFileMs = askFileDetails.length > 0 ? Math.round(askFileDetails.reduce((a, d) => a + d.ms, 0) / askFileDetails.length) : null
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
        metadata_ms: metadataMs,
        data_documents_ms: dataDocumentsMs,
        data_experts_ms: dataExpertsMs,
        ask_text_ms: askTextMs,
        ask_file_ms: askFileMs,
        error_message: errorMsg,
        metadata_details: metadataDetails,
        data_details: dataDetails,
        ask_text_details: askTextDetails,
        ask_file_details: askFileDetails,
      })
      await query(
        `INSERT INTO research_chat.agent_test_results
         (run_id, agent_id, agent_alias, base_url, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, metadata_ms, data_documents_ms, data_experts_ms, ask_text_ms, ask_file_ms, error_message, metadata_details, data_details, ask_text_details, ask_file_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb)`,
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
          metadataMs,
          dataDocumentsMs,
          dataExpertsMs,
          askTextMs,
          askFileMs,
          errorMsg,
          metadataDetails ? JSON.stringify(metadataDetails) : null,
          JSON.stringify(dataDetails),
          JSON.stringify(askTextDetails),
          JSON.stringify(askFileDetails),
        ]
      )
    }
    const actualTested = aborted ? testedCount : agents.length
    await query(
      `UPDATE research_chat.agent_test_runs SET passed_count = $1, total_agents = $2 WHERE id = $3`,
      [passedCount, actualTested, runId]
    )
    const durationMs = Date.now() - startTime
    if (aborted) {
      try { send("stopped", { run_id: runId, tested: actualTested, passed_count: passedCount }) } catch (_) {}
    } else {
      send("done", {
        run_id: runId,
        total: agents.length,
        passed_count: passedCount,
        duration_ms: durationMs,
        duration_str: `${(durationMs / 1000).toFixed(1)}s`,
      })
    }
  } catch (err: any) {
    send("error", { message: err?.message || String(err) })
  } finally {
    res.end()
  }
})

// POST /api/admin/agents/test-all - Test tất cả agents, lưu kết quả vào DB
router.post("/agents/test-all", adminOnly, async (req: Request, res: Response) => {
  try {
    const backendUrl = getBackendBaseUrl(req)
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
        let dataType1 = "documents"
        let dataType2 = "experts"
        if (metaRes.ok) {
          const metaData = (await fetch(`${baseUrl}/metadata`).then((r) => r.json().catch(() => ({})))) as Record<string, unknown>
          const models = (metaData?.supported_models as { model_id?: string }[]) || []
          if (models.length > 0 && models[0]?.model_id) modelId = models[0].model_id
          const prompts = (metaData?.sample_prompts as string[]) || []
          if (prompts.length > 0 && typeof prompts[0] === "string") prompt = prompts[0]
          const pdt = (metaData?.provided_data_types as { type?: string }[]) || []
          const extracted = pdt.map((dt: { type?: string }) => (typeof dt === "string" ? dt : dt?.type)).filter(Boolean) as string[]
          if (extracted.length > 0) {
            dataType1 = extracted[0]
            dataType2 = extracted[1] ?? extracted[0]
          }
        }

        const docRes = await runAgentTest(baseUrl, "data", { dataType: dataType1 })
        dataDocumentsPass = docRes.ok

        if (dataType1 !== dataType2) {
          const expRes = await runAgentTest(baseUrl, "data", { dataType: dataType2 })
          dataExpertsPass = expRes.ok
        } else {
          dataExpertsPass = null
        }

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
        context:
          Array.isArray(document_urls) && document_urls.length > 0
            ? { extra_data: { document: document_urls.filter((u: unknown) => typeof u === "string") } }
            : {},
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

// ─────────────────────────────────────────────────────────────────────────────
// Admin Chat: xem hội thoại gửi đến Agents (ẩn danh tính người nhắn)
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// GET /api/admin/chat/sessions - Danh sách phiên chat (không trả về user_id / email)
// Query: assistant_alias?, limit?, offset?
router.get("/chat/sessions", adminOnly, async (req: Request, res: Response) => {
  try {
    const assistantAlias = (req.query.assistant_alias as string)?.trim() || undefined
    const sourceFilter = (req.query.source as string)?.trim()
    const source = sourceFilter === "embed" || sourceFilter === "web" ? sourceFilter : undefined
    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)

    const conditions: string[] = []
    const params: (string | number)[] = []
    let idx = 1
    if (assistantAlias) {
      conditions.push(`cs.assistant_alias = $${idx++}`)
      params.push(assistantAlias)
    }
    if (source) {
      conditions.push(`cs.source = $${idx++}`)
      params.push(source)
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    params.push(limit, offset)
    const paramLimit = `$${idx++}`
    const paramOffset = `$${idx}`

    const sql = `
      SELECT cs.id, cs.title, cs.assistant_alias, cs.source, cs.created_at, cs.updated_at,
             COALESCE(cs.message_count, (SELECT COUNT(*) FROM research_chat.messages WHERE session_id = cs.id)) AS message_count
      FROM research_chat.chat_sessions cs
      ${where}
      ORDER BY cs.updated_at DESC NULLS LAST, cs.created_at DESC
      LIMIT ${paramLimit} OFFSET ${paramOffset}
    `
    const result = await query(sql, params)
    const rows = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      user_display: "Người dùng",
    }))
    const countWhere = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    const countParams = conditions.length ? params.slice(0, conditions.length) : []
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM research_chat.chat_sessions cs ${countWhere}`,
      countParams
    )
    const total = countResult.rows[0]?.total ?? 0
    res.json({ data: rows, page: { limit, offset, total } })
  } catch (err: any) {
    console.error("GET /api/admin/chat/sessions error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// GET /api/admin/chat/sessions/:sessionId - Chi tiết một phiên (không trả user_id)
router.get("/chat/sessions/:sessionId", adminOnly, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim()
    if (!UUID_RE.test(sessionId)) return res.status(400).json({ error: "Invalid sessionId" })
    const result = await query(
      `SELECT cs.id, cs.title, cs.assistant_alias, cs.source, cs.created_at, cs.updated_at, COALESCE(cs.message_count, 0) AS message_count
       FROM research_chat.chat_sessions cs
       WHERE cs.id = $1::uuid`,
      [sessionId]
    )
    const row = result.rows[0]
    if (!row) return res.status(404).json({ error: "Session not found" })
    res.json({
      ...row,
      user_display: "Người dùng",
    })
  } catch (err: any) {
    console.error("GET /api/admin/chat/sessions/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// GET /api/admin/chat/sessions/:sessionId/messages - Tin nhắn trong phiên (không trả user_id của message)
router.get("/chat/sessions/:sessionId/messages", adminOnly, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId).trim()
    if (!UUID_RE.test(sessionId)) return res.status(400).json({ error: "Invalid sessionId" })
    let limit = Number(req.query.limit ?? 200)
    let offset = Number(req.query.offset ?? 0)
    if (!Number.isFinite(limit) || limit <= 0) limit = 200
    if (limit > 500) limit = 500
    if (!Number.isFinite(offset) || offset < 0) offset = 0

    const sql = `
      SELECT m.id, m.assistant_alias, m.role, m.content_type, m.content,
             m.model_id, m.prompt_tokens, m.completion_tokens, m.response_time_ms, m.refs, m.created_at,
             COALESCE(
               (SELECT json_agg(json_build_object('file_name', ma.file_name, 'file_url', ma.file_url))
                FROM research_chat.message_attachments ma WHERE ma.message_id = m.id),
               '[]'::json
             ) AS attachments
      FROM research_chat.messages m
      WHERE m.session_id = $1::uuid
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `
    const result = await query(sql, [sessionId, limit, offset])
    res.json({ data: result.rows })
  } catch (err: any) {
    console.error("GET /api/admin/chat/sessions/:id/messages error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
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

// GET /api/admin/stats/messages-per-day - Số tin nhắn mỗi ngày (30 ngày gần nhất)
router.get("/stats/messages-per-day", adminOnly, async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)
    const result = await query<{ day: string; count: string }>(
      `
      SELECT 
        to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
        COUNT(*)::text AS count
      FROM research_chat.messages
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

// GET /api/admin/stats/messages-by-source - Số tin nhắn theo nguồn (web / embed)
router.get("/stats/messages-by-source", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query<{ source: string; count: string }>(
      `
      SELECT COALESCE(s.source, 'web') AS source, COUNT(*)::text AS count
      FROM research_chat.messages m
      JOIN research_chat.chat_sessions s ON s.id = m.session_id
      GROUP BY s.source
      `
    )
    const data = result.rows.map((r) => ({ source: r.source === "embed" ? "embed" : "web", count: parseInt(r.count, 10) }))
    res.json({ data })
  } catch (err: any) {
    console.error("Error fetching messages-by-source:", err)
    res.status(500).json({ error: "Internal Server Error", message: allowAdmin ? err.message : undefined })
  }
})

// GET /api/admin/stats/messages-by-agent - Số tin nhắn theo agent (assistant_alias)
router.get("/stats/messages-by-agent", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query<{ assistant_alias: string; count: string }>(
      `
      SELECT COALESCE(s.assistant_alias, 'main') AS assistant_alias, COUNT(*)::text AS count
      FROM research_chat.messages m
      JOIN research_chat.chat_sessions s ON s.id = m.session_id
      GROUP BY s.assistant_alias
      ORDER BY count DESC
      `
    )
    const data = result.rows.map((r) => ({ assistant_alias: r.assistant_alias || "main", count: parseInt(r.count, 10) }))
    res.json({ data })
  } catch (err: any) {
    console.error("Error fetching messages-by-agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: allowAdmin ? err.message : undefined })
  }
})

export default router
