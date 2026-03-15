// lib/api/tools-api.ts – Apps API (data), separate from assistants
import { API_CONFIG } from "@/lib/config"
import type { Assistant, AssistantResponse } from "@/lib/assistants"
import { transformAssistant } from "@/lib/assistants"

const API_BASE = `${API_CONFIG.baseUrl}/api/tools`
const CATEGORIES_URL = `${API_CONFIG.baseUrl}/api/categories`

/**
 * Base URL cho các API cần cookie (cài/gỡ ứng dụng). Luôn gọi qua same-origin (Next.js)
 * để trình duyệt gửi cookie; nếu dùng API_CONFIG.baseUrl trỏ thẳng backend sẽ 401.
 */
function getSameOriginApiBase(): string {
  if (typeof window === "undefined") return ""
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  return basePath
}

const INSTALL_PACKAGE_URL = `${getSameOriginApiBase()}/api/tools/install-package`

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

/**
 * Cài ứng dụng từ file .zip (chỉ cho tài khoản hiện tại). Cần đăng nhập.
 * Chỉ hỗ trợ gói frontend-only. Gói có backend cần cài từ Admin.
 */
export async function installPackageForUser(file: File): Promise<{ tool: unknown; installed: boolean }> {
  const formData = new FormData()
  formData.append("package", file)
  const response = await fetch(INSTALL_PACKAGE_URL, {
    method: "POST",
    body: formData,
    credentials: "include",
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || (data as { message?: string }).message || `HTTP ${response.status}`)
  }
  return data as { tool: unknown; installed: boolean }
}

/**
 * Gỡ cài ứng dụng do chính mình cài. Chỉ áp dụng cho tool có user_installed = true.
 */
export async function uninstallPackageForUser(alias: string): Promise<{ success: boolean }> {
  const url = `${getSameOriginApiBase()}/api/tools/${encodeURIComponent(alias)}`
  const response = await fetch(url, {
    method: "DELETE",
    credentials: "include",
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || (data as { message?: string }).message || `HTTP ${response.status}`)
  }
  return data as { success: boolean }
}
