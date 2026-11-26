/** Admin API: thống kê sử dụng, tình trạng dịch vụ, kiểm thử hồi quy Central, cảnh báo. */
import { adminJson } from "@/lib/api/admin"

export type LikertItem = { question_id: string; title: string; n: number; avg: number | null; dist: number[] }
export type RetentionDay = { day: string; active: number; returned: number; rate: number | null }
export type Retention = { cohort: number; returned: number; rate: number | null; series: RetentionDay[] }

export type UsageStats = {
  range: { from: string; to: string; days: number; timezone: string; today: string }
  totals: {
    new_users: number
    new_guest_accounts: number
    active_users: number
    active_guest_devices: number
    logins: number
    questions: number
    tool_views: number
    survey_responses: number
    feedback_new: number
    feedback_open: number
  }
  daily: Array<{
    day: string
    new_users: number
    new_guest_accounts: number
    active_users: number
    active_guest_devices: number
    logins: number
    questions: number
  }>
  logins_by_provider: Array<{ provider: string; logins: number; users: number }>
  tools: Array<{ alias: string; views: number; users: number; guest_devices: number; opens_counter: number }>
  assistants: Array<{
    alias: string
    questions: number
    answered: number
    unanswered: number
    errored: number
    error_rate: number | null
    avg_ms: number | null
    p95_ms: number | null
    askers: number
  }>
  surveys: Array<{
    survey_id: string
    name: string
    responses: number
    from_users: number
    from_guests: number
    shown: number
    completed: number
    likert: LikertItem[]
  }>
  feedback: {
    new_in_range: number
    open_total: number
    resolved_in_range: number
    message_likes: number
    message_dislikes: number
    open_dislikes: number
  }
  retention: { users: Retention; guests: Retention }
  generated_ms: number
}

export function getUsageStats(params: { from?: string; to?: string; days?: number }) {
  const q = new URLSearchParams()
  if (params.from) q.set("from", params.from)
  if (params.to) q.set("to", params.to)
  if (params.days) q.set("days", String(params.days))
  return adminJson<UsageStats>(`/api/admin/usage-stats${q.toString() ? `?${q}` : ""}`)
}

export type ExtraTarget = { key: string; name: string; url: string; headers?: Record<string, string>; header_names?: string[] }

export type MonitoringConfig = {
  health_enabled: boolean
  health_interval_min: number
  health_timeout_ms: number
  health_retention_days: number
  extra_targets: ExtraTarget[]
  disabled_targets: string[]
  regression_nightly: "auto" | "on" | "off"
  regression_hour: number
  regression_concurrency: number
  regression_case_timeout_ms: number
  alert_slow_p95_ms: number
  alert_error_rate_pct: number
  alert_min_questions: number
  alert_window_hours: number
  alert_down_minutes: number
  alert_regression_drop_pct: number
}

export type ServiceStatus = {
  key: string
  name: string
  kind: "assistant" | "llm" | "extra"
  url: string
  status: "up" | "down" | "unknown"
  last_checked_at: string | null
  last_latency_ms: number | null
  last_status_code: number | null
  down_since: string | null
  down_minutes: number | null
  uptime_pct: number | null
  avg_latency_ms: number | null
  checks: number
  last_error_at: string | null
  last_error: string | null
  history: Array<{ t: string; ok: boolean; ms: number | null }>
}

export function getServiceHealth() {
  return adminJson<{ services: ServiceStatus[]; config: MonitoringConfig; disabled_by_env: boolean }>("/api/admin/monitoring/health")
}

export function checkServicesNow() {
  return adminJson<{ services: ServiceStatus[] }>("/api/admin/monitoring/health/check-now", { method: "POST" })
}

export function saveMonitoringConfig(config: Partial<MonitoringConfig>) {
  return adminJson<{ config: MonitoringConfig }>("/api/admin/monitoring/config", {
    method: "PUT",
    body: JSON.stringify({ config }),
  })
}

export type RegressionCheck = { name: string; passed: boolean; detail?: string }
export type RegressionRun = {
  id: string
  trigger: string
  status: "running" | "done" | "failed" | "aborted"
  suite_version: string | null
  model: string | null
  total: number
  completed: number
  passed: number
  score: number | null
  avg_latency_ms: number | null
  triggered_by: string | null
  error: string | null
  started_at: string
  finished_at: string | null
}
export type RegressionResult = {
  case_id: string
  category: string | null
  question: string | null
  passed: boolean
  score: number | null
  latency_ms: number | null
  functions_called: string[] | null
  checks: RegressionCheck[] | null
  answer: string | null
  error: string | null
}
export type RegressionCase = { id: string; category: string; question: string; expect: Record<string, unknown> }

export function getRegressionOverview() {
  return adminJson<{
    runs: RegressionRun[]
    suite_version: string
    cases: RegressionCase[]
    skipped_cases: Array<{ id: string; requires_tool?: string }>
    nightly: { mode: "auto" | "on" | "off"; hour: number; active: boolean }
    concurrency: number
  }>("/api/admin/monitoring/regression")
}

export function startRegressionRun(caseIds?: string[]) {
  return adminJson<{ run_id: string; total: number; skipped: number }>("/api/admin/monitoring/regression/run", {
    method: "POST",
    body: JSON.stringify(caseIds?.length ? { case_ids: caseIds } : {}),
  })
}

export function getRegressionRun(id: string) {
  return adminJson<{
    run: RegressionRun
    previous: RegressionRun | null
    results: RegressionResult[]
    comparison: {
      diffs: Array<{ case_id: string; before: boolean | null; after: boolean | null; change: string }>
      regressed: number
      fixed: number
    } | null
  }>(`/api/admin/monitoring/regression/runs/${encodeURIComponent(id)}`)
}

export type AdminAlert = {
  id: string
  type:
    | "assistant_errors"
    | "assistant_error_status"
    | "assistant_slow"
    | "service_down"
    | "health_stale"
    | "regression_drop"
    | "regression_failed"
  severity: "critical" | "warning" | "info"
  subject: string
  value?: number | null
  threshold?: number | null
  since?: string | null
  detail?: string | null
  tab: "usage" | "health" | "regression"
}

export function getAdminAlerts(refresh = false) {
  return adminJson<{ alerts: AdminAlert[]; counts: { critical: number; warning: number; info: number }; total: number }>(
    `/api/admin/monitoring/alerts${refresh ? "?refresh=1" : ""}`
  )
}

/** Thay {name} trong chuỗi dịch bằng giá trị. */
export function fmt(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])))
}
