// lib/tools.ts – Apps (tools), separate from assistants
import fs from "fs"
import path from "path"
import type { AgentMetadata } from "./agent-types"

const TOOLS_BACKEND_ROOT = path.join(__dirname, "..", "..")
const APPS_DIR = path.join(TOOLS_BACKEND_ROOT, "data", "apps")

function getBackendBaseUrl(): string {
  const { getSetting } = require("./settings") as { getSetting: (k: string, d?: string) => string }
  const v = getSetting("BACKEND_URL")
  if (v) return v.replace(/\/$/, "")
  const port = process.env.PORT || "3001"
  return `http://localhost:${port}`
}

const colorPalettes = [
  { bgColor: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
  { bgColor: "bg-cyan-100 dark:bg-cyan-900/30", iconColor: "text-cyan-600 dark:text-cyan-400" },
]

export type ToolIconName = "FileText" | "Database" | "Bot"

export interface ToolConfig {
  alias: string
  icon: ToolIconName
  configJson?: Record<string, unknown>
}

export interface Tool extends Partial<AgentMetadata> {
  alias: string
  icon: ToolIconName
  baseUrl: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string
}

/** URL gốc của app: bundled = /api/apps/:alias, frontend-only = /api/data_agent/v1 (cùng Portal). */
export function getEffectiveToolBaseUrl(alias: string, configJson?: Record<string, unknown> | null): string {
  const base = getBackendBaseUrl()
  const config = configJson ?? {}
  if ((config as { frontendOnly?: boolean }).frontendOnly) return `${base}/api/data_agent/v1`
  return `${base}/api/apps/${alias}`
}

function getInternalToolBaseUrl(agentPath: string): string {
  const { getSetting } = require("./settings") as typeof import("./settings")
  const envKey = `${agentPath.toUpperCase().replace(/-/g, "_")}_BASE_URL`
  const v = getSetting(envKey)
  if (v) return v
  return `http://localhost:3001/api/${agentPath}/v1`
}

function getColorForAlias(_alias: string): { bgColor: string; iconColor: string } {
  return colorPalettes[0]
}

const metadataCache = new Map<string, { data: AgentMetadata; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

function isValidMetadata(data: unknown): data is AgentMetadata {
  return !!data && typeof data === "object"
}

/** Đọc tên hiển thị từ manifest.json của app đã giải nén (khi config_json không có displayName). */
function readDisplayNameFromManifest(alias: string): string | null {
  if (!alias || alias.includes("..")) return null
  const candidates = [
    path.join(APPS_DIR, alias, "manifest.json"),
    path.join(APPS_DIR, alias, "package", "manifest.json"),
  ]
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, "utf-8")
      const manifest = JSON.parse(raw) as { name?: string }
      if (typeof manifest.name === "string" && manifest.name.trim()) return manifest.name.trim()
    } catch {
      // ignore
    }
  }
  return null
}

/** Tên hiển thị cho tool: config_json.displayName || manifest.name || alias. Dùng cho API và Admin. */
export function getToolDisplayName(
  alias: string,
  configJson?: Record<string, unknown> | null
): string {
  const fromConfig = (configJson as { displayName?: string } | undefined)?.displayName
  if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig.trim()
  const fromManifest = readDisplayNameFromManifest(alias)
  if (fromManifest) return fromManifest
  return alias
}

async function fetchToolMetadata(baseUrl: string): Promise<AgentMetadata | null> {
  try {
    const cached = metadataCache.get(baseUrl)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data
    const res = await fetch(`${baseUrl}/metadata`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!isValidMetadata(data)) return null
    metadataCache.set(baseUrl, { data: data as AgentMetadata, timestamp: Date.now() })
    return data as AgentMetadata
  } catch {
    return null
  }
}

async function ensureToolsTable(): Promise<void> {
  const { query } = await import("./db")
  await query(`
    CREATE TABLE IF NOT EXISTS ai_portal.tools (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alias         TEXT NOT NULL UNIQUE,
      icon          TEXT NOT NULL DEFAULT 'Bot',
      is_active     BOOLEAN NOT NULL DEFAULT true,
      display_order INTEGER NOT NULL DEFAULT 0,
      config_json   JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_tools_alias ON ai_portal.tools(alias)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_tools_active ON ai_portal.tools(is_active, display_order)`)
  try {
    await query(`ALTER TABLE ai_portal.tools DROP COLUMN IF EXISTS base_url`)
    await query(`ALTER TABLE ai_portal.tools DROP COLUMN IF EXISTS domain_url`)
  } catch {
    // ignore if columns already dropped or table structure differs
  }
}

