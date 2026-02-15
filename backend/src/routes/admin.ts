// routes/admin.ts
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import OpenAI from "openai"
import { query, getDatabaseName } from "../lib/db"
import { isAlwaysAdmin } from "../lib/admin-utils"
import { searchPoints, scrollPoints } from "../lib/qdrant"
import { getRegulationsEmbeddingUrl, getQdrantUrl, getLakeFlowApiUrl } from "../lib/config"
import path from "path"
import fs from "fs"
import { spawnSync } from "child_process"

const EMBEDDING_MODEL = process.env.REGULATIONS_EMBEDDING_MODEL || "text-embedding-3-small"

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
      let row: { role?: string; is_admin?: boolean } | undefined
      const r = await query<{ role?: string; is_admin?: boolean }>(
        `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
        [token.id]
      )
      row = r.rows[0]
      if (!row && userEmail) {
        const r2 = await query<{ role?: string; is_admin?: boolean }>(
          `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [userEmail]
        )
        row = r2.rows[0]
      }
      isAdmin = !!row && (row.role === "admin" || row.role === "developer" || !!row.is_admin)
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
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000"
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
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000"
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

// Proxy tới Datalake inbox API (upload / list) — chỉ admin
import datalakeInboxRouter from "./datalake-inbox"
router.use("/datalake-inbox", adminOnly, datalakeInboxRouter)

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

// ============================================
// Plugins (cài Agent như plugin từ Admin)
// ============================================

const PLUGINS_AVAILABLE: { id: string; name: string; description: string; mountPath: string; assistantAlias: string }[] = [
  {
    id: "data-agent",
    name: "Data Agent",
    description: "Trợ lý phân tích và xử lý dữ liệu: thống kê mô tả, trực quan hóa, đưa ra insights từ các dataset mẫu.",
    mountPath: "/api/data_agent",
    assistantAlias: "data",
  },
]

// GET /api/admin/plugins/available - Danh sách plugin có thể cài
router.get("/plugins/available", adminOnly, (_req: Request, res: Response) => {
  res.json({ plugins: PLUGINS_AVAILABLE })
})

// GET /api/admin/plugins/installed - Danh sách plugin đã cài (folder tồn tại trong src/agents)
router.get("/plugins/installed", adminOnly, (req: Request, res: Response) => {
  try {
    const backendRoot = path.join(__dirname, "..", "..")
    const agentsDir = path.join(backendRoot, "src", "agents")
    const installed: string[] = []
    if (fs.existsSync(agentsDir)) {
      for (const name of fs.readdirSync(agentsDir)) {
        const dir = path.join(agentsDir, name)
        if (!fs.statSync(dir).isDirectory()) continue
        if (fs.existsSync(path.join(dir, "manifest.json"))) installed.push(name)
      }
    }
    const { getMountedPaths } = require("../lib/app-ref")
    const mounted = getMountedPaths() ? Array.from(getMountedPaths()!) : []
    res.json({ installed, mounted })
  } catch (err: any) {
    console.error("GET /plugins/installed error:", err)
    res.status(500).json({ error: err?.message || "Internal Server Error" })
  }
})

// POST /api/admin/plugins/install - Cài plugin: tải gói zip từ URL (DATA_AGENT_PACKAGE_URL), giải nén, mount và thêm trợ lý
router.post("/plugins/install", adminOnly, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.body || {}
    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({ error: "Thiếu agentId (vd. data-agent)" })
    }
    const plugin = PLUGINS_AVAILABLE.find((p) => p.id === agentId)
    if (!plugin) {
      return res.status(400).json({ error: "Plugin không tồn tại" })
    }

    const packageUrl = process.env.DATA_AGENT_PACKAGE_URL
    if (!packageUrl || typeof packageUrl !== "string" || !packageUrl.trim()) {
      return res.status(400).json({
        error: "Chưa cấu hình URL gói Data Agent",
        hint: "Đặt biến môi trường DATA_AGENT_PACKAGE_URL trỏ tới file zip đã đóng gói (vd. từ AI-Agents: npm run pack → host dist/data-agent.zip).",
      })
    }

    const backendRoot = path.join(__dirname, "..", "..")
    const agentsDestDir = path.join(backendRoot, "src", "agents")
    const destDir = path.join(agentsDestDir, agentId)
    fs.mkdirSync(agentsDestDir, { recursive: true })

    const resFetch = await fetch(packageUrl.trim(), { method: "GET" })
    if (!resFetch.ok) {
      return res.status(502).json({
        error: "Không tải được gói plugin",
        detail: `HTTP ${resFetch.status}. Kiểm tra DATA_AGENT_PACKAGE_URL có đúng và truy cập được không.`,
      })
    }
    const zipBuffer = Buffer.from(await resFetch.arrayBuffer())
    if (zipBuffer.length === 0) {
      return res.status(502).json({ error: "Gói tải về rỗng" })
    }

    const AdmZip = require("adm-zip")
    const zip = new AdmZip(zipBuffer)
    zip.extractAllTo(destDir, true)

    if (!fs.existsSync(path.join(destDir, "manifest.json"))) {
      return res.status(500).json({
        error: "Gói zip không đúng định dạng (thiếu manifest.json). Đóng gói từ AI-Agents: npm run pack.",
      })
    }

    const indexPath = path.join(destDir, "index.ts")
    const indexJsPath = path.join(destDir, "index.js")
    const resolved = fs.existsSync(indexJsPath) ? indexJsPath : fs.existsSync(indexPath) ? indexPath : null
    if (!resolved) {
      return res.status(500).json({ error: "Gói plugin không có index.ts hoặc index.js" })
    }

    const { mountPlugin, getMountedPaths } = require("../lib/app-ref")
    const alreadyMounted = getMountedPaths()?.has(plugin.mountPath)
    let mounted = false
    if (!alreadyMounted) {
      let mod: any
      try {
        mod = require(resolved)
      } catch (e: any) {
        return res.status(500).json({ error: "Không load được plugin: " + (e?.message || String(e)) })
      }
      const router = mod?.default
      if (!router) {
        return res.status(500).json({ error: "Plugin không export default router" })
      }
      mounted = mountPlugin(plugin.mountPath, router)
    }

    await query(
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, domain_url, display_order, config_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (alias) DO UPDATE SET
         base_url = EXCLUDED.base_url,
         config_json = EXCLUDED.config_json,
         updated_at = now()`,
      [
        plugin.assistantAlias,
        "Database",
        getBackendBaseUrl(req) + plugin.mountPath + "/v1",
        null,
        4,
        JSON.stringify({ isInternal: true, routing_hint: "Dữ liệu, data, thống kê" }),
      ]
    )

    console.log("[admin] Plugin installed and mounted:", agentId, "at", plugin.mountPath)
    res.json({
      success: true,
      message: alreadyMounted
        ? "Đã cập nhật file. Trợ lý đang chạy (khởi động lại backend nếu cần phiên bản mới)."
        : "Đã tải gói, cài plugin và thêm trợ lý. Có thể dùng ngay.",
      installed: true,
      mounted: mounted || alreadyMounted,
    })
  } catch (err: any) {
    console.error("POST /plugins/install error:", err)
    res.status(500).json({ error: err?.message || "Internal Server Error" })
  }
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
      WHERE table_schema = 'ai_portal'
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
      WHERE table_schema = 'ai_portal' AND table_name = $1
    `, [tableName])
    
    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema 'ai_portal'` })
    }
    
    // Lấy schema của table
    const schemaResult = await query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'ai_portal' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName])

    // Lấy primary key columns
    const pkResult = await query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'ai_portal' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
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
      SELECT * FROM ai_portal.${tableName}
      ${orderBy}
      LIMIT $1 OFFSET $2
    `, [limit, offset])
    
    // Đếm tổng số rows
    const countResult = await query(`
      SELECT COUNT(*) as total FROM ai_portal.${tableName}
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

// Helper: kiểm tra table thuộc ai_portal và lấy schema
async function getTableSchema(tableName: string): Promise<{ schema: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]; primaryKey: string[] } | null> {
  const safeName = String(tableName).replace(/[^a-zA-Z0-9_]/g, "")
  const tableCheck = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'ai_portal' AND table_name = $1`,
    [safeName]
  )
  if (tableCheck.rows.length === 0) return null
  const schemaResult = await query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema = 'ai_portal' AND table_name = $1 ORDER BY ordinal_position`,
    [safeName]
  )
  const pkResult = await query(
    `SELECT kcu.column_name FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema = 'ai_portal' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position`,
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
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema ai_portal` })
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
    const insertSql = `INSERT INTO ai_portal.${tableName} (${cols}) VALUES (${placeholders}) RETURNING *`
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
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema ai_portal` })
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
    const updateSql = `UPDATE ai_portal.${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`
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
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema ai_portal` })
    const { primaryKey } = meta
    if (primaryKey.length === 0) return res.status(400).json({ error: "Table không có primary key, không thể xóa theo dòng" })
    const pk = req.body?.pk
    if (!pk || typeof pk !== "object") {
      return res.status(400).json({ error: "Body phải có dạng { pk: { pk_col: value } }" })
    }
    const whereClause = primaryKey.map((c, i) => `${c} = $${i + 1}`).join(" AND ")
    const values = primaryKey.map((c) => pk[c])
    const deleteSql = `DELETE FROM ai_portal.${tableName} WHERE ${whereClause} RETURNING *`
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
    const sql = (req.body?.sql ?? req.body?.query) as string | undefined

    if (!sql || typeof sql !== "string" || !sql.trim()) {
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

// ─── Qdrant Vector Database (cùng instance với trợ lý Quy chế: docker-compose qdrant / localhost:8010) ───
router.get("/qdrant/health", adminOnly, async (req: Request, res: Response) => {
  const QDRANT_ADMIN_URL = getQdrantUrl()
  try {
    const r = await fetch(`${QDRANT_ADMIN_URL}/`, { method: "GET" })
    const ok = r.ok
    const data = await r.json().catch(() => ({}))
    res.json({
      ok,
      status: r.status,
      url: QDRANT_ADMIN_URL,
      title: (data as { title?: string }).title ?? null,
      version: (data as { version?: string }).version ?? null,
    })
  } catch (err: any) {
    res.status(502).json({
      ok: false,
      url: QDRANT_ADMIN_URL,
      error: err?.message ?? "Không kết nối được Qdrant",
    })
  }
})

router.get("/qdrant/collections", adminOnly, async (req: Request, res: Response) => {
  const QDRANT_ADMIN_URL = getQdrantUrl()
  try {
    const r = await fetch(`${QDRANT_ADMIN_URL}/collections`, { method: "GET" })
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: `Qdrant: ${errText}` })
    }
    const data = (await r.json()) as { result?: { collections?: Array<{ name: string }> } }
    const collections = data?.result?.collections ?? []
    res.json({ url: QDRANT_ADMIN_URL, collections: collections.map((c) => c.name) })
  } catch (err: any) {
    res.status(502).json({
      url: QDRANT_ADMIN_URL,
      error: err?.message ?? "Không kết nối được Qdrant",
      collections: [],
    })
  }
})

