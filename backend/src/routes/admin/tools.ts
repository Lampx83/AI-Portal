import { Router, Request, Response } from "express"
import fs from "fs"
import path from "path"
import os from "os"
import { spawnSync } from "child_process"
import multer from "multer"
import AdmZip from "adm-zip"
import { query, getDatabaseName } from "../../lib/db"
import { getBootstrapEnv, getSetting } from "../../lib/settings"
import { unmountBundledApp, clearBundledAppCache, remountAllBundledApps } from "../../lib/mounted-apps"
import { getToolDisplayName, readSupportedLanguagesFromManifest } from "../../lib/tools"
import { getApp } from "../../lib/app-ref"
import { getBackendRoot, getDataDir } from "../../lib/paths"
import { adminOnly } from "./middleware"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB (package includes dist + public)
const dbUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } }) // 512MB for DB backup/restore

const APPS_DIR = path.join(getDataDir(), "apps")

const ALLOWED_TOOL_ICONS = [
  "Bot", "MessageSquare", "Brain", "Users", "Database", "ListTodo", "ShieldCheck", "Award", "Newspaper",
  "FileText", "GraduationCap", "Sparkles", "BookOpen", "Search", "Code", "Calculator", "Image", "Music",
  "Video", "Mail", "Phone", "MapPin", "BarChart2", "Settings", "Timer", "Gamepad", "Wrench",
  "Folder", "FolderOpen", "Home", "Star", "Heart", "Zap", "Camera", "Mic", "PenLine", "Copy", "Share2",
  "Send", "Calendar", "Clock", "Bell", "Eye", "Tag", "Link", "Download", "Upload", "Plus", "Minus",
  "Check", "X", "AlertCircle", "Info", "HelpCircle", "ChevronRight", "Globe", "Lock", "Bookmark", "Flag",
  "Package", "LayoutGrid", "Layers", "Cpu", "Terminal", "Type", "Heading", "List", "Quote", "AtSign",
  "Hash", "Percent", "DollarSign", "CircleDot", "Grid3X3", "Box", "Archive", "Briefcase", "Building2",
  "Landmark", "Car", "Plane", "Ship", "Train", "Bike", "Footprints", "Compass", "Mountain", "TreePine",
  "Flower2", "Sun", "Moon", "Cloud", "CloudRain", "Snowflake", "Thermometer", "Droplet", "Flame", "Wind",
  "Lightbulb", "Rocket", "Target", "Palette", "Paintbrush", "Key", "Scan", "QrCode", "Wallet", "ShoppingCart",
  "Store", "Truck", "FlaskConical", "TestTube", "HeartPulse", "StickyNote", "NotepadText", "FolderPlus",
  "Server", "Monitor", "Smartphone", "Laptop", "Wifi", "ShieldAlert", "Megaphone", "Gift", "PartyPopper",
  "Pen", "Pencil", "Scissors", "ListOrdered", "ListChecks", "Table", "FilePlus", "FileCode", "FileJson",
  "MessageCircle", "BookMarked", "Radio", "Keyboard", "Boxes", "FileImage", "Plug", "Battery", "CreditCard",
  "Receipt", "Utensils", "Coffee", "Leaf", "Bug", "MailPlus", "Volume2", "MessageCirclePlus", "Wand", "WandSparkles",
] as const
function normalizeToolIcon(icon: unknown): string {
  if (typeof icon !== "string") return "Bot"
  return (ALLOWED_TOOL_ICONS as readonly string[]).includes(icon) ? icon : "Bot"
}

/** Portal base path (e.g. /base-path). Used when writing embed-config at install. */
function getPortalBasePath(): string {
  return (getBootstrapEnv("BASE_PATH") || getSetting("PORTAL_PUBLIC_BASE_PATH") || "").replace(/\/+$/, "")
}

/** Write embed-config.json into app's public/ so the app and embed router can use basePath (and optional apiProxyTarget) set at install. */
function writeEmbedConfig(appDir: string, alias: string, apiProxyTarget?: string): void {
  const basePath = getPortalBasePath()
  const publicDir = path.join(appDir, "public")
  fs.mkdirSync(publicDir, { recursive: true })
  const config: { basePath?: string; embedPath?: string; apiProxyTarget?: string } = {}
  if (basePath) {
    config.basePath = basePath
    config.embedPath = `${basePath}/embed/${alias}`
  }
  if (typeof apiProxyTarget === "string" && apiProxyTarget.trim()) {
    config.apiProxyTarget = apiProxyTarget.trim().replace(/\/+$/, "")
  }
  /** Luôn ghi file — tránh 404 GET /embed/:alias/embed-config.json khi Portal không dùng subpath (basePath rỗng). */
  fs.writeFileSync(path.join(publicDir, "embed-config.json"), JSON.stringify(config, null, 2), "utf-8")
}

