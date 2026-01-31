// lib/api/research-assistants.ts
import { API_CONFIG } from "@/lib/config"
import type {
  ResearchAssistant,
  ResearchAssistantResponse,
  ResearchAssistantConfig,
  ResearchAssistantConfigResponse,
} from "@/lib/research-assistants"
import { transformConfig, transformAssistant } from "@/lib/research-assistants"

const API_BASE = `${API_CONFIG.baseUrl}/api/research-assistants`

/**
 * Fetch danh sách cấu hình research assistants từ backend (không có metadata)
 */
export async function fetchResearchAssistantConfigs(): Promise<ResearchAssistantConfig[]> {
  try {
    const response = await fetch(API_BASE, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "default",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const configs = (await response.json()) as ResearchAssistantConfigResponse[]
    // Transform để có Icon component
    return configs.map(transformConfig)
  } catch (error: any) {
    console.error("Error fetching research assistant configs:", error)
    throw error
  }
}

/**
 * Fetch một research assistant theo alias từ backend
 */
export async function fetchResearchAssistantByAlias(
  alias: string
): Promise<ResearchAssistant | null> {
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(alias)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "default",
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const assistant = (await response.json()) as ResearchAssistantResponse
    // Transform để có Icon component
    return transformAssistant(assistant)
  } catch (error: any) {
    console.error(`Error fetching research assistant ${alias}:`, error)
    throw error
  }
}