router.get("/qdrant/collections/:name", adminOnly, async (req: Request, res: Response) => {
  const QDRANT_ADMIN_URL = getQdrantUrl()
  try {
    const name = String(req.params.name ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
    if (!name) return res.status(400).json({ error: "Tên collection không hợp lệ" })
    const r = await fetch(`${QDRANT_ADMIN_URL}/collections/${encodeURIComponent(name)}`, { method: "GET" })
    if (!r.ok) {
      if (r.status === 404) return res.status(404).json({ error: "Collection không tồn tại" })
      const errText = await r.text()
      return res.status(r.status).json({ error: errText })
    }
    const data = (await r.json()) as {
      result?: {
        status?: string
        vectors_count?: number
        points_count?: number
        segments_count?: number
        config?: {
          params?: { vectors?: { size?: number; distance?: string } }
        }
      }
    }
    const result = data?.result ?? {}
    res.json({
      name,
      url: QDRANT_ADMIN_URL,
      status: result.status ?? null,
      points_count: result.points_count ?? 0,
      vectors_count: result.vectors_count ?? 0,
      segments_count: result.segments_count ?? 0,
      vector_size: result.config?.params?.vectors?.size ?? null,
      distance: result.config?.params?.vectors?.distance ?? null,
    })
  } catch (err: any) {
    res.status(502).json({
      error: err?.message ?? "Không kết nối được Qdrant",
    })
  }
})

/**
 * POST /api/admin/qdrant/search - Tìm kiếm vector theo từ khóa (embedding + semantic search)
 * Body: { collection: string, keyword: string, limit?: number }
 */
router.post("/qdrant/search", adminOnly, async (req: Request, res: Response) => {
  try {
    const { collection, keyword, limit } = req.body ?? {}
    const col = typeof collection === "string" ? collection.trim() : ""
    const kw = typeof keyword === "string" ? keyword.trim() : ""
    if (!col || !kw) {
      return res.status(400).json({ error: "collection và keyword là bắt buộc" })
    }
    const embeddingUrl = getRegulationsEmbeddingUrl()
    const apiKey = process.env.OPENAI_API_KEY
    const useLakeFlowEmbed = embeddingUrl.startsWith("http")
    if (!apiKey && !useLakeFlowEmbed) {
      return res.status(500).json({ error: "Chưa cấu hình OPENAI_API_KEY hoặc REGULATIONS_EMBEDDING_URL (tự dùng LakeFlow khi không set)" })
    }

    const EMBED_TIMEOUT_MS = 25000
    const ac = new AbortController()
    const timeoutId = setTimeout(() => ac.abort(), EMBED_TIMEOUT_MS)

    let vector: number[]
    try {
      if (useLakeFlowEmbed) {
        const embedRes = await fetch(embeddingUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: kw }),
          signal: ac.signal,
        })
        clearTimeout(timeoutId)
        if (!embedRes.ok) {
          const errText = await embedRes.text()
          throw new Error(`Embedding API failed: ${embedRes.status} ${errText}`)
        }
        const embedJson = (await embedRes.json()) as { embedding?: number[]; vector?: number[] }
        vector = embedJson.embedding ?? embedJson.vector ?? []
        if (!Array.isArray(vector) || vector.length === 0) {
          throw new Error("Embedding API trả về vector rỗng hoặc không hợp lệ")
        }
      } else {
        const openai = new OpenAI({ apiKey })
        const embedRes = await openai.embeddings.create(
          {
            model: EMBEDDING_MODEL,
            input: kw,
          },
          { signal: ac.signal }
        )
        clearTimeout(timeoutId)
        const v = embedRes.data?.[0]?.embedding
        if (!v || !Array.isArray(v)) throw new Error("Không nhận được vector từ embedding API")
        vector = v
      }
    } catch (embedErr: any) {
      clearTimeout(timeoutId)
      if (embedErr?.name === "AbortError") {
        throw new Error("Embedding quá thời gian (timeout 25s). Kiểm tra REGULATIONS_EMBEDDING_URL hoặc OPENAI_API_KEY.")
      }
      throw embedErr
    }

    const searchLimit = Math.min(Math.max(typeof limit === "number" ? limit : 20, 1), 50)
    const points = await searchPoints(col, vector, { limit: searchLimit, withPayload: true })
    res.json({ keyword: kw, collection: col, points })
  } catch (err: any) {
    console.error("POST /api/admin/qdrant/search error:", err)
    res.status(500).json({
      error: err?.message ?? "Lỗi tìm kiếm vector",
    })
  }
})

/**
 * POST /api/admin/qdrant/collections/:name/scroll - Duyệt points trong collection (phân trang)
 * Body: { limit?: number, offset?: string | number }
 */