function buildPortalDatabaseUrl(): string {
  const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
  const port = getBootstrapEnv("POSTGRES_PORT", "5432")
  const user = getBootstrapEnv("POSTGRES_USER", "postgres")
  const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || ""
  const db = getDatabaseName()
  const ssl = getBootstrapEnv("POSTGRES_SSL", "").toLowerCase() === "true"
  const enc = encodeURIComponent
  return `postgresql://${enc(user)}:${enc(password)}@${host}:${port}/${enc(db)}${ssl ? "?sslmode=require" : ""}`
}

/** Chỉ cho phép tên schema an toàn (chữ, số, gạch dưới) để tránh SQL injection. */
const SAFE_SCHEMA_REGEX = /^[a-zA-Z0-9_]+$/

function safeAlias(alias: string): string | null {
  const normalized = String(alias || "").trim().toLowerCase()
  if (!SAFE_SCHEMA_REGEX.test(normalized)) return null
  return normalized
}

function getAppDir(alias: string): string {
  return path.join(APPS_DIR, alias)
}

/**
 * Embedded tools must expose a router only; any `.listen(...)` in dist/embed.js is unsafe.
 * Reject early at install time to prevent backend crash loops after restart.
 */
function assertEmbedRouterOnly(appDir: string, alias: string): void {
  const embedPath = path.join(appDir, "dist", "embed.js")
  if (!fs.existsSync(embedPath)) return
  const content = fs.readFileSync(embedPath, "utf-8")
  if (/\.\s*listen\s*\(/.test(content)) {
    throw new Error(
      `Goi ${alias} khong hop le: dist/embed.js dang goi server.listen(). ` +
        "Embedded app chi duoc export createEmbedRouter/default router."
    )
  }
}

function getDirectorySizeBytes(targetPath: string): number {
  if (!fs.existsSync(targetPath)) return 0
  const stat = fs.statSync(targetPath)
  if (stat.isFile()) return stat.size
  if (!stat.isDirectory()) return 0
  let total = 0
  for (const name of fs.readdirSync(targetPath)) {
    total += getDirectorySizeBytes(path.join(targetPath, name))
  }
  return total
}

async function getToolStorageMetrics(alias: string): Promise<{ app_size_bytes: number; db_size_bytes: number; total_size_bytes: number }> {
  const normalized = safeAlias(alias)
  if (!normalized) {
    return { app_size_bytes: 0, db_size_bytes: 0, total_size_bytes: 0 }
  }
  const app_size_bytes = getDirectorySizeBytes(getAppDir(normalized))
  let db_size_bytes = 0
  try {
    const result = await query<{ bytes: string }>(
      `SELECT COALESCE(SUM(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass)), 0)::bigint AS bytes
       FROM pg_tables
       WHERE schemaname = $1`,
      [normalized]
    )
    db_size_bytes = Number(result.rows?.[0]?.bytes || 0)
  } catch (err: any) {
    console.warn("[tools] getToolStorageMetrics db size failed:", normalized, err?.message)
  }
  return {
    app_size_bytes,
    db_size_bytes,
    total_size_bytes: app_size_bytes + db_size_bytes,
  }
}

/**
 * Xóa schema trong database tương ứng với công cụ (alias = tên schema, ví dụ surveylab).
 * Gọi khi admin xóa bundled app để dọn dữ liệu DB.
 */
async function dropSchemaForApp(alias: string): Promise<void> {
  if (!alias || !SAFE_SCHEMA_REGEX.test(alias)) return
  try {
    await query(`DROP SCHEMA IF EXISTS "${alias}" CASCADE`)
    console.log("[tools] Dropped schema for app:", alias)
  } catch (e: any) {
    console.warn("[tools] Could not drop schema for app", alias, "—", e?.message)
  }
}

/**
 * Chạy schema trong zip (Writium, v.v.). Placeholder __SCHEMA__ trong SQL phải thay bằng alias (vd. writium);
 * nếu không, PostgreSQL coi __SCHEMA__ là tên schema chữ thường "__schema__" → app truy vấn writium.* sẽ lỗi.
 */
async function runSchemaIfExists(appDir: string, zip: AdmZip, alias: string): Promise<void> {
  const entry = zip.getEntry("schema/portal-embedded.sql") ?? zip.getEntry("portal-embedded.sql")
  if (!entry?.getData) return
  const raw = entry.getData().toString("utf-8")
  if (!raw?.trim()) return
  if (!SAFE_SCHEMA_REGEX.test(alias)) {
    console.warn("[tools] Skip portal-embedded.sql: invalid alias for schema:", alias)
    return
  }
  const quotedSchema = `"${alias.replace(/"/g, '""')}"`
  const sql = raw.replace(/__SCHEMA__/g, quotedSchema)
  const schemaPath = path.join(appDir, "schema", "portal-embedded.sql")
  const schemaDir = path.dirname(schemaPath)
  if (!fs.existsSync(schemaDir)) fs.mkdirSync(schemaDir, { recursive: true })
  fs.writeFileSync(schemaPath, sql, "utf-8")
  try {
    const { Client } = await import("pg")
    const client = new Client({ connectionString: buildPortalDatabaseUrl() })
    await client.connect()
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.replace(/^\s*--[^\n]*\n?/gm, "").trim())
      .filter((s) => s.length > 0)
    for (const stmt of statements) {
      const s = stmt.endsWith(";") ? stmt : stmt + ";"
      await client.query(s)
    }
    await client.end()
    console.log("[tools] Ran schema portal-embedded.sql for app alias=%s", alias)
  } catch (e: any) {
    console.error("[tools] portal-embedded.sql failed (alias=%s):", alias, e?.message ?? e)
  }
}

