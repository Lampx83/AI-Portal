// lib/tools.ts – Apps (tools), separate from assistants
import fs from "fs"
import path from "path"
import type { AgentMetadata } from "./agent-types"
import { getSetting } from "./settings"

const TOOLS_BACKEND_ROOT = path.join(__dirname, "..", "..")
const APPS_DIR = path.join(TOOLS_BACKEND_ROOT, "data", "apps")

function getBackendBaseUrl(): string {
  const v = getSetting("BACKEND_URL")
  if (v) return v.replace(/\/$/, "")
  const port = process.env.PORT || "3001"
  return `http://localhost:${port}`
}

const colorPalettes = [
  { bgColor: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
  { bgColor: "bg-cyan-100 dark:bg-cyan-900/30", iconColor: "text-cyan-600 dark:text-cyan-400" },
  { bgColor: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400" },
  { bgColor: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-600 dark:text-purple-400" },
  { bgColor: "bg-pink-100 dark:bg-pink-900/30", iconColor: "text-pink-600 dark:text-pink-400" },
  { bgColor: "bg-indigo-100 dark:bg-indigo-900/30", iconColor: "text-indigo-600 dark:text-indigo-400" },
  { bgColor: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400" },
  { bgColor: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-600 dark:text-orange-400" },
  { bgColor: "bg-teal-100 dark:bg-teal-900/30", iconColor: "text-teal-600 dark:text-teal-400" },
  { bgColor: "bg-rose-100 dark:bg-rose-900/30", iconColor: "text-rose-600 dark:text-rose-400" },
  { bgColor: "bg-violet-100 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400" },
  { bgColor: "bg-sky-100 dark:bg-sky-900/30", iconColor: "text-sky-600 dark:text-sky-400" },
]

/**
 * Get color by alias for consistency (same tool always gets same color, like assistants).
 */
function getColorForAlias(alias: string): { bgColor: string; iconColor: string } {
  let hash = 0
  for (let i = 0; i < alias.length; i++) {
    hash = alias.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colorPalettes.length
  return colorPalettes[index]
}

export type ToolIconName = string

export interface ToolConfig {
  alias: string
  icon: ToolIconName
  configJson?: Record<string, unknown>
  /** When true, tool appears in sidebar/home by default. User can also pin more via UI. */
  pinned?: boolean
  /** Tool do chính user cài (chỉ user đó thấy, có thể gỡ cài). */
  categorySlug?: string | null
  categoryName?: string | null
  isUserInstalled?: boolean
}

export interface Tool extends Partial<AgentMetadata> {
  alias: string
  icon: ToolIconName
  baseUrl: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string
  config_json?: Record<string, unknown>
  /** Store category slug (for grouping in Store). */
  category_slug?: string | null
  /** Store category display name. */
  category_name?: string | null
  /** Tool do chính user cài (có thể gỡ cài từ Dialog Tools). */
  user_installed?: boolean
}

/** App base URL: bundled = /api/apps/:alias; frontend-only = /api/central_agent/v1 or config.apiProxyTarget (proxy to external backend). */
export function getEffectiveToolBaseUrl(alias: string, configJson?: Record<string, unknown> | null): string {
  const base = getBackendBaseUrl()
  const config = configJson ?? {}
  const frontendOnly = (config as { frontendOnly?: boolean }).frontendOnly
  const apiProxyTarget = (config as { apiProxyTarget?: string }).apiProxyTarget
  if (frontendOnly && typeof apiProxyTarget === "string" && apiProxyTarget.trim()) {
    return apiProxyTarget.trim().replace(/\/+$/, "")
  }
  if (frontendOnly) return `${base}/api/central_agent/v1`
  return `${base}/api/apps/${alias}`
}

function getInternalToolBaseUrl(agentPath: string): string {
  const envKey = `${agentPath.toUpperCase().replace(/-/g, "_")}_BASE_URL`
  const v = getSetting(envKey)
  if (v) return v
  return `http://localhost:3001/api/${agentPath}/v1`
}

const metadataCache = new Map<string, { data: AgentMetadata; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

/** Manifest fields for Central orchestrator context (from manifest.json on disk). */
export interface ToolManifestForCentral {
  alias: string
  name: string
  description: string
  keywords: string[]
}

/** Read manifest.json for a tool (name, description, keywords). Used by orchestrator for system context. */
function readManifestForCentral(alias: string): ToolManifestForCentral | null {
  if (!alias || alias.includes("..")) return null
  const candidates = [
    path.join(APPS_DIR, alias, "package", "manifest.json"),
    path.join(APPS_DIR, alias, "manifest.json"),
  ]
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, "utf-8")
      const manifest = JSON.parse(raw) as {
        name?: string
        description?: string
        keywords?: string[]
      }
      const name = typeof manifest.name === "string" ? manifest.name.trim() : alias
      const description = typeof manifest.description === "string" ? manifest.description.trim() : ""
      const keywords = Array.isArray(manifest.keywords)
        ? manifest.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
        : []
      return { alias, name, description, keywords }
    } catch {
      // ignore
    }
  }
  return null
}

/** Get tools manifests for Central system prompt. Only global tools (user_id IS NULL). */
export async function getToolsManifestsForCentral(): Promise<ToolManifestForCentral[]> {
  const configs = await getToolConfigs(null)
  const out: ToolManifestForCentral[] = []
  for (const c of configs) {
    const m = readManifestForCentral(c.alias)
    if (m) out.push(m)
  }
  return out
}

function isValidMetadata(data: unknown): data is AgentMetadata {
  return !!data && typeof data === "object"
}

/** Read supported_languages from extracted app's manifest.json. */
export function readSupportedLanguagesFromManifest(alias: string): string[] {
  if (!alias || alias.includes("..")) return []
  const candidates = [
    path.join(APPS_DIR, alias, "manifest.json"),
    path.join(APPS_DIR, alias, "package", "manifest.json"),
  ]
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, "utf-8")
      const manifest = JSON.parse(raw) as { supported_languages?: string[] }
      const list = manifest.supported_languages
      if (Array.isArray(list) && list.length > 0) {
        return list.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().toLowerCase())
      }
    } catch {
      // ignore
    }
  }
  return []
}
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

