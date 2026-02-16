// setup.ts – API cài đặt lần đầu (branding → DB → admin)
// Không yêu cầu auth. Chỉ cho phép khi needsSetup.
// Kết nối Postgres chỉ dùng biến môi trường (getBootstrapEnv).
import { Router, Request, Response } from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import os from "os"
import { spawnSync } from "child_process"
import crypto from "crypto"
import { Pool, QueryResultRow } from "pg"
import AdmZip from "adm-zip"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { query, resetPool } from "../lib/db"
import { getBootstrapEnv, getSetting } from "../lib/settings"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } }) // 512MB max

const BACKEND_ROOT = path.join(__dirname, "..", "..")
const DATA_DIR = path.join(BACKEND_ROOT, "data")
const BRANDING_FILE = path.join(DATA_DIR, "setup-branding.json")
const SETUP_DB_FILE = path.join(DATA_DIR, "setup-db.json")
const SETUP_LANGUAGE_FILE = path.join(DATA_DIR, "setup-language.json")

const ALLOWED_SETUP_LOCALES = ["en", "vi", "zh", "ja", "fr"]

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

/** Ngôn ngữ mặc định chọn trong setup (bước 1). Trả về null nếu chưa chọn. */
function readSetupLanguage(): { defaultLocale: string } | null {
  ensureDataDir()
  if (!fs.existsSync(SETUP_LANGUAGE_FILE)) return null
  try {
    const raw = fs.readFileSync(SETUP_LANGUAGE_FILE, "utf8")
    const data = JSON.parse(raw) as { defaultLocale?: string }
    const loc = typeof data.defaultLocale === "string" ? data.defaultLocale.trim().toLowerCase() : ""
    if (loc && ALLOWED_SETUP_LOCALES.includes(loc)) return { defaultLocale: loc }
  } catch {}
  return null
}

/** Database mặc định để kết nối khi kiểm tra pg_database (luôn dùng "postgres", không dùng POSTGRES_DB để tránh Docker env POSTGRES_DB=ai_portal gây FATAL). */
const MAINTENANCE_DB = "postgres"