type CatalogApp = { id: string; alias: string; name?: string; icon?: string }
/** Built-in app catalog. Apps like Write are installed via zip package only. */
const APP_CATALOG: readonly CatalogApp[] = []

router.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { ensureDefaultTools } = await import("../../lib/tools")
    try {
      await ensureDefaultTools()
    } catch (initErr: any) {
      console.warn("[tools] ensureDefaultTools:", initErr?.message || initErr)
    }
    let result: Awaited<ReturnType<typeof query>>
    try {
      result = await query(
        `SELECT id, alias, icon, is_active, display_order, config_json, pinned, category_id,
                created_at, updated_at,
                (SELECT slug FROM ai_portal.tool_categories WHERE id = tools.category_id) AS category_slug,
                (SELECT name FROM ai_portal.tool_categories WHERE id = tools.category_id) AS category_name
         FROM ai_portal.tools
         WHERE user_id IS NULL
         ORDER BY display_order ASC, alias ASC`
      )
    } catch (selectErr: any) {
      if (selectErr?.code === "42P01" || selectErr?.code === "42703") {
        try {
          result = await query(
            `SELECT id, alias, icon, is_active, display_order, config_json, pinned, created_at, updated_at
             FROM ai_portal.tools
             WHERE user_id IS NULL
             ORDER BY display_order ASC, alias ASC`
          )
        } catch (fallbackErr: any) {
          if (fallbackErr?.code === "42P01" || fallbackErr?.code === "42703") {
            result = await query(
              `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
               FROM ai_portal.tools
               ORDER BY display_order ASC, alias ASC`
            )
          } else {
            throw fallbackErr
          }
        }
      } else {
        throw selectErr
      }
    }
    const tools = await Promise.all(
      (result.rows as any[]).map(async (a) => {
        try {
          const config = a.config_json ?? {}
          const daily_message_limit = config.daily_message_limit != null ? Number(config.daily_message_limit) : 100
          const metrics = await getToolStorageMetrics(a.alias)
          const updated_at = a.updated_at
          return {
            ...a,
            ...metrics,
            updated_at,
            name: getToolDisplayName(a.alias, a.config_json),
            daily_message_limit:
              Number.isInteger(daily_message_limit) && daily_message_limit >= 0 ? daily_message_limit : 100,
            category_id: a.category_id ?? null,
            category_slug: a.category_slug ?? null,
            category_name: a.category_name ?? null,
          }
        } catch (e: any) {
          console.warn("[tools] Error building tool row for alias", a?.alias, "—", e?.message)
          return {
            ...a,
            app_size_bytes: 0,
            db_size_bytes: 0,
            total_size_bytes: 0,
            updated_at: a.updated_at,
            name: a.alias || "Tool",
            daily_message_limit: 100,
            category_id: a.category_id ?? null,
            category_slug: a.category_slug ?? null,
            category_name: a.category_name ?? null,
          }
        }
      })
    )
    res.json({ tools })
  } catch (err: any) {
    console.error("Error fetching tools:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.get("/catalog", adminOnly, async (req: Request, res: Response) => {
  res.json({ catalog: [...APP_CATALOG] })
})