/** Display name for tool: config_json.displayName || manifest.name || alias. Used for API and Admin. */
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
    const normalizedBase = baseUrl.replace(/\/+$/, "")
    const cached = metadataCache.get(normalizedBase)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data
    const res = await fetch(`${normalizedBase}/metadata`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!isValidMetadata(data)) return null
    metadataCache.set(normalizedBase, { data: data as AgentMetadata, timestamp: Date.now() })
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
  try {
    await query(`ALTER TABLE ai_portal.tools ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false`)
  } catch {
    // ignore if column already exists
  }
  try {
    await query(`ALTER TABLE ai_portal.tools ADD COLUMN IF NOT EXISTS category_id UUID`)
  } catch {
    // ignore; migration 003 may add it with FK to tool_categories
  }
  try {
    await query(`ALTER TABLE ai_portal.tools ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES ai_portal.users(id) ON DELETE CASCADE`)
  } catch {
    // ignore; migration 004 adds it
  }
}

let defaultToolsEnsured = false

/** Tools (apps) do not store base_url/domain_url in DB; base URL is derived via getEffectiveToolBaseUrl(alias, config_json). */
export async function ensureDefaultTools(): Promise<void> {
  if (defaultToolsEnsured) return
  try {
    await ensureToolsTable()
    const { query } = await import("./db")
    const defaults: { alias: string; icon: string; order: number }[] = []
    for (const d of defaults) {
      await query(
        `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, user_id, updated_at)
         VALUES ($1, $2, false, $3, '{"isInternal": true}'::jsonb, NULL, now())
         ON CONFLICT (alias) WHERE (user_id IS NULL) DO UPDATE SET
           config_json = COALESCE(ai_portal.tools.config_json, '{}'::jsonb) || '{"isInternal": true}'::jsonb,
           updated_at = now()`,
        [d.alias, d.icon, d.order]
      )
    }
    await query(`DELETE FROM ai_portal.tools WHERE alias = 'data'`)
    await query(`DELETE FROM ai_portal.assistants WHERE alias = 'write'`)
    defaultToolsEnsured = true
  } catch (e: unknown) {
    console.warn("⚠️ ensureDefaultTools:", (e as Error)?.message || e)
    defaultToolsEnsured = false
  }
}

