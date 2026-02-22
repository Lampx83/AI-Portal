// setup.ts – First-time setup API (branding → DB → admin)
// No auth required. Only allowed when needsSetup.
// Postgres connection uses env only (getBootstrapEnv).
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
import { runRestore, RestoreError } from "../lib/restore-backup"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } }) // 512MB max

const BACKEND_ROOT = path.join(__dirname, "..", "..")
const DATA_DIR = path.join(BACKEND_ROOT, "data")
const BRANDING_FILE = path.join(DATA_DIR, "setup-branding.json")
const SETUP_DB_FILE = path.join(DATA_DIR, "setup-db.json")
const SETUP_LANGUAGE_FILE = path.join(DATA_DIR, "setup-language.json")

const ALLOWED_SETUP_LOCALES = ["en", "vi", "zh", "ja", "fr"]

/** Path to schema.sql (inside backend directory). */
function getSchemaPath(): string {
  return path.join(BACKEND_ROOT, "schema.sql")
}

const isTrue = (v?: string) => String(v).toLowerCase() === "true"

/**
 * Database name from system name: no spaces, non-ASCII → ASCII equivalent.
 * E.g. "Nghiên cứu" → "nghien_cuu", "AI Portal" → "ai_portal".
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

/** Default language chosen in setup (step 1). Returns null if not chosen yet. */
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

/** Default database for pg_database checks (always "postgres", not POSTGRES_DB to avoid Docker POSTGRES_DB=ai_portal FATAL). */
const MAINTENANCE_DB = "postgres"

/** Check if database exists (connect to postgres, not target DB — avoid FATAL "database does not exist"). */
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

/** Run query against any database (for setup; does not use default pool). */
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

export type Branding = { systemName: string; logoDataUrl?: string; systemSubtitle?: string; themeColor?: string }

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
    const data = JSON.parse(raw) as { systemName?: string; logoDataUrl?: string; systemSubtitle?: string; themeColor?: string }
    const name = typeof data.systemName === "string" ? data.systemName.trim() : ""
    if (!name) return null
    const systemSubtitle = typeof data.systemSubtitle === "string" ? data.systemSubtitle.trim() : undefined
    const themeColor = typeof data.themeColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(data.themeColor.trim()) ? data.themeColor.trim() : undefined
    return {
      systemName: name,
      logoDataUrl: typeof data.logoDataUrl === "string" ? data.logoDataUrl : undefined,
      systemSubtitle: systemSubtitle || undefined,
      themeColor,
    }
  } catch {
    return null
  }
}