router.post("/install-from-catalog", adminOnly, async (req: Request, res: Response) => {
  try {
    const { catalogId } = req.body ?? {}
    const id = String(catalogId ?? "").trim().toLowerCase()
    const app = APP_CATALOG.find((a) => a.id === id || a.alias === id)
    if (!app) {
      return res.status(400).json({ error: "Application not in catalog", catalogId: id })
    }
    const iconVal = normalizeToolIcon(app.icon)
    await query(
      `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, user_id, updated_at)
       VALUES ($1, $2, true, 0, '{"embedded": true}'::jsonb, NULL, now())
       ON CONFLICT (alias) WHERE (user_id IS NULL) DO UPDATE SET
         config_json = ai_portal.tools.config_json || '{"embedded": true}'::jsonb,
         updated_at = now()`,
      [app.alias, iconVal]
    )
    const result = await query(
      `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools WHERE alias = $1 AND user_id IS NULL`,
      [app.alias]
    )
    res.status(200).json({ tool: result.rows[0], installed: true })
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(200).json({ message: "Application was already installed", installed: false })
    }
    console.error("Install from catalog error:", err)
    res.status(500).json({ error: "Installation error", message: err?.message })
  }
})

function writeProgress(res: Response, data: { step: string; message: string; status?: "running" | "done" }) {
  res.write(JSON.stringify({ type: "progress", ...data }) + "\n")
}

