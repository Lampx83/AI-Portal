import { test } from "node:test"
import assert from "node:assert/strict"
import { displayUrl, summarizeTarget } from "../health"
import { evaluateAssistantAlerts, evaluateRegressionDrop, evaluateServiceAlerts } from "../alerts"
import { DEFAULT_MONITORING_CONFIG, mergeIncomingConfig, normalizeMonitoringConfig, redactConfig } from "../config"

const cfg = DEFAULT_MONITORING_CONFIG
const now = new Date("2026-10-15T10:00:00Z")
const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000).toISOString()

test("summarizeTarget: đang đỏ — tính thời điểm bắt đầu chuỗi lỗi", () => {
  const rows = [
    { ok: false, status_code: null, latency_ms: 4000, error: "ECONNREFUSED", checked_at: at(0) },
    { ok: false, status_code: 502, latency_ms: 30, error: "HTTP 502", checked_at: at(5) },
    { ok: false, status_code: null, latency_ms: 4000, error: "timeout", checked_at: at(10) },
    { ok: true, status_code: 200, latency_ms: 20, error: null, checked_at: at(15) },
    { ok: true, status_code: 200, latency_ms: 40, error: null, checked_at: at(20) },
  ]
  const s = summarizeTarget(rows, now)
  assert.equal(s.status, "down")
  assert.equal(s.down_since, at(10))
  assert.equal(s.down_minutes, 10)
  assert.equal(s.uptime_pct, 40)
  assert.equal(s.avg_latency_ms, 30)
  assert.equal(s.last_error, "ECONNREFUSED")
})

test("summarizeTarget: xanh + lần lỗi gần nhất lấy từ ngoài cửa sổ", () => {
  const s = summarizeTarget([{ ok: true, status_code: 200, latency_ms: 12, error: null, checked_at: at(1) }], now, { at: at(3000), error: "HTTP 500" })
  assert.equal(s.status, "up")
  assert.equal(s.down_since, null)
  assert.equal(s.last_error, "HTTP 500")
  assert.equal(summarizeTarget([], now).status, "unknown")
})

test("displayUrl ẩn thông tin đăng nhập và query", () => {
  assert.equal(displayUrl("http://u:p@10.0.0.1:8000/health?key=abc"), "http://10.0.0.1:8000/health")
})

test("evaluateServiceAlerts: chỉ báo khi đỏ quá ngưỡng phút", () => {
  const a = evaluateServiceAlerts(
    [
      { key: "x", name: "X", status: "down", down_minutes: 20, down_since: at(20), last_error: "timeout" },
      { key: "y", name: "Y", status: "down", down_minutes: 5, down_since: at(5), last_error: "timeout" },
      { key: "z", name: "Z", status: "up", down_minutes: null, down_since: null, last_error: null },
    ],
    cfg
  )
  assert.equal(a.length, 1)
  assert.equal(a[0].subject, "X")
  assert.equal(a[0].severity, "critical")
})

test("evaluateAssistantAlerts: lỗi, trạng thái lỗi lặp lại, chậm; bỏ qua khi ít câu hỏi", () => {
  const a = evaluateAssistantAlerts(
    [
      { alias: "central", questions: 100, unanswered: 15, errored: 0, p95_ms: 45_000 },
      { alias: "papers", questions: 3, unanswered: 3, errored: 0, p95_ms: 90_000 },
      { alias: "funds", questions: 50, unanswered: 0, errored: 4, p95_ms: 5000 },
    ],
    cfg
  )
  const ids = a.map((x) => x.id).sort()
  assert.deepEqual(ids, ["assistant_error_status:funds", "assistant_errors:central", "assistant_slow:central"])
})

test("evaluateRegressionDrop: so trên phần câu chung", () => {
  const prev = Array.from({ length: 10 }, (_, i) => ({ case_id: `c${i}`, passed: true }))
  const curSame = prev.map((r) => ({ ...r }))
  assert.equal(evaluateRegressionDrop({ id: "r2", started_at: now }, curSame, prev, cfg), null)
  const curWorse = prev.map((r, i) => ({ ...r, passed: i >= 3 })) // 3 câu tụt
  const alert = evaluateRegressionDrop({ id: "r2", started_at: now }, curWorse, prev, cfg)
  assert.ok(alert)
  assert.equal(alert!.value, 30)
  // Lần chạy một phần (chỉ 2 câu chung) → không đủ so sánh
  assert.equal(evaluateRegressionDrop({ id: "r3", started_at: now }, [{ case_id: "c0", passed: false }, { case_id: "c1", passed: false }], prev, cfg), null)
})

test("config: chuẩn hoá, chặn giá trị, che header và giữ giá trị cũ khi lưu", () => {
  const c = normalizeMonitoringConfig({ health_interval_min: 0, regression_concurrency: 9, regression_nightly: "x", extra_targets: [{ name: "Bóc băng", url: "http://10.0.0.1:8000/health", headers: { "x-key": "secret" } }, { name: "bad", url: "ftp://x" }] })
  assert.equal(c.health_interval_min, 1)
  assert.equal(c.regression_concurrency, 2)
  assert.equal(c.regression_nightly, "auto")
  assert.equal(c.extra_targets.length, 1)
  assert.equal(c.extra_targets[0].key, "boc-bang")
  const red = redactConfig(c)
  assert.equal(red.extra_targets[0].headers?.["x-key"], "••••")
  assert.ok(!JSON.stringify(red).includes("secret"))
  const merged = mergeIncomingConfig(c, { health_enabled: false, extra_targets: red.extra_targets })
  assert.equal(merged.health_enabled, false)
  assert.equal(merged.extra_targets[0].headers?.["x-key"], "secret")
})