/** Save branding to DB (app_settings). Locale strings live in locale packages (data/locales), not site_strings. */
async function saveBrandingToDb(branding: Branding): Promise<void> {
  await query(
    `INSERT INTO ai_portal.app_settings (key, value) VALUES ('system_name', $1), ('logo_data_url', $2), ('system_subtitle', $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [branding.systemName, branding.logoDataUrl ?? "", branding.systemSubtitle ?? ""]
  )
}

/** Error due to missing database/schema (during setup) — do not expose technical message to client. */
function isDbMissingError(msg: string): boolean {
  if (!msg || typeof msg !== "string") return false
  return /database\s+["'].*["']?\s+does not exist/i.test(msg) || /database .* does not exist/i.test(msg)
}

export type SetupStatus = {
  needsSetup: boolean
  step?: "language" | "branding" | "database" | "admin"
  /** Intended database name (from system name) when step === "database". */
  databaseName?: string
}

/**
 * GET /api/setup/status
 * Returns { needsSetup, step? }.
 * - needsSetup true, step "language": language not chosen → POST /api/setup/language.
 * - needsSetup true, step "branding": name/logo not set → POST /api/setup/branding.
 * - needsSetup true, step "database": no ai_portal schema → run init-database.
 * - needsSetup true, step "admin": schema exists but no is_admin user → create-admin.
 * - needsSetup false: setup complete.
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
      return res.json({ needsSetup: true, step: "admin", databaseName: dbName } as SetupStatus)
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
 * GET /api/setup/current-database
 * Returns database name backend is using (from setup-db.json). Used in step 4 to align with errors.
 */
router.get("/current-database", (_req: Request, res: Response) => {
  const name = readSetupDbName()
  res.json({ databaseName: name ?? undefined })
})

/**
 * POST /api/setup/language
 * Setup step 1: choose default language. Body: { default_locale: string } (en, vi, zh, ja, fr).
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
 * Returns { defaultLocale } chosen in setup (from file), or { defaultLocale: "en" } if not set.
 */
router.get("/language", (_req: Request, res: Response) => {
  const lang = readSetupLanguage()
  res.json({ defaultLocale: lang?.defaultLocale ?? "en" })
})

/**
 * GET /api/setup/page-config?page=welcome|guide
 * Returns page content (title, subtitle, cards) from app_settings. Default title = system name (branding), default subtitle = system_subtitle.
 */
router.get("/page-config", async (req: Request, res: Response) => {
  const page = typeof req.query.page === "string" ? req.query.page : ""
  if (page !== "welcome" && page !== "guide") {
    return res.status(400).json({ error: "Invalid page" })
  }
  try {
    const key = page === "welcome" ? "welcome_page_config" : "guide_page_config"
    const [pageRows, brandingRows] = await Promise.all([
      query<{ value: string }>(`SELECT value FROM ai_portal.app_settings WHERE key = $1 LIMIT 1`, [key]),
      query<{ key: string; value: string }>(
        `SELECT key, value FROM ai_portal.app_settings WHERE key IN ('system_name', 'system_subtitle')`
      ),
    ])
    const raw = pageRows.rows[0]?.value
    const brandingMap = Object.fromEntries(brandingRows.rows.map((r) => [r.key, r.value]))
    const systemName = (brandingMap.system_name ?? "").trim()
    const systemSubtitle = (brandingMap.system_subtitle ?? "").trim()

    const defaultTitle = systemName
    const defaultSubtitle = systemSubtitle

    if (!raw) {
      return res.json(
        page === "welcome"
          ? { title: defaultTitle, subtitle: defaultSubtitle, cards: [] }
          : { title: defaultTitle, subtitle: defaultSubtitle, cards: [] }
      )
    }
    const data = JSON.parse(raw) as Record<string, unknown>
    const cards = Array.isArray(data.cards) ? data.cards : []
    const title = (typeof data.title === "string" ? data.title.trim() : "") || defaultTitle
    const subtitle = (typeof data.subtitle === "string" ? data.subtitle.trim() : "") || defaultSubtitle
    return res.json({ title, subtitle, cards })
  } catch {
    res.json(
      page === "welcome"
        ? { title: "", subtitle: "", cards: [] }
        : { title: "", subtitle: "", cards: [] }
    )
  }
})

/**
 * GET /api/setup/branding
 * Returns { systemName, logoDataUrl? } from DB (app_settings) or file (when no DB yet).
 * Used by setup page and app for name/logo (system_name in app_settings).
 */
router.get("/branding", async (_req: Request, res: Response) => {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM ai_portal.app_settings WHERE key IN ('system_name', 'logo_data_url', 'system_subtitle', 'theme_color', 'projects_enabled')`
    )
    const map = Object.fromEntries(rows.rows.map((r) => [r.key, r.value]))
    const systemName = (map.system_name ?? "").trim()
    const projectsEnabled = map.projects_enabled !== "false"
    const systemSubtitle = (map.system_subtitle ?? "").trim() || undefined
    const themeColor = (map.theme_color ?? "").trim()
    const themeColorValid = /^#[0-9A-Fa-f]{6}$/.test(themeColor) ? themeColor : undefined
    if (systemName) {
      return res.json({
        systemName,
        logoDataUrl: (map.logo_data_url ?? "").trim() || undefined,
        systemSubtitle,
        themeColor: themeColorValid,
        projectsEnabled,
      })
    }
    const branding = readBranding()
    if (!branding) {
      return res.json({ systemName: "", logoDataUrl: undefined, systemSubtitle: undefined, themeColor: undefined, projectsEnabled: true })
    }
    return res.json({
      systemName: branding.systemName,
      logoDataUrl: branding.logoDataUrl ?? undefined,
      systemSubtitle: branding.systemSubtitle ?? undefined,
      themeColor: branding.themeColor ?? undefined,
      projectsEnabled,
    })
  } catch {
    // DB not ready or no data yet → read from file
  }
  const branding = readBranding()
  if (!branding) {
    return res.json({ systemName: "", logoDataUrl: undefined, systemSubtitle: undefined, themeColor: undefined, projectsEnabled: true })
  }
  res.json({
    systemName: branding.systemName,
    logoDataUrl: branding.logoDataUrl ?? undefined,
    systemSubtitle: branding.systemSubtitle ?? undefined,
    themeColor: branding.themeColor ?? undefined,
    projectsEnabled: true,
  })
})

/**
 * POST /api/setup/branding
 * Body: { system_name: string, logo?: string } (logo = data URL or image URL).
 * Saves to data/setup-branding.json (Step 1, no DB yet). After Step 2 (init-database) written to DB (app_settings).
 */
