// lib/assistants.ts – trợ lý AI (AI Portal)
import type { AgentMetadata, SupportedModel } from "./agent-types"

// Danh sách màu sắc đa dạng cho icon và background đa dạng cho icon và background
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
 * Lấy màu sắc dựa trên alias để đảm bảo nhất quán
 */
function getColorForAlias(alias: string): { bgColor: string; iconColor: string } {
  // Tạo hash từ alias để luôn trả về cùng màu cho cùng alias
  let hash = 0
  for (let i = 0; i < alias.length; i++) {
    hash = alias.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colorPalettes.length
  return colorPalettes[index]
}

// Icon types - backend không cần import lucide-react, chỉ cần string identifier
export type IconName =
  | "Users"
  | "Database"
  | "ListTodo"
  | "ShieldCheck"
  | "Award"
  | "Newspaper"
  | "FileText"
  | "Bot"

// Cấu hình tối thiểu cho mỗi trợ lý
export interface AssistantConfig {
  alias: string
  icon: IconName
  baseUrl: string
  domainUrl?: string
  /** config_json từ DB: isInternal, routing_hint, ... */
  configJson?: Record<string, unknown>
}

// Interface đầy đủ sau khi merge với metadata từ API
export interface Assistant extends Partial<AgentMetadata> {
  alias: string
  icon: IconName
  baseUrl: string
  domainUrl?: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string // Luôn có name (từ metadata hoặc alias)
}

// Helper để xác định baseUrl cho internal agents (central/orchestrator, data)
// Khi backend gọi đến chính nó, luôn dùng localhost vì đó là cùng một process/container
function getInternalAgentBaseUrl(agentPath: string): string {
  const envKey = `${agentPath.toUpperCase().replace("/", "_").replace("-", "_")}_BASE_URL`
  const { getSetting } = require("./settings") as typeof import("./settings")
  const v = getSetting(envKey)
  if (v) return v
  return `http://localhost:3001/api/${agentPath}/v1`
}

/** Cấu hình domain cho phép nhúng agent (dùng cho CSP frame-ancestors). Trả về null nếu agent không tồn tại. */
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

/** Giới hạn tin nhắn mỗi ngày cho embed (từ config_json.embed_daily_message_limit). Trả về null = không giới hạn. */
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

/** Giới hạn tin nhắn mỗi ngày cho agent (chat web). Từ config_json.daily_message_limit, mặc định 100. */
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
// Đảm bảo chỉ central (trợ lý chính) có trong DB (data đã tách sang bảng tools)
async function ensureDefaultAssistants(): Promise<void> {
  if (defaultAssistantsEnsured) return
  try {
    const { query } = await import("./db")
    const baseUrl = getInternalAgentBaseUrl("main_agent")
    // Migration: đổi alias 'main' cũ sang 'central' (chỉ còn một trợ lý chính)
    await query(
      `UPDATE ai_portal.assistants SET alias = 'central', base_url = $1, updated_at = now() WHERE alias = 'main'`,
      [baseUrl]
    )
    await query(
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, domain_url, is_active, display_order, config_json, updated_at)
       VALUES ('central', 'Bot', $1, NULL, true, 0, '{"isInternal": true}'::jsonb, now())
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

// Lấy danh sách config từ database thay vì hardcode
export async function getAssistantConfigs(): Promise<AssistantConfig[]> {
  try {
    await ensureDefaultAssistants()
    const { query } = await import("./db")
    const result = await query(
      `SELECT alias, icon, base_url, domain_url, config_json
       FROM ai_portal.assistants
       WHERE is_active = true
       ORDER BY display_order ASC, alias ASC`
    )
    const configs = result.rows.map((row: any) => {
      const config = row.config_json || {}
      let baseUrl = row.base_url
      if (config.isInternal) {
        // central (trợ lý chính) dùng route main_agent
        const agentPath = row.alias === "central" ? "main_agent" : `${row.alias}_agent`
        baseUrl = getInternalAgentBaseUrl(agentPath)
      }
      return {
        alias: row.alias,
        icon: (row.icon || "Bot") as IconName,
        baseUrl,
        domainUrl: row.domain_url || undefined,
        configJson: config,
      }
    })
    return configs
  } catch (e: any) {
    console.warn("⚠️ Failed to load assistants from DB:", e?.message || e)
    return []
  }
}

// Deprecated: dùng getAssistantConfigs() thay thế
export const assistantConfigs: AssistantConfig[] = []

const metadataCache = new Map<string, { data: AgentMetadata; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 phút

function isValidMetadata(data: any): data is AgentMetadata {
  if (!data || typeof data !== "object") return false
  return true
}

async function fetchAssistantMetadata(baseUrl: string): Promise<AgentMetadata | null> {
  try {
    const cached = metadataCache.get(baseUrl)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }
    const metadataUrl = `${baseUrl}/metadata`
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
      metadataCache.set(baseUrl, { data: agentMetadata, timestamp: Date.now() })
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
 * Merge cấu hình với metadata từ API để tạo Assistant đầy đủ
 */
export async function getAssistant(config: AssistantConfig): Promise<Assistant> {
  try {
    const metadata = await fetchAssistantMetadata(config.baseUrl)
    const colors = getColorForAlias(config.alias)
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
    const normalizedMetadata: AgentMetadata = {
      ...metadata,
      name: metadata.name || config.alias,
      provided_data_types: metadata.provided_data_types?.map((dt: any) => ({
        type: dt.type,
        description: dt.description || dt.detail || undefined,
      })),
    }
    return {
      ...normalizedMetadata,
      ...config,
      ...colors,
      health: "healthy",
      name: normalizedMetadata.name,
    }
  } catch (error: any) {
    const colors = getColorForAlias(config.alias)
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

export async function getAllAssistants(): Promise<Assistant[]> {
  const configs = await getAssistantConfigs()
  return Promise.all(configs.map((config) => getAssistant(config)))
}

export async function getAssistantByAlias(alias: string): Promise<Assistant | null> {
  const configs = await getAssistantConfigs()
  const config = configs.find((c) => c.alias === alias)
  if (!config) return null
  const assistant = await getAssistant(config)
  // Trợ lý chính (central) hiển thị tên "Trợ lý chính" / "AI Central"
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
    }
  })
  const { getAllTools, getToolConfigs } = await import("./tools")
  const toolConfigs = await getToolConfigs()
  const tools = await getAllTools()
  const toolConfigByAlias = new Map(toolConfigs.map((c) => [c.alias, c.configJson]))
  const fromTools = tools.map((t) => {
    const cfg = toolConfigByAlias.get(t.alias) as { routing_hint?: string } | undefined
    const routingHint = typeof cfg?.routing_hint === "string" ? cfg.routing_hint : undefined
    return {
      alias: t.alias,
      name: t.name || t.alias,
      icon: t.icon,
      baseUrl: t.baseUrl,
      description: String((t as { description?: string }).description || t.name || t.alias).slice(0, 300),
      supported_models: (t as { supported_models?: SupportedModel[] }).supported_models ?? [],
      routing_hint: routingHint,
    }
  })
  return [...fromAssistants, ...fromTools]
}
