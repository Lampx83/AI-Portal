import { Router, Request, Response } from "express"
import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"
import multer from "multer"
import AdmZip from "adm-zip"
import { query, getDatabaseName } from "../../lib/db"
import { getBootstrapEnv } from "../../lib/settings"
import { mountBundledApp, unmountBundledApp } from "../../lib/mounted-apps"
import { getApp } from "../../lib/app-ref"
import { adminOnly } from "./middleware"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB (gói có dist + public)

const BACKEND_ROOT = path.join(__dirname, "..", "..", "..")
const APPS_DIR = path.join(BACKEND_ROOT, "data", "apps")

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

/** Chạy migration schema nếu có file SQL trong zip (đã extract) */
function runSchemaIfExists(appDir: string, zip: AdmZip): void {
  const entry = zip.getEntry("schema/portal-embedded.sql") ?? zip.getEntry("portal-embedded.sql")
  if (!entry?.getData) return
  const sql = entry.getData().toString("utf-8")
  if (!sql?.trim()) return
  const schemaPath = path.join(appDir, "schema", "portal-embedded.sql")
  const schemaDir = path.dirname(schemaPath)
  if (!fs.existsSync(schemaDir)) fs.mkdirSync(schemaDir, { recursive: true })
  fs.writeFileSync(schemaPath, sql, "utf-8")
  void (async () => {
    try {
      const { Client } = await import("pg")
      const client = new Client({ connectionString: buildPortalDatabaseUrl() })
      await client.connect()
      await client.query(sql)
      await client.end()
      console.log("[tools] Đã chạy schema portal-embedded.sql cho app")
    } catch (e: any) {
      console.warn("[tools] Không chạy được schema:", e?.message)
    }
  })()
}

