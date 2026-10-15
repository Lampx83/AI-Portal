/**
 * Cấu hình giám sát: lưu trong ai_portal.app_settings, khoá `monitoring_config` (JSON), sửa được ở
 * Admin → «Tình trạng dịch vụ» mà không cần khởi động lại. Biến môi trường MONITORING_DISABLED=true
 * tắt toàn bộ tác vụ nền (kiểm tra sức khoẻ + kiểm thử hằng đêm) — dùng khi cần tắt khẩn.
 */
import { query } from "../db"
import { getBootstrapEnv } from "../settings"

export interface ExtraHealthTarget {
  /** Khoá ổn định (chữ thường, số, -, _). */
  key: string
  name: string
  url: string
  /** Gửi kèm header (vd. khoá nội bộ). Không bao giờ trả về giao diện ở dạng rõ. */
  headers?: Record<string, string>
}

export type NightlyMode = "auto" | "on" | "off"

export interface MonitoringConfig {
  health_enabled: boolean
  health_interval_min: number
  health_timeout_ms: number
  health_retention_days: number
  /** Kiểm tra thêm (vd. dịch vụ bóc băng, máy chủ chuyên gia) — ngoài các trợ lý trong DB và LLM của Central. */
  extra_targets: ExtraHealthTarget[]
  /** Các target_key bị bỏ qua. */
  disabled_targets: string[]
  /** auto = chỉ chạy khi Central có ít nhất một công cụ mà bộ câu hỏi cần (funds, journal-conference, regulations, paperfinder). */
  regression_nightly: NightlyMode
  regression_hour: number
  regression_concurrency: number
  regression_case_timeout_ms: number
  /** Ngưỡng cảnh báo */
  alert_slow_p95_ms: number
  alert_error_rate_pct: number
  alert_min_questions: number
  alert_window_hours: number
  alert_down_minutes: number
  alert_regression_drop_pct: number
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  health_enabled: true,
  health_interval_min: 5,
  health_timeout_ms: 4000,
  health_retention_days: 7,
  extra_targets: [],
  disabled_targets: [],
  regression_nightly: "auto",
  regression_hour: 2,
  regression_concurrency: 2,
  regression_case_timeout_ms: 90_000,
  alert_slow_p95_ms: 30_000,
  alert_error_rate_pct: 10,
  alert_min_questions: 10,
  alert_window_hours: 24,
  alert_down_minutes: 15,
  alert_regression_drop_pct: 10,
}

export const MONITORING_CONFIG_KEY = "monitoring_config"

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.round(n)))
}

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

/** Chuẩn hoá cấu hình (đầu vào từ DB hoặc từ admin) — giá trị lạ quay về mặc định, có chặn trên/dưới. */
export function normalizeMonitoringConfig(raw: unknown): MonitoringConfig {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_MONITORING_CONFIG
  const extra: ExtraHealthTarget[] = []
  if (Array.isArray(r.extra_targets)) {
    for (const t of r.extra_targets.slice(0, 30)) {
      if (!t || typeof t !== "object") continue
      const o = t as Record<string, unknown>
      const url = typeof o.url === "string" ? o.url.trim() : ""
      if (!/^https?:\/\/[^\s]+$/i.test(url)) continue
      const name = (typeof o.name === "string" ? o.name.trim() : "").slice(0, 80) || url
      let key = (typeof o.key === "string" ? o.key.trim().toLowerCase() : "").replace(/[^a-z0-9_-]/g, "-")
      if (!KEY_RE.test(key)) key = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `svc-${extra.length + 1}`
      if (extra.some((x) => x.key === key)) continue
      const headers: Record<string, string> = {}
      if (o.headers && typeof o.headers === "object" && !Array.isArray(o.headers)) {
        for (const [hk, hv] of Object.entries(o.headers as Record<string, unknown>)) {
          if (typeof hv === "string" && /^[A-Za-z0-9-]{1,64}$/.test(hk)) headers[hk] = hv
        }
      }
      extra.push({ key, name, url, ...(Object.keys(headers).length ? { headers } : {}) })
    }
  }
  const nightly = r.regression_nightly
  return {
    health_enabled: typeof r.health_enabled === "boolean" ? r.health_enabled : d.health_enabled,
    health_interval_min: clampInt(r.health_interval_min, 1, 60, d.health_interval_min),
    health_timeout_ms: clampInt(r.health_timeout_ms, 500, 15_000, d.health_timeout_ms),
    health_retention_days: clampInt(r.health_retention_days, 1, 30, d.health_retention_days),
    extra_targets: extra,
    disabled_targets: Array.isArray(r.disabled_targets)
      ? Array.from(new Set(r.disabled_targets.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))).slice(0, 100)
      : [],
    regression_nightly: nightly === "on" || nightly === "off" || nightly === "auto" ? nightly : d.regression_nightly,
    regression_hour: clampInt(r.regression_hour, 0, 23, d.regression_hour),
    regression_concurrency: clampInt(r.regression_concurrency, 1, 2, d.regression_concurrency),
    regression_case_timeout_ms: clampInt(r.regression_case_timeout_ms, 10_000, 300_000, d.regression_case_timeout_ms),
    alert_slow_p95_ms: clampInt(r.alert_slow_p95_ms, 1000, 600_000, d.alert_slow_p95_ms),
    alert_error_rate_pct: clampInt(r.alert_error_rate_pct, 1, 100, d.alert_error_rate_pct),
    alert_min_questions: clampInt(r.alert_min_questions, 1, 10_000, d.alert_min_questions),
    alert_window_hours: clampInt(r.alert_window_hours, 1, 168, d.alert_window_hours),
    alert_down_minutes: clampInt(r.alert_down_minutes, 5, 1440, d.alert_down_minutes),
    alert_regression_drop_pct: clampInt(r.alert_regression_drop_pct, 1, 100, d.alert_regression_drop_pct),
  }
}