router.post("/install-package", adminOnly, upload.single("package"), async (req: Request, res: Response) => {
  req.setTimeout(180_000) // 3 minutes — npm install may take 1–2 minutes
  const streamProgress = (req.headers["x-stream-progress"] as string) === "1"
  if (streamProgress) {
    res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" })
  }
  const prog = (step: string, message: string, status: "running" | "done" = "running") => {
    if (streamProgress && !res.writableEnded) writeProgress(res, { step, message, status })
  }
  const sendError = (statusCode: number, payload: Record<string, unknown>) => {
    if (res.writableEnded) return
    if (streamProgress) {
      res.write(JSON.stringify({ type: "error", ...payload }) + "\n")
      res.end()
      return
    }
    if (!res.headersSent) {
      res.status(statusCode).json(payload)
    }
  }
  const sendSuccess = (payload: Record<string, unknown>) => {
    if (res.writableEnded) return
    if (streamProgress) {
      res.write(JSON.stringify({ type: "done", ...payload }) + "\n")
      res.end()
      return
    }
    if (!res.headersSent) {
      res.status(200).json(payload)
    }
  }
  try {
    prog("validating", "Validating package...")
    const file = (req as any).file
    if (!file?.buffer) return sendError(400, { error: "Missing package file. Send field 'package' as a .zip file" })
    const zip = new AdmZip(file.buffer)
    const entries = zip.getEntries()
    const manifestEntry = entries.find((e) => e.entryName === "manifest.json" || e.entryName.endsWith("/manifest.json"))
    if (!manifestEntry?.getData()) return sendError(400, { error: "Package does not contain manifest.json" })
    const manifest = JSON.parse(manifestEntry.getData().toString("utf-8")) as {
      id?: string
      alias?: string
      name?: string
      icon?: string
      type?: string
      hasBackend?: boolean
      hasFrontendOnly?: boolean
      supported_languages?: string[]
      apiProxyTarget?: string
    }
    const alias = String(manifest.alias ?? manifest.id ?? "").trim().toLowerCase()
    if (!alias) return sendError(400, { error: "manifest.json must have id or alias" })
    const app = APP_CATALOG.find((a) => a.alias === alias)
    const existingTool = await query<{ config_json?: Record<string, unknown> }>(
      `SELECT config_json FROM ai_portal.tools WHERE alias = $1 AND user_id IS NULL LIMIT 1`,
      [alias]
    )
    const existingConfigJson = (existingTool.rows?.[0]?.config_json ?? {}) as Record<string, unknown>
    const existingDisplayName = typeof existingConfigJson.displayName === "string" ? String(existingConfigJson.displayName).trim() : ""
    prog("validating", "Package validated", "done")

    const hasDist = entries.some((e) => e.entryName === "dist/server.js" || e.entryName.startsWith("dist/"))
    const hasPackageJson = entries.some((e) => e.entryName === "package.json")
    const hasPublic = entries.some((e) => e.entryName === "public/index.html" || e.entryName.startsWith("public/"))
    const bundled = hasDist && hasPackageJson && (manifest.hasBackend !== false)
    const frontendOnly = !!(manifest.hasFrontendOnly && hasPublic)

    const supportedLanguages = Array.isArray(manifest.supported_languages)
      ? manifest.supported_languages.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().toLowerCase())
      : []
    let configJson: Record<string, unknown> = {
      ...existingConfigJson,
      embedded: true,
      displayName: existingDisplayName || manifest.name || undefined,
      supported_languages: supportedLanguages.length > 0 ? supportedLanguages : undefined,
    }

    if (frontendOnly) {
      prog("extracting", "Extracting package...")
      fs.mkdirSync(APPS_DIR, { recursive: true })
      const appDir = path.join(APPS_DIR, alias)
      if (fs.existsSync(appDir)) {
        for (const name of fs.readdirSync(appDir)) {
          fs.rmSync(path.join(appDir, name), { recursive: true })
        }
      } else {
        fs.mkdirSync(appDir, { recursive: true })
      }
      ;(zip as unknown as { extractAllTo: (p: string, o: boolean) => void }).extractAllTo(appDir, true)
      prog("extracting", "Extracted", "done")
      const apiProxyFromManifest =
        typeof manifest.apiProxyTarget === "string" && manifest.apiProxyTarget.trim()
          ? manifest.apiProxyTarget.trim().replace(/\/+$/, "")
          : undefined
      writeEmbedConfig(appDir, alias, apiProxyFromManifest)
      const indexPath = path.join(appDir, "public", "index.html")
      if (!fs.existsSync(indexPath)) {
        return sendError(400, { error: "Frontend-only package must contain public/index.html" })
      }
      configJson = {
        ...existingConfigJson,
        embedded: true,
        frontendOnly: true,
        bundledPath: null,
        displayName: existingDisplayName || manifest.name || undefined,
        supported_languages: supportedLanguages.length > 0 ? supportedLanguages : undefined,
        ...(apiProxyFromManifest ? { apiProxyTarget: apiProxyFromManifest } : {}),
      }
    } else if (bundled) {
      prog("extracting", "Extracting package...")
      fs.mkdirSync(APPS_DIR, { recursive: true })
      const appDir = path.join(APPS_DIR, alias)
      if (fs.existsSync(appDir)) {
        clearBundledAppCache(alias)
        for (const name of fs.readdirSync(appDir)) {
          fs.rmSync(path.join(appDir, name), { recursive: true })
        }
      } else {
        fs.mkdirSync(appDir, { recursive: true })
      }
      ;(zip as unknown as { extractAllTo: (p: string, o: boolean) => void }).extractAllTo(appDir, true)
      prog("extracting", "Extracted", "done")
      writeEmbedConfig(appDir, alias)

      const serverPath = path.join(appDir, "dist", "server.js")
      if (!fs.existsSync(serverPath)) {
        return sendError(400, { error: "Package has dist/ but is missing dist/server.js" })
      }
      const embedJsPath = path.join(appDir, "dist", "embed.js")
      if (!fs.existsSync(embedJsPath)) {
        return sendError(400, {
          error: "Missing dist/embed.js",
          message:
            "Gói thiếu dist/embed.js (bắt buộc app có backend nhúng). " +
            "PaperFinder: từ thư mục gốc repo chạy `npm run pack`, upload `dist/paperfinder-app-package.zip` — không chỉ zip mỗi thư mục public sau `npm run build`. " +
            "App khác: đóng gói đủ dist/embed.js + dist/server.js theo script pack của từng repo.",
        })
      }
      try {
        assertEmbedRouterOnly(appDir, alias)
      } catch (scanErr: any) {
        return sendError(400, {
          error: "Invalid embedded backend package",
          message: scanErr?.message ?? "dist/embed.js must not call server.listen()",
        })
      }

      prog("schema", "Running schema migration (if any)...")
      await runSchemaIfExists(appDir, zip, alias)
      prog("schema", "Schema run", "done")

      prog("npm", "Installing dependencies (npm install, may take 1–2 minutes)...")
      const npmResult = spawnSync("npm", ["install", "--production", "--no-audit", "--no-fund"], {
        cwd: appDir,
        shell: true,
        stdio: "inherit",
        timeout: 120_000,
      })
      if (npmResult.status !== 0) {
        return sendError(500, { error: "npm install failed in app package" })
      }
      prog("npm", "Dependencies installed", "done")

      configJson = {
        ...existingConfigJson,
        embedded: true,
        frontendOnly: false,
        bundledPath: path.relative(getBackendRoot(), appDir),
        displayName: existingDisplayName || manifest.name || undefined,
        supported_languages: supportedLanguages.length > 0 ? supportedLanguages : undefined,
      }
    }

    prog("config", "Configuring database...")
    const iconVal = normalizeToolIcon(manifest.icon)
    await query(
      `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, user_id, updated_at)
       VALUES ($1, $2, true, 0, $3::jsonb, NULL, now())
       ON CONFLICT (alias) WHERE (user_id IS NULL) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = now()`,
      [alias, iconVal, JSON.stringify(configJson)]
    )
    const result = await query(
      `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools WHERE alias = $1 AND user_id IS NULL`,
      [alias]
    )
    prog("config", "Installation complete", "done")

    // Remount sau khi DB đã có bundledPath + bust require.cache — tránh 503 /health cho tới khi restart backend
    if (bundled) {
      prog("mounting", "Registering bundled app with server...")
      try {
        const mainApp = getApp()
        if (mainApp) await remountAllBundledApps(mainApp)
      } catch (e: any) {
        console.warn("[tools] remount after install failed (restart backend if app 503):", e?.message)
      }
      prog("mounting", "Done", "done")
    }

    sendSuccess({ tool: result.rows[0], installed: true })
  } catch (err: any) {
    console.error("Install package error:", err)
    sendError(500, { error: "Package installation error", message: err?.message })
  }
})