router.post("/qdrant/collections/:name/scroll", adminOnly, async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
    if (!name) return res.status(400).json({ error: "Tên collection không hợp lệ" })
    const { limit, offset } = req.body ?? {}
    const result = await scrollPoints(name, {
      limit: typeof limit === "number" ? limit : 20,
      offset: offset != null ? offset : undefined,
    })
    res.json(result)
  } catch (err: any) {
    console.error("POST /api/admin/qdrant/collections/:name/scroll error:", err)
    res.status(500).json({
      error: err?.message ?? "Lỗi duyệt points",
    })
  }
})

// POST /api/admin/notifications - Gửi thông báo hệ thống cho một user (quản trị)
router.post("/notifications", adminOnly, async (req: Request, res: Response) => {
  try {
    const { user_id, user_email, title, body } = req.body ?? {}
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "title là bắt buộc" })
    }
    let targetUserId: string | null = null
    if (user_id && typeof user_id === "string") {
      targetUserId = user_id.trim()
    } else if (user_email && typeof user_email === "string") {
      const r = await query(`SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`, [user_email.trim().toLowerCase()])
      if (r.rows[0]?.id) targetUserId = (r.rows[0] as { id: string }).id
    }
    if (!targetUserId) {
      return res.status(400).json({ error: "Cần user_id hoặc user_email hợp lệ" })
    }
    await query(
      `INSERT INTO ai_portal.notifications (user_id, type, title, body, payload)
       VALUES ($1::uuid, 'system', $2, $3, '{}'::jsonb)`,
      [targetUserId, title.trim(), body != null ? String(body).trim() : null]
    )
    res.status(201).json({ ok: true, message: "Đã gửi thông báo" })
  } catch (err: any) {
    console.error("POST /api/admin/notifications error:", err)
    res.status(500).json({ error: "Internal Server Error", message: (err as Error)?.message })
  }
})

