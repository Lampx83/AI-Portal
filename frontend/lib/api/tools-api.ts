// lib/api/tools-api.ts – Apps API (data), separate from assistants
import { API_CONFIG } from "@/lib/config"
import type { Assistant, AssistantResponse } from "@/lib/assistants"
import { transformAssistant } from "@/lib/assistants"

const API_BASE = `${API_CONFIG.baseUrl}/api/tools`
const CATEGORIES_URL = `${API_CONFIG.baseUrl}/api/categories`

export interface ToolConfigResponse {
  alias: string
  icon: string
  baseUrl?: string
  /** When true, tool is shown in sidebar by default (admin-configured). */
  pinned?: boolean
}

/**
 * Fetch list of app configs (no metadata)
 */
export async function fetchToolConfigs(): Promise<ToolConfigResponse[]> {
  const response = await fetch(API_BASE, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`)
  }
  return (await response.json()) as ToolConfigResponse[]
}

/**
 * Fetch all tools with full metadata in one request (tránh N+1 request).
 */
export async function fetchAllTools(): Promise<Assistant[]> {
  const url = `${API_BASE}?full=1`
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`)
  }
  const data = (await response.json()) as AssistantResponse[]
  return data.map((item) => transformAssistant(item))
}

export async function fetchToolByAlias(alias: string): Promise<Assistant | null> {
  const url = `${API_BASE}/${encodeURIComponent(alias)}`
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`)
  }
  const data = (await response.json()) as AssistantResponse
  return transformAssistant(data)
}

export interface ToolCategory {
  id: string
  slug: string
  name: string
  display_order: number
}

export async function fetchCategories(): Promise<ToolCategory[]> {
  const response = await fetch(CATEGORIES_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`)
  }
  const data = (await response.json()) as { categories: ToolCategory[] }
  return data.categories ?? []
}
