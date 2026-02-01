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
    console.log(`[API] Fetching research assistant configs from: ${API_BASE}`)
    const response = await fetch(API_BASE, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "default",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
      console.error(`[API] Error response:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        url: API_BASE
      })
      throw new Error(errorMessage)
    }

    const configs = (await response.json()) as ResearchAssistantConfigResponse[]
    console.log(`[API] Successfully fetched ${configs.length} assistant configs`)
    // Transform để có Icon component
    return configs.map(transformConfig)
  } catch (error: any) {
    // Xử lý các loại lỗi khác nhau
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'server-side'
      const networkError = new Error(
        `Không thể kết nối đến backend tại ${API_BASE}. ` +
        `(Frontend origin: ${currentOrigin}) ` +
        `Vui lòng kiểm tra:\n` +
        `1. Backend có đang chạy không?\n` +
        `2. URL backend có đúng không? (Đang dùng: ${API_BASE})\n` +
        `3. CORS có được cấu hình đúng không? (Backend cần cho phép origin: ${currentOrigin})`
      )
      console.error("[API] Network error:", networkError.message)
      console.error("[API] Config:", { API_BASE, currentOrigin, NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL })
      throw networkError
    }
    console.error("[API] Error fetching research assistant configs:", error)
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
    const url = `${API_BASE}/${encodeURIComponent(alias)}`
    console.log(`[API] Fetching assistant ${alias} from: ${url}`)
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "default",
    })

    if (response.status === 404) {
      console.log(`[API] Assistant ${alias} not found (404)`)
      return null
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
      console.error(`[API] Error fetching assistant ${alias}:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        url
      })
      throw new Error(errorMessage)
    }

    const assistant = (await response.json()) as ResearchAssistantResponse
    console.log(`[API] Successfully fetched assistant ${alias}`)
    // Transform để có Icon component
    return transformAssistant(assistant)
  } catch (error: any) {
    // Xử lý network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error(
        `Không thể kết nối đến backend để lấy thông tin trợ lý ${alias}. ` +
        `Vui lòng kiểm tra backend có đang chạy không.`
      )
      console.error(`[API] Network error for assistant ${alias}:`, networkError.message)
      throw networkError
    }
    console.error(`[API] Error fetching research assistant ${alias}:`, error)
    throw error
  }
}