let defaultToolsEnsured = false

export async function ensureDefaultTools(): Promise<void> {
  if (defaultToolsEnsured) return
  try {
    await ensureToolsTable()
    const { query } = await import("./db")
    const defaults: { alias: string; icon: string; order: number }[] = []
    for (const d of defaults) {
      await query(
        `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, updated_at)
         VALUES ($1, $2, false, $3, '{"isInternal": true}'::jsonb, now())
         ON CONFLICT (alias) DO UPDATE SET
           config_json = COALESCE(tools.config_json, '{}'::jsonb) || '{"isInternal": true}'::jsonb,
           updated_at = now()`,
        [d.alias, d.icon, d.order]
      )
    }
    await query(`DELETE FROM ai_portal.tools WHERE alias = 'data'`)
    await query(`DELETE FROM ai_portal.assistants WHERE alias = 'write'`)
    defaultToolsEnsured = true
  } catch (e: unknown) {
    console.warn("⚠️ ensureDefaultTools:", (e as Error)?.message || e)
  }
}

export async function getToolConfigs(): Promise<ToolConfig[]> {
  try {
    await ensureDefaultTools()
    const { query } = await import("./db")
    const result = await query(
      `SELECT alias, icon, config_json
       FROM ai_portal.tools
       WHERE is_active = true
       ORDER BY display_order ASC, alias ASC`
    )
    return (result.rows as any[]).map((row) => ({
      alias: row.alias,
      icon: (row.icon || "Bot") as ToolIconName,
      configJson: row.config_json || {},
    }))
  } catch (e: unknown) {
    console.warn("⚠️ getToolConfigs:", (e as Error)?.message || e)
    return []
  }
}

export async function getToolByAlias(alias: string): Promise<Tool | null> {
  const configs = await getToolConfigs()
  const config = configs.find((c) => c.alias === alias)
  if (!config) return null
  return getTool(config)
}

async function getTool(config: ToolConfig): Promise<Tool> {
  const colors = getColorForAlias(config.alias)
  const baseUrl = getEffectiveToolBaseUrl(config.alias, config.configJson)
  try {
    const metadata = await fetchToolMetadata(baseUrl)
    if (!metadata || !isValidMetadata(metadata)) {
      return {
        alias: config.alias,
        icon: config.icon,
        baseUrl,
        name: getToolDisplayName(config.alias, config.configJson),
        health: "unhealthy",
        ...colors,
      }
    }
    const name = getToolDisplayName(config.alias, config.configJson)
    return {
      ...metadata,
      ...config,
      baseUrl,
      ...colors,
      health: "healthy",
      name,
    }
  } catch {
    return {
      alias: config.alias,
      icon: config.icon,
      baseUrl: getEffectiveToolBaseUrl(config.alias, config.configJson),
      name: getToolDisplayName(config.alias, config.configJson),
      health: "unhealthy",
      ...colors,
    }
  }
}

export async function getAllTools(): Promise<Tool[]> {
  const configs = await getToolConfigs()
  return Promise.all(configs.map((c) => getTool(c)))
}

export async function getEmbedConfigByAlias(alias: string): Promise<{ embed_allow_all: boolean; embed_allowed_domains: string[] } | null> {
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT config_json FROM ai_portal.tools WHERE alias = $1 AND is_active = true LIMIT 1`,
      [alias]
    )
    if (!result.rows[0]) return null
    const config = (result.rows[0] as { config_json?: Record<string, unknown> }).config_json ?? {}
    return {
      embed_allow_all: !!config.embed_allow_all,
      embed_allowed_domains: Array.isArray(config.embed_allowed_domains)
        ? (config.embed_allowed_domains as string[]).filter((d) => typeof d === "string" && d.trim().length > 0).map((d) => d.trim())
        : [],
    }
  } catch {
    return null
  }
}
