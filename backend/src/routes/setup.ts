// setup.ts – API cài đặt lần đầu (branding → DB → admin)
// Không yêu cầu auth. Chỉ cho phép khi needsSetup.
// Database name được tạo từ tên hệ thống (slug), không bắt buộc cấu hình POSTGRES_DB trong .env.
import { Router, Request, Response } from "express"
import { query, resetPool } from "../lib/db"
import path from "path"
import fs from "fs"
import { spawnSync } from "child_process"
import crypto from "crypto"
import { Pool } from "pg"

const router = Router()

const BACKEND_ROOT = path.join(__dirname, "..", "..")
const DATA_DIR = path.join(BACKEND_ROOT, "data")
const BRANDING_FILE = path.join(DATA_DIR, "setup-branding.json")
const SETUP_DB_FILE = path.join(DATA_DIR, "setup-db.json")

/** Đường dẫn schema.sql (nằm trong thư mục backend). */
function getSchemaPath(): string {
  return path.join(BACKEND_ROOT, "schema.sql")
}

const isTrue = (v?: string) => String(v).toLowerCase() === "true"

/**
 * Tên database từ tên hệ thống: không dấu cách, ký tự ngoài bảng chữ cái Anh → chữ Anh tương ứng.
 * VD: "Nghiên cứu" → "nghien_cuu", "AI Portal" → "ai_portal".
 */
function slugify(s: string): string {
  let t = s.trim()
  if (!t) return "app"
  t = t.replace(/đ/g, "d").replace(/Đ/g, "D")
  t = t.normalize("NFD").replace(/\p{M}/gu, "")
  t = t.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  return t || "app"
}

function readSetupDbName(): string | null {
  try {
    if (fs.existsSync(SETUP_DB_FILE)) {
      const raw = fs.readFileSync(SETUP_DB_FILE, "utf8")
      const data = JSON.parse(raw) as { databaseName?: string }
      if (typeof data.databaseName === "string" && data.databaseName.trim()) return data.databaseName.trim()
    }
  } catch {}
  return null
}

/** Database mặc định để kết nối khi kiểm tra pg_database (luôn dùng "postgres", không dùng POSTGRES_DB để tránh Docker env POSTGRES_DB=ai_portal gây FATAL). */
const MAINTENANCE_DB = "postgres"

/** Kiểm tra database có tồn tại không (kết nối vào postgres, không vào DB đích → tránh log FATAL "database does not exist"). */
async function databaseExists(dbName: string): Promise<boolean> {
  const p = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: MAINTENANCE_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: isTrue(process.env.POSTGRES_SSL) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10_000,
  })
  try {
    const client = await p.connect()
    try {
      const r = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName])
      return r.rows.length > 0
    } finally {
      client.release()
    }
  } finally {
    await p.end()
  }
}

/** Chạy query với database name bất kỳ (dùng cho setup, không dùng pool mặc định). */
async function queryWithDb<T = any>(database: string, text: string, params?: any[]): Promise<{ rows: T[] }> {
  const p = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: isTrue(process.env.POSTGRES_SSL) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10_000,
  })
  try {
    const client = await p.connect()
    try {
      const result = await client.query<T>(text, params)
      return { rows: result.rows }
    } finally {
      client.release()
    }
  } finally {
    await p.end()
  }
}

export type Branding = { systemName: string; logoDataUrl?: string }

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readBranding(): Branding | null {
  ensureDataDir()
  if (!fs.existsSync(BRANDING_FILE)) return null
  try {
    const raw = fs.readFileSync(BRANDING_FILE, "utf8")
    const data = JSON.parse(raw) as { systemName?: string; logoDataUrl?: string }
    const name = typeof data.systemName === "string" ? data.systemName.trim() : ""
    if (!name) return null
    return { systemName: name, logoDataUrl: typeof data.logoDataUrl === "string" ? data.logoDataUrl : undefined }
  } catch {
    return null
  }
}

