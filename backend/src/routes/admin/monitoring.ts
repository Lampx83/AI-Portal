/**
 * API giám sát cho Admin (mọi đường đều qua adminOnly ở routes/admin.ts, kèm adminOnly ở từng route để fail-closed
 * kể cả khi bị mount nhầm chỗ):
 *   GET  /api/admin/usage-stats?from=YYYY-MM-DD&to=YYYY-MM-DD | ?days=N
 *   GET  /api/admin/monitoring/health                 trạng thái dịch vụ + cấu hình
 *   POST /api/admin/monitoring/health/check-now       kiểm tra ngay
 *   GET  /api/admin/monitoring/config | PUT …          cấu hình giám sát
 *   GET  /api/admin/monitoring/regression             danh sách lần chạy + bộ câu
 *   POST /api/admin/monitoring/regression/run         chạy ngay ({ case_ids?: string[] })
 *   GET  /api/admin/monitoring/regression/runs/:id    chi tiết + so sánh với lần trước
 *   GET  /api/admin/monitoring/alerts                 cảnh báo
 */
import { Router, Request, Response } from "express"
import { adminOnly } from "./middleware"
import { parseDateRange, vnDateOf } from "../../lib/monitoring/time"
import { getUsageStats } from "../../lib/monitoring/usage-stats"
import {
  getMonitoringConfig,
  mergeIncomingConfig,
  monitoringDisabledByEnv,
  redactConfig,
  saveMonitoringConfig,
} from "../../lib/monitoring/config"
import { getServiceStatuses, runHealthChecks } from "../../lib/monitoring/health"
import {
  getApplicableCases,
  getRunDetail,
  hasRunningRun,
  listRuns,
  nightlyAllowed,
  startRegressionRun,
} from "../../lib/monitoring/regression"
import { REGRESSION_SUITE_VERSION } from "../../lib/monitoring/regression-cases"
import { getAdminAlerts, invalidateAlertsCache } from "../../lib/monitoring/alerts"
import { getCaller } from "../../lib/chat/access"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(res: Response, where: string, err: any) {
  console.error(`[admin/monitoring] ${where}:`, err?.message ?? err)
  res.status(500).json({ error: "Internal Server Error", message: err?.message })
}

// ─── /api/admin/usage-stats ──────────────────────────────────────────────────
export const usageStatsRouter = Router()

usageStatsRouter.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const range = parseDateRange({ from: req.query.from, to: req.query.to, days: req.query.days })
    res.json(await getUsageStats(range, vnDateOf()))
  } catch (err) {
    fail(res, "usage-stats", err)
  }
})

// ─── /api/admin/monitoring ───────────────────────────────────────────────────
export const monitoringRouter = Router()

monitoringRouter.get("/health", adminOnly, async (_req: Request, res: Response) => {
  try {
    const cfg = await getMonitoringConfig()
    const services = await getServiceStatuses(cfg, 24)
    res.json({
      services,
      config: redactConfig(cfg),
      disabled_by_env: monitoringDisabledByEnv(),
    })
  } catch (err) {
    fail(res, "health", err)
  }
})

let checkNowRunning = false
monitoringRouter.post("/health/check-now", adminOnly, async (_req: Request, res: Response) => {
  if (checkNowRunning) return res.status(409).json({ error: "Đang kiểm tra, vui lòng chờ." })
  checkNowRunning = true
  try {
    const cfg = await getMonitoringConfig()
    await runHealthChecks(cfg)
    invalidateAlertsCache()
    res.json({ services: await getServiceStatuses(cfg, 24) })
  } catch (err) {
    fail(res, "health/check-now", err)
  } finally {
    checkNowRunning = false
  }
})

monitoringRouter.get("/config", adminOnly, async (_req: Request, res: Response) => {
  try {
    res.json({ config: redactConfig(await getMonitoringConfig()), disabled_by_env: monitoringDisabledByEnv() })
  } catch (err) {
    fail(res, "config", err)
  }
})

monitoringRouter.put("/config", adminOnly, async (req: Request, res: Response) => {
  try {
    const current = await getMonitoringConfig()
    const next = mergeIncomingConfig(current, req.body?.config ?? req.body)
    await saveMonitoringConfig(next)
    invalidateAlertsCache()
    res.json({ config: redactConfig(next) })
  } catch (err) {
    fail(res, "config:put", err)
  }
})

monitoringRouter.get("/regression", adminOnly, async (_req: Request, res: Response) => {
  try {
    const cfg = await getMonitoringConfig()
    const [runs, applicable] = await Promise.all([listRuns(30), getApplicableCases()])
    res.json({
      runs,
      suite_version: REGRESSION_SUITE_VERSION,
      cases: applicable.cases.map((c) => ({ id: c.id, category: c.category, question: c.question, expect: c.expect })),
      skipped_cases: applicable.skipped.map((c) => ({ id: c.id, requires_tool: c.requiresTool })),
      nightly: {
        mode: cfg.regression_nightly,
        hour: cfg.regression_hour,
        active: !monitoringDisabledByEnv() && nightlyAllowed(cfg, applicable.installedTools),
      },
      concurrency: cfg.regression_concurrency,
    })
  } catch (err) {
    fail(res, "regression", err)
  }
})

monitoringRouter.post("/regression/run", adminOnly, async (req: Request, res: Response) => {
  try {
    if (await hasRunningRun()) return res.status(409).json({ error: "Đang có một lần kiểm thử chạy dở, vui lòng chờ." })
    const caseIds = Array.isArray(req.body?.case_ids)
      ? (req.body.case_ids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 100)
      : undefined
    const cfg = await getMonitoringConfig()
    const caller = await getCaller(req).catch(() => null)
    const r = await startRegressionRun(cfg, {
      trigger: "manual",
      triggeredBy: caller?.email ?? "admin",
      caseIds,
    })
    invalidateAlertsCache()
    res.status(202).json({ run_id: r.runId, total: r.total, skipped: r.skipped })
  } catch (err: any) {
    if (/Không có câu kiểm thử/.test(err?.message || "")) return res.status(400).json({ error: err.message })
    fail(res, "regression/run", err)
  }
})

monitoringRouter.get("/regression/runs/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "")
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "id không hợp lệ" })
    const detail = await getRunDetail(id)
    if (!detail) return res.status(404).json({ error: "Không tìm thấy" })
    res.json(detail)
  } catch (err) {
    fail(res, "regression/runs/:id", err)
  }
})

monitoringRouter.get("/alerts", adminOnly, async (req: Request, res: Response) => {
  try {
    const alerts = await getAdminAlerts(req.query.refresh === "1")
    const counts = { critical: 0, warning: 0, info: 0 }
    for (const a of alerts) counts[a.severity]++
    res.json({ alerts, counts, total: alerts.length })
  } catch (err) {
    fail(res, "alerts", err)
  }
})
