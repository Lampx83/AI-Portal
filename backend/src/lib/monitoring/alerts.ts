/**
 * Cảnh báo trong trang quản trị — phát hiện bất thường từ dữ liệu sẵn có (không gửi email):
 *  - assistant_errors: tỉ lệ câu hỏi lỗi/không được trả lời vượt ngưỡng trong cửa sổ gần đây
 *  - assistant_error_status: tin nhắn trả lời mang trạng thái error/partial lặp lại
 *  - assistant_slow: thời gian trả lời p95 vượt ngưỡng
 *  - service_down: dịch vụ ngoài đỏ liên tục quá N phút
 *  - health_stale: tác vụ kiểm tra sức khoẻ đang bật nhưng không có kết quả mới
 *  - regression_drop: kiểm thử Central giảm điểm so với lần trước
 *  - regression_failed: lần chạy kiểm thử gần nhất lỗi/bị gián đoạn
 * Phần đánh giá ngưỡng là hàm thuần (evaluate*), có kiểm thử.
 */
import { query } from "../db"
import { getMonitoringConfig, monitoringDisabledByEnv, type MonitoringConfig } from "./config"
import { getServiceStatuses, type ServiceStatus } from "./health"
import { compareRuns } from "./regression-grader"
import { getRunResults, listRuns, type RunRow } from "./regression"
import { ensureMonitoringTables } from "./schema"
import { errorRate } from "./usage-stats"

export type AlertSeverity = "critical" | "warning" | "info"
export type AlertType =
  | "assistant_errors"
  | "assistant_error_status"
  | "assistant_slow"
  | "service_down"
  | "health_stale"
  | "regression_drop"
  | "regression_failed"

export interface AdminAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  /** Đối tượng (alias trợ lý, tên dịch vụ…). */
  subject: string
  value?: number | null
  threshold?: number | null
  since?: string | null
  detail?: string | null
  /** Tab admin liên quan. */
  tab: "usage" | "health" | "regression"
}

export interface AssistantWindowRow {
  alias: string
  questions: number
  unanswered: number
  errored: number
  p95_ms: number | null
}

export function evaluateAssistantAlerts(rows: AssistantWindowRow[], cfg: MonitoringConfig): AdminAlert[] {
  const out: AdminAlert[] = []
  for (const r of rows) {
    const rate = errorRate(r.questions, r.unanswered, r.errored)
    if (r.questions >= cfg.alert_min_questions && rate != null && rate * 100 >= cfg.alert_error_rate_pct) {
      out.push({
        id: `assistant_errors:${r.alias}`,
        type: "assistant_errors",
        severity: rate * 100 >= cfg.alert_error_rate_pct * 2 ? "critical" : "warning",
        subject: r.alias,
        value: Math.round(rate * 1000) / 10,
        threshold: cfg.alert_error_rate_pct,
        detail: `${r.unanswered + r.errored}/${r.questions}`,
        tab: "usage",
      })
    }
    if (r.errored >= 3) {
      out.push({
        id: `assistant_error_status:${r.alias}`,
        type: "assistant_error_status",
        severity: "warning",
        subject: r.alias,
        value: r.errored,
        threshold: 3,
        tab: "usage",
      })
    }
    if (r.questions >= cfg.alert_min_questions && r.p95_ms != null && r.p95_ms > cfg.alert_slow_p95_ms) {
      out.push({
        id: `assistant_slow:${r.alias}`,
        type: "assistant_slow",
        severity: "warning",
        subject: r.alias,
        value: r.p95_ms,
        threshold: cfg.alert_slow_p95_ms,
        tab: "usage",
      })
    }
  }
  return out
}

export function evaluateServiceAlerts(services: Pick<ServiceStatus, "key" | "name" | "status" | "down_minutes" | "down_since" | "last_error">[], cfg: MonitoringConfig): AdminAlert[] {
  return services
    .filter((s) => s.status === "down" && (s.down_minutes ?? 0) >= cfg.alert_down_minutes)
    .map((s) => ({
      id: `service_down:${s.key}`,
      type: "service_down" as const,
      severity: "critical" as const,
      subject: s.name,
      value: s.down_minutes,
      threshold: cfg.alert_down_minutes,
      since: s.down_since,
      detail: s.last_error,
      tab: "health" as const,
    }))
}

/**
 * So sánh lần chạy hoàn tất gần nhất với lần trước, trên phần câu chung của hai lần
 * (để lần chạy một phần không bị coi là giảm điểm).
 */
