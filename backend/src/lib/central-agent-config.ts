/**
 * Central agent config. LLM: provider, model, api_key, base_url (optional).
 * Stored in app_settings, not env vars.
 */
import { query } from "./db"

export type CentralLlmProvider = "openai" | "gemini" | "anthropic" | "openai_compatible" | "ollama" | "skip"

export interface CentralAgentConfig {
  provider: CentralLlmProvider
  /** Model name (e.g. gpt-4o-mini, qwen3:8b) — model đang dùng. */
  model: string
  /** Masked key for display */
  apiKeyMasked: string
  /** Base URL (only used when provider = openai_compatible or ollama) */
  baseUrl: string
  /** System prompt for Central (orchestrator). Admin can edit in Settings/Central. */
  systemPrompt: string
  /** Danh sách model đã chọn từ Ollama (để hiển thị lại khi mở form). */
  ollamaModels: string[]
}

const CONFIG_KEYS = [
  "central_llm_provider",
  "central_llm_model",
  "central_llm_api_key",
  "central_llm_base_url",
  "central_system_prompt",
  "central_llm_models",
] as const

function parseMap(rows: { key: string; value: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.key] = row.value ?? ""
  }
  return map
}

function normalizeProvider(p: string): CentralLlmProvider {
  const v = p.trim().toLowerCase()
  if (v === "openai" || v === "gemini" || v === "anthropic" || v === "openai_compatible" || v === "ollama") return v
  return "skip"
}

/** Get Central config (for Admin GET). API key returned masked. */
export async function getCentralAgentConfig(): Promise<CentralAgentConfig> {
  try {
    const result = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [CONFIG_KEYS as unknown as string[]]
    )
    const map = parseMap(result.rows as { key: string; value: string }[])
    const provider = normalizeProvider(map.central_llm_provider || "skip")
    const model = (map.central_llm_model || "").trim() || (provider === "openai" ? "gpt-4o-mini" : provider === "ollama" ? "qwen3:8b" : "")
    const hasKey = !!(map.central_llm_api_key || "").trim()
    const baseUrl = (map.central_llm_base_url || "").trim()
    const systemPrompt = (map.central_system_prompt || "").trim() || DEFAULT_CENTRAL_SYSTEM_PROMPT
    let ollamaModels: string[] = []
    try {
      const raw = (map as Record<string, string>).central_llm_models
      if (typeof raw === "string" && raw.trim()) {
        const parsed = JSON.parse(raw) as unknown
        ollamaModels = Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === "string") : []
      }
    } catch {
      // ignore
    }
    return {
      provider,
      model,
      apiKeyMasked: hasKey ? "••••••••••••" : "",
      baseUrl,
      systemPrompt,
      ollamaModels,
    }
  } catch {
    return { provider: "skip", model: "", apiKeyMasked: "", baseUrl: "", systemPrompt: "", ollamaModels: [] }
  }
}

/** Credentials to call LLM (only openai / openai_compatible supported). */
export interface CentralLlmCredentials {
  provider: "openai" | "openai_compatible"
  model: string
  apiKey: string
  baseUrl?: string
}

/**
 * Return credentials for Central LLM. Ollama and openai_compatible (with baseUrl) supported;
 * for Ollama, apiKey can be empty (we use "ollama" placeholder).
 */
export async function getCentralLlmCredentials(): Promise<CentralLlmCredentials | null> {
  try {
    const result = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [CONFIG_KEYS as unknown as string[]]
    )
    const map = parseMap(result.rows as { key: string; value: string }[])
    const provider = (map.central_llm_provider || "").trim().toLowerCase()
    const model = (map.central_llm_model || "").trim() || (provider === "ollama" ? "qwen3:8b" : "gpt-4o-mini")
    const apiKey = (map.central_llm_api_key || "").trim()
    const baseUrl = (map.central_llm_base_url || "").trim().replace(/\/+$/, "")

    if (provider === "openai" && apiKey) {
      return { provider: "openai", model, apiKey }
    }
    if (provider === "ollama") {
      const raw = baseUrl || "https://research.neu.edu.vn/ollama"
      const url = raw.replace(/\/v1\/?$/, "") + "/v1"
      return { provider: "openai_compatible", model, apiKey: apiKey || "ollama", baseUrl: url }
    }
    if (provider === "openai_compatible" && baseUrl) {
      return { provider: "openai_compatible", model, apiKey: apiKey || "ollama", baseUrl }
    }
    return null
  } catch {
    return null
  }
}

