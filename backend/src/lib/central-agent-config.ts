/**
 * Cấu hình Trợ lý chính (Central agent). LLM: provider, model, api_key, base_url (optional).
 * Lưu trong app_settings, không dùng biến môi trường.
 */
import { query } from "./db"

export type CentralLlmProvider = "openai" | "gemini" | "anthropic" | "openai_compatible" | "skip"

export interface CentralAgentConfig {
  provider: CentralLlmProvider
  /** Tên mô hình (vd. gpt-4o-mini, gemini-1.5-flash) */
  model: string
  /** Masked key for display */
  apiKeyMasked: string
  /** Base URL (chỉ dùng khi provider = openai_compatible) */
  baseUrl: string
}

const CONFIG_KEYS = ["central_llm_provider", "central_llm_model", "central_llm_api_key", "central_llm_base_url"] as const

function parseMap(rows: { key: string; value: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.key] = row.value ?? ""
  }
  return map
}

function normalizeProvider(p: string): CentralLlmProvider {
  const v = p.trim().toLowerCase()
  if (v === "openai" || v === "gemini" || v === "anthropic" || v === "openai_compatible") return v
  return "skip"
}

/** Lấy cấu hình Central (cho Admin GET). API key trả về dạng mask. */
export async function getCentralAgentConfig(): Promise<CentralAgentConfig> {
  try {
    const result = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [CONFIG_KEYS]
    )
    const map = parseMap(result.rows as { key: string; value: string }[])
    const provider = normalizeProvider(map.central_llm_provider || "skip")
    const model = (map.central_llm_model || "").trim() || (provider === "openai" ? "gpt-4o-mini" : "")
    const hasKey = !!(map.central_llm_api_key || "").trim()
    const baseUrl = (map.central_llm_base_url || "").trim()
    return {
      provider,
      model,
      apiKeyMasked: hasKey ? "••••••••••••" : "",
      baseUrl,
    }
  } catch {
    return { provider: "skip", model: "", apiKeyMasked: "", baseUrl: "" }
  }
}

/** Credentials để gọi LLM (chỉ hỗ trợ openai / openai_compatible). */
export interface CentralLlmCredentials {
  provider: "openai" | "openai_compatible"
  model: string
  apiKey: string
  baseUrl?: string
}

/**
 * Trả về credentials cho Central LLM. Chỉ openai và openai_compatible được hỗ trợ gọi API;
 * gemini/anthropic trả về null (chưa implement).
 */
export async function getCentralLlmCredentials(): Promise<CentralLlmCredentials | null> {
  try {
    const result = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [CONFIG_KEYS]
    )
    const map = parseMap(result.rows as { key: string; value: string }[])
    const provider = (map.central_llm_provider || "").trim().toLowerCase()
    const model = (map.central_llm_model || "").trim() || "gpt-4o-mini"
    const apiKey = (map.central_llm_api_key || "").trim()
    const baseUrl = (map.central_llm_base_url || "").trim()

    if (provider === "openai" && apiKey) {
      return { provider: "openai", model, apiKey }
    }
    if (provider === "openai_compatible" && apiKey && baseUrl) {
      return { provider: "openai_compatible", model, apiKey, baseUrl }
    }
    return null
  } catch {
    return null
  }
}

/** Trả về OpenAI API key khi provider = openai hoặc openai_compatible (để tương thích code cũ). */
export async function getOpenAIApiKey(): Promise<string | null> {
  const cred = await getCentralLlmCredentials()
  return cred ? cred.apiKey : null
}

export interface CentralAgentConfigUpdate {
  provider?: CentralLlmProvider
  model?: string
  api_key?: string
  base_url?: string
}

/** Cập nhật cấu hình Central (cho Admin PATCH). */
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
  return getCentralAgentConfig()
}
