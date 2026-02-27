// lib/assistants.ts – AI assistants (AI Portal)
import type { AgentMetadata, SupportedModel } from "./agent-types"
import { getSetting } from "./settings"

// Color palette for assistant icons and backgrounds
const colorPalettes = [
  { bgColor: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400" },
  { bgColor: "bg-cyan-100 dark:bg-cyan-900/30", iconColor: "text-cyan-600 dark:text-cyan-400" },
  { bgColor: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-600 dark:text-purple-400" },
  { bgColor: "bg-pink-100 dark:bg-pink-900/30", iconColor: "text-pink-600 dark:text-pink-400" },
  { bgColor: "bg-indigo-100 dark:bg-indigo-900/30", iconColor: "text-indigo-600 dark:text-indigo-400" },
  { bgColor: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
  { bgColor: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400" },
  { bgColor: "bg-orange-100 dark:bg-orange-900/30", iconColor: "text-orange-600 dark:text-orange-400" },
  { bgColor: "bg-teal-100 dark:bg-teal-900/30", iconColor: "text-teal-600 dark:text-teal-400" },
  { bgColor: "bg-rose-100 dark:bg-rose-900/30", iconColor: "text-rose-600 dark:text-rose-400" },
  { bgColor: "bg-violet-100 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400" },
  { bgColor: "bg-sky-100 dark:bg-sky-900/30", iconColor: "text-sky-600 dark:text-sky-400" },
]

/**
 * Get color by alias for consistency
 */
function getColorForAlias(alias: string): { bgColor: string; iconColor: string } {
  // Hash alias so the same alias always gets the same color
  let hash = 0
  for (let i = 0; i < alias.length; i++) {
    hash = alias.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colorPalettes.length
  return colorPalettes[index]
}

// Icon types - backend uses string identifiers only (no lucide-react)
export type IconName =
  | "Users"
  | "Database"
  | "ListTodo"
  | "ShieldCheck"
  | "Award"
  | "Newspaper"
  | "FileText"
  | "Bot"

// Minimal config per assistant
export interface AssistantConfig {
  alias: string
  icon: IconName
  baseUrl: string
  /** config_json from DB: isInternal, routing_hint, ... */
  configJson?: Record<string, unknown>
}

// Full interface after merging with API metadata
export interface Assistant extends Partial<AgentMetadata> {
  alias: string
  icon: IconName
  baseUrl: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string // Always has name (from metadata or alias)
}

// Helper to resolve baseUrl for internal agents (central/orchestrator, data)
// When backend calls itself, always use localhost (same process/container)
function getInternalAgentBaseUrl(agentPath: string): string {
  const envKey = `${agentPath.toUpperCase().replace("/", "_").replace("-", "_")}_BASE_URL`
  const v = getSetting(envKey)
  if (v) return v
  return `http://localhost:3001/api/${agentPath}/v1`
}

/** Allowed embed domain config for agent (for CSP frame-ancestors). Returns null if agent does not exist. */
export async function getEmbedConfigByAlias(alias: string): Promise<{ embed_allow_all: boolean; embed_allowed_domains: string[] } | null> {
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT config_json FROM ai_portal.assistants WHERE alias = $1 AND is_active = true LIMIT 1`,
      [alias]
    )
    if (!result.rows[0]) return null
    const config = (result.rows[0] as { config_json?: Record<string, unknown> }).config_json ?? {}
    const embed_allow_all = !!config.embed_allow_all
    const embed_allowed_domains = Array.isArray(config.embed_allowed_domains)
      ? (config.embed_allowed_domains as string[]).filter((d) => typeof d === "string" && d.trim().length > 0).map((d) => d.trim())
      : []
    return { embed_allow_all, embed_allowed_domains }
  } catch (e: any) {
    console.warn("⚠️ getEmbedConfigByAlias:", e?.message || e)
    return null
  }
}

/** Daily message limit for embed (from config_json.embed_daily_message_limit). null = no limit. */
export async function getEmbedDailyLimitByAlias(alias: string): Promise<number | null> {
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT config_json FROM ai_portal.assistants WHERE alias = $1 AND is_active = true LIMIT 1`,
      [alias]
    )
    if (!result.rows[0]) return null
    const config = (result.rows[0] as { config_json?: Record<string, unknown> }).config_json ?? {}
    const raw = config.embed_daily_message_limit
    if (raw == null || raw === "") return null
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1) return null
    return n
  } catch (e: any) {
    console.warn("⚠️ getEmbedDailyLimitByAlias:", e?.message || e)
    return null
  }
}

/** Daily message limit for agent (web chat). From config_json.daily_message_limit, default 100. */
export async function getAgentDailyMessageLimitByAlias(alias: string): Promise<number> {
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT config_json FROM ai_portal.assistants WHERE alias = $1 AND is_active = true LIMIT 1`,
      [alias]
    )
    if (!result.rows[0]) return 100
    const config = (result.rows[0] as { config_json?: Record<string, unknown> }).config_json ?? {}
    const raw = config.daily_message_limit
    if (raw == null || raw === "") return 100
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1) return 100
    return n
  } catch (e: any) {
    console.warn("⚠️ getAgentDailyMessageLimitByAlias:", e?.message || e)
    return 100
  }
}

let defaultAssistantsEnsured = false
// Ensure only central (main assistant) is in DB (data app moved to tools table)
async function ensureDefaultAssistants(): Promise<void> {
  if (defaultAssistantsEnsured) return
  try {
    const { query } = await import("./db")
    const baseUrl = getInternalAgentBaseUrl("central_agent")
    // Migration: rename old alias 'main' to 'central' (single main assistant)
    await query(
      `UPDATE ai_portal.assistants SET alias = 'central', base_url = $1, updated_at = now() WHERE alias = 'main'`,
      [baseUrl]
    )
    await query(
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, is_active, display_order, config_json, updated_at)
       VALUES ('central', 'Bot', $1, true, 0, '{"isInternal": true}'::jsonb, now())
       ON CONFLICT (alias) DO UPDATE SET
         is_active = true,
         base_url = EXCLUDED.base_url,
         config_json = COALESCE(assistants.config_json, '{}'::jsonb) || '{"isInternal": true}'::jsonb,
         updated_at = now()`,
      [baseUrl]
    )
    defaultAssistantsEnsured = true
  } catch (e: any) {
    console.warn("⚠️ ensureDefaultAssistants:", e?.message || e)
  }
}

