// lib/api/tools-api.ts – API công cụ (write, data), tách khỏi trợ lý
import { API_CONFIG } from "@/lib/config"
import type { Assistant, AssistantResponse } from "@/lib/assistants"
import { transformAssistant } from "@/lib/assistants"

const API_BASE = `${API_CONFIG.baseUrl}/api/tools`

export interface ToolConfigResponse {
  alias: string
  icon: string
  baseUrl: string
  domainUrl?: string
}

/**
 * Fetch danh sách cấu hình công cụ (không có metadata)
 */
export async function fetchToolConfigs(): Promise<ToolConfigResponse[]> {
  const response = await fetch(API_BASE, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "default",
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`)
  }
  return (await response.json()) as ToolConfigResponse[]
}

/**
 * Fetch một công cụ theo alias (có metadata). Trả về cùng shape Assistant để dùng chung UI.
 */
export async function fetchToolByAlias(alias: string): Promise<Assistant | null> {
  const url = `${API_BASE}/${encodeURIComponent(alias)}`
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "default",
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`)
  }
  const data = (await response.json()) as AssistantResponse
  return transformAssistant(data)
}
