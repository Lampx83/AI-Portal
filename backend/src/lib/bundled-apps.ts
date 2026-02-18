/**
 * Quản lý và spawn các ứng dụng bundled (extract từ gói zip, chạy trong process riêng).
 */
import fs from "fs"
import path from "path"
import { spawn } from "child_process"
import { query } from "./db"
import { getDatabaseName } from "./db"
import { getBootstrapEnv } from "./settings"

export const bundledAppProcesses = new Map<string, ReturnType<typeof spawn>>()

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

export function spawnBundledApp(alias: string, appDir: string, port: number): boolean {
  const existing = bundledAppProcesses.get(alias)
  if (existing?.killed === false) {
    try {
      existing.kill()
    } catch {
      /* ignore */
    }
    bundledAppProcesses.delete(alias)
  }
  const serverPath = path.join(appDir, "dist", "server.js")
  if (!fs.existsSync(serverPath)) return false
  const dbUrl = buildPortalDatabaseUrl()
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const env = {
    ...process.env,
    PORT: String(port),
    PORTAL_DATABASE_URL: dbUrl,
    DATABASE_URL: dbUrl,
    DB_SCHEMA: "ai_portal",
    AUTH_MODE: "portal",
    RUN_MODE: "embedded",
    CORS_ORIGIN: nextAuthUrl + ",http://localhost:" + port,
    SESSION_SECRET: process.env.SESSION_SECRET || "write-app-portal-embedded",
  }
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: appDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  child.stdout?.on("data", (d) => process.stdout.write(`[app:${alias}] ${d}`))
  child.stderr?.on("data", (d) => process.stderr.write(`[app:${alias}] ${d}`))
  child.on("exit", (code) => {
    bundledAppProcesses.delete(alias)
    if (code && code !== 0) console.warn(`[bundled-apps] App ${alias} exited with code ${code}`)
  })
  bundledAppProcesses.set(alias, child)
  return true
}

/** Spawn lại các app bundled khi Portal khởi động. */
export async function spawnAllBundledApps(): Promise<void> {
  const backendRoot = path.join(__dirname, "..", "..")
  try {
    const result = await query<{ alias: string; config_json: { bundledPath?: string; port?: number } }>(
      `SELECT alias, config_json FROM ai_portal.tools
       WHERE is_active = true
         AND config_json->>'bundledPath' IS NOT NULL
         AND config_json->>'port' IS NOT NULL`
    )
    for (const row of result.rows) {
      const cfg = row.config_json ?? {}
      const bundledPath = cfg.bundledPath
      const port = Number(cfg.port)
      if (!bundledPath || !Number.isInteger(port) || port < 1) continue
      const appDir = path.isAbsolute(bundledPath) ? bundledPath : path.join(backendRoot, bundledPath)
      if (!fs.existsSync(path.join(appDir, "dist", "server.js"))) continue
      spawnBundledApp(row.alias, appDir, port)
      console.log("[bundled-apps] Started", row.alias, "on port", port)
    }
  } catch (e: any) {
    console.warn("[bundled-apps] spawnAllBundledApps failed:", e?.message)
  }
}