router.get("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    let result: Awaited<ReturnType<typeof query>>
    try {
      result = await query(
        `SELECT id, alias, icon, is_active, display_order, config_json, pinned, category_id,
                (SELECT slug FROM ai_portal.tool_categories WHERE id = tools.category_id) AS category_slug,
                (SELECT name FROM ai_portal.tool_categories WHERE id = tools.category_id) AS category_name,
                created_at, updated_at
         FROM ai_portal.tools
         WHERE id = $1::uuid AND user_id IS NULL`,
        [id]
      )
    } catch (e: any) {
      if (e?.code === "42703") {
        result = await query(
          `SELECT id, alias, icon, is_active, display_order, config_json, pinned, created_at, updated_at
           FROM ai_portal.tools
           WHERE id = $1::uuid AND user_id IS NULL`,
          [id]
        )
      } else throw e
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "App not found" })
    }
    const row = result.rows[0] as { alias: string; config_json?: Record<string, unknown>; category_id?: string; category_slug?: string; category_name?: string }
    const config = row.config_json ?? {}
    const supportedFromManifest = readSupportedLanguagesFromManifest(row.alias)
    const metrics = await getToolStorageMetrics(row.alias)
    const mergedConfig =
      supportedFromManifest.length > 0 && !Array.isArray(config.supported_languages)
        ? { ...config, supported_languages: supportedFromManifest }
        : config
    res.json({
      tool: {
        ...row,
        ...metrics,
        config_json: mergedConfig,
        name: getToolDisplayName(row.alias, mergedConfig),
        category_id: row.category_id ?? null,
        category_slug: row.category_slug ?? null,
        category_name: row.category_name ?? null,
      },
    })
  } catch (err: any) {
    console.error("Error fetching tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

function addDirectoryToZip(zip: AdmZip, dirPath: string, zipPrefix = ""): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dirPath, entry.name)
    const rel = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, abs, rel)
    } else if (entry.isFile()) {
      zip.addFile(rel, fs.readFileSync(abs))
    }
  }
}