/** List tools: global (user_id IS NULL) + tools of the given user. Pass null/undefined for guest = only global. */
export async function getToolConfigs(userId?: string | null): Promise<ToolConfig[]> {
  try {
    await ensureDefaultTools()
    const { query } = await import("./db")
    const whereClause = userId
      ? `(t.user_id IS NULL OR t.user_id = $1::uuid)`
      : `t.user_id IS NULL`
    const params = userId ? [userId] : []
    let result: { rows: any[] }
    try {
      result = await query(
        `SELECT t.alias, t.icon, t.config_json, t.pinned, t.category_id, t.user_id,
                c.slug AS category_slug, c.name AS category_name
         FROM ai_portal.tools t
         LEFT JOIN ai_portal.tool_categories c ON c.id = t.category_id
         WHERE t.is_active = true AND ${whereClause}
         ORDER BY t.display_order ASC, t.alias ASC`,
        params
      )
    } catch (e: any) {
      if (e?.code === "42P01" || e?.code === "42703") {
        result = await query(
          `SELECT alias, icon, config_json, pinned, user_id
           FROM ai_portal.tools
           WHERE is_active = true AND ${whereClause}
           ORDER BY display_order ASC, alias ASC`,
          params
        )
        return (result.rows as any[]).map((row) => ({
          alias: row.alias,
          icon: (row.icon || "Bot") as ToolIconName,
          configJson: row.config_json || {},
          pinned: !!row.pinned,
          categoryId: null,
          categorySlug: null,
          categoryName: null,
          isUserInstalled: !!row.user_id,
        }))
      }
      throw e
    }
    return (result.rows as any[]).map((row) => {
      const categorySlug = row.category_slug != null ? String(row.category_slug).trim() || null : null
      const categoryName = row.category_name != null ? String(row.category_name).trim() || null : null
      return {
        alias: row.alias,
        icon: (row.icon || "Bot") as ToolIconName,
        configJson: row.config_json || {},
        pinned: !!row.pinned,
        categoryId: row.category_id ?? null,
        categorySlug,
        categoryName,
        isUserInstalled: !!row.user_id,
      }
    })
  } catch (e: unknown) {
    console.warn("⚠️ getToolConfigs:", (e as Error)?.message || e)
    return []
  }
}

export async function getToolByAlias(alias: string, userId?: string | null): Promise<Tool | null> {
  const configs = await getToolConfigs(userId ?? undefined)
  const config = configs.find((c) => c.alias === alias)
  if (!config) return null
  return getTool(config)
}

async function getTool(config: ToolConfig): Promise<Tool> {
  const colors = getColorForAlias(config.alias)
  const baseUrl = getEffectiveToolBaseUrl(config.alias, config.configJson)
  const configJson = config.configJson ?? {}
  const supportedLanguages =
    (configJson.supported_languages as string[] | undefined) ||
    readSupportedLanguagesFromManifest(config.alias) ||
    []
  const mergedConfig = { ...configJson, supported_languages: supportedLanguages.length > 0 ? supportedLanguages : ["en", "vi"] }
  const name = getToolDisplayName(config.alias, config.configJson)
  // App đã cài thì luôn coi là available, không gọi /metadata để check health
  return {
    alias: config.alias,
    icon: config.icon,
    baseUrl,
    name,
    health: "healthy",
    ...colors,
    config_json: mergedConfig,
    category_slug: config.categorySlug ?? null,
    category_name: config.categoryName ?? null,
    user_installed: !!config.isUserInstalled,
  }
}

/** Get all tools. Pass configs to avoid duplicate getToolConfigs() when caller already has them. */
export async function getAllTools(existingConfigs?: ToolConfig[]): Promise<Tool[]> {
  const configs = existingConfigs ?? (await getToolConfigs())
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

/** Get tool row by alias for access check (embed). Returns user_id: null = global, set = only that user. */
export async function getToolRowByAlias(alias: string): Promise<{ config_json: Record<string, unknown>; user_id: string | null } | null> {
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT config_json, user_id FROM ai_portal.tools WHERE alias = $1 AND is_active = true LIMIT 1`,
      [alias]
    )
    if (!result.rows[0]) return null
    const row = result.rows[0] as { config_json?: Record<string, unknown>; user_id: string | null }
    return {
      config_json: row.config_json ?? {},
      user_id: row.user_id ?? null,
    }
  } catch {
    return null
  }
}

/** Lấy config_json của tool theo alias (dùng khi serve embed để inject api base). */
export async function getToolConfigJsonByAlias(alias: string): Promise<Record<string, unknown> | null> {
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT config_json FROM ai_portal.tools WHERE alias = $1 AND is_active = true LIMIT 1`,
      [alias]
    )
    if (!result.rows[0]) return null
    return (result.rows[0] as { config_json?: Record<string, unknown> }).config_json ?? null
  } catch {
    return null
  }
}