router.post("/branding", (req: Request, res: Response) => {
  const { system_name, logo, system_subtitle } = req.body ?? {}
  const systemName = typeof system_name === "string" ? system_name.trim() : ""
  if (!systemName) {
    return res.status(400).json({ error: "Tên hệ thống không được để trống." })
  }
  const logoDataUrl = typeof logo === "string" && logo.length > 0 ? logo : undefined
  const systemSubtitle = typeof system_subtitle === "string" ? system_subtitle.trim() : undefined
  ensureDataDir()
  fs.writeFileSync(
    BRANDING_FILE,
    JSON.stringify({ systemName, logoDataUrl: logoDataUrl ?? null, systemSubtitle: systemSubtitle ?? null }, null, 2),
    "utf8"
  )
  res.json({ ok: true, message: "Đã lưu tên và logo. Chuyển sang bước thiết lập database." })
})

/** Valid PostgreSQL database name: lowercase letters, digits, underscore, 1–63 chars. */
const DB_NAME_REGEX = /^[a-z0-9_]{1,63}$/

/**
 * POST /api/setup/init-database
 * Create database. Body may include database_name (optional); if missing or invalid use slug(system name).
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
        // Schema exists but may be partially initialized (missing users table) → check critical tables
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
        // Schema exists but missing users table (partial init) → drop and run schema.sql again
        await queryWithDb(dbName, "DROP SCHEMA IF EXISTS ai_portal CASCADE")
        schemaExists = false
      }
      if (schemaExists && forceRecreate) {
        await queryWithDb(dbName, "DROP SCHEMA IF EXISTS ai_portal CASCADE")
      }
    } catch {
      // Database does not exist or has no schema yet → continue creating
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
 * Create first admin account. Only allowed when no user has is_admin = true.
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
    // Users table does not exist (42P01) → run Step 2 Initialize database first
    if (code === "42P01" && (msg.includes("users") || msg.includes("ai_portal"))) {
      return res.status(400).json({
        error: "Chưa khởi tạo database đầy đủ. Vui lòng quay lại Bước 2 và bấm «Khởi tạo database», sau đó mới tạo tài khoản quản trị.",
        code: "NEED_INIT_DATABASE",
      })
    }
    // Always return detailed message so user sees the error (e.g. database "researcg" does not exist → fix DB name typo).
    res.status(500).json({
      error: "Lỗi tạo tài khoản",
      message: msg,
    })
  }
})

/**
 * POST /api/setup/central-assistant
 * Step 4 (optional): whether "Configure later", "ChatGPT" or "Gemini", create/ensure Main assistant (alias central).
 * Save provider + API key to app_settings and INSERT central agent if missing.
 * Only allowed when at least one admin exists.
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

    // Always create/ensure Main assistant (alias central) when completing step 4 (data app is in tools table; ensured on GET /api/tools)
    const centralBaseUrl = (await import("../lib/settings")).getSetting("CENTRAL_AGENT_BASE_URL", "http://localhost:3001/api/central_agent/v1")
    await query(
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, domain_url, is_active, display_order, config_json, updated_at)
       VALUES ('central', 'Bot', $1, NULL, true, 0, '{"isInternal": true}'::jsonb, now())
       ON CONFLICT (alias) DO UPDATE SET
         is_active = true,
         config_json = COALESCE(assistants.config_json, '{}'::jsonb) || '{"isInternal": true}'::jsonb,
         updated_at = now()`,
      [centralBaseUrl]
    )

    res.json({ ok: true, message: "Main assistant (Central) saved. Apps (Data) are managed in Admin → Apps." })
  } catch (err: any) {
    console.error("POST /api/setup/central-assistant error:", err)
    res.status(500).json({ error: "Lỗi lưu cấu hình", message: err?.message })
  }
})

/**
 * POST /api/setup/restore
 * Restore system from backup .zip (database + MinIO + data/setup-*.json).
 * Body: multipart form with field "file" = .zip from GET /api/admin/backup/create.
 */
router.post("/restore", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file
    if (!file?.buffer?.length) {
      return res.status(400).json({ error: "Chưa chọn file backup. Gửi file .zip với field 'file'." })
    }
    await runRestore(file.buffer)
    res.json({
      ok: true,
      message: "Đã khôi phục backup. Hệ thống đã về trạng thái tại thời điểm backup. Bạn có thể đăng nhập và sử dụng bình thường.",
    })
  } catch (err: any) {
    console.error("POST /api/setup/restore error:", err)
    if (err instanceof RestoreError) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    res.status(500).json({
      error: "Lỗi khôi phục backup",
      message: err?.message ?? String(err),
    })
  }
})

export default router