// Load config list from database instead of hardcoding
export async function getAssistantConfigs(): Promise<AssistantConfig[]> {
  try {
    await ensureDefaultAssistants()
    const { query } = await import("./db")
    const result = await query(
      `SELECT alias, icon, base_url, config_json
       FROM ai_portal.assistants
       WHERE is_active = true
       ORDER BY display_order ASC, alias ASC`
    )
    const configs = result.rows.map((row: any) => {
      const config = row.config_json || {}
      let baseUrl = row.base_url
      if (config.isInternal) {
        // central (main assistant) uses central_agent route
        const agentPath = row.alias === "central" ? "central_agent" : `${row.alias}_agent`
        baseUrl = getInternalAgentBaseUrl(agentPath)
      }
      return {
        alias: row.alias,
        icon: (row.icon || "Bot") as IconName,
        baseUrl,
        configJson: config,
      }
    })
    return configs
  } catch (e: any) {
    console.warn("⚠️ Failed to load assistants from DB:", e?.message || e)
    return []
  }
}

const metadataCache = new Map<string, { data: AgentMetadata; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/** Invalidate cached metadata for central agent so GET /api/assistants/central returns fresh supported_models after config save. */
export function invalidateCentralAgentMetadataCache(): void {
  const base = getInternalAgentBaseUrl("central_agent").replace(/\/+$/, "")
  metadataCache.delete(base)
}

function isValidMetadata(data: any): data is AgentMetadata {
  if (!data || typeof data !== "object") return false
  return true
}

async function fetchAssistantMetadata(baseUrl: string): Promise<AgentMetadata | null> {
  try {
    const normalizedBase = baseUrl.replace(/\/+$/, "")
    const cached = metadataCache.get(normalizedBase)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }
    const metadataUrl = `${normalizedBase}/metadata`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(metadataUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!response.ok) return null
      const metadata = await response.json()
      if (!isValidMetadata(metadata)) return null
      const agentMetadata = metadata as AgentMetadata
      metadataCache.set(normalizedBase, { data: agentMetadata, timestamp: Date.now() })
      return agentMetadata
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      return null
    }
  } catch (error: any) {
    return null
  }
}

/**
 * Merge config with API metadata to build full Assistant
 */