/** Ghi branding vào DB (app_settings + site_strings app.shortName) sau khi đã khởi tạo schema. */
async function saveBrandingToDb(branding: Branding): Promise<void> {
  await query(
    `INSERT INTO ai_portal.app_settings (key, value) VALUES ('system_name', $1), ('logo_data_url', $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [branding.systemName, branding.logoDataUrl ?? ""]
  )
  await query(
    `UPDATE ai_portal.site_strings SET value = $1 WHERE key = 'app.shortName'`,
    [branding.systemName]
  )
}

/** Lỗi do chưa có database / schema (trong lúc cài đặt) — không trả message kỹ thuật ra client. */
function isDbMissingError(msg: string): boolean {
  if (!msg || typeof msg !== "string") return false
  return /database\s+["'].*["']?\s+does not exist/i.test(msg) || /database .* does not exist/i.test(msg)
}

export type SetupStatus = {
  needsSetup: boolean
  step?: "branding" | "database" | "admin"
  /** Tên database dự định (từ tên hệ thống) khi step === "database". */
  databaseName?: string
}

/**
 * GET /api/setup/status
 * Trả về { needsSetup, step? }.
 * - needsSetup true, step "branding": chưa đặt tên/logo → cần POST /api/setup/branding.
 * - needsSetup true, step "database": chưa có schema ai_portal → cần chạy init-database.
 * - needsSetup true, step "admin": đã có schema nhưng chưa có user is_admin → cần create-admin.
 * - needsSetup false: đã cài xong.
 */
router.get("/status", async (_req: Request, res: Response) => {
  const branding = readBranding()
  if (!branding) {
    return res.json({ needsSetup: true, step: "branding" } as SetupStatus)
  }

  const dbName = readSetupDbName() || slugify(branding.systemName)

  try {
    const exists = await databaseExists(dbName)
    if (!exists) {
      return res.json({ needsSetup: true, step: "database", databaseName: slugify(branding.systemName) } as SetupStatus)
    }

    const schemaCheck = await queryWithDb<{ exists: string }>(
      dbName,
      `SELECT COUNT(*) AS exists FROM information_schema.schemata WHERE schema_name = 'ai_portal'`
    )
    const schemaExists = Number(schemaCheck.rows[0]?.exists ?? 0) > 0
    if (!schemaExists) {
      return res.json({ needsSetup: true, step: "database", databaseName: slugify(branding.systemName) } as SetupStatus)
    }

    const adminCountResult = await queryWithDb<{ count: string }>(
      dbName,
      `SELECT COUNT(*) AS count FROM ai_portal.users WHERE is_admin = true`
    )
    const adminCount = Number(adminCountResult.rows[0]?.count ?? 0)
    if (adminCount === 0) {
      return res.json({ needsSetup: true, step: "admin" } as SetupStatus)
    }

    return res.json({ needsSetup: false } as SetupStatus)
  } catch (err: any) {
    const msg = err?.message ?? ""
    const hideMsg = isDbMissingError(msg)
    if (!hideMsg) console.error("GET /api/setup/status error:", err)
    res.status(500).json({
      needsSetup: true,
      step: "database",
      databaseName: slugify(branding.systemName),
      error: hideMsg ? undefined : (msg || "Lỗi kiểm tra trạng thái"),
    })
  }
})

/**
 * GET /api/setup/branding
 * Trả về { systemName, logoDataUrl? } từ DB (app_settings) hoặc từ file (khi chưa có DB).
 * Dùng cho trang setup và cho app hiển thị tên/logo (app.shortName đã sync trong site_strings).
 */
router.get("/branding", async (_req: Request, res: Response) => {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM ai_portal.app_settings WHERE key IN ('system_name', 'logo_data_url')`
    )
    const map = Object.fromEntries(rows.rows.map((r) => [r.key, r.value]))
    const systemName = (map.system_name ?? "").trim()
    if (systemName) {
      return res.json({
        systemName,
        logoDataUrl: (map.logo_data_url ?? "").trim() || undefined,
      })
    }
  } catch {
    // DB chưa sẵn sàng hoặc chưa có dữ liệu → đọc từ file
  }
  const branding = readBranding()
  if (!branding) {
    return res.json({ systemName: "", logoDataUrl: undefined })
  }
  res.json({ systemName: branding.systemName, logoDataUrl: branding.logoDataUrl ?? undefined })
})

/**
 * POST /api/setup/branding
 * Body: { system_name: string, logo?: string } (logo = data URL hoặc URL ảnh).
 * Lưu vào data/setup-branding.json (Bước 1, chưa có DB). Sau Bước 2 (init-database) sẽ được ghi vào DB (app_settings + site_strings app.shortName).
 */
router.post("/branding", (req: Request, res: Response) => {
  const { system_name, logo } = req.body ?? {}
  const systemName = typeof system_name === "string" ? system_name.trim() : ""
  if (!systemName) {
    return res.status(400).json({ error: "Tên hệ thống không được để trống." })
  }
  const logoDataUrl = typeof logo === "string" && logo.length > 0 ? logo : undefined
  ensureDataDir()
  fs.writeFileSync(
    BRANDING_FILE,
    JSON.stringify({ systemName, logoDataUrl: logoDataUrl ?? null }, null, 2),
    "utf8"
  )
  res.json({ ok: true, message: "Đã lưu tên và logo. Chuyển sang bước thiết lập database." })
})

