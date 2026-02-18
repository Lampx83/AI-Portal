// lib/api/tools-api.ts – Apps API (data), separate from assistants
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
 * Fetch list of app configs (no metadata)
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
 * Fetch one app by alias (with metadata). Returns same Assistant shape for shared UI.
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