/** Return OpenAI API key when provider = openai or openai_compatible (for legacy compatibility). */
export async function getOpenAIApiKey(): Promise<string | null> {
  const cred = await getCentralLlmCredentials()
  return cred ? cred.apiKey : null
}

export interface CentralAgentConfigUpdate {
  provider?: CentralLlmProvider
  model?: string
  api_key?: string
  base_url?: string
  system_prompt?: string
  /** Danh sách model đã chọn (Ollama). Lưu để lần sau mở form hiển thị lại. */
  models?: string[]
}

/** Update Central config (for Admin PATCH). */
export async function updateCentralAgentConfig(update: CentralAgentConfigUpdate): Promise<CentralAgentConfig> {
  if (update.provider !== undefined) {
    const p = normalizeProvider(update.provider)
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [p]
    )
  }
  if (update.model !== undefined) {
    const v = typeof update.model === "string" ? update.model.trim() : ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_model', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  if (update.api_key !== undefined) {
    const key = typeof update.api_key === "string" ? update.api_key.trim() : ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_api_key', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key]
    )
  }
  if (update.base_url !== undefined) {
    const v = typeof update.base_url === "string" ? update.base_url.trim() : ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_base_url', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  if (update.system_prompt !== undefined) {
    let v = typeof update.system_prompt === "string" ? update.system_prompt.trim() : ""
    if (v === DEFAULT_CENTRAL_SYSTEM_PROMPT) v = ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_system_prompt', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  if (update.models !== undefined) {
    const arr = Array.isArray(update.models) ? update.models.filter((m): m is string => typeof m === "string") : []
    const v = JSON.stringify(arr)
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_models', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  return getCentralAgentConfig()
}

/** Get custom system prompt for Central (for orchestrator). Returns empty string if not set. */
export async function getCentralSystemPrompt(): Promise<string> {
  try {
    const r = await query<{ value: string }>(
      `SELECT value FROM ai_portal.app_settings WHERE key = 'central_system_prompt' LIMIT 1`
    )
    const v = r.rows[0]?.value
    return typeof v === "string" ? v.trim() : ""
  } catch {
    return ""
  }
}

/** Default system prompt for Central when admin has not set one. */
export const DEFAULT_CENTRAL_SYSTEM_PROMPT = `Bạn là trợ lý AI điều phối (Central) của hệ thống. Nhiệm vụ:
(1) Hướng dẫn người dùng sử dụng hệ thống dựa trên nội dung Hướng dẫn (mục dưới).
(2) Gợi ý hoặc điều hướng người dùng đến đúng Công cụ (Tools) khi họ cần chức năng tương ứng — dựa vào mô tả và từ khóa (keywords) của từng tool.
(3) Gợi ý hoặc chuyển tiếp đến đúng Trợ lý chuyên biệt (Agents) khi câu hỏi thuộc lĩnh vực của agent đó — dựa vào mô tả từ /metadata của từng agent.

Quy tắc khi gợi ý công cụ (Tools): luôn dùng **tên công cụ** (không dùng alias kỹ thuật) và đính kèm link Markdown để người dùng bấm chuyển sang công cụ đó, dạng: [Tên công cụ](/tools/alias). Ví dụ: [Tên công cụ](/tools/alias).

Quan trọng — phạm vi trả lời: Chỉ trả lời các câu hỏi trong khả năng của hệ thống (hướng dẫn sử dụng, gợi ý công cụ/trợ lý, câu chào hỏi hoặc hỏi chung về hệ thống). Nếu câu hỏi ngoài phạm vi hỗ trợ (ví dụ kiến thức tổng quát, tin tức, giải bài tập, soạn văn bản tùy ý, v.v.), hãy trả lời ngắn gọn rằng câu hỏi ngoài phạm vi hỗ trợ của trợ lý và không cung cấp bất kỳ thông tin hay nội dung nào thêm.

Trả lời ngắn gọn, thân thiện. Không bịa thông tin ngoài ngữ cảnh dưới đây.`