export function evaluateRegressionDrop(
  latest: { id: string; started_at: string | Date },
  latestResults: Array<{ case_id: string; passed: boolean }>,
  prevResults: Array<{ case_id: string; passed: boolean }>,
  cfg: MonitoringConfig
): AdminAlert | null {
  const prevIds = new Set(prevResults.map((r) => r.case_id))
  const common = latestResults.filter((r) => prevIds.has(r.case_id))
  if (common.length < 3) return null
  const commonIds = new Set(common.map((r) => r.case_id))
  const prevCommon = prevResults.filter((r) => commonIds.has(r.case_id))
  const rate = (arr: Array<{ passed: boolean }>) => (arr.filter((x) => x.passed).length / arr.length) * 100
  const drop = rate(prevCommon) - rate(common)
  const { regressed } = compareRuns(prevCommon, common)
  if (drop >= cfg.alert_regression_drop_pct || regressed >= 3) {
    return {
      id: `regression_drop:${latest.id}`,
      type: "regression_drop",
      severity: drop >= cfg.alert_regression_drop_pct * 2 ? "critical" : "warning",
      subject: "central",
      value: Math.round(drop * 10) / 10,
      threshold: cfg.alert_regression_drop_pct,
      since: new Date(latest.started_at).toISOString(),
      detail: `${regressed}`,
      tab: "regression",
    }
  }
  return null
}

async function assistantWindowRows(hours: number): Promise<AssistantWindowRow[]> {
  const r = await query<{ alias: string; questions: string; unanswered: string; errored: string; p95_ms: string | null }>(
    `WITH m AS (
       SELECT m.role::text AS role, m.status::text AS status, m.response_time_ms, m.created_at,
              COALESCE(NULLIF(m.assistant_alias, ''), NULLIF(s.assistant_alias, ''), 'central') AS alias,
              LEAD(m.role::text) OVER (PARTITION BY m.session_id ORDER BY m.created_at, m.role, m.id) AS next_role
       FROM ai_portal.messages m
       JOIN ai_portal.chat_sessions s ON s.id = m.session_id
       WHERE m.created_at >= now() - ($1::int * interval '1 hour')
         AND m.role IN ('user', 'assistant')
     )
     SELECT alias,
            COUNT(*) FILTER (WHERE role = 'user')::text AS questions,
            -- câu hỏi vừa gửi (< 3 phút) có thể chưa có trả lời: không tính là lỗi
            COUNT(*) FILTER (WHERE role = 'user' AND next_role IS DISTINCT FROM 'assistant' AND created_at < now() - interval '3 minutes')::text AS unanswered,
            COUNT(*) FILTER (WHERE role = 'assistant' AND status <> 'ok')::text AS errored,
            ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms)
                   FILTER (WHERE role = 'assistant' AND response_time_ms IS NOT NULL))::numeric)::text AS p95_ms
     FROM m GROUP BY alias`,
    [hours]
  )
  return r.rows.map((x) => ({
    alias: x.alias,
    questions: Number(x.questions) || 0,
    unanswered: Number(x.unanswered) || 0,
    errored: Number(x.errored) || 0,
    p95_ms: x.p95_ms != null ? Number(x.p95_ms) : null,
  }))
}

let cache: { at: number; data: AdminAlert[] } | null = null
const CACHE_MS = 60_000

export function invalidateAlertsCache(): void {
  cache = null
}

export async function getAdminAlerts(force = false): Promise<AdminAlert[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data
  const cfg = await getMonitoringConfig()
  await ensureMonitoringTables()
  const alerts: AdminAlert[] = []

  try {
    alerts.push(...evaluateAssistantAlerts(await assistantWindowRows(cfg.alert_window_hours), cfg))
  } catch (e: any) {
    console.warn("[alerts] assistants:", e?.message ?? e)
  }

  try {
    const services = await getServiceStatuses(cfg, 24)
    alerts.push(...evaluateServiceAlerts(services, cfg))
    if (cfg.health_enabled && !monitoringDisabledByEnv() && services.length > 0) {
      const last = services.map((s) => (s.last_checked_at ? Date.parse(s.last_checked_at) : 0)).reduce((a, b) => Math.max(a, b), 0)
      const staleMin = cfg.health_interval_min * 3 + 5
      if (!last || Date.now() - last > staleMin * 60_000) {
        alerts.push({
          id: "health_stale",
          type: "health_stale",
          severity: "info",
          subject: "health",
          value: last ? Math.round((Date.now() - last) / 60_000) : null,
          threshold: staleMin,
          since: last ? new Date(last).toISOString() : null,
          tab: "health",
        })
      }
    }
  } catch (e: any) {
    console.warn("[alerts] services:", e?.message ?? e)
  }

  try {
    const runs: RunRow[] = await listRuns(10)
    const finished = runs.filter((r) => r.status !== "running")
    const latest = finished[0]
    if (latest && (latest.status === "failed" || latest.status === "aborted")) {
      alerts.push({
        id: `regression_failed:${latest.id}`,
        type: "regression_failed",
        severity: "warning",
        subject: "central",
        since: new Date(latest.started_at).toISOString(),
        detail: latest.error,
        tab: "regression",
      })
    }
    const done = runs.filter((r) => r.status === "done")
    if (done.length >= 2) {
      const [a, b] = done
      const [ra, rb] = await Promise.all([getRunResults(a.id), getRunResults(b.id)])
      const drop = evaluateRegressionDrop(a, ra, rb, cfg)
      if (drop) alerts.push(drop)
    }
  } catch (e: any) {
    console.warn("[alerts] regression:", e?.message ?? e)
  }

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((x, y) => order[x.severity] - order[y.severity])
  cache = { at: Date.now(), data: alerts }
  return alerts
}
