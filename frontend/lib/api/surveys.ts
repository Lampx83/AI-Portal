import { API_CONFIG } from "@/lib/config"
import { adminJson, adminFetch } from "@/lib/api/admin"
import { getOrCreateGuestDeviceId } from "@/lib/guest-device-id"

export type SurveyQuestionType = "single_choice" | "text"

export type SurveyOption = { id: string; label: string; allow_text?: boolean }

export type SurveyAnswer = { option?: string; text?: string }

export type SurveyQuestion = {
  id?: string
  order_index?: number
  type: SurveyQuestionType
  title: string
  description?: string | null
  is_required: boolean
  options: SurveyOption[]
}

export type SurveyDisplayConfig = {
  audience?: "all" | "logged_in" | "guest"
  trigger?: { type: "on_load" | "after_seconds" | "after_n_visits" | "on_exit_intent"; value?: number }
  position?: "center" | "bottom_right" | "bottom_bar" | "top_bar"
  frequency?: { type: "once" | "once_per_n_days" | "until_answered" | "every_session"; value?: number }
  dismissible?: boolean
  max_dismissals?: number
  cooldown_days_after_dismiss?: number
  pages_include?: string[]
  pages_exclude?: string[]
}

export type SurveyListItem = {
  id: string
  slug: string
  name: string
  description: string | null
  is_active: boolean
  priority: number
  start_at: string | null
  end_at: string | null
  created_at: string
  updated_at: string
  question_count: number
  response_count: number
}

export type SurveyFull = {
  id: string
  slug: string
  name: string
  description: string | null
  is_active: boolean
  priority: number
  start_at: string | null
  end_at: string | null
  thank_you_message: string | null
  display_config: SurveyDisplayConfig
  created_at: string
  updated_at: string
  questions: Array<{
    id: string
    order_index: number
    type: SurveyQuestionType
    title: string
    description: string | null
    is_required: boolean
    options: SurveyOption[]
  }>
}

export type SurveyInput = {
  slug: string
  name: string
  description?: string | null
  is_active?: boolean
  priority?: number
  start_at?: string | null
  end_at?: string | null
  thank_you_message?: string | null
  display_config?: SurveyDisplayConfig
  questions: SurveyQuestion[]
}

// ===== Admin =====
export async function listSurveys() {
  return adminJson<{ data: SurveyListItem[] }>("/api/admin/surveys")
}
export async function getSurvey(id: string) {
  return adminJson<{ survey: SurveyFull }>(`/api/admin/surveys/${id}`)
}
export async function createSurvey(input: SurveyInput) {
  return adminJson<{ survey: SurveyFull }>("/api/admin/surveys", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
export async function updateSurvey(id: string, input: SurveyInput) {
  return adminJson<{ survey: SurveyFull }>(`/api/admin/surveys/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
}
export async function deleteSurvey(id: string) {
  return adminJson<{ success: boolean }>(`/api/admin/surveys/${id}`, { method: "DELETE" })
}
export async function exportSurvey(id: string): Promise<Blob> {
  const res = await adminFetch(`/api/admin/surveys/${id}/export`)
  if (!res.ok) throw new Error("Export thất bại")
  return await res.blob()
}
export async function exportSurveyDocx(id: string): Promise<Blob> {
  const res = await adminFetch(`/api/admin/surveys/${id}/printable`)
  if (!res.ok) throw new Error("Xuất bản giấy thất bại")
  return await res.blob()
}
export async function exportSurveyTxt(id: string): Promise<Blob> {
  const res = await adminFetch(`/api/admin/surveys/${id}/printable?format=txt`)
  if (!res.ok) throw new Error("Xuất text thất bại")
  return await res.blob()
}
export async function importSurvey(payload: any) {
  return adminJson<{ survey: SurveyFull }>("/api/admin/surveys/import", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
export type SurveyResponseRow = {
  id: string
  user_id: string | null
  guest_device_id: string | null
  answers: Record<string, SurveyAnswer>
  user_agent: string | null
  submitted_at: string
  user_email: string | null
  user_display_name: string | null
}
export type SurveyStats = Array<{
  question_id: string
  type: SurveyQuestionType
  title: string
  total_answers: number
  options: Array<{
    id: string
    label: string
    allow_text?: boolean
    count: number
    percent: number
    text_samples?: string[]
  }>
  text_samples?: string[]
}>
export async function getSurveyResponses(id: string, opts?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams()
  if (opts?.limit != null) params.set("limit", String(opts.limit))
  if (opts?.offset != null) params.set("offset", String(opts.offset))
  const qs = params.toString()
  return adminJson<{
    data: SurveyResponseRow[]
    page: { limit: number; offset: number; total: number }
    stats: SurveyStats
  }>(`/api/admin/surveys/${id}/responses${qs ? `?${qs}` : ""}`)
}
export async function exportSurveyResponses(id: string): Promise<Blob> {
  const res = await adminFetch(`/api/admin/surveys/${id}/responses?format=csv`)
  if (!res.ok) throw new Error("Export CSV thất bại")
  return await res.blob()
}
export async function clearSurveyResponses(id: string) {
  return adminJson<{ success: boolean }>(`/api/admin/surveys/${id}/responses`, { method: "DELETE" })
}

// ===== Public =====
export type ActiveSurvey = {
  id: string
  slug: string
  name: string
  description: string | null
  thank_you_message: string | null
  display_config: SurveyDisplayConfig
  questions: Array<{
    id: string
    order_index: number
    type: SurveyQuestionType
    title: string
    description: string | null
    is_required: boolean
    options: SurveyOption[]
  }>
}

const baseUrl = `${API_CONFIG.baseUrl.replace(/\/+$/, "")}/api/survey`

function publicHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (typeof window !== "undefined") {
    headers["X-Guest-Device-Id"] = getOrCreateGuestDeviceId()
  }
  return headers
}

export async function getActiveSurvey(): Promise<{ survey: ActiveSurvey | null }> {
  const res = await fetch(`${baseUrl}/active`, {
    credentials: "include",
    headers: publicHeaders(),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function logSurveyImpression(id: string, event: "shown" | "dismissed" | "completed") {
  await fetch(`${baseUrl}/${id}/impression`, {
    method: "POST",
    credentials: "include",
    headers: publicHeaders(),
    body: JSON.stringify({ event }),
  }).catch(() => {})
}

export async function submitSurveyResponse(id: string, answers: Record<string, SurveyAnswer>) {
  const res = await fetch(`${baseUrl}/${id}/response`, {
    method: "POST",
    credentials: "include",
    headers: publicHeaders(),
    body: JSON.stringify({ answers }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return data
}
