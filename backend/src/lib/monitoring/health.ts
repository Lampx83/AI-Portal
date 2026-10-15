/**
 * Kiểm tra sức khoẻ các dịch vụ AI/công cụ bên ngoài mà Portal gọi tới.
 * Danh sách lấy từ cấu hình trong DB (không ghi cứng địa chỉ):
 *   - mọi trợ lý đang bật trong ai_portal.assistants → GET {base_url}/metadata (endpoint nhẹ chuẩn của agent)
 *   - LLM của Trợ lý chính (app_settings central_llm_*) → GET {baseUrl}/models
 *   - danh sách bổ sung trong monitoring_config.extra_targets (vd. dịch vụ bóc băng, máy chủ chuyên gia)
 * Mỗi lần kiểm tra chạy song song, timeout ngắn (mặc định 4 giây), không chặn luồng xử lý request.
 */
import { query } from "../db"
import { getCentralLlmCredentials } from "../central-agent-config"
import type { MonitoringConfig } from "./config"
import { ensureMonitoringTables } from "./schema"

export type HealthTargetKind = "assistant" | "llm" | "extra"

export interface HealthTarget {
  key: string
  name: string
  kind: HealthTargetKind
  url: string
  headers?: Record<string, string>
}

export interface ProbeResult {
  target_key: string
  target_name: string
  url: string
  ok: boolean
  status_code: number | null
  latency_ms: number
  error: string | null
}

/** Ẩn userinfo + query string khỏi URL trước khi lưu/hiển thị. */
export function displayUrl(u: string): string {
  try {
    const x = new URL(u)
    x.username = ""
    x.password = ""
    x.search = ""
    x.hash = ""
    return x.toString()
  } catch {
    return u.split("?")[0]
  }
}