// GET /api/admin/config - Cấu hình hệ thống chi tiết (chỉ đọc, sửa trong .env hoặc docker-compose)
router.get("/config", adminOnly, (req: Request, res: Response) => {
  try {
    const port = process.env.PORT || "3001"
    const backendUrl = process.env.BACKEND_URL || (process.env.NODE_ENV === "production"
      ? (process.env.NEXTAUTH_URL || "http://localhost:3000")
      : `http://localhost:${port}`)
    const mask = (set: boolean) => (set ? "••••••••" : "(chưa set)")
    const sections: Array<{ title: string; description?: string; items: Array<{ key: string; value: string; description: string; secret?: boolean }> }> = [
      {
        title: "Server / Backend",
        description: "Cấu hình runtime backend. Sửa trong .env hoặc docker-compose.",
        items: [
          { key: "PORT", value: port, description: "Cổng backend (mặc định 3001)" },
          { key: "NODE_ENV", value: process.env.NODE_ENV || "development", description: "development | production" },
          { key: "BACKEND_URL", value: backendUrl, description: "URL backend dùng nội bộ" },
          { key: "API_BASE_URL", value: process.env.API_BASE_URL || "(mặc định)", description: "URL API base (backend)" },
          { key: "ENABLE_ADMIN_ROUTES", value: String(process.env.ENABLE_ADMIN_ROUTES === "true"), description: "Bật trang admin (true khi production)" },
        ],
      },
      {
        title: "Frontend",
        items: [
          { key: "NEXTAUTH_URL", value: process.env.NEXTAUTH_URL || "(chưa set)", description: "URL trình duyệt mở (vd. https://your-domain.com)" },
          { key: "FRONTEND_URL", value: process.env.FRONTEND_URL || "(chưa set)", description: "URL frontend (dự phòng)" },
          { key: "NEXT_PUBLIC_API_BASE_URL", value: process.env.NEXT_PUBLIC_API_BASE_URL || "(trống = same-origin)", description: "URL API cho client (Next.js build)" },
          { key: "NEXT_PUBLIC_WS_URL", value: process.env.NEXT_PUBLIC_WS_URL || "(chưa set)", description: "WebSocket URL (nếu dùng)" },
        ],
      },
      {
        title: "Auth / NextAuth",
        items: [
          { key: "NEXTAUTH_SECRET", value: mask(!!process.env.NEXTAUTH_SECRET), description: "Secret cho NextAuth (bắt buộc production)", secret: true },
          { key: "ADMIN_SECRET", value: mask(!!process.env.ADMIN_SECRET), description: "Secret để vào trang admin", secret: true },
          { key: "ADMIN_REDIRECT_PATH", value: process.env.ADMIN_REDIRECT_PATH || "(mặc định /admin)", description: "Đường dẫn redirect sau khi vào admin" },
          { key: "AUTH_TRUST_HOST", value: process.env.AUTH_TRUST_HOST ?? "true", description: "NextAuth trust host" },
          { key: "AZURE_AD_CLIENT_ID", value: process.env.AZURE_AD_CLIENT_ID || "(chưa set)", description: "Azure AD OAuth client ID" },
          { key: "AZURE_AD_CLIENT_SECRET", value: mask(!!process.env.AZURE_AD_CLIENT_SECRET), description: "Azure AD OAuth client secret", secret: true },
          { key: "AZURE_AD_TENANT_ID", value: process.env.AZURE_AD_TENANT_ID || "(chưa set)", description: "Azure AD tenant ID" },
        ],
      },
      {
        title: "PostgreSQL",
        items: [
          { key: "POSTGRES_HOST", value: process.env.POSTGRES_HOST || "(chưa set)", description: "Host Postgres" },
          { key: "POSTGRES_PORT", value: process.env.POSTGRES_PORT || "5432", description: "Cổng Postgres" },
          { key: "POSTGRES_DB", value: process.env.POSTGRES_DB || "(chưa set)", description: "Tên database" },
          { key: "POSTGRES_USER", value: process.env.POSTGRES_USER || "(chưa set)", description: "User Postgres" },
          { key: "POSTGRES_PASSWORD", value: mask(!!process.env.POSTGRES_PASSWORD), description: "Mật khẩu Postgres", secret: true },
          { key: "POSTGRES_SSL", value: process.env.POSTGRES_SSL || "false", description: "SSL (true/false)" },
        ],
      },
      {
        title: "Qdrant (Vector DB)",
        items: [
          { key: "QDRANT_URL", value: getQdrantUrl(), description: "URL Qdrant (dùng cho embedding search)" },
          { key: "QDRANT_PORT", value: process.env.QDRANT_PORT || "8010", description: "Cổng host khi map Qdrant" },
          { key: "QDRANT_EXTERNAL_URL", value: process.env.QDRANT_EXTERNAL_URL || "(tự động từ QDRANT_URL)", description: "URL Qdrant cho Datalake pipeline ghi vector" },
        ],
      },
      {
        title: "LakeFlow / Datalake",
        items: [
          { key: "LAKEFLOW_API_URL", value: getLakeFlowApiUrl(), description: "URL Datalake API (inbox, upload, embed)" },
          { key: "LAKEFLOW_PORT", value: process.env.LAKEFLOW_PORT || "8011", description: "Cổng host khi map LakeFlow" },
          { key: "REGULATIONS_EMBEDDING_URL", value: getRegulationsEmbeddingUrl(), description: "URL embedding (LakeFlow /search/embed hoặc override)" },
          { key: "REGULATIONS_EMBEDDING_MODEL", value: process.env.REGULATIONS_EMBEDDING_MODEL || "text-embedding-3-small", description: "Model embedding OpenAI (khi không dùng LakeFlow)" },
        ],
      },
      {
        title: "MinIO / Storage",
        items: [
          { key: "MINIO_ENDPOINT", value: process.env.MINIO_ENDPOINT || "localhost", description: "Host MinIO" },
          { key: "MINIO_PORT", value: process.env.MINIO_PORT || "9000", description: "Cổng MinIO" },
          { key: "MINIO_ENDPOINT_PUBLIC", value: process.env.MINIO_ENDPOINT_PUBLIC || process.env.MINIO_ENDPOINT || "(cùng MINIO_ENDPOINT)", description: "Host MinIO cho public URL" },
          { key: "MINIO_BUCKET_NAME", value: process.env.MINIO_BUCKET_NAME || "portal", description: "Tên bucket" },
          { key: "MINIO_ACCESS_KEY", value: mask(!!process.env.MINIO_ACCESS_KEY), description: "Access key MinIO", secret: true },
          { key: "MINIO_SECRET_KEY", value: mask(!!process.env.MINIO_SECRET_KEY), description: "Secret key MinIO", secret: true },
        ],
      },
      {
        title: "Agents (ngoại vi)",
        items: [
          { key: "PAPER_AGENT_URL", value: process.env.PAPER_AGENT_URL || "(chưa set)", description: "URL Paper Agent (vd. http://localhost:8000/v1)" },
          { key: "EXPERT_AGENT_URL", value: process.env.EXPERT_AGENT_URL || "(chưa set)", description: "URL Expert Agent (vd. LakeFlow :8011/v1)" },
          { key: "REVIEW_AGENT_URL", value: process.env.REVIEW_AGENT_URL || "(chưa set)", description: "URL Review Agent" },
          { key: "PLAGIARISM_AGENT_URL", value: process.env.PLAGIARISM_AGENT_URL || "(chưa set)", description: "URL Plagiarism Agent" },
        ],
      },
      {
        title: "OpenAI & dịch vụ khác",
        items: [
          { key: "OPENAI_API_KEY", value: mask(!!process.env.OPENAI_API_KEY), description: "API key OpenAI (chat, embedding khi không dùng LakeFlow)", secret: true },
          { key: "SERPAPI_KEY", value: mask(!!process.env.SERPAPI_KEY), description: "API key SerpAPI (tìm kiếm)", secret: true },
          { key: "CORS_ORIGIN", value: process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:3002", description: "CORS allowed origins" },
          { key: "PRIMARY_DOMAIN", value: process.env.PRIMARY_DOMAIN || "your-domain.com", description: "Domain chính" },
          { key: "RUNNING_IN_DOCKER", value: process.env.RUNNING_IN_DOCKER || "false", description: "true khi chạy trong container" },
          { key: "ADMIN_EMAILS", value: process.env.ADMIN_EMAILS || "(chưa set)", description: "Danh sách email admin (phân cách dấu phẩy)" },
        ],
      },
    ]
    res.json({ sections })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/projects - Danh sách tất cả projects (kèm thông tin user)
router.get("/projects", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT p.id, p.user_id, p.name, p.description, p.team_members, p.file_keys, p.created_at, p.updated_at,
             u.email AS user_email, u.display_name AS user_display_name, u.full_name AS user_full_name
      FROM ai_portal.projects p
      JOIN ai_portal.users u ON u.id = p.user_id
      ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
    `)
    const projects = result.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      description: r.description,
      team_members: r.team_members ?? [],
      file_keys: r.file_keys ?? [],
      created_at: r.created_at,
      updated_at: r.updated_at,
      user_email: r.user_email,
      user_display_name: r.user_display_name,
      user_full_name: r.user_full_name,
    }))
    res.json({ projects })
  } catch (err: any) {
    console.error("Error fetching projects:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    })
  }
})

// GET /api/admin/users - Danh sách users (kèm daily_message_limit, daily_used, extra_messages_today)
router.get("/users", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.display_name, u.full_name, u.is_admin, COALESCE(u.role, CASE WHEN u.is_admin THEN 'admin' ELSE 'user' END) AS role, u.created_at, u.last_login_at, u.sso_provider,
             u.position, u.department_id, u.intro, u.direction,
             COALESCE(u.daily_message_limit, 10) AS daily_message_limit,
             (SELECT o.extra_messages FROM ai_portal.user_daily_limit_overrides o
              WHERE o.user_id = u.id AND o.override_date = current_date LIMIT 1) AS extra_messages_today,
             (SELECT COUNT(*)::int FROM ai_portal.messages m
              JOIN ai_portal.chat_sessions s ON s.id = m.session_id
              WHERE s.user_id = u.id AND m.role = 'user' AND m.created_at >= date_trunc('day', now())) AS daily_used
      FROM ai_portal.users u
      ORDER BY u.created_at DESC
    `)
    res.json({ users: result.rows })
  } catch (err: any) {
    console.error("Error fetching users:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      hint: "Đảm bảo đã chạy schema.sql (cột is_admin có trong ai_portal.users)"
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
      `SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`,
      [emailNorm]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email đã tồn tại" })
    }
    const id = crypto.randomUUID()
    const passwordHash = hashPassword(pwd)
    await query(
      `INSERT INTO ai_portal.users (id, email, display_name, full_name, password_hash, password_algo, password_updated_at, is_admin, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, 'scrypt', now(), false, now(), now())`,
      [id, emailNorm, displayName ?? emailNorm.split("@")[0], fullName, passwordHash]
    )
    const created = await query(
      `SELECT id, email, display_name, full_name, is_admin, COALESCE(role, 'user') AS role, created_at, last_login_at, sso_provider FROM ai_portal.users WHERE id = $1::uuid`,
      [id]
    )
    res.status(201).json({ user: created.rows[0] })
  } catch (err: any) {
    console.error("Error creating user:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// PATCH /api/admin/users/:id - Cập nhật (role, display_name, full_name, password tùy chọn)
router.patch("/users/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim().replace(/[^a-f0-9-]/gi, "")
    if (id.length !== 36) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    const { role, is_admin, display_name, full_name, password, daily_message_limit } = req.body
    const updates: string[] = ["updated_at = now()"]
    const values: unknown[] = []
    let idx = 1
    if (role === "user" || role === "admin" || role === "developer") {
      updates.push(`role = $${idx++}`)
      values.push(role)
      updates.push(`is_admin = $${idx++}`)
      values.push(role === "admin" || role === "developer")
    } else if (typeof is_admin === "boolean") {
      updates.push(`is_admin = $${idx++}`)
      values.push(is_admin)
      updates.push(`role = $${idx++}`)
      values.push(is_admin ? "admin" : "user")
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
      `UPDATE ai_portal.users SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      values
    )
    const updated = await query(
      `SELECT id, email, display_name, full_name, is_admin, COALESCE(role, CASE WHEN is_admin THEN 'admin' ELSE 'user' END) AS role, daily_message_limit, updated_at, last_login_at, sso_provider FROM ai_portal.users WHERE id = $1::uuid`,
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
      `INSERT INTO ai_portal.user_daily_limit_overrides (user_id, override_date, extra_messages)
       VALUES ($1::uuid, current_date, $2)
       ON CONFLICT (user_id, override_date) DO UPDATE SET extra_messages = $2`,
      [id, extra_messages]
    )
    const row = await query(
      `SELECT u.id, u.email, COALESCE(u.daily_message_limit, 10) AS base_limit,
              (SELECT o.extra_messages FROM ai_portal.user_daily_limit_overrides o
               WHERE o.user_id = u.id AND o.override_date = current_date LIMIT 1) AS extra_today
       FROM ai_portal.users u WHERE u.id = $1::uuid LIMIT 1`,
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
        `UPDATE ai_portal.users SET daily_message_limit = $1, updated_at = now() WHERE id = $2::uuid`,
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
    const result = await query(`DELETE FROM ai_portal.users WHERE id = $1::uuid RETURNING id`, [id])
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
// App Settings (cấu hình runtime)
// ============================================

// GET /api/admin/app-settings - Lấy cấu hình runtime (vd. guest_daily_message_limit)
router.get("/app-settings", adminOnly, async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key IN ('guest_daily_message_limit')`
    )
    const map: Record<string, string> = {}
    for (const r of rows.rows as { key: string; value: string }[]) {
      map[r.key] = r.value ?? ""
    }
    const guestLimit = parseInt(map.guest_daily_message_limit ?? "1", 10)
    res.json({
      guest_daily_message_limit: Number.isInteger(guestLimit) && guestLimit >= 0 ? guestLimit : 1,
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// PATCH /api/admin/app-settings - Cập nhật cấu hình runtime
router.patch("/app-settings", adminOnly, async (req: Request, res: Response) => {
  try {
    const { guest_daily_message_limit } = req.body ?? {}
    if (guest_daily_message_limit !== undefined) {
      const n = Number(guest_daily_message_limit)
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ error: "guest_daily_message_limit phải là số nguyên không âm" })
      }
      await query(
        `INSERT INTO ai_portal.app_settings (key, value) VALUES ('guest_daily_message_limit', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [String(n)]
      )
    }
    const rows = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = 'guest_daily_message_limit'`
    )
    const v = rows.rows[0] as { value: string } | undefined
    const guestLimit = parseInt(v?.value ?? "1", 10)
    res.json({
      guest_daily_message_limit: Number.isInteger(guestLimit) && guestLimit >= 0 ? guestLimit : 1,
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// POST /api/admin/settings/reset-database - Xoá schema ai_portal trong database đang dùng và chạy lại schema.sql (chỉ admin)
// Dùng đúng database từ setup (setup-db.json), không dùng POSTGRES_DB/ai_portal.
// Body: { confirm: "RESET" } bắt buộc để tránh bấm nhầm.
router.post("/settings/reset-database", adminOnly, async (req: Request, res: Response) => {
  try {
    const { confirm: confirmValue } = req.body ?? {}
    if (confirmValue !== "RESET") {
      return res.status(400).json({
        error: "Cần gửi body { confirm: \"RESET\" } để xác nhận. Hành động này xoá toàn bộ dữ liệu và tạo lại schema.",
      })
    }

    const database = getDatabaseName()
    if (database === "postgres") {
      return res.status(400).json({
        error: "Chưa có cấu hình database từ setup. Reset chỉ áp dụng khi đã hoàn thành Bước 2 (Khởi tạo database).",
      })
    }

    await query("DROP SCHEMA IF EXISTS ai_portal CASCADE")

    const backendRoot = path.join(__dirname, "..", "..")
    const schemaPath = path.join(backendRoot, "schema.sql")
    if (!fs.existsSync(schemaPath)) {
      return res.status(500).json({
        error: `Không tìm thấy schema.sql tại ${schemaPath}. Chạy thủ công: psql -f backend/schema.sql`,
      })
    }

    const host = process.env.POSTGRES_HOST ?? "localhost"
    const port = process.env.POSTGRES_PORT ?? "5432"
    const user = process.env.POSTGRES_USER ?? "postgres"
    const password = process.env.POSTGRES_PASSWORD ?? ""

    const result = spawnSync(
      "psql",
      ["-h", host, "-p", String(port), "-d", database, "-U", user, "-f", schemaPath, "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        env: { ...process.env, PGPASSWORD: password },
        timeout: 120_000,
      }
    )
    if (result.error) {
      return res.status(503).json({
        error: `Không chạy được psql (có thể chưa cài). Reset thủ công: kết nối vào database "${database}", chạy DROP SCHEMA ai_portal CASCADE; rồi psql -d ${database} -f backend/schema.sql`,
        message: result.error.message,
      })
    }
    if (result.status !== 0) {
      return res.status(500).json({
        error: "Lỗi khi chạy schema.sql",
        message: result.stderr || result.stdout || String(result.status),
      })
    }

    res.json({ ok: true, message: "Đã xoá toàn bộ DB và thiết lập lại schema. Thêm assistants qua Admin → Agents (Nhập từ file / Thêm mới)." })
  } catch (err: any) {
    console.error("POST /api/admin/settings/reset-database error:", err)
    res.status(500).json({
      error: "Lỗi khi reset database",
      message: err?.message ?? String(err),
    })
  }
})

// ============================================
// Shortcuts (link công cụ trực tuyến — chỉ link, hệ thống không quản lý)
// ============================================

// GET /api/admin/shortcuts - Danh sách shortcut
router.get("/shortcuts", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, description, url, icon, display_order, created_at, updated_at
       FROM ai_portal.shortcuts ORDER BY display_order ASC, name ASC`
    )
    res.json({ shortcuts: result.rows })
  } catch (err: any) {
    if (err?.message?.includes("shortcuts") && err?.message?.includes("does not exist")) {
      return res.json({ shortcuts: [] })
    }
    res.status(500).json({ error: err?.message ?? "Lỗi tải shortcuts" })
  }
})

// POST /api/admin/shortcuts - Tạo shortcut (body: name, url, description?, icon?, display_order?)
router.post("/shortcuts", adminOnly, async (req: Request, res: Response) => {
  try {
    const { name, url, description, icon, display_order } = req.body ?? {}
    const n = typeof name === "string" ? name.trim() : ""
    const u = typeof url === "string" ? url.trim() : ""
    if (!n || !u) return res.status(400).json({ error: "name và url là bắt buộc" })
    if (!u.startsWith("http://") && !u.startsWith("https://")) return res.status(400).json({ error: "url phải bắt đầu bằng http:// hoặc https://" })
    const ord = Number(display_order)
    const displayOrder = Number.isInteger(ord) ? ord : 0
    const iconVal = typeof icon === "string" && icon.trim() ? icon.trim() : "ExternalLink"
    const desc = description != null ? String(description).trim() : null
    const r = await query(
      `INSERT INTO ai_portal.shortcuts (name, description, url, icon, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, url, icon, display_order, created_at, updated_at`,
      [n, desc || null, u, iconVal, displayOrder]
    )
    res.status(201).json({ shortcut: r.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi tạo shortcut" })
  }
})

// PATCH /api/admin/shortcuts/:id - Cập nhật shortcut
router.patch("/shortcuts/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const { name, url, description, icon, display_order } = req.body ?? {}
    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (typeof name === "string") {
      updates.push(`name = $${idx++}`)
      values.push(name.trim())
    }
    if (typeof url === "string") {
      const u = url.trim()
      if (u && !u.startsWith("http://") && !u.startsWith("https://")) return res.status(400).json({ error: "url phải bắt đầu bằng http:// hoặc https://" })
      updates.push(`url = $${idx++}`)
      values.push(u)
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`)
      values.push(description != null ? String(description).trim() : null)
    }
    if (typeof icon === "string") {
      updates.push(`icon = $${idx++}`)
      values.push(icon.trim() || "ExternalLink")
    }
    if (typeof display_order === "number" && Number.isInteger(display_order)) {
      updates.push(`display_order = $${idx++}`)
      values.push(display_order)
    }
    if (updates.length === 0) return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    updates.push(`updated_at = now()`)
    values.push(id)
    await query(
      `UPDATE ai_portal.shortcuts SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      values
    )
    const r = await query(
      `SELECT id, name, description, url, icon, display_order, created_at, updated_at FROM ai_portal.shortcuts WHERE id = $1::uuid`,
      [id]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: "Shortcut không tồn tại" })
    res.json({ shortcut: r.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi cập nhật shortcut" })
  }
})

// DELETE /api/admin/shortcuts/:id - Xóa shortcut
router.delete("/shortcuts/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const r = await query(`DELETE FROM ai_portal.shortcuts WHERE id = $1::uuid RETURNING id`, [id])
    if (r.rows.length === 0) return res.status(404).json({ error: "Shortcut không tồn tại" })
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi xóa shortcut" })
  }
})

// ============================================
// Site Strings (chuỗi hiển thị toàn site, lưu DB — rebrand)
// ============================================

// GET /api/admin/site-strings - Lấy tất cả chuỗi theo key, mỗi key có vi + en
router.get("/site-strings", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT key, locale, value FROM ai_portal.site_strings ORDER BY key, locale`
    )
    const byKey: Record<string, { vi: string; en: string }> = {}
    for (const row of result.rows as { key: string; locale: string; value: string }[]) {
      if (!byKey[row.key]) byKey[row.key] = { vi: "", en: "" }
      if (row.locale === "vi") byKey[row.key].vi = row.value ?? ""
      if (row.locale === "en") byKey[row.key].en = row.value ?? ""
    }
    res.json({ strings: byKey })
  } catch (err: any) {
    console.error("GET /api/admin/site-strings error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// PATCH /api/admin/site-strings - Cập nhật chuỗi (body: { strings: { [key]: { vi?: string, en?: string } } })
router.patch("/site-strings", adminOnly, async (req: Request, res: Response) => {
  try {
    const { strings } = req.body ?? {}
    if (typeof strings !== "object" || strings === null) {
      return res.status(400).json({ error: "Body phải có dạng { strings: { [key]: { vi?, en? } } }" })
    }
    for (const [key, locales] of Object.entries(strings as Record<string, { vi?: string; en?: string }>)) {
      const k = String(key).trim()
      if (!k) continue
      const vi = locales?.vi
      const en = locales?.en
      if (vi !== undefined) {
        await query(
          `INSERT INTO ai_portal.site_strings (key, locale, value) VALUES ($1, 'vi', $2)
           ON CONFLICT (key, locale) DO UPDATE SET value = $2`,
          [k, String(vi ?? "")]
        )
      }
      if (en !== undefined) {
        await query(
          `INSERT INTO ai_portal.site_strings (key, locale, value) VALUES ($1, 'en', $2)
           ON CONFLICT (key, locale) DO UPDATE SET value = $2`,
          [k, String(en ?? "")]
        )
      }
    }
    const result = await query(
      `SELECT key, locale, value FROM ai_portal.site_strings ORDER BY key, locale`
    )
    const byKey: Record<string, { vi: string; en: string }> = {}
    for (const row of result.rows as { key: string; locale: string; value: string }[]) {
      if (!byKey[row.key]) byKey[row.key] = { vi: "", en: "" }
      if (row.locale === "vi") byKey[row.key].vi = row.value ?? ""
      if (row.locale === "en") byKey[row.key].en = row.value ?? ""
    }
    res.json({ strings: byKey })
  } catch (err: any) {
    console.error("PATCH /api/admin/site-strings error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// ============================================
// Agents Management API
// ============================================

// GET /api/admin/agents/export - Xuất danh sách agents ra JSON (để lưu file và import sau)
router.get("/agents/export", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT alias, icon, base_url, domain_url, is_active, display_order, config_json
       FROM ai_portal.assistants
       ORDER BY display_order ASC, alias ASC`
    )
    const payload = {
      version: 1,
      schema: "ai_portal.assistants",
      exported_at: new Date().toISOString(),
      agents: (result.rows as any[]).map((r) => ({
        alias: r.alias,
        icon: r.icon ?? "Bot",
        base_url: r.base_url,
        domain_url: r.domain_url ?? null,
        is_active: r.is_active !== false,
        display_order: Number(r.display_order) || 0,
        config_json: r.config_json ?? {},
      })),
    }
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Content-Disposition", 'attachment; filename="agents-export.json"')
    res.json(payload)
  } catch (err: any) {
    console.error("GET /agents/export error:", err)
    res.status(500).json({ error: err?.message || "Internal Server Error" })
  }
})

// POST /api/admin/agents/import - Nhập danh sách agents từ file JSON (theo alias: cập nhật nếu đã có, thêm mới nếu chưa)
router.post("/agents/import", adminOnly, async (req: Request, res: Response) => {
  try {
    const body = req.body as { agents?: any[]; version?: number }
    const list = Array.isArray(body?.agents) ? body.agents : []
    if (list.length === 0) {
      return res.status(400).json({ error: "Thiếu hoặc rỗng agents trong body" })
    }
    let count = 0
    for (const a of list) {
      const alias = String(a?.alias ?? "").trim()
      if (!alias) continue
      const icon = String(a?.icon ?? "Bot").trim() || "Bot"
      const base_url = String(a?.base_url ?? "").trim()
      if (!base_url) continue
      const domain_url = a?.domain_url != null ? String(a.domain_url).trim() || null : null
      const is_active = a?.is_active !== false
      const display_order = Number(a?.display_order) || 0
      const config_json = a?.config_json != null ? a.config_json : {}
      await query(
        `INSERT INTO ai_portal.assistants (alias, icon, base_url, domain_url, is_active, display_order, config_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (alias) DO UPDATE SET
           icon = EXCLUDED.icon,
           base_url = EXCLUDED.base_url,
           domain_url = EXCLUDED.domain_url,
           is_active = EXCLUDED.is_active,
           display_order = EXCLUDED.display_order,
           config_json = EXCLUDED.config_json,
           updated_at = now()`,
        [alias, icon, base_url, domain_url, is_active, display_order, JSON.stringify(config_json)]
      )
      count++
    }
    res.json({
      success: true,
      message: `Đã nhập ${count} agent(s). Trùng alias sẽ được cập nhật.`,
      total: count,
    })
  } catch (err: any) {
    console.error("POST /agents/import error:", err)
    res.status(500).json({ error: err?.message || "Internal Server Error" })
  }
})

// GET /api/admin/agents - Lấy danh sách tất cả agents (kèm daily_message_limit, daily_used)
router.get("/agents", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.assistants
       ORDER BY display_order ASC, alias ASC`
    )
    const usageRows = await query(
      `SELECT s.assistant_alias AS alias, COUNT(*)::int AS daily_used
       FROM ai_portal.messages m
       JOIN ai_portal.chat_sessions s ON s.id = m.session_id
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
           FROM ai_portal.agent_test_runs r
           ORDER BY r.run_at DESC`
        : `SELECT r.id, r.run_at, r.total_agents, r.passed_count
           FROM ai_portal.agent_test_runs r
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
         FROM ai_portal.agent_test_results WHERE run_id IN (${placeholders})
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
       FROM ai_portal.assistants
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
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, domain_url, display_order, config_json)
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
          `SELECT config_json FROM ai_portal.assistants WHERE id = $1::uuid LIMIT 1`,
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
      `UPDATE ai_portal.assistants
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

// ─── Công cụ (tools): write, data — tách khỏi bảng agents ───
// GET /api/admin/tools - Danh sách công cụ (từ bảng tools)
router.get("/tools", adminOnly, async (req: Request, res: Response) => {
  try {
    const { ensureDefaultTools } = await import("../lib/tools")
    await ensureDefaultTools()
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools
       ORDER BY display_order ASC, alias ASC`
    )
    const tools = (result.rows as any[]).map((a) => {
      const config = a.config_json ?? {}
      const daily_message_limit = config.daily_message_limit != null ? Number(config.daily_message_limit) : 100
      return {
        ...a,
        daily_message_limit: Number.isInteger(daily_message_limit) && daily_message_limit >= 0 ? daily_message_limit : 100,
      }
    })
    res.json({ tools })
  } catch (err: any) {
    console.error("Error fetching tools:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/tools/:id - Một công cụ theo ID
router.get("/tools/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools
       WHERE id = $1::uuid`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Công cụ không tồn tại" })
    }
    res.json({ tool: result.rows[0] })
  } catch (err: any) {
    console.error("Error fetching tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// PATCH /api/admin/tools/:id - Cập nhật công cụ
router.patch("/tools/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const { base_url, is_active, display_order, config_json } = req.body
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    if (base_url !== undefined) {
      updates.push(`base_url = $${paramIndex++}`)
      values.push(base_url)
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
      `UPDATE ai_portal.tools
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}::uuid
       RETURNING id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at`,
      values
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Công cụ không tồn tại" })
    }
    res.json({ tool: result.rows[0] })
  } catch (err: any) {
    console.error("Error updating tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// Resolve base_url cho internal agents (gọi chính backend) — tránh localhost không reach được trong Docker
function getInternalAgentBaseUrlForTest(alias: string): string {
  const base = (process.env.BACKEND_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/+$/, "")
  const path = alias === "central" ? "main_agent" : `${alias}_agent`
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
        `SELECT id, alias, base_url FROM ai_portal.assistants
         WHERE id::text = ANY($1::text[]) OR alias = ANY($1::text[])
         ORDER BY display_order, alias`,
        [agentIdsFilter]
      )
    } else {
      agentsResult = await query(
        `SELECT id, alias, base_url FROM ai_portal.assistants WHERE is_active = true ORDER BY display_order, alias`
      )
    }
    const agents = agentsResult.rows as { id: string; alias: string; base_url: string }[]
    if (agents.length === 0) {
      send("error", { message: "Không có agent nào được chọn để test" })
      res.end()
      return
    }
    const runResult = await query(
      `INSERT INTO ai_portal.agent_test_runs (total_agents, passed_count) VALUES ($1, 0) RETURNING id, run_at`,
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
      // Agent "central" (trợ lý chính) gọi nội bộ để tránh container không reach được public URL
      const baseUrl =
        agent.alias === "central"
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
        `INSERT INTO ai_portal.agent_test_results
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
      `UPDATE ai_portal.agent_test_runs SET passed_count = $1, total_agents = $2 WHERE id = $3`,
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
      `SELECT id, alias, base_url FROM ai_portal.assistants WHERE is_active = true ORDER BY display_order, alias`
    )
    const agents = agentsResult.rows as { id: string; alias: string; base_url: string }[]

    const runResult = await query(
      `INSERT INTO ai_portal.agent_test_runs (total_agents, passed_count) VALUES ($1, 0) RETURNING id, run_at`,
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
        `INSERT INTO ai_portal.agent_test_results
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
      `UPDATE ai_portal.agent_test_runs SET passed_count = $1 WHERE id = $2`,
      [passedCount, runId]
    )

    const results = await query(
      `SELECT agent_alias, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, error_message
       FROM ai_portal.agent_test_results WHERE run_id = $1 ORDER BY agent_alias`,
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
      `UPDATE ai_portal.assistants
       SET is_active = false, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, alias`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    res.json({ message: "Agent đã được xóa (ẩn). Có thể khôi phục sau.", agent: result.rows[0] })
  } catch (err: any) {
    console.error("Error deleting agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// DELETE /api/admin/agents/:id/permanent - Xóa vĩnh viễn khỏi database (chỉ khi agent đã vô hiệu hóa; không xóa central)
router.delete("/agents/:id/permanent", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const check = await query(
      `SELECT id, alias, is_active FROM ai_portal.assistants WHERE id = $1::uuid`,
      [id]
    )
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    const row = check.rows[0] as { alias: string; is_active: boolean }
    if (row.alias === "central") {
      return res.status(400).json({ error: "Không được xóa vĩnh viễn trợ lý chính (central)" })
    }
    if (row.is_active) {
      return res.status(400).json({ error: "Vui lòng xóa (ẩn) agent trước, sau đó mới xóa vĩnh viễn" })
    }
    await query(`DELETE FROM ai_portal.assistants WHERE id = $1::uuid`, [id])
    res.json({ message: "Đã xóa vĩnh viễn agent khỏi database" })
  } catch (err: any) {
    console.error("Error permanent delete agent:", err)
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
             COALESCE(cs.message_count, (SELECT COUNT(*) FROM ai_portal.messages WHERE session_id = cs.id)) AS message_count
      FROM ai_portal.chat_sessions cs
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
      `SELECT COUNT(*)::int AS total FROM ai_portal.chat_sessions cs ${countWhere}`,
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
       FROM ai_portal.chat_sessions cs
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
                FROM ai_portal.message_attachments ma WHERE ma.message_id = m.id),
               '[]'::json
             ) AS attachments
      FROM ai_portal.messages m
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
        'users' as table_name, COUNT(*)::text as row_count FROM ai_portal.users
      UNION ALL
      SELECT 
        'chat_sessions', COUNT(*)::text FROM ai_portal.chat_sessions
      UNION ALL
      SELECT 
        'messages', COUNT(*)::text FROM ai_portal.messages
      UNION ALL
      SELECT 
        'message_attachments', COUNT(*)::text FROM ai_portal.message_attachments
      UNION ALL
      SELECT 
        'assistants', COUNT(*)::text FROM ai_portal.assistants
      UNION ALL
      SELECT 
        'projects', COUNT(*)::text FROM ai_portal.projects
      UNION ALL
      SELECT 
        'write_articles', COUNT(*)::text FROM ai_portal.write_articles
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

// GET /api/admin/stats/logins-per-day - Số lần đăng nhập mỗi ngày (30 ngày gần nhất)
router.get("/stats/logins-per-day", adminOnly, async (req: Request, res: Response) => {
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

// GET /api/admin/stats/messages-per-day - Số tin nhắn mỗi ngày (30 ngày gần nhất)
router.get("/stats/messages-per-day", adminOnly, async (req: Request, res: Response) => {
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

// GET /api/admin/stats/messages-by-source - Số tin nhắn theo nguồn (web / embed)
router.get("/stats/messages-by-source", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query<{ source: string; count: string }>(
      `
      SELECT COALESCE(s.source, 'web') AS source, COUNT(*)::text AS count
      FROM ai_portal.messages m
      JOIN ai_portal.chat_sessions s ON s.id = m.session_id
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
      SELECT COALESCE(s.assistant_alias, 'central') AS assistant_alias, COUNT(*)::text AS count
      FROM ai_portal.messages m
      JOIN ai_portal.chat_sessions s ON s.id = m.session_id
      GROUP BY s.assistant_alias
      ORDER BY count DESC
      `
    )
    const data = result.rows.map((r) => ({ assistant_alias: r.assistant_alias || "central", count: parseInt(r.count, 10) }))
    res.json({ data })
  } catch (err: any) {
    console.error("Error fetching messages-by-agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: allowAdmin ? err.message : undefined })
  }
})

// GET /api/admin/feedback - Danh sách góp ý hệ thống (user_feedback)
router.get("/feedback", adminOnly, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)
    const resolved = req.query.resolved as string | undefined
    const conditions: string[] = []
    const params: unknown[] = []
    if (resolved === "true") {
      conditions.push("uf.resolved = true")
    } else if (resolved === "false") {
      conditions.push("(uf.resolved = false OR uf.resolved IS NULL)")
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    const sql = `
      SELECT uf.id, uf.user_id, uf.content, uf.assistant_alias, uf.created_at,
             uf.admin_note, uf.resolved, uf.resolved_at, uf.resolved_by,
             u.email AS user_email, u.display_name AS user_display_name
      FROM ai_portal.user_feedback uf
      JOIN ai_portal.users u ON u.id = uf.user_id
      ${where}
      ORDER BY uf.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const countSql = `
      SELECT COUNT(*)::int AS total FROM ai_portal.user_feedback uf ${where}
    `
    const listParams = [...params, limit, offset]
    const [rowsResult, countResult] = await Promise.all([
      query(sql, listParams),
      query(countSql, params),
    ])
    const total = (countResult.rows[0] as { total: number })?.total ?? 0
    res.json({ data: rowsResult.rows, page: { limit, offset, total } })
  } catch (err: any) {
    console.error("GET /api/admin/feedback error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// PATCH /api/admin/feedback/:id - Cập nhật ghi chú, đánh dấu đã xử lý
router.patch("/feedback/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" })
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) return res.status(503).json({ error: "NEXTAUTH_SECRET chưa cấu hình" })
    const cookies = parseCookies(req.headers.cookie)
    const token = await getToken({ req: { cookies, headers: req.headers } as any, secret })
    const adminUserId = (token as { id?: string })?.id ?? null
    const body = req.body as { admin_note?: string | null; resolved?: boolean }
    const updates: string[] = []
    const params: unknown[] = []
    let idx = 1
    if (body.admin_note !== undefined) {
      updates.push(`admin_note = $${idx}`)
      params.push(body.admin_note === null || body.admin_note === "" ? null : String(body.admin_note).trim().slice(0, 2000))
      idx++
    }
    if (body.resolved !== undefined) {
      updates.push(`resolved = $${idx}`)
      params.push(!!body.resolved)
      idx++
      updates.push(`resolved_at = $${idx}`)
      params.push(body.resolved ? new Date() : null)
      idx++
      updates.push(`resolved_by = $${idx}`)
      params.push(body.resolved && adminUserId ? adminUserId : null)
      idx++
    }
    if (updates.length === 0) return res.status(400).json({ error: "Cần admin_note hoặc resolved" })
    params.push(id)
    await query(
      `UPDATE ai_portal.user_feedback SET ${updates.join(", ")} WHERE id = $${idx}::uuid`,
      params
    )
    const row = await query(
      `SELECT id, admin_note, resolved, resolved_at, resolved_by FROM ai_portal.user_feedback WHERE id = $1::uuid`,
      [id]
    )
    res.json({ feedback: row.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/admin/feedback/:id error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// GET /api/admin/message-feedback - Góp ý khi dislike tin nhắn (có comment), full context
router.get("/message-feedback", adminOnly, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    const offset = Math.max(Number(req.query.offset ?? 0), 0)
    const assistantAlias = req.query.assistant_alias as string | undefined
    const resolved = req.query.resolved as string | undefined
    const conditions: string[] = ["mf.feedback = 'dislike'", "mf.comment IS NOT NULL", "mf.comment != ''"]
    const params: unknown[] = []
    if (resolved === "true") conditions.push("mf.resolved = true")
    else if (resolved === "false") conditions.push("(mf.resolved = false OR mf.resolved IS NULL)")
    if (assistantAlias && assistantAlias.trim()) {
      conditions.push("cs.assistant_alias = $" + (params.length + 1))
      params.push(assistantAlias.trim())
    }
    const where = `WHERE ${conditions.join(" AND ")}`
    params.push(limit, offset)
    const pLen = params.length
    const sql = `
      SELECT mf.message_id, mf.user_id, mf.comment, mf.created_at,
             mf.admin_note, mf.resolved, mf.resolved_at, mf.resolved_by,
             cs.id AS session_id, cs.assistant_alias, cs.title AS session_title, cs.created_at AS session_created_at,
             u.email AS user_email, u.display_name AS user_display_name,
             m_assist.id AS disliked_message_id, m_assist.content AS disliked_content, m_assist.created_at AS disliked_at
      FROM ai_portal.message_feedback mf
      JOIN ai_portal.messages m_assist ON m_assist.id = mf.message_id AND m_assist.role = 'assistant'
      JOIN ai_portal.chat_sessions cs ON cs.id = m_assist.session_id
      JOIN ai_portal.users u ON u.id = mf.user_id
      ${where}
      ORDER BY mf.created_at DESC
      LIMIT $${pLen - 1} OFFSET $${pLen}
    `
    const rowsResult = await query(sql, params)
    const rows = rowsResult.rows as Array<{
      message_id: string
      user_id: string
      comment: string
      created_at: string
      admin_note: string | null
      resolved: boolean
      session_id: string
      user_email: string
      user_display_name: string | null
      assistant_alias: string
      session_title: string | null
      session_created_at: string
      disliked_message_id: string
      disliked_content: string | null
      disliked_at: string
    }>
    const sessionIds = [...new Set(rows.map((r) => r.session_id))]
    let sessionMessages: Record<string, Array<{ id: string; role: string; content: string | null; created_at: string }>> = {}
    if (sessionIds.length > 0) {
      const msgsResult = await query(
        `SELECT m.id, m.session_id, m.role, m.content, m.created_at
         FROM ai_portal.messages m
         WHERE m.session_id = ANY($1::uuid[])
         ORDER BY m.session_id, m.created_at ASC`,
        [sessionIds]
      )
      for (const m of msgsResult.rows as Array<{ id: string; session_id: string; role: string; content: string | null; created_at: string }>) {
        if (!sessionMessages[m.session_id]) sessionMessages[m.session_id] = []
        sessionMessages[m.session_id].push({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })
      }
    }
    const data = rows.map((r) => ({
      message_id: r.message_id,
      user_id: r.user_id,
      session_id: r.session_id,
      user_email: r.user_email,
      user_display_name: r.user_display_name,
      comment: r.comment,
      created_at: r.created_at,
      admin_note: r.admin_note,
      resolved: !!r.resolved,
      assistant_alias: r.assistant_alias,
      session_title: r.session_title,
      session_created_at: r.session_created_at,
      disliked_message_id: r.disliked_message_id,
      disliked_message: { id: r.disliked_message_id, content: r.disliked_content, created_at: r.disliked_at },
      session_messages: sessionMessages[r.session_id] ?? [],
    }))
    const countParams = params.slice(0, -2)
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM ai_portal.message_feedback mf
       JOIN ai_portal.messages m_assist ON m_assist.id = mf.message_id AND m_assist.role = 'assistant'
       JOIN ai_portal.chat_sessions cs ON cs.id = m_assist.session_id
       ${where}`,
      countParams
    )
    const total = (countResult.rows[0] as { total: number })?.total ?? 0
    res.json({ data, page: { limit, offset, total } })
  } catch (err: any) {
    console.error("GET /api/admin/message-feedback error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// PATCH /api/admin/message-feedback/:messageId/:userId - Cập nhật ghi chú, đánh dấu đã xử lý
router.patch("/message-feedback/:messageId/:userId", adminOnly, async (req: Request, res: Response) => {
  try {
    const messageId = String(req.params.messageId).trim()
    const userId = String(req.params.userId).trim()
    if (!UUID_RE.test(messageId) || !UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid messageId or userId" })
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) return res.status(503).json({ error: "NEXTAUTH_SECRET chưa cấu hình" })
    const cookies = parseCookies(req.headers.cookie)
    const token = await getToken({ req: { cookies, headers: req.headers } as any, secret })
    const adminUserId = (token as { id?: string })?.id ?? null
    const body = req.body as { admin_note?: string | null; resolved?: boolean }
    const updates: string[] = []
    const params: unknown[] = []
    let idx = 1
    if (body.admin_note !== undefined) {
      updates.push(`admin_note = $${idx}`)
      params.push(body.admin_note === null || body.admin_note === "" ? null : String(body.admin_note).trim().slice(0, 2000))
      idx++
    }
    if (body.resolved !== undefined) {
      updates.push(`resolved = $${idx}`)
      params.push(!!body.resolved)
      idx++
      updates.push(`resolved_at = $${idx}`)
      params.push(body.resolved ? new Date() : null)
      idx++
      updates.push(`resolved_by = $${idx}`)
      params.push(body.resolved && adminUserId ? adminUserId : null)
      idx++
    }
    if (updates.length === 0) return res.status(400).json({ error: "Cần admin_note hoặc resolved" })
    params.push(messageId, userId)
    await query(
      `UPDATE ai_portal.message_feedback SET ${updates.join(", ")}
       WHERE message_id = $${idx}::uuid AND user_id = $${idx + 1}::uuid`,
      params
    )
    const row = await query(
      `SELECT message_id, user_id, admin_note, resolved, resolved_at, resolved_by
       FROM ai_portal.message_feedback WHERE message_id = $1::uuid AND user_id = $2::uuid`,
      [messageId, userId]
    )
    res.json({ feedback: row.rows[0] })
  } catch (err: any) {
    console.error("PATCH /api/admin/message-feedback/:messageId/:userId error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// DELETE /api/admin/message-feedback/:messageId/:userId - Xóa góp ý dislike
router.delete("/message-feedback/:messageId/:userId", adminOnly, async (req: Request, res: Response) => {
  try {
    const messageId = String(req.params.messageId).trim()
    const userId = String(req.params.userId).trim()
    if (!UUID_RE.test(messageId) || !UUID_RE.test(userId)) return res.status(400).json({ error: "Invalid messageId or userId" })
    const result = await query(
      `DELETE FROM ai_portal.message_feedback WHERE message_id = $1::uuid AND user_id = $2::uuid`,
      [messageId, userId]
    )
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: "Góp ý không tồn tại" })
    res.json({ success: true })
  } catch (err: any) {
    console.error("DELETE /api/admin/message-feedback/:messageId/:userId error:", err)
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

// GET /api/admin/stats/online-users - Số tài khoản đang trực tuyến
// Đếm: (1) hoạt động chat (updated_at hoặc created_at session) trong X phút, HOẶC (2) đăng nhập trong Y phút (rộng hơn)
const ONLINE_ACTIVITY_MINUTES = 15
const ONLINE_LOGIN_MINUTES = 60
router.get("/stats/online-users", adminOnly, async (req: Request, res: Response) => {
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
