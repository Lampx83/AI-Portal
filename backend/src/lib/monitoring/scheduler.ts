/**
 * Tác vụ nền giám sát (chạy trong tiến trình backend, mỗi phút "tick" một lần, timer unref):
 *  - Kiểm tra sức khoẻ dịch vụ mỗi health_interval_min phút (mặc định 5).
 *  - Kiểm thử hồi quy Central hằng đêm lúc regression_hour giờ (mặc định 02:00 giờ VN).
 * Nhiều tiến trình backend dùng chung DB không chạy trùng nhờ "lease" nguyên tử trong ai_portal.monitoring_state.
 * Tắt: Admin → Tình trạng dịch vụ (cấu hình) hoặc biến môi trường MONITORING_DISABLED=true.
 */
import { query } from "../db"
import { getMonitoringConfig, monitoringDisabledByEnv } from "./config"
import { runHealthChecks } from "./health"
import { abortStaleRuns, getApplicableCases, hasRunningRun, nightlyAllowed, startRegressionRun } from "./regression"
import { ensureMonitoringTables } from "./schema"
import { vnDateOf, vnHourOf } from "./time"
import { invalidateAlertsCache } from "./alerts"

const TICK_MS = 60_000
const STARTUP_DELAY_MS = 45_000
let timer: NodeJS.Timeout | null = null
let ticking = false

/**
 * Lease nguyên tử: trả true nếu lấy được quyền chạy (bản ghi chưa có hoặc đã cũ hơn minIntervalSec).
 */
export async function tryAcquireLease(name: string, minIntervalSec: number): Promise<boolean> {
  const r = await query<{ key: string }>(
    `INSERT INTO ai_portal.monitoring_state (key, value, updated_at) VALUES ($1, '{}'::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET updated_at = now()
       WHERE ai_portal.monitoring_state.updated_at < now() - ($2::int * interval '1 second')
     RETURNING key`,
    [name, Math.max(1, Math.floor(minIntervalSec))]
  )
  return (r.rowCount ?? 0) > 0
}

/** Khoá chỉ-một-lần (vd. mỗi đêm một lần): true nếu đây là lần đầu tạo khoá. */
export async function tryOnce(name: string): Promise<boolean> {
  const r = await query<{ key: string }>(
    `INSERT INTO ai_portal.monitoring_state (key, value, updated_at) VALUES ($1, '{}'::jsonb, now())
     ON CONFLICT (key) DO NOTHING RETURNING key`,
    [name]
  )
  return (r.rowCount ?? 0) > 0
}

async function tick(): Promise<void> {
  if (ticking || monitoringDisabledByEnv()) return
  ticking = true
  try {
    const cfg = await getMonitoringConfig()
    if (cfg.health_enabled) {
      // Trừ 20 giây để tick 60s không trượt một chu kỳ.
      const got = await tryAcquireLease("health_lease", cfg.health_interval_min * 60 - 20).catch(() => false)
      if (got) {
        await runHealthChecks(cfg).catch((e) => console.warn("[monitoring] health checks failed:", e?.message ?? e))
        invalidateAlertsCache()
      }
    }
    if (cfg.regression_nightly !== "off" && vnHourOf() === cfg.regression_hour) {
      const today = vnDateOf()
      const { installedTools } = await getApplicableCases()
      if (nightlyAllowed(cfg, installedTools) && !(await hasRunningRun())) {
        if (await tryOnce(`regression_nightly:${today}`)) {
          const r = await startRegressionRun(cfg, { trigger: "nightly", triggeredBy: "schedule" })
          console.log(`[monitoring] nightly Central regression started: ${r.runId} (${r.total} câu)`)
        }
      }
    }
    // Dọn khoá chỉ-một-lần cũ (giữ 14 ngày).
    if (Math.random() < 0.02) {
      await query(
        `DELETE FROM ai_portal.monitoring_state WHERE key LIKE 'regression_nightly:%' AND updated_at < now() - interval '14 days'`
      ).catch(() => {})
    }
  } catch (e: any) {
    console.warn("[monitoring] tick failed:", e?.message ?? e)
  } finally {
    ticking = false
  }
}

export function startMonitoringScheduler(): void {
  if (timer) return
  if (monitoringDisabledByEnv()) {
    console.log("[monitoring] disabled by MONITORING_DISABLED")
    return
  }
  const boot = setTimeout(async () => {
    const ok = await ensureMonitoringTables()
    if (!ok) console.warn("[monitoring] tables unavailable — scheduler sẽ thử lại mỗi phút")
    await abortStaleRuns().catch(() => {})
    void tick()
    timer = setInterval(() => void tick(), TICK_MS)
    timer.unref()
  }, STARTUP_DELAY_MS)
  boot.unref()
}

export function stopMonitoringScheduler(): void {
  if (timer) clearInterval(timer)
  timer = null
}