type CatalogApp = { id: string; alias: string; name?: string; icon?: string; defaultBaseUrl?: string; defaultDomainUrl?: string }
/** Danh mục ứng dụng có sẵn. Ứng dụng như Write chỉ cài qua gói zip. */
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
        `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
         FROM ai_portal.tools
         ORDER BY display_order ASC, alias ASC`
      )
    } catch (selectErr: any) {
      if (selectErr?.code === "42P01") {
        try {
          await ensureDefaultTools()
        } catch (e2: any) {
          console.warn("[tools] ensureDefaultTools retry:", e2?.message || e2)
        }
        result = await query(
          `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
           FROM ai_portal.tools
           ORDER BY display_order ASC, alias ASC`
        )
      } else {
        throw selectErr
      }
    }
    const tools = (result.rows as any[]).map((a) => {
      const config = a.config_json ?? {}
      const daily_message_limit = config.daily_message_limit != null ? Number(config.daily_message_limit) : 100
      return {
        ...a,
        daily_message_limit:
          Number.isInteger(daily_message_limit) && daily_message_limit >= 0 ? daily_message_limit : 100,
      }
    })
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
    const { catalogId, base_url, domain_url } = req.body ?? {}
    const id = String(catalogId ?? "").trim().toLowerCase()
    const app = APP_CATALOG.find((a) => a.id === id || a.alias === id)
    if (!app) {
      return res.status(400).json({ error: "Ứng dụng không có trong danh mục", catalogId: id })
    }
    const baseUrl = (base_url && String(base_url).trim()) || app.defaultBaseUrl || ""
    const domainUrl = (domain_url && String(domain_url).trim()) || app.defaultDomainUrl || null
    if (!baseUrl) return res.status(400).json({ error: "Cần base_url hoặc chạy Write app với URL mặc định" })
    const iconVal = (app.icon && ["FileText", "Database", "Bot"].includes(app.icon)) ? app.icon : "Bot"
    await query(
      `INSERT INTO ai_portal.tools (alias, icon, base_url, domain_url, is_active, display_order, config_json, updated_at)
       VALUES ($1, $2, $3, $4, true, 0, '{"embedded": true}'::jsonb, now())
       ON CONFLICT (alias) DO UPDATE SET
         base_url = EXCLUDED.base_url,
         domain_url = COALESCE(EXCLUDED.domain_url, ai_portal.tools.domain_url),
         config_json = ai_portal.tools.config_json || '{"embedded": true}'::jsonb,
         updated_at = now()`,
      [app.alias, iconVal, baseUrl, domainUrl]
    )
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools WHERE alias = $1`,
      [app.alias]
    )
    res.status(200).json({ tool: result.rows[0], installed: true })
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(200).json({ message: "Ứng dụng đã được cài đặt trước đó", installed: false })
    }
    console.error("Install from catalog error:", err)
    res.status(500).json({ error: "Lỗi cài đặt", message: err?.message })
  }
})

function writeProgress(res: Response, data: { step: string; message: string; status?: "running" | "done" }) {
  res.write(JSON.stringify({ type: "progress", ...data }) + "\n")
}

router.post("/install-package", adminOnly, upload.single("package"), async (req: Request, res: Response) => {
  req.setTimeout(180_000) // 3 phút — npm install có thể mất 1–2 phút
  const streamProgress = (req.headers["x-stream-progress"] as string) === "1"
  if (streamProgress) {
    res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" })
  }
  const prog = (step: string, message: string, status: "running" | "done" = "running") => {
    if (streamProgress) writeProgress(res, { step, message, status })
  }
  try {
    prog("validating", "Đang kiểm tra gói...")
    const file = (req as any).file
    if (!file?.buffer) return res.status(400).json({ error: "Thiếu file gói (package). Gửi field 'package' dạng file .zip" })
    const zip = new AdmZip(file.buffer)
    const entries = zip.getEntries()
    const manifestEntry = entries.find((e) => e.entryName === "manifest.json" || e.entryName.endsWith("/manifest.json"))
    if (!manifestEntry?.getData()) return res.status(400).json({ error: "Gói không chứa manifest.json" })
    const manifest = JSON.parse(manifestEntry.getData().toString("utf-8")) as {
      id?: string
      alias?: string
      name?: string
      icon?: string
      defaultBaseUrl?: string
      defaultDomainUrl?: string
      type?: string
      hasBackend?: boolean
      hasFrontendOnly?: boolean
    }
    const alias = String(manifest.alias ?? manifest.id ?? "").trim().toLowerCase()
    if (!alias) return res.status(400).json({ error: "manifest.json phải có id hoặc alias" })
    const app = APP_CATALOG.find((a) => a.alias === alias)
    prog("validating", "Đã kiểm tra gói", "done")

    const hasDist = entries.some((e) => e.entryName === "dist/server.js" || e.entryName.startsWith("dist/"))
    const hasPackageJson = entries.some((e) => e.entryName === "package.json")
    const hasPublic = entries.some((e) => e.entryName === "public/index.html" || e.entryName.startsWith("public/"))
    const bundled = hasDist && hasPackageJson && (manifest.hasBackend !== false)
    const frontendOnly = !!(manifest.hasFrontendOnly && hasPublic)

    let baseUrl: string
    let domainUrl: string | null
    let configJson: Record<string, unknown> = { embedded: true }

    if (frontendOnly) {
      prog("extracting", "Đang giải nén gói...")
      const backendPort = process.env.PORT || "3001"
      const backendBase = process.env.BACKEND_URL || `http://localhost:${backendPort}`
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
      prog("extracting", "Đã giải nén", "done")
      const indexPath = path.join(appDir, "public", "index.html")
      if (!fs.existsSync(indexPath)) {
        return res.status(400).json({ error: "Gói frontend-only phải chứa public/index.html" })
      }
      baseUrl = manifest.defaultBaseUrl
        ? manifest.defaultBaseUrl.replace(/^https?:\/\/[^/]+/, backendBase)
        : `${backendBase}/api/data_agent/v1`
      domainUrl = `${backendBase}/embed/${alias}`
      configJson = { embedded: true, frontendOnly: true }
    } else if (bundled) {
      prog("extracting", "Đang giải nén gói...")
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
      prog("extracting", "Đã giải nén", "done")

      const serverPath = path.join(appDir, "dist", "server.js")
      if (!fs.existsSync(serverPath)) {
        return res.status(400).json({ error: "Gói có dist/ nhưng thiếu dist/server.js" })
      }

      prog("schema", "Đang chạy migration schema (nếu có)...")
      runSchemaIfExists(appDir, zip)
      prog("schema", "Đã chạy schema", "done")

      prog("npm", "Đang cài phụ thuộc (npm install, có thể mất 1–2 phút)...")
      const npmResult = spawnSync("npm", ["install", "--production", "--no-audit", "--no-fund"], {
        cwd: appDir,
        shell: true,
        stdio: "inherit",
        timeout: 120_000,
      })
      if (npmResult.status !== 0) {
        return res.status(500).json({ error: "Không chạy được npm install trong gói ứng dụng" })
      }
      prog("npm", "Đã cài phụ thuộc", "done")

      const backendPort = process.env.PORT || "3001"
      const backendBase = process.env.BACKEND_URL || `http://localhost:${backendPort}`
      baseUrl = `${backendBase}/api/apps/${alias}`
      domainUrl = `${backendBase}/embed/${alias}`
      configJson = { embedded: true, bundledPath: path.relative(BACKEND_ROOT, appDir) }

      prog("mounting", "Đang gắn ứng dụng...")
      const mainApp = getApp()
      if (mainApp) mountBundledApp(mainApp, alias)
      prog("mounting", "Đã gắn ứng dụng", "done")
    } else {
      baseUrl = (req.body?.base_url && String(req.body.base_url).trim()) || manifest.defaultBaseUrl || (app?.defaultBaseUrl ?? "")
      domainUrl = (req.body?.domain_url && String(req.body.domain_url).trim()) || manifest.defaultDomainUrl || app?.defaultDomainUrl || null
      if (!baseUrl) return res.status(400).json({ error: "Cần base_url trong manifest hoặc gửi kèm trong form" })
    }

    prog("config", "Đang cấu hình cơ sở dữ liệu...")
    const iconVal = (manifest.icon && ["FileText", "Database", "Bot"].includes(manifest.icon)) ? manifest.icon : "Bot"
    await query(
      `INSERT INTO ai_portal.tools (alias, icon, base_url, domain_url, is_active, display_order, config_json, updated_at)
       VALUES ($1, $2, $3, $4, true, 0, $5::jsonb, now())
       ON CONFLICT (alias) DO UPDATE SET
         base_url = EXCLUDED.base_url,
         domain_url = COALESCE(EXCLUDED.domain_url, ai_portal.tools.domain_url),
         config_json = EXCLUDED.config_json,
         updated_at = now()`,
      [alias, iconVal, baseUrl, domainUrl, JSON.stringify(configJson)]
    )
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools WHERE alias = $1`,
      [alias]
    )
    prog("config", "Hoàn thành cài đặt", "done")

    if (streamProgress) {
      res.write(JSON.stringify({ type: "done", tool: result.rows[0], installed: true }) + "\n")
      res.end()
    } else {
      res.status(200).json({ tool: result.rows[0], installed: true })
    }
  } catch (err: any) {
    console.error("Install package error:", err)
    if (streamProgress) {
      res.write(JSON.stringify({ type: "error", error: err?.message || "Lỗi cài đặt gói" }) + "\n")
      res.end()
    } else {
      res.status(500).json({ error: "Lỗi cài đặt gói", message: err?.message })
    }
  }
})

router.get("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `SELECT id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools
       WHERE id = $1::uuid`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "App not found" })
    }
    res.json({ tool: result.rows[0] })
  } catch (err: any) {
    console.error("Error fetching tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { alias, icon, base_url, domain_url, is_active, display_order, config_json } = req.body
    if (!alias || typeof alias !== "string" || !base_url || typeof base_url !== "string") {
      return res.status(400).json({ error: "alias và base_url là bắt buộc" })
    }
    const a = String(alias).trim()
    const iconVal = (icon && ["FileText", "Database", "Bot"].includes(icon)) ? icon : "Bot"
    const result = await query(
      `INSERT INTO ai_portal.tools (alias, icon, base_url, domain_url, is_active, display_order, config_json, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
       RETURNING id, alias, icon, base_url, domain_url, is_active, display_order, config_json, created_at, updated_at`,
      [a, iconVal, String(base_url).trim(), domain_url ? String(domain_url).trim() : null, is_active !== false, Number(display_order) || 0, JSON.stringify(config_json || {})]
    )
    res.status(201).json({ tool: result.rows[0] })
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Ứng dụng với alias này đã tồn tại" })
    console.error("Error creating tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.patch("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const { base_url, domain_url, is_active, display_order, config_json } = req.body
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    if (base_url !== undefined) {
      updates.push(`base_url = $${paramIndex++}`)
      values.push(base_url)
    }
    if (domain_url !== undefined) {
      updates.push(`domain_url = $${paramIndex++}`)
      values.push(domain_url === "" || domain_url === null ? null : domain_url)
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
      return res.status(404).json({ error: "App not found" })
    }
    res.json({ tool: result.rows[0] })
  } catch (err: any) {
    console.error("Error updating tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.delete("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `SELECT id, alias, config_json FROM ai_portal.tools WHERE id = $1::uuid`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ứng dụng không tồn tại" })
    }
    const row = result.rows[0] as { alias: string; config_json?: { bundledPath?: string } }
    const alias = row.alias
    const config = (row.config_json ?? {}) as { bundledPath?: string }
    if (config.bundledPath) {
      unmountBundledApp(alias)
      const appDir = path.join(APPS_DIR, alias)
      if (fs.existsSync(appDir)) {
        fs.rmSync(appDir, { recursive: true })
      }
    }
    await query(`DELETE FROM ai_portal.tools WHERE id = $1::uuid`, [id])
    res.status(200).json({ success: true, message: "Đã xoá ứng dụng" })
  } catch (err: any) {
    console.error("Delete tool error:", err)
    res.status(500).json({ error: "Lỗi xoá ứng dụng", message: err.message })
  }
})

export default router