/** Chuỗi hợp lệ cho tên database PostgreSQL: chỉ chữ thường, số, gạch dưới, 1–63 ký tự. */
const DB_NAME_REGEX = /^[a-z0-9_]{1,63}$/

/**
 * POST /api/setup/init-database
 * Tạo database. Body có thể gửi database_name (tùy chọn); nếu không gửi hoặc không hợp lệ thì dùng slug(tên hệ thống).
 */
router.post("/init-database", async (req: Request, res: Response) => {
  try {
    const branding = readBranding()
    if (!branding) {
      return res.status(400).json({
        error: "Chưa có tên hệ thống. Hoàn thành Bước 1 (đặt tên và logo) trước.",
      })
    }

    const rawDbName = typeof req.body?.database_name === "string" ? req.body.database_name.trim() : ""
    const dbName = rawDbName && DB_NAME_REGEX.test(rawDbName)
      ? rawDbName
      : slugify(branding.systemName)
    const host = process.env.POSTGRES_HOST ?? "localhost"
    const port = process.env.POSTGRES_PORT ?? "5432"
    const user = process.env.POSTGRES_USER ?? "postgres"
    const password = process.env.POSTGRES_PASSWORD ?? ""

    const forceRecreate = req.body?.force_recreate === true
    let schemaExists = false
    try {
      const schemaCheck = await queryWithDb<{ exists: string }>(
        dbName,
        `SELECT COUNT(*) AS exists FROM information_schema.schemata WHERE schema_name = 'ai_portal'`
      )
      schemaExists = Number(schemaCheck.rows[0]?.exists ?? 0) > 0
      if (schemaExists && !forceRecreate) {
        return res.status(200).json({
          ok: true,
          alreadyInitialized: true,
          message: "Database đã được khởi tạo. Không cần chạy lại. Bạn có thể chuyển sang bước 3 hoặc tạo lại database.",
        })
      }
      if (schemaExists && forceRecreate) {
        await queryWithDb(dbName, "DROP SCHEMA IF EXISTS ai_portal CASCADE")
      }
    } catch {
      // Database chưa tồn tại hoặc chưa có schema → tiếp tục tạo
    }

    const poolDefault = new Pool({
      host,
      port: Number(port),
      database: MAINTENANCE_DB,
      user,
      password,
      ssl: isTrue(process.env.POSTGRES_SSL) ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10_000,
    })
    try {
      const client = await poolDefault.connect()
      try {
        const exists = await client.query(
          "SELECT 1 FROM pg_database WHERE datname = $1",
          [dbName]
        )
        if (exists.rows.length === 0) {
          await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`)
        }
      } finally {
        client.release()
      }
    } finally {
      await poolDefault.end()
    }

    const schemaPath = getSchemaPath()
    if (!fs.existsSync(schemaPath)) {
      return res.status(500).json({
        error: `Không tìm thấy schema.sql tại ${schemaPath}. Đảm bảo file backend/schema.sql tồn tại.`,
      })
    }

    const result = spawnSync(
      "psql",
      ["-h", host, "-p", String(port), "-d", dbName, "-U", user, "-f", schemaPath, "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        env: { ...process.env, PGPASSWORD: password },
        timeout: 120_000,
      }
    )
    if (result.error) {
      return res.status(503).json({
        error: "Không chạy được psql (có thể chưa cài). Cần PostgreSQL client (psql) để khởi tạo schema.",
        message: result.error.message,
      })
    }
    if (result.status !== 0) {
      return res.status(500).json({
        error: "Lỗi khi chạy schema.sql",
        message: result.stderr || result.stdout || String(result.status),
      })
    }

    ensureDataDir()
    fs.writeFileSync(SETUP_DB_FILE, JSON.stringify({ databaseName: dbName }, null, 2), "utf8")
    resetPool()

    try {
      await saveBrandingToDb(branding)
    } catch (e) {
      console.error("Lưu branding vào DB:", e)
    }

    res.json({
      ok: true,
      message: `Đã tạo database "${dbName}" và khởi tạo schema. Bước tiếp theo: tạo tài khoản quản trị.`,
    })
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    const hideMsg = isDbMissingError(msg)
    if (!hideMsg) console.error("POST /api/setup/init-database error:", err)
    const detail = hideMsg ? undefined : msg
    res.status(500).json({
      error: detail ? `Lỗi khởi tạo database: ${detail}` : "Lỗi khởi tạo database",
      message: detail,
    })
  }
})

/**
 * POST /api/setup/create-admin
 * Tạo tài khoản admin đầu tiên. Chỉ cho phép khi chưa có user nào is_admin = true.
 * Body: { email: string, password: string, display_name?: string }
 */
router.post("/create-admin", async (req: Request, res: Response) => {
  try {
    const adminCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ai_portal.users WHERE is_admin = true`
    )
    const adminCount = Number((adminCountResult.rows[0] as { count: string })?.count ?? 0)
    if (adminCount > 0) {
      return res.status(400).json({
        error: "Đã có tài khoản quản trị. Không thể tạo thêm từ trang cài đặt.",
      })
    }

    const { email, password, display_name } = req.body ?? {}
    const emailNorm = typeof email === "string" ? email.trim().toLowerCase() : ""
    const pwd = typeof password === "string" ? password : ""
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ error: "Email không hợp lệ." })
    }
    if (pwd.length < 6) {
      return res.status(400).json({ error: "Mật khẩu tối thiểu 6 ký tự." })
    }

    const { hashPassword } = await import("../lib/password")
    const displayName = typeof display_name === "string" ? display_name.trim() || emailNorm.split("@")[0] : emailNorm.split("@")[0]
    const id = crypto.randomUUID()

    await query(
      `INSERT INTO ai_portal.users (id, email, display_name, password_hash, password_algo, password_updated_at, is_admin, role, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, 'scrypt', now(), true, 'admin', now(), now())`,
      [id, emailNorm, displayName, hashPassword(pwd)]
    )

    res.json({
      ok: true,
      message: "Đã tạo tài khoản quản trị. Bạn có thể đăng nhập bằng email và mật khẩu vừa đặt.",
    })
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    const hideMsg = isDbMissingError(msg)
    if (!hideMsg) console.error("POST /api/setup/create-admin error:", err)
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return res.status(400).json({ error: "Email này đã được sử dụng." })
    }
    res.status(500).json({
      error: "Lỗi tạo tài khoản",
      message: hideMsg ? undefined : msg,
    })
  }
})