router.get("/:id/package-download", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "").trim()
    const toolResult = await query<{ alias: string }>(
      `SELECT alias FROM ai_portal.tools WHERE id = $1::uuid AND user_id IS NULL LIMIT 1`,
      [id]
    )
    const alias = toolResult.rows?.[0]?.alias
    const normalizedAlias = alias ? safeAlias(alias) : null
    if (!normalizedAlias) return res.status(404).json({ error: "App not found" })
    const appDir = getAppDir(normalizedAlias)
    if (!fs.existsSync(appDir)) {
      return res.status(404).json({
        error: "Tool package files not found",
        message: "Ứng dụng này chưa có thư mục package trong data/apps.",
      })
    }
    const zip = new AdmZip()
    addDirectoryToZip(zip, appDir)
    const zipBuffer = zip.toBuffer()
    const filename = `${normalizedAlias}-package-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.zip`
    res.setHeader("Content-Type", "application/zip")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.setHeader("Content-Length", String(zipBuffer.length))
    res.send(zipBuffer)
  } catch (err: any) {
    console.error("Download tool package error:", err)
    res.status(500).json({ error: "Error downloading tool package", message: err?.message })
  }
})

router.get("/:id/backup-db", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "").trim()
    const toolResult = await query<{ alias: string }>(
      `SELECT alias FROM ai_portal.tools WHERE id = $1::uuid AND user_id IS NULL LIMIT 1`,
      [id]
    )
    const alias = toolResult.rows?.[0]?.alias
    const schema = alias ? safeAlias(alias) : null
    if (!schema) return res.status(404).json({ error: "App not found" })

    const dbName = getDatabaseName()
    const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
    const port = getBootstrapEnv("POSTGRES_PORT", "5432")
    const user = getBootstrapEnv("POSTGRES_USER", "postgres")
    const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres"

    const pgDump = spawnSync(
      "pg_dump",
      ["-h", host, "-p", String(port), "-U", user, "-d", dbName, "-n", schema, "--no-owner", "--no-acl"],
      { encoding: "utf8", env: { ...process.env, PGPASSWORD: password }, timeout: 300_000, maxBuffer: 100 * 1024 * 1024 }
    )
    if (pgDump.error) {
      return res.status(503).json({ error: "Không chạy được pg_dump.", message: pgDump.error.message })
    }
    if (pgDump.status !== 0) {
      return res.status(500).json({ error: "Lỗi dump dữ liệu ứng dụng", message: pgDump.stderr || pgDump.stdout || String(pgDump.status) })
    }

    const zip = new AdmZip()
    zip.addFile("schema.sql", Buffer.from(pgDump.stdout || "", "utf8"))
    zip.addFile(
      "manifest.json",
      Buffer.from(
        JSON.stringify(
          {
            version: 1,
            scope: "tool_schema",
            alias: schema,
            databaseName: dbName,
            createdAt: new Date().toISOString(),
          },
          null,
          2
        ),
        "utf8"
      )
    )
    const zipBuffer = zip.toBuffer()
    const filename = `${dbName}-${schema}-db-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.zip`
    res.setHeader("Content-Type", "application/zip")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.setHeader("Content-Length", String(zipBuffer.length))
    res.send(zipBuffer)
  } catch (err: any) {
    console.error("Backup tool DB error:", err)
    res.status(500).json({ error: "Lỗi backup dữ liệu ứng dụng", message: err?.message ?? String(err) })
  }
})

