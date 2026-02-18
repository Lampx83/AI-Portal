// lib/tools.ts – Apps (data), separate from assistants
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
  baseUrl: string
  domainUrl?: string
  configJson?: Record<string, unknown>
}

export interface Tool extends Partial<AgentMetadata> {
  alias: string
  icon: ToolIconName
  baseUrl: string
  domainUrl?: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string
}

function getInternalToolBaseUrl(agentPath: string): string {
  const { getSetting } = require("./settings") as typeof import("./settings")
  const envKey = `${agentPath.toUpperCase().replace(/-/g, "_")}_BASE_URL`
  const v = getSetting(envKey)
  if (v) return v
  return `http://localhost:3001/api/${agentPath}/v1`
}

function getColorForAlias(alias: string): { bgColor: string; iconColor: string } {
  const i = alias === "data" ? 1 : 0
  return colorPalettes[i] ?? colorPalettes[0]
}

const metadataCache = new Map<string, { data: AgentMetadata; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

function isValidMetadata(data: unknown): data is AgentMetadata {
  return !!data && typeof data === "object"
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
      base_url      TEXT NOT NULL,
      domain_url    TEXT,
      is_active     BOOLEAN NOT NULL DEFAULT true,
      display_order INTEGER NOT NULL DEFAULT 0,
      config_json   JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_tools_alias ON ai_portal.tools(alias)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_tools_active ON ai_portal.tools(is_active, display_order)`)
}

let defaultToolsEnsured = false

export async function ensureDefaultTools(): Promise<void> {
  if (defaultToolsEnsured) return
  try {
    await ensureToolsTable()
    const { query } = await import("./db")
    const defaults = [
      { alias: "data", icon: "Database", order: 0, path: "data_agent" },
    ] as const
    for (const d of defaults) {
      const baseUrl = getInternalToolBaseUrl(d.path)
      await query(
        `INSERT INTO ai_portal.tools (alias, icon, base_url, domain_url, is_active, display_order, config_json, updated_at)
         VALUES ($1, $2, $3, NULL, false, $4, '{"isInternal": true}'::jsonb, now())
         ON CONFLICT (alias) DO UPDATE SET
           base_url = EXCLUDED.base_url,
           config_json = COALESCE(tools.config_json, '{}'::jsonb) || '{"isInternal": true}'::jsonb,
           updated_at = now()`,
        [d.alias, d.icon, baseUrl, d.order]
      )
    }
    // Gỡ data khỏi bảng assistants (đã chuyển sang tools). Không xoá write — chỉ cài qua gói zip
    await query(`DELETE FROM ai_portal.assistants WHERE alias IN ('write','data')`)
    defaultToolsEnsured = true
  } catch (e: unknown) {
    console.warn("⚠️ ensureDefaultTools:", (e as Error)?.message || e)
  }
}

/** Kích hoạt tool data nếu frontend đã có (cho phép hiện iframe không cần đăng nhập). */
async function ensureDataToolActivatedIfFrontendExists(): Promise<void> {
  try {
    const dataIndexPath = path.join(APPS_DIR, "data", "public", "index.html")
    if (!fs.existsSync(dataIndexPath)) return
    const { query } = await import("./db")
    const backendBase = getBackendBaseUrl()
    const domainUrl = `${backendBase}/embed/data`
    await query(
      `UPDATE ai_portal.tools SET is_active = true, domain_url = $1, updated_at = now()
       WHERE alias = 'data' AND (domain_url IS NULL OR domain_url = '')`,
      [domainUrl]
    )
  } catch {
    // Ignore
  }
}

export async function getToolConfigs(): Promise<ToolConfig[]> {
  try {
    await ensureDefaultTools()
    await ensureDataToolActivatedIfFrontendExists()
    const { query } = await import("./db")
    const result = await query(
      `SELECT alias, icon, base_url, domain_url, config_json
       FROM ai_portal.tools
       WHERE is_active = true
       ORDER BY display_order ASC, alias ASC`
    )
    return (result.rows as any[]).map((row) => {
      const config = row.config_json || {}
      let baseUrl = row.base_url
      if (config.isInternal && row.alias === "data") {
        baseUrl = getInternalToolBaseUrl("data_agent")
      }
      return {
        alias: row.alias,
        icon: (row.icon || "Bot") as ToolIconName,
        baseUrl,
        domainUrl: row.domain_url || undefined,
        configJson: config,
      }
    })
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
  try {
    const metadata = await fetchToolMetadata(config.baseUrl)
    if (!metadata || !isValidMetadata(metadata)) {
      return {
        alias: config.alias,
        icon: config.icon,
        baseUrl: config.baseUrl,
        domainUrl: config.domainUrl,
        name: config.alias,
        health: "unhealthy",
        ...colors,
      }
    }
    const name = (metadata as { name?: string }).name || config.alias
    return {
      ...metadata,
      ...config,
      ...colors,
      health: "healthy",
      name,
    }
  } catch {
    return {
      alias: config.alias,
      icon: config.icon,
      baseUrl: config.baseUrl,
      domainUrl: config.domainUrl,
      name: config.alias,
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
  if (alias !== "data") return null
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