/**
 * POST /api/setup/central-assistant
 * Bước 4 (tùy chọn): dù chọn "Cấu hình sau", "ChatGPT" hay "Gemini" đều tạo/đảm bảo Trợ lý chính (alias central).
 * Lưu provider + API key vào app_settings và INSERT agent central nếu chưa có.
 * Chỉ cho phép khi đã có ít nhất một admin.
 * Body: { provider: "openai" | "gemini" | "skip", api_key?: string }
 */
router.post("/central-assistant", async (req: Request, res: Response) => {
  try {
    const adminCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ai_portal.users WHERE is_admin = true`
    )
    const adminCount = Number((adminCountResult.rows[0] as { count: string })?.count ?? 0)
    if (adminCount === 0) {
      return res.status(400).json({ error: "Hoàn thành bước tạo tài khoản quản trị trước." })
    }

    const provider = (req.body?.provider === "openai" || req.body?.provider === "gemini" || req.body?.provider === "skip")
      ? req.body.provider
      : "skip"
    const apiKey = typeof req.body?.api_key === "string" ? req.body.api_key.trim() : ""

    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [provider]
    )
    if (provider !== "skip" && apiKey) {
      await query(
        `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_api_key', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [apiKey]
      )
    }

    // Luôn tạo/đảm bảo Trợ lý chính (alias central) khi hoàn thành bước 4 (công cụ write/data nằm ở bảng tools, được ensure khi gọi GET /api/tools)
    const centralBaseUrl = process.env.MAIN_AGENT_BASE_URL || "http://localhost:3001/api/main_agent/v1"
    await query(
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, domain_url, is_active, display_order, config_json, updated_at)
       VALUES ('central', 'Bot', $1, NULL, true, 0, '{"isInternal": true}'::jsonb, now())
       ON CONFLICT (alias) DO UPDATE SET
         is_active = true,
         config_json = COALESCE(assistants.config_json, '{}'::jsonb) || '{"isInternal": true}'::jsonb,
         updated_at = now()`,
      [centralBaseUrl]
    )

    res.json({ ok: true, message: "Đã lưu cấu hình trợ lý chính (Central) và tạo Trợ lý chính. Công cụ (Viết bài, Dữ liệu) quản lý tại Admin → Công cụ." })
  } catch (err: any) {
    console.error("POST /api/setup/central-assistant error:", err)
    res.status(500).json({ error: "Lỗi lưu cấu hình", message: err?.message })
  }
})

export default router