/** Tắt khẩn toàn bộ tác vụ nền bằng biến môi trường. */
export function monitoringDisabledByEnv(): boolean {
  return /^(1|true|yes|on)$/i.test(getBootstrapEnv("MONITORING_DISABLED", ""))
}

export async function getMonitoringConfig(): Promise<MonitoringConfig> {
  try {
    const r = await query<{ value: string }>(`SELECT value FROM ai_portal.app_settings WHERE key = $1`, [MONITORING_CONFIG_KEY])
    const v = r.rows[0]?.value
    return normalizeMonitoringConfig(v ? JSON.parse(v) : {})
  } catch {
    return normalizeMonitoringConfig({})
  }
}

export async function saveMonitoringConfig(cfg: MonitoringConfig): Promise<void> {
  await query(
    `INSERT INTO ai_portal.app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [MONITORING_CONFIG_KEY, JSON.stringify(cfg)]
  )
}

/** Bản cấu hình gửi ra giao diện: che giá trị header (chỉ giữ tên header). */
export function redactConfig(cfg: MonitoringConfig): MonitoringConfig & { extra_targets: Array<ExtraHealthTarget & { header_names?: string[] }> } {
  return {
    ...cfg,
    extra_targets: cfg.extra_targets.map((t) => ({
      key: t.key,
      name: t.name,
      url: t.url,
      ...(t.headers ? { header_names: Object.keys(t.headers), headers: Object.fromEntries(Object.keys(t.headers).map((k) => [k, "••••"])) } : {}),
    })),
  }
}

/**
 * Gộp cấu hình admin gửi lên với cấu hình đang lưu: header có giá trị "••••" (đã che) giữ giá trị cũ.
 */
export function mergeIncomingConfig(current: MonitoringConfig, incoming: unknown): MonitoringConfig {
  const inc = incoming && typeof incoming === "object" ? { ...(incoming as Record<string, unknown>) } : {}
  if (Array.isArray(inc.extra_targets)) {
    inc.extra_targets = (inc.extra_targets as unknown[]).map((t) => {
      if (!t || typeof t !== "object") return t
      const o = { ...(t as Record<string, unknown>) }
      const prev = current.extra_targets.find((x) => x.key === o.key)
      if (o.headers && typeof o.headers === "object") {
        const h: Record<string, unknown> = { ...(o.headers as Record<string, unknown>) }
        for (const [k, v] of Object.entries(h)) {
          if (v === "••••") {
            if (prev?.headers?.[k] != null) h[k] = prev.headers[k]
            else delete h[k]
          }
        }
        o.headers = h
      }
      return o
    })
  }
  return normalizeMonitoringConfig({ ...current, ...inc })
}