router.post("/:id/restore-db", adminOnly, dbUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "").trim()
    const file = req.file
    if (!file?.buffer?.length) {
      return res.status(400).json({ error: "Chưa chọn file backup. Gửi file .zip với field 'file'." })
    }
    const toolResult = await query<{ alias: string }>(
      `SELECT alias FROM ai_portal.tools WHERE id = $1::uuid AND user_id IS NULL LIMIT 1`,
      [id]
    )
    const alias = toolResult.rows?.[0]?.alias
    const schema = alias ? safeAlias(alias) : null
    if (!schema) return res.status(404).json({ error: "App not found" })

    const zip = new AdmZip(file.buffer)
    const sqlEntry = zip.getEntry("schema.sql")
    if (!sqlEntry || sqlEntry.isDirectory) {
      return res.status(400).json({ error: "File backup không hợp lệ: thiếu schema.sql." })
    }
    const sqlContent = sqlEntry.getData().toString("utf8")
    if (!sqlContent.trim()) {
      return res.status(400).json({ error: "File backup không có nội dung schema.sql." })
    }

    await query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)

    const sqlPath = path.join(os.tmpdir(), `aiportal-tool-restore-${schema}-${Date.now()}.sql`)
    fs.writeFileSync(sqlPath, sqlContent, "utf8")
    try {
      const dbName = getDatabaseName()
      const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
      const port = getBootstrapEnv("POSTGRES_PORT", "5432")
      const user = getBootstrapEnv("POSTGRES_USER", "postgres")
      const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres"
      const psql = spawnSync(
        "psql",
        ["-h", host, "-p", String(port), "-d", dbName, "-U", user, "-f", sqlPath, "-v", "ON_ERROR_STOP=1"],
        { encoding: "utf8", env: { ...process.env, PGPASSWORD: password }, timeout: 300_000 }
      )
      if (psql.error) {
        return res.status(503).json({ error: "Không chạy được psql để khôi phục.", message: psql.error.message })
      }
      if (psql.status !== 0) {
        return res.status(500).json({
          error: "Lỗi khôi phục dữ liệu ứng dụng",
          message: psql.stderr || psql.stdout || String(psql.status),
        })
      }
    } finally {
      try {
        fs.unlinkSync(sqlPath)
      } catch {
        // ignore
      }
    }

    res.json({ ok: true, message: "Đã khôi phục dữ liệu database cho ứng dụng." })
  } catch (err: any) {
    console.error("Restore tool DB error:", err)
    res.status(500).json({ error: "Lỗi khôi phục dữ liệu ứng dụng", message: err?.message ?? String(err) })
  }
})

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { alias, icon, is_active, display_order, config_json } = req.body
    if (!alias || typeof alias !== "string") {
      return res.status(400).json({ error: "alias is required" })
    }
    const a = String(alias).trim().toLowerCase()
    const iconVal = normalizeToolIcon(icon)
    const result = await query(
      `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, user_id, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NULL, now())
       RETURNING id, alias, icon, is_active, display_order, config_json, created_at, updated_at`,
      [a, iconVal, is_active !== false, Number(display_order) || 0, JSON.stringify(config_json || {})]
    )
    res.status(201).json({ tool: result.rows[0] })
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Application with this alias already exists" })
    console.error("Error creating tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.patch("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const { icon, is_active, display_order, config_json, pinned, category_id } = req.body
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    if (icon !== undefined) {
      const iconVal = normalizeToolIcon(icon)
      updates.push(`icon = $${paramIndex++}`)
      values.push(iconVal)
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(is_active)
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`)
      values.push(display_order)
    }
    if (pinned !== undefined) {
      updates.push(`pinned = $${paramIndex++}`)
      values.push(!!pinned)
    }
    if (category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`)
      values.push(category_id === null || category_id === "" ? null : category_id)
    }
    if (config_json !== undefined) {
      updates.push(`config_json = $${paramIndex++}::jsonb`)
      values.push(JSON.stringify(config_json))
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" })
    }
    updates.push(`updated_at = NOW()`)
    values.push(id)
    const result = await query(
      `UPDATE ai_portal.tools
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}::uuid AND user_id IS NULL
       RETURNING id, alias, icon, is_active, display_order, config_json, pinned, category_id, created_at, updated_at`,
      values
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "App not found" })
    }
    const row = result.rows[0] as any
    const withCategory = await query(
      `SELECT slug AS category_slug, name AS category_name FROM ai_portal.tool_categories WHERE id = $1`,
      [row.category_id]
    ).catch(() => ({ rows: [] }))
    const cat = withCategory.rows[0]
    res.json({
      tool: {
        ...row,
        category_slug: cat?.category_slug ?? null,
        category_name: cat?.category_name ?? null,
      },
    })
  } catch (err: any) {
    console.error("Error updating tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.delete("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `SELECT id, alias, config_json FROM ai_portal.tools WHERE id = $1::uuid AND user_id IS NULL`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Application does not exist" })
    }
    const row = result.rows[0] as { alias: string; config_json?: { bundledPath?: string } }
    const alias = row.alias
    const config = (row.config_json ?? {}) as { bundledPath?: string }
    if (config.bundledPath) {
      await dropSchemaForApp(alias)
      unmountBundledApp(alias)
      const appDir = path.join(APPS_DIR, alias)
      if (fs.existsSync(appDir)) {
        fs.rmSync(appDir, { recursive: true })
      }
    }
    await query(`DELETE FROM ai_portal.tools WHERE id = $1::uuid`, [id])
    res.status(200).json({ success: true, message: "Application deleted" })
  } catch (err: any) {
    console.error("Delete tool error:", err)
    res.status(500).json({ error: "Error deleting application", message: err.message })
  }
})

export default router