/** Kiểm tra database có tồn tại không (kết nối vào postgres, không vào DB đích → tránh log FATAL "database does not exist"). */
async function databaseExists(dbName: string): Promise<boolean> {
  const p = new Pool({
    host: getBootstrapEnv("POSTGRES_HOST", "localhost"),
    port: Number(getBootstrapEnv("POSTGRES_PORT", "5432")),
    database: MAINTENANCE_DB,
    user: getBootstrapEnv("POSTGRES_USER", "postgres"),
    password: getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres",
    ssl: isTrue(getBootstrapEnv("POSTGRES_SSL")) ? { rejectUnauthorized: false } : undefined,
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
async function queryWithDb<T extends QueryResultRow = QueryResultRow>(database: string, text: string, params?: any[]): Promise<{ rows: T[] }> {
  const p = new Pool({
    host: getBootstrapEnv("POSTGRES_HOST", "localhost"),
    port: Number(getBootstrapEnv("POSTGRES_PORT", "5432")),
    database,
    user: getBootstrapEnv("POSTGRES_USER", "postgres"),
    password: getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres",
    ssl: isTrue(getBootstrapEnv("POSTGRES_SSL")) ? { rejectUnauthorized: false } : undefined,
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

/** Ghi branding vào DB (app_settings). Chuỗi hiển thị theo ngôn ngữ nằm trong gói locale (data/locales), không dùng site_strings. */
async function saveBrandingToDb(branding: Branding): Promise<void> {
  await query(
    `INSERT INTO ai_portal.app_settings (key, value) VALUES ('system_name', $1), ('logo_data_url', $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [branding.systemName, branding.logoDataUrl ?? ""]
  )
}

/** Lỗi do chưa có database / schema (trong lúc cài đặt) — không trả message kỹ thuật ra client. */
function isDbMissingError(msg: string): boolean {
  if (!msg || typeof msg !== "string") return false
  return /database\s+["'].*["']?\s+does not exist/i.test(msg) || /database .* does not exist/i.test(msg)
}

export type SetupStatus = {
  needsSetup: boolean
  step?: "language" | "branding" | "database" | "admin"
  /** Tên database dự định (từ tên hệ thống) khi step === "database". */
  databaseName?: string
}

/**
 * GET /api/setup/status
 * Trả về { needsSetup, step? }.
 * - needsSetup true, step "language": chưa chọn ngôn ngữ → cần POST /api/setup/language.
 * - needsSetup true, step "branding": chưa đặt tên/logo → cần POST /api/setup/branding.
 * - needsSetup true, step "database": chưa có schema ai_portal → cần chạy init-database.
 * - needsSetup true, step "admin": đã có schema nhưng chưa có user is_admin → cần create-admin.
 * - needsSetup false: đã cài xong.
 */
router.get("/status", async (_req: Request, res: Response) => {
  const language = readSetupLanguage()
  if (!language) {
    return res.json({ needsSetup: true, step: "language" } as SetupStatus)
  }
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
 * POST /api/setup/language
 * Bước 1 setup: chọn ngôn ngữ mặc định. Body: { default_locale: string } (en, vi, zh, ja, fr).
 */
router.post("/language", async (req: Request, res: Response) => {
  try {
    const loc = typeof req.body?.default_locale === "string" ? req.body.default_locale.trim().toLowerCase() : ""
    if (!loc || !ALLOWED_SETUP_LOCALES.includes(loc)) {
      return res.status(400).json({
        error: "Invalid default_locale",
        message: `Choose one of: ${ALLOWED_SETUP_LOCALES.join(", ")}`,
      })
    }
    ensureDataDir()
    fs.writeFileSync(
      SETUP_LANGUAGE_FILE,
      JSON.stringify({ defaultLocale: loc }, null, 2),
      "utf8"
    )
    return res.json({ ok: true, default_locale: loc })
  } catch (err: any) {
    console.error("POST /api/setup/language error:", err)
    res.status(500).json({ error: "Failed to save language", message: err?.message })
  }
})

/**
 * GET /api/setup/language
 * Trả về { defaultLocale } đã chọn trong setup (từ file), hoặc { defaultLocale: "en" } nếu chưa có.
 */
router.get("/language", (_req: Request, res: Response) => {
  const lang = readSetupLanguage()
  res.json({ defaultLocale: lang?.defaultLocale ?? "en" })
})

/**
 * GET /api/setup/branding
 * Trả về { systemName, logoDataUrl? } từ DB (app_settings) hoặc từ file (khi chưa có DB).
 * Dùng cho trang setup và cho app hiển thị tên/logo (system_name trong app_settings).
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
 * Lưu vào data/setup-branding.json (Bước 1, chưa có DB). Sau Bước 2 (init-database) sẽ được ghi vào DB (app_settings).
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
    const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
    const port = getBootstrapEnv("POSTGRES_PORT", "5432")
    const user = getBootstrapEnv("POSTGRES_USER", "postgres")
    const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres"

    const forceRecreate = req.body?.force_recreate === true
    let schemaExists = false
    try {
      const schemaCheck = await queryWithDb<{ exists: string }>(
        dbName,
        `SELECT COUNT(*) AS exists FROM information_schema.schemata WHERE schema_name = 'ai_portal'`
      )
      schemaExists = Number(schemaCheck.rows[0]?.exists ?? 0) > 0
      if (schemaExists && !forceRecreate) {
        // Schema có nhưng có thể init dở dang (thiếu bảng users) → kiểm tra bảng quan trọng
        const tablesCheck = await queryWithDb<{ cnt: string }>(
          dbName,
          `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = 'ai_portal' AND table_name = 'users'`
        )
        const hasUsersTable = Number(tablesCheck.rows[0]?.cnt ?? 0) > 0
        if (hasUsersTable) {
          return res.status(200).json({
            ok: true,
            alreadyInitialized: true,
            message: "Database đã được khởi tạo. Không cần chạy lại. Bạn có thể chuyển sang bước 3 hoặc tạo lại database.",
          })
        }
        // Schema tồn tại nhưng thiếu bảng users (init dở dang) → drop và chạy lại schema.sql
        await queryWithDb(dbName, "DROP SCHEMA IF EXISTS ai_portal CASCADE")
        schemaExists = false
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
ssl: isTrue(getBootstrapEnv("POSTGRES_SSL")) ? { rejectUnauthorized: false } : undefined,
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

    const setupLang = readSetupLanguage()
    if (setupLang?.defaultLocale) {
      try {
        await query(
          `INSERT INTO ai_portal.app_settings (key, value) VALUES ('default_locale', $1)
           ON CONFLICT (key) DO UPDATE SET value = $1`,
          [setupLang.defaultLocale]
        )
      } catch (e) {
        console.error("Lưu default_locale vào DB:", e)
      }
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
    const code = err?.code as string | undefined
    const hideMsg = isDbMissingError(msg)
    if (!hideMsg) console.error("POST /api/setup/create-admin error:", err)
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return res.status(400).json({ error: "Email này đã được sử dụng." })
    }
    // Bảng users chưa tồn tại (42P01) → cần chạy Bước 2 Khởi tạo database trước
    if (code === "42P01" && (msg.includes("users") || msg.includes("ai_portal"))) {
      return res.status(400).json({
        error: "Chưa khởi tạo database đầy đủ. Vui lòng quay lại Bước 2 và bấm «Khởi tạo database», sau đó mới tạo tài khoản quản trị.",
        code: "NEED_INIT_DATABASE",
      })
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

    // Always create/ensure Main assistant (alias central) when completing step 4 (write/data apps are in tools table, ensured on GET /api/tools)
    const centralBaseUrl = (await import("../lib/settings")).getSetting("MAIN_AGENT_BASE_URL", "http://localhost:3001/api/main_agent/v1")
    await query(
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, domain_url, is_active, display_order, config_json, updated_at)
       VALUES ('central', 'Bot', $1, NULL, true, 0, '{"isInternal": true}'::jsonb, now())
       ON CONFLICT (alias) DO UPDATE SET
         is_active = true,
         config_json = COALESCE(assistants.config_json, '{}'::jsonb) || '{"isInternal": true}'::jsonb,
         updated_at = now()`,
      [centralBaseUrl]
    )

    res.json({ ok: true, message: "Main assistant (Central) saved. Apps (Write, Data) are managed in Admin → Apps." })
  } catch (err: any) {
    console.error("POST /api/setup/central-assistant error:", err)
    res.status(500).json({ error: "Lỗi lưu cấu hình", message: err?.message })
  }
})

/**
 * POST /api/setup/restore
 * Khôi phục hệ thống từ file backup .zip (database + MinIO + data/setup-*.json).
 * Body: multipart form với field "file" = file .zip từ GET /api/admin/backup/create.
 */
router.post("/restore", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file
    if (!file || !file.buffer || file.buffer.length === 0) {
      return res.status(400).json({ error: "Chưa chọn file backup. Gửi file .zip với field 'file'." })
    }
    const zip = new AdmZip(file.buffer)
    const manifestEntry = zip.getEntry("manifest.json")
    if (!manifestEntry || manifestEntry.isDirectory) {
      return res.status(400).json({ error: "File backup không hợp lệ: thiếu manifest.json." })
    }
    const manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as {
      version?: number
      databaseName?: string
      createdAt?: string
      minioKeyCount?: number
    }
    const dbName = typeof manifest.databaseName === "string" && manifest.databaseName.trim()
      ? manifest.databaseName.trim()
      : null
    if (!dbName || !/^[a-z0-9_]{1,63}$/.test(dbName)) {
      return res.status(400).json({ error: "File backup không hợp lệ: databaseName trong manifest không hợp lệ." })
    }

    const dbExists = await databaseExists(dbName)
    if (!dbExists) {
      const poolDefault = new Pool({
        host: getBootstrapEnv("POSTGRES_HOST", "localhost"),
        port: Number(getBootstrapEnv("POSTGRES_PORT", "5432")),
        database: MAINTENANCE_DB,
        user: getBootstrapEnv("POSTGRES_USER", "postgres"),
        password: getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres",
        ssl: isTrue(getBootstrapEnv("POSTGRES_SSL")) ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 10_000,
      })
      try {
        const client = await poolDefault.connect()
        try {
          await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`)
        } finally {
          client.release()
        }
      } finally {
        await poolDefault.end()
      }
    }

    await queryWithDb(dbName, "DROP SCHEMA IF EXISTS ai_portal CASCADE")

    const dbSqlEntry = zip.getEntry("database.sql")
    if (!dbSqlEntry || dbSqlEntry.isDirectory) {
      return res.status(400).json({ error: "File backup không hợp lệ: thiếu database.sql." })
    }
    const sqlPath = path.join(os.tmpdir(), `aiportal-restore-${Date.now()}.sql`)
    fs.writeFileSync(sqlPath, dbSqlEntry.getData(), "utf8")
    try {
      const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
      const port = getBootstrapEnv("POSTGRES_PORT", "5432")
      const user = getBootstrapEnv("POSTGRES_USER", "postgres")
      const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres"
      const result = spawnSync(
        "psql",
        ["-h", host, "-p", String(port), "-d", dbName, "-U", user, "-f", sqlPath, "-v", "ON_ERROR_STOP=1"],
        { encoding: "utf8", env: { ...process.env, PGPASSWORD: password }, timeout: 300_000 }
      )
      if (result.error) {
        return res.status(503).json({
          error: "Không chạy được psql để khôi phục database.",
          message: result.error.message,
        })
      }
      if (result.status !== 0) {
        return res.status(500).json({
          error: "Lỗi khi chạy SQL khôi phục",
          message: result.stderr || result.stdout || String(result.status),
        })
      }
    } finally {
      try { fs.unlinkSync(sqlPath) } catch {}
    }

    ensureDataDir()
    fs.writeFileSync(SETUP_DB_FILE, JSON.stringify({ databaseName: dbName }, null, 2), "utf8")
    const dataFiles = ["setup-branding.json", "setup-db.json", "setup-language.json"] as const
    for (const name of dataFiles) {
      const entry = zip.getEntry(`data/${name}`)
      if (entry && !entry.isDirectory) {
        fs.writeFileSync(path.join(DATA_DIR, name), entry.getData(), "utf8")
      }
    }
    resetPool()

    const bucket = getSetting("MINIO_BUCKET_NAME", "portal")
    const minioEndpoint = getSetting("MINIO_ENDPOINT", "localhost")
    const minioPort = getSetting("MINIO_PORT", "9000")
    const accessKey = getSetting("MINIO_ACCESS_KEY")
    const secretKey = getSetting("MINIO_SECRET_KEY")
    const region = getSetting("AWS_REGION", "us-east-1")
    if (bucket && minioEndpoint && minioPort && accessKey && secretKey) {
      const s3 = new S3Client({
        endpoint: `http://${minioEndpoint}:${minioPort}`,
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        forcePathStyle: true,
      })
      const entries = zip.getEntries()
      for (const entry of entries) {
        const name = entry.entryName
        if (name.startsWith("minio/") && !entry.isDirectory) {
          const key = name.slice("minio/".length)
          if (!key) continue
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: entry.getData(),
              ContentType: "application/octet-stream",
            })
          )
        }
      }
    }

    res.json({
      ok: true,
      message: "Đã khôi phục backup. Hệ thống đã về trạng thái tại thời điểm backup. Bạn có thể đăng nhập và sử dụng bình thường.",
    })
  } catch (err: any) {
    console.error("POST /api/setup/restore error:", err)
    res.status(500).json({
      error: "Lỗi khôi phục backup",
      message: err?.message ?? String(err),
    })
  }
})

export default router