export async function getAssistant(config: AssistantConfig): Promise<Assistant> {
  try {
    const metadata = await fetchAssistantMetadata(config.baseUrl)
    const colors = getColorForAlias(config.alias)
    if (!metadata || !isValidMetadata(metadata)) {
      const displayName = (config.configJson as { displayName?: string } | undefined)?.displayName
      const name =
        typeof displayName === "string" && displayName.trim() ? displayName.trim() : config.alias
      return {
        alias: config.alias,
        icon: config.icon,
        baseUrl: config.baseUrl,
        name,
        health: "unhealthy",
        ...colors,
      }
    }
    const normalizedMetadata: AgentMetadata = {
      ...metadata,
      name: metadata.name || config.alias,
      provided_data_types: metadata.provided_data_types?.map((dt: any) => ({
        type: dt.type,
        description: dt.description || dt.detail || undefined,
      })),
    }
    const displayName = (config.configJson as { displayName?: string } | undefined)?.displayName
    const finalName =
      typeof displayName === "string" && displayName.trim()
        ? displayName.trim()
        : normalizedMetadata.name
    return {
      ...normalizedMetadata,
      ...config,
      ...colors,
      health: "healthy",
      name: finalName,
    }
  } catch (error: any) {
    const colors = getColorForAlias(config.alias)
    const displayName = (config.configJson as { displayName?: string } | undefined)?.displayName
    const name =
      typeof displayName === "string" && displayName.trim() ? displayName.trim() : config.alias
    return {
      alias: config.alias,
      icon: config.icon,
      baseUrl: config.baseUrl,
      name,
      health: "unhealthy",
      ...colors,
    }
  }
}

export async function getAllAssistants(): Promise<Assistant[]> {
  const configs = await getAssistantConfigs()
  return Promise.all(configs.map((config) => getAssistant(config)))
}

export async function getAssistantByAlias(alias: string): Promise<Assistant | null> {
  const configs = await getAssistantConfigs()
  const config = configs.find((c) => c.alias === alias)
  if (!config) return null
  const assistant = await getAssistant(config)
  // Main assistant (central) display name "Main Assistant" / "AI Central"
  if (alias === "central") {
    return { ...assistant, name: assistant.name || "Trợ lý chính" }
  }
  return assistant
}

/** For orchestrator: list of assistants (except central) + apps (data) */
export async function getAgentsForOrchestrator(): Promise<
  Array<{
    alias: string
    name: string
    icon: string
    baseUrl: string
    description: string
    supported_models?: SupportedModel[]
    routing_hint?: string
    sample_prompts?: string[]
  }>
> {
  const configs = await getAssistantConfigs()
  const withoutCentral = configs.filter((c) => c.alias !== "central")
  const configByAlias = new Map(withoutCentral.map((c) => [c.alias, c.configJson]))
  const assistants = await Promise.all(withoutCentral.map((c) => getAssistant(c)))
  const fromAssistants = assistants.map((a) => {
    const cfg = configByAlias.get(a.alias) as { routing_hint?: string } | undefined
    const routingHint = typeof cfg?.routing_hint === "string" ? cfg.routing_hint : undefined
    return {
      alias: a.alias,
      name: a.name || a.alias,
      icon: a.icon,
      baseUrl: a.baseUrl,
      description: String(a.description || a.name || a.alias).slice(0, 300),
      supported_models: a.supported_models ?? [],
      routing_hint: routingHint,
      sample_prompts: a.sample_prompts ?? [],
    }
  })
  const { getAllTools, getToolConfigs } = await import("./tools")
  const toolConfigs = await getToolConfigs()
  const tools = await getAllTools(toolConfigs)
  const toolConfigByAlias = new Map(toolConfigs.map((c) => [c.alias, c.configJson]))
  const fromTools = tools
    .filter((t): t is typeof t & { baseUrl: string } => t.baseUrl != null && t.baseUrl !== "")
    .map((t) => {
      const cfg = toolConfigByAlias.get(t.alias) as { routing_hint?: string } | undefined
      const routingHint = typeof cfg?.routing_hint === "string" ? cfg.routing_hint : undefined
      const toolWithMeta = t as { sample_prompts?: string[] }
      return {
        alias: t.alias,
        name: t.name || t.alias,
        icon: t.icon as string,
        baseUrl: t.baseUrl,
        description: String((t as { description?: string }).description || t.name || t.alias).slice(0, 300),
        supported_models: (t as { supported_models?: SupportedModel[] }).supported_models ?? [],
        routing_hint: routingHint,
        sample_prompts: toolWithMeta.sample_prompts ?? [],
      }
    })
  return [...fromAssistants, ...fromTools]
}

/** Lấy danh sách sample_prompts từ các agent khác (dùng cho metadata Trợ lý Central). */
export async function getCentralSamplePromptsFromAgents(): Promise<string[]> {
  const agents = await getAgentsForOrchestrator()
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of agents) {
    const prompts = a.sample_prompts ?? []
    for (const p of prompts) {
      const s = typeof p === "string" ? p.trim() : ""
      if (s && !seen.has(s)) {
        seen.add(s)
        out.push(s)
      }
    }
  }
  return out.slice(0, 40)
}