export async function discoverHealthTargets(cfg: MonitoringConfig): Promise<HealthTarget[]> {
  const targets: HealthTarget[] = []
  try {
    const r = await query<{ alias: string; base_url: string; config_json: any }>(
      `SELECT alias, base_url, config_json FROM ai_portal.assistants
       WHERE is_active = true AND base_url IS NOT NULL AND base_url <> ''
       ORDER BY display_order, alias`
    )
    for (const a of r.rows) {
      const base = String(a.base_url).trim().replace(/\/+$/, "")
      if (!/^https?:\/\//i.test(base)) continue
      const name = (a.config_json && typeof a.config_json.name === "string" && a.config_json.name.trim()) || a.alias
      targets.push({ key: `assistant:${a.alias}`, name, kind: "assistant", url: `${base}/metadata` })
    }
  } catch (e: any) {
    console.warn("[monitoring] list assistants failed:", e?.message ?? e)
  }
  try {
    const cred = await getCentralLlmCredentials()
    if (cred) {
      const base = (cred.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")
      const headers: Record<string, string> = { ...(cred.extraHeaders || {}) }
      if (cred.apiKey) headers.Authorization = `Bearer ${cred.apiKey}`
      targets.push({ key: "llm:central", name: `LLM Central (${cred.model})`, kind: "llm", url: `${base}/models`, headers })
    }
  } catch {
    /* không có cấu hình LLM */
  }
  for (const t of cfg.extra_targets) {
    targets.push({ key: `extra:${t.key}`, name: t.name, kind: "extra", url: t.url, headers: t.headers })
  }
  const disabled = new Set(cfg.disabled_targets)
  return targets.filter((t) => !disabled.has(t.key))
}

/** Một lần gọi kiểm tra; không bao giờ ném lỗi. */
export async function probeTarget(t: HealthTarget, timeoutMs: number): Promise<ProbeResult> {
  const started = Date.now()
  const base = { target_key: t.key, target_name: t.name, url: displayUrl(t.url) }
  try {
    const res = await fetch(t.url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "AI-Portal-HealthCheck/1.0", ...(t.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    })
    // Không cần nội dung — huỷ để giải phóng kết nối.
    try {
      await res.body?.cancel()
    } catch {
      /* bỏ qua */
    }
    const latency = Date.now() - started
    // 5xx = dịch vụ lỗi. LLM trả 401/403 = sai khoá → Central cũng sẽ lỗi, coi là đỏ.
    const authFail = t.kind === "llm" && (res.status === 401 || res.status === 403)
    const ok = res.status < 500 && !authFail
    return {
      ...base,
      ok,
      status_code: res.status,
      latency_ms: latency,
      error: ok ? null : authFail ? `HTTP ${res.status} (xác thực)` : `HTTP ${res.status}`,
    }
  } catch (e: any) {
    const latency = Date.now() - started
    const code = e?.cause?.code || e?.code
    const isTimeout = e?.name === "TimeoutError" || e?.name === "AbortError"
    const msg = isTimeout ? `Hết thời gian chờ (${timeoutMs} ms)` : String(code || e?.message || e).slice(0, 200)
    return { ...base, ok: false, status_code: null, latency_ms: latency, error: msg }
  }
}

let running = false

/** Chạy một vòng kiểm tra toàn bộ + lưu kết quả + dọn lịch sử cũ. */
export async function runHealthChecks(cfg: MonitoringConfig): Promise<ProbeResult[]> {
  if (running) return []
  running = true
  try {
    await ensureMonitoringTables()
    const targets = await discoverHealthTargets(cfg)
    const results = await Promise.all(targets.map((t) => probeTarget(t, cfg.health_timeout_ms)))
    if (results.length > 0) {
      const values: string[] = []
      const params: unknown[] = []
      results.forEach((r, i) => {
        const o = i * 7
        values.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7})`)
        params.push(r.target_key, r.target_name, r.url, r.ok, r.status_code, r.latency_ms, r.error)
      })
      await query(
        `INSERT INTO ai_portal.service_health_checks (target_key, target_name, url, ok, status_code, latency_ms, error)
         VALUES ${values.join(", ")}`,
        params
      )
    }
    await query(
      `DELETE FROM ai_portal.service_health_checks WHERE checked_at < now() - ($1::int * interval '1 day')`,
      [cfg.health_retention_days]
    ).catch(() => {})
    return results
  } finally {
    running = false
  }
}

// ─── Tổng hợp trạng thái (thuần) ─────────────────────────────────────────────

export interface HealthRow {
  ok: boolean
  status_code: number | null
  latency_ms: number | null
  error: string | null
  checked_at: string | Date
}

export interface TargetSummary {
  status: "up" | "down" | "unknown"
  last_checked_at: string | null
  last_latency_ms: number | null
  last_status_code: number | null
  /** Thời điểm bắt đầu chuỗi lỗi hiện tại (nếu đang đỏ). */
  down_since: string | null
  down_minutes: number | null
  uptime_pct: number | null
  avg_latency_ms: number | null
  checks: number
  last_error_at: string | null
  last_error: string | null
}

const iso = (d: string | Date | null | undefined) => (d == null ? null : new Date(d).toISOString())

/**
 * Tóm tắt lịch sử một dịch vụ (rows sắp xếp MỚI → CŨ).
 * `lastError` có thể lấy từ ngoài cửa sổ lịch sử (lần lỗi gần nhất trong toàn bộ dữ liệu lưu).
 */
export function summarizeTarget(rows: HealthRow[], now: Date = new Date(), lastError?: { at: string | Date; error: string | null } | null): TargetSummary {
  if (!rows.length) {
    return {
      status: "unknown",
      last_checked_at: null,
      last_latency_ms: null,
      last_status_code: null,
      down_since: null,
      down_minutes: null,
      uptime_pct: null,
      avg_latency_ms: null,
      checks: 0,
      last_error_at: lastError ? iso(lastError.at) : null,
      last_error: lastError?.error ?? null,
    }
  }
  const latest = rows[0]
  let downSince: string | Date | null = null
  if (!latest.ok) {
    downSince = latest.checked_at
    for (const r of rows) {
      if (r.ok) break
      downSince = r.checked_at
    }
  }
  const okRows = rows.filter((r) => r.ok)
  const lat = okRows.map((r) => r.latency_ms).filter((x): x is number => typeof x === "number")
  const firstFail = rows.find((r) => !r.ok)
  const le = firstFail ? { at: firstFail.checked_at, error: firstFail.error } : lastError ?? null
  return {
    status: latest.ok ? "up" : "down",
    last_checked_at: iso(latest.checked_at),
    last_latency_ms: latest.latency_ms,
    last_status_code: latest.status_code,
    down_since: iso(downSince),
    down_minutes: downSince ? Math.max(0, Math.round((now.getTime() - new Date(downSince).getTime()) / 60000)) : null,
    uptime_pct: Math.round((okRows.length / rows.length) * 1000) / 10,
    avg_latency_ms: lat.length ? Math.round(lat.reduce((s, x) => s + x, 0) / lat.length) : null,
    checks: rows.length,
    last_error_at: le ? iso(le.at) : null,
    last_error: le?.error ?? null,
  }
}

export interface ServiceStatus extends TargetSummary {
  key: string
  name: string
  kind: HealthTargetKind
  url: string
  /** Lịch sử rút gọn (cũ → mới) để vẽ dải trạng thái. */
  history: Array<{ t: string; ok: boolean; ms: number | null }>
}

/** Trạng thái hiện tại của mọi dịch vụ (kể cả dịch vụ chưa được kiểm tra lần nào). */
export async function getServiceStatuses(cfg: MonitoringConfig, windowHours = 24): Promise<ServiceStatus[]> {
  await ensureMonitoringTables()
  const targets = await discoverHealthTargets(cfg)
  const [hist, lastErr] = await Promise.all([
    query<{ target_key: string; target_name: string; url: string; ok: boolean; status_code: number | null; latency_ms: number | null; error: string | null; checked_at: Date }>(
      `SELECT target_key, target_name, url, ok, status_code, latency_ms, error, checked_at
       FROM ai_portal.service_health_checks
       WHERE checked_at > now() - ($1::int * interval '1 hour')
       ORDER BY target_key, checked_at DESC`,
      [windowHours]
    ),
    query<{ target_key: string; error: string | null; checked_at: Date }>(
      `SELECT DISTINCT ON (target_key) target_key, error, checked_at
       FROM ai_portal.service_health_checks
       WHERE ok = false
       ORDER BY target_key, checked_at DESC`
    ),
  ])
  const byKey = new Map<string, typeof hist.rows>()
  for (const r of hist.rows) {
    let arr = byKey.get(r.target_key)
    if (!arr) byKey.set(r.target_key, (arr = []))
    arr.push(r)
  }
  const errMap = new Map(lastErr.rows.map((r) => [r.target_key, { at: r.checked_at, error: r.error }]))
  const now = new Date()
  const out: ServiceStatus[] = targets.map((t) => {
    const rows = byKey.get(t.key) ?? []
    return {
      key: t.key,
      name: t.name,
      kind: t.kind,
      url: displayUrl(t.url),
      ...summarizeTarget(rows, now, errMap.get(t.key) ?? null),
      history: rows
        .slice(0, 96)
        .reverse()
        .map((r) => ({ t: new Date(r.checked_at).toISOString(), ok: r.ok, ms: r.latency_ms })),
    }
  })
  return out
}
