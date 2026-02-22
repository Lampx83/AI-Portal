/**
 * Central agent config. LLM: provider, model, api_key, base_url (optional).
 * Stored in app_settings, not env vars.
 */
import { query } from "./db"

export type CentralLlmProvider = "openai" | "gemini" | "anthropic" | "openai_compatible" | "skip"

export interface CentralAgentConfig {
  provider: CentralLlmProvider
  /** Model name (e.g. gpt-4o-mini, gemini-1.5-flash) */
  model: string
  /** Masked key for display */
  apiKeyMasked: string
  /** Base URL (only used when provider = openai_compatible) */
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

/** Get Central config (for Admin GET). API key returned masked. */
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

/** Credentials to call LLM (only openai / openai_compatible supported). */
export interface CentralLlmCredentials {
  provider: "openai" | "openai_compatible"
  model: string
  apiKey: string
  baseUrl?: string
}

/**
 * Return credentials for Central LLM. Only openai and openai_compatible are supported for API calls;
 * gemini/anthropic return null (not implemented).
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
  return getCentralAgentConfig()
}
