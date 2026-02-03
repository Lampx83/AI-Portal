// lib/research-assistants.ts
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
export interface ResearchAssistantConfig {
  alias: string
  icon: IconName
  baseUrl: string
  domainUrl?: string
  /** config_json từ DB: isInternal, routing_hint, ... */
  configJson?: Record<string, unknown>
}

// Interface đầy đủ sau khi merge với metadata từ API
export interface ResearchAssistant extends Partial<AgentMetadata> {
  alias: string
  icon: IconName
  baseUrl: string
  domainUrl?: string
  bgColor: string
  iconColor: string
  health: "healthy" | "unhealthy"
  name: string // Luôn có name (từ metadata hoặc alias)
}

// Helper để xác định baseUrl cho internal agents (main, write, data)
// Khi backend gọi đến chính nó, luôn dùng localhost vì đó là cùng một process/container
function getInternalAgentBaseUrl(agentPath: string): string {
  // Ưu tiên biến môi trường nếu có (cho từng agent cụ thể)
  // Ví dụ: MAIN_AGENT_BASE_URL, WRITE_AGENT_BASE_URL, DATA_AGENT_BASE_URL
  const envKey = `${agentPath.toUpperCase().replace("/", "_").replace("-", "_")}_BASE_URL`
  if (process.env[envKey]) {
    return process.env[envKey]!
  }
  
  // Backend luôn gọi đến chính nó qua localhost (cùng process/container)
  // Không cần dùng service name vì đó là cùng một server
  return `http://localhost:3001/api/${agentPath}/v1`
}

/** Cấu hình domain cho phép nhúng agent (dùng cho CSP frame-ancestors). Trả về null nếu agent không tồn tại. */
export async function getEmbedConfigByAlias(alias: string): Promise<{ embed_allow_all: boolean; embed_allowed_domains: string[] } | null> {
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT config_json FROM research_chat.research_assistants WHERE alias = $1 AND is_active = true LIMIT 1`,
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
      `SELECT config_json FROM research_chat.research_assistants WHERE alias = $1 AND is_active = true LIMIT 1`,
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
      `SELECT config_json FROM research_chat.research_assistants WHERE alias = $1 AND is_active = true LIMIT 1`,
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

// Lấy danh sách config từ database thay vì hardcode
export async function getResearchAssistantConfigs(): Promise<ResearchAssistantConfig[]> {
  try {
    const { query } = await import("./db")
    const result = await query(
      `SELECT alias, icon, base_url, domain_url, config_json
       FROM research_chat.research_assistants
       WHERE is_active = true
       ORDER BY display_order ASC, alias ASC`
    )
    
    return result.rows.map((row: any) => {
      const config = row.config_json || {}
      // Nếu là internal agent, resolve baseUrl động
      let baseUrl = row.base_url
      if (config.isInternal) {
        const agentPath = row.alias === "main" ? "main_agent" : `${row.alias}_agent`
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
  } catch (e: any) {
    console.warn("⚠️ Failed to load research_assistants from DB:", e?.message || e)
    // Không dùng hardcode - trả về rỗng. Dữ liệu agents được seed khi server khởi động.
    return []
  }
}

// Deprecated: dùng getResearchAssistantConfigs() thay thế
export const researchAssistantConfigs: ResearchAssistantConfig[] = []

// Cache metadata trong memory để tránh fetch nhiều lần
const metadataCache = new Map<string, { data: AgentMetadata; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 phút

/**
 * Validate metadata format - linh hoạt hơn, chỉ cần là object hợp lệ
 */
function isValidMetadata(data: any): data is AgentMetadata {
  if (!data || typeof data !== "object") return false
  // Không yêu cầu name vì có thể dùng alias làm name mặc định
  return true
}

/**
 * Fetch metadata từ API endpoint của trợ lý
 * Backend gọi trực tiếp đến các trợ lý
 */
async function fetchAssistantMetadata(baseUrl: string): Promise<AgentMetadata | null> {
  try {
    // Kiểm tra cache
    const cached = metadataCache.get(baseUrl)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }

    // Xây dựng URL metadata
    const metadataUrl = `${baseUrl}/metadata`

    // Backend gọi đến trợ lý với timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 giây timeout

    try {
      const response = await fetch(metadataUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch metadata from ${metadataUrl}: ${response.status} ${response.statusText}`)
        return null
      }

      const metadata = await response.json()


      // Validate metadata format
      if (!isValidMetadata(metadata)) {
        console.warn(`⚠️ Invalid metadata format from ${metadataUrl}:`, metadata)
        return null
      }

      const agentMetadata = metadata as AgentMetadata

      // Lưu vào cache
      metadataCache.set(baseUrl, {
        data: agentMetadata,
        timestamp: Date.now(),
      })

      return agentMetadata
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      // Không log lỗi nếu là abort (timeout) hoặc network error thông thường
      if (fetchError.name === "AbortError") {
        console.warn(`⚠️ Timeout fetching metadata from ${metadataUrl}`)
      } else if (
        fetchError.code === "ECONNREFUSED" ||
        fetchError.code === "ENOTFOUND" ||
        fetchError.code === "ETIMEDOUT" ||
        fetchError.message?.includes("fetch failed") ||
        fetchError.message?.includes("ECONNREFUSED")
      ) {
        console.warn(`⚠️ Network error fetching metadata from ${metadataUrl}:`, fetchError.message)
      } else {
        console.warn(`⚠️ Error fetching metadata from ${metadataUrl}:`, fetchError.message || fetchError)
      }
      return null
    }
  } catch (error: any) {
    // Catch mọi lỗi khác và không throw
    console.warn(`⚠️ Unexpected error fetching metadata from ${baseUrl}:`, error?.message || error)
    return null
  }
}

