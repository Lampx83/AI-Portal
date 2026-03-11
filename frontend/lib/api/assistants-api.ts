// lib/api/assistants-api.ts – call backend assistants API (AI Portal)
import { API_CONFIG } from "@/lib/config"
import type { Assistant, AssistantResponse, AssistantConfig, AssistantConfigResponse } from "@/lib/assistants"
import { transformConfig, transformAssistant } from "@/lib/assistants"

const API_BASE = `${API_CONFIG.baseUrl}/api/assistants`

/**
 * Fetch danh sách cấu hình trợ lý từ backend (không có metadata)
 */
export async function fetchAssistantConfigs(): Promise<AssistantConfig[]> {
  try {
    const response = await fetch(API_BASE, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
    if (!response.ok) {
      let errorMessage: string
      try {
        const errorData = await response.json().catch(() => ({})) as { error?: string; message?: string }
        const fromBody = errorData?.error ?? errorData?.message
        errorMessage =
          typeof fromBody === "string" && fromBody.trim()
            ? fromBody.trim()
            : `HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ""}`
      } catch {
        errorMessage = `HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ""}`
      }
      if (!errorMessage) errorMessage = `Request failed (${response.status})`
      console.error("[API] Assistants error:", { status: response.status, statusText: response.statusText, url: API_BASE, message: errorMessage })
      throw new Error(errorMessage)
    }
    const configs = (await response.json()) as AssistantConfigResponse[]
    return configs.map(transformConfig)
  } catch (error: any) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      const currentOrigin = typeof window !== "undefined" ? window.location.origin : "server-side"
      throw new Error(
        `Không thể kết nối đến backend tại ${API_BASE}. (Frontend origin: ${currentOrigin}) Vui lòng kiểm tra backend và CORS.`
      )
    }
    throw error
  }
}

/**
 * Fetch một trợ lý theo alias từ backend
 */
export async function fetchAssistantByAlias(alias: string): Promise<Assistant | null> {
  try {
    const url = `${API_BASE}/${encodeURIComponent(alias)}`
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
    if (response.status === 404) return null
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }
    const assistant = (await response.json()) as AssistantResponse
    return transformAssistant(assistant)
  } catch (error: any) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error(`Không thể kết nối đến backend để lấy trợ lý ${alias}.`)
    }
    throw error
  }
}
