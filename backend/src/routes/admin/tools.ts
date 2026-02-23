import { Router, Request, Response } from "express"
import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"
import multer from "multer"
import AdmZip from "adm-zip"
import { query, getDatabaseName } from "../../lib/db"
import { getBootstrapEnv, getSetting } from "../../lib/settings"
import { mountBundledApp, unmountBundledApp, clearBundledAppCache } from "../../lib/mounted-apps"
import { getToolDisplayName } from "../../lib/tools"
import { getApp } from "../../lib/app-ref"
import { adminOnly } from "./middleware"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB (package includes dist + public)

const BACKEND_ROOT = path.join(__dirname, "..", "..", "..")
const APPS_DIR = path.join(BACKEND_ROOT, "data", "apps")

/** Portal base path (e.g. /admission). Used when writing embed-config at install. */
function getPortalBasePath(): string {
  return (getBootstrapEnv("BASE_PATH") || getSetting("PORTAL_PUBLIC_BASE_PATH") || "").replace(/\/+$/, "")
}

/** Write embed-config.json into app's public/ so the app and embed router can use basePath set at install. */
function writeEmbedConfig(appDir: string, alias: string): void {
  const basePath = getPortalBasePath()
  if (!basePath) return
  const publicDir = path.join(appDir, "public")
  fs.mkdirSync(publicDir, { recursive: true })
  const embedPath = `${basePath}/embed/${alias}`
  const config = { basePath, embedPath }
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

/** Run schema migration if zip contains SQL file (after extract) */
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
      console.log("[tools] Ran schema portal-embedded.sql for app")
    } catch (e: any) {
      console.warn("[tools] Could not run schema:", e?.message)
    }
  })()
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
        `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
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
          `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
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
        name: getToolDisplayName(a.alias, a.config_json),
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
    const { catalogId } = req.body ?? {}
    const id = String(catalogId ?? "").trim().toLowerCase()
    const app = APP_CATALOG.find((a) => a.id === id || a.alias === id)
    if (!app) {
      return res.status(400).json({ error: "Application not in catalog", catalogId: id })
    }
    const iconVal = (app.icon && ["FileText", "Database", "Bot"].includes(app.icon)) ? app.icon : "Bot"
    await query(
      `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, updated_at)
       VALUES ($1, $2, true, 0, '{"embedded": true}'::jsonb, now())
       ON CONFLICT (alias) DO UPDATE SET
         config_json = ai_portal.tools.config_json || '{"embedded": true}'::jsonb,
         updated_at = now()`,
      [app.alias, iconVal]
    )
    const result = await query(
      `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools WHERE alias = $1`,
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
    if (streamProgress) writeProgress(res, { step, message, status })
  }
  try {
    prog("validating", "Validating package...")
    const file = (req as any).file
    if (!file?.buffer) return res.status(400).json({ error: "Missing package file. Send field 'package' as a .zip file" })
    const zip = new AdmZip(file.buffer)
    const entries = zip.getEntries()
    const manifestEntry = entries.find((e) => e.entryName === "manifest.json" || e.entryName.endsWith("/manifest.json"))
    if (!manifestEntry?.getData()) return res.status(400).json({ error: "Package does not contain manifest.json" })
    const manifest = JSON.parse(manifestEntry.getData().toString("utf-8")) as {
      id?: string
      alias?: string
      name?: string
      icon?: string
      type?: string
      hasBackend?: boolean
      hasFrontendOnly?: boolean
    }
    const alias = String(manifest.alias ?? manifest.id ?? "").trim().toLowerCase()
    if (!alias) return res.status(400).json({ error: "manifest.json must have id or alias" })
    const app = APP_CATALOG.find((a) => a.alias === alias)
    prog("validating", "Package validated", "done")

    const hasDist = entries.some((e) => e.entryName === "dist/server.js" || e.entryName.startsWith("dist/"))
    const hasPackageJson = entries.some((e) => e.entryName === "package.json")
    const hasPublic = entries.some((e) => e.entryName === "public/index.html" || e.entryName.startsWith("public/"))
    const bundled = hasDist && hasPackageJson && (manifest.hasBackend !== false)
    const frontendOnly = !!(manifest.hasFrontendOnly && hasPublic)

    let configJson: Record<string, unknown> = { embedded: true, displayName: manifest.name ?? undefined }

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
      writeEmbedConfig(appDir, alias)
      const indexPath = path.join(appDir, "public", "index.html")
      if (!fs.existsSync(indexPath)) {
        return res.status(400).json({ error: "Frontend-only package must contain public/index.html" })
      }
      configJson = { embedded: true, frontendOnly: true, displayName: manifest.name ?? undefined }
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
        return res.status(400).json({ error: "Package has dist/ but is missing dist/server.js" })
      }

      prog("schema", "Running schema migration (if any)...")
      runSchemaIfExists(appDir, zip)
      prog("schema", "Schema run", "done")

      prog("npm", "Installing dependencies (npm install, may take 1–2 minutes)...")
      const npmResult = spawnSync("npm", ["install", "--production", "--no-audit", "--no-fund"], {
        cwd: appDir,
        shell: true,
        stdio: "inherit",
        timeout: 120_000,
      })
      if (npmResult.status !== 0) {
        return res.status(500).json({ error: "npm install failed in app package" })
      }
      prog("npm", "Dependencies installed", "done")

      configJson = { embedded: true, bundledPath: path.relative(BACKEND_ROOT, appDir), displayName: manifest.name ?? undefined }

      prog("mounting", "Mounting application...")
      const mainApp = getApp()
      if (mainApp) mountBundledApp(mainApp, alias)
      prog("mounting", "Application mounted", "done")
    }

    prog("config", "Configuring database...")
    const iconVal = (manifest.icon && ["FileText", "Database", "Bot"].includes(manifest.icon)) ? manifest.icon : "Bot"
    await query(
      `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, updated_at)
       VALUES ($1, $2, true, 0, $3::jsonb, now())
       ON CONFLICT (alias) DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = now()`,
      [alias, iconVal, JSON.stringify(configJson)]
    )
    const result = await query(
      `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools WHERE alias = $1`,
      [alias]
    )
    prog("config", "Installation complete", "done")

    if (streamProgress) {
      res.write(JSON.stringify({ type: "done", tool: result.rows[0], installed: true }) + "\n")
      res.end()
    } else {
      res.status(200).json({ tool: result.rows[0], installed: true })
    }
  } catch (err: any) {
    console.error("Install package error:", err)
    if (streamProgress) {
      res.write(JSON.stringify({ type: "error", error: err?.message || "Package installation error" }) + "\n")
      res.end()
    } else {
      res.status(500).json({ error: "Package installation error", message: err?.message })
    }
  }
})

router.get("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools
       WHERE id = $1::uuid`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "App not found" })
    }
    const row = result.rows[0] as { alias: string; config_json?: Record<string, unknown> }
    res.json({ tool: { ...row, name: getToolDisplayName(row.alias, row.config_json) } })
  } catch (err: any) {
    console.error("Error fetching tool:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { alias, icon, is_active, display_order, config_json } = req.body
    if (!alias || typeof alias !== "string") {
      return res.status(400).json({ error: "alias is required" })
    }
    const a = String(alias).trim().toLowerCase()
    const iconVal = (icon && ["FileText", "Database", "Bot"].includes(icon)) ? icon : "Bot"
    const result = await query(
      `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
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
    const { is_active, display_order, config_json } = req.body
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
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
      return res.status(400).json({ error: "No fields to update" })
    }
    updates.push(`updated_at = NOW()`)
    values.push(id)
    const result = await query(
      `UPDATE ai_portal.tools
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}::uuid
       RETURNING id, alias, icon, is_active, display_order, config_json, created_at, updated_at`,
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
      return res.status(404).json({ error: "Application does not exist" })
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
    res.status(200).json({ success: true, message: "Application deleted" })
  } catch (err: any) {
    console.error("Delete tool error:", err)
    res.status(500).json({ error: "Error deleting application", message: err.message })
  }
})

export default router