/**
 * Merge cấu hình với metadata từ API để tạo ResearchAssistant đầy đủ
 * Luôn trả về assistant, đánh dấu health là "unhealthy" nếu không fetch được metadata
 */
export async function getResearchAssistant(
  config: ResearchAssistantConfig
): Promise<ResearchAssistant> {
  try {
    // Xác định baseUrl để fetch metadata
    // Sử dụng baseUrl từ config (đã được resolve từ env vars)
    const metadataBaseUrl = config.baseUrl

    const metadata = await fetchAssistantMetadata(metadataBaseUrl)

    // Lấy màu sắc dựa trên alias
    const colors = getColorForAlias(config.alias)

    // Nếu không fetch được metadata hoặc metadata không hợp lệ, trả về assistant với health unhealthy
    if (!metadata || !isValidMetadata(metadata)) {
      console.warn(`⚠️ Assistant ${config.alias} is unhealthy: failed to fetch or invalid metadata`)
      return {
        alias: config.alias,
        icon: config.icon,
        baseUrl: config.baseUrl,
        domainUrl: config.domainUrl,
        name: config.alias, // Dùng alias làm name mặc định
        health: "unhealthy",
        ...colors,
      }
    }

    // Normalize metadata: đảm bảo có name (dùng alias nếu không có)
    const normalizedMetadata: AgentMetadata = {
      ...metadata,
      name: metadata.name || config.alias,
      // Normalize provided_data_types: chuyển "detail" thành "description" nếu cần
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
      name: normalizedMetadata.name, // Đảm bảo name luôn có
    }
  } catch (error: any) {
    // Catch mọi lỗi và trả về assistant với health unhealthy
    console.warn(`⚠️ Assistant ${config.alias} is unhealthy:`, error?.message || error)
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

/**
 * Lấy tất cả các trợ lý với metadata từ API (bao gồm cả những trợ lý unhealthy)
 */
export async function getAllResearchAssistants(): Promise<ResearchAssistant[]> {
  const configs = await getResearchAssistantConfigs()
  const assistants = await Promise.all(
    configs.map((config) => getResearchAssistant(config))
  )

  return assistants // Không filter, trả về tất cả kể cả unhealthy
}

/**
 * Lấy một trợ lý theo alias với metadata từ API
 */
export async function getResearchAssistantByAlias(
  alias: string
): Promise<ResearchAssistant | null> {
  const configs = await getResearchAssistantConfigs()
  const config = configs.find((c) => c.alias === alias)
  if (!config) return null

  return getResearchAssistant(config)
}

/** Dùng cho orchestrator: danh sách agents (trừ main) với alias, name, icon, baseUrl, description, supported_models, routing_hint */
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
  const configs = await getResearchAssistantConfigs()
  const withoutMain = configs.filter((c) => c.alias !== "main")
  const configByAlias = new Map(withoutMain.map((c) => [c.alias, c.configJson]))
  const assistants = await Promise.all(withoutMain.map((c) => getResearchAssistant(c)))
  return assistants.map((a) => {
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
}