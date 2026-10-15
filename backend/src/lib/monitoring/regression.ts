/**
 * Chạy kiểm thử hồi quy Trợ lý chính (Central): gửi từng câu trong REGRESSION_CASES tới
 * /api/central_agent/v1/ask (nhánh stream — đúng đường giao diện chat dùng), chấm điểm và lưu
 * vào ai_portal.central_regression_runs / central_regression_results.
 * Không ghi vào messages/chat_sessions (orchestrator không lưu hội thoại) nên không làm lệch thống kê.
 * Tối đa 2 câu song song để không làm nặng máy chủ mô hình.
 */
import { query } from "../db"
import { getBootstrapEnv } from "../settings"
import { getCentralLlmCredentials } from "../central-agent-config"
import { getToolsManifestsForCentral } from "../tools"
import { ensureMonitoringTables } from "./schema"
import { REGRESSION_CASES, REGRESSION_SUITE_VERSION, type RegressionCase } from "./regression-cases"
import { gradeCase, summarizeGrades, compareRuns, type CaseOutcome } from "./regression-grader"
import type { MonitoringConfig } from "./config"
import { vnDateOf } from "./time"

const MAX_ANSWER_STORE = 6000
/** Chạy treo quá lâu (backend khởi động lại giữa chừng) → đánh dấu bỏ dở. */
const STALE_RUN_HOURS = 3

export interface ApplicableCases {
  cases: RegressionCase[]
  skipped: RegressionCase[]
  installedTools: string[]
}

/** Lọc câu theo công cụ đang cài (câu cần công cụ chưa cài thì bỏ qua). */
export async function getApplicableCases(): Promise<ApplicableCases> {
  let installed: string[] = []
  try {
    installed = (await getToolsManifestsForCentral()).map((m) => m.alias.toLowerCase())
  } catch {
    installed = []
  }
  const set = new Set(installed)
  const cases: RegressionCase[] = []
  const skipped: RegressionCase[] = []
  for (const c of REGRESSION_CASES) {
    if (c.requiresTool && !set.has(c.requiresTool.toLowerCase())) skipped.push(c)
    else cases.push(c)
  }
  return { cases, skipped, installedTools: installed }
}

/** Chế độ "auto" của lịch hằng đêm: chỉ chạy khi có công cụ NCKH mà bộ câu cần (tránh chạy vô ích trên bản cài đặt khác). */
export function nightlyAllowed(cfg: MonitoringConfig, installedTools: string[]): boolean {
  if (cfg.regression_nightly === "off") return false
  if (cfg.regression_nightly === "on") return true
  const need = ["funds", "journal-conference", "regulations", "paperfinder"]
  return need.some((x) => installedTools.includes(x))
}

function backendBase(): string {
  return `http://127.0.0.1:${getBootstrapEnv("PORT", "3001")}`
}

/** Gọi Central (stream SSE) cho một câu; trả nội dung cuối + danh sách hàm đã gọi. */
export async function askCentral(question: string, model: string, timeoutMs: number): Promise<CaseOutcome> {
  const started = Date.now()
  try {
    const res = await fetch(`${backendBase()}/api/central_agent/v1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        session_id: `regression-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        model_id: model,
        user: "central-regression",
        prompt: question,
        stream: true,
        context: {},
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const ctype = res.headers.get("content-type") || ""
    if (!ctype.includes("text/event-stream")) {
      const data: any = await res.json().catch(() => ({}))
      const ok = res.ok && data?.status === "success"
      return {
        ok,
        answer: String(data?.content_markdown ?? ""),
        functionsCalled: Array.isArray(data?.meta?.functions_called) ? data.meta.functions_called.map(String) : [],
        latencyMs: Date.now() - started,
        error: ok ? null : String(data?.error_message || `HTTP ${res.status}`).slice(0, 300),
      }
    }
    const text = await res.text()
    let content = ""
    let done: any = null
    let errorMsg: string | null = null
    for (const block of text.split(/\n\n+/)) {
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === "[DONE]") continue
        let evt: any
        try {
          evt = JSON.parse(payload)
        } catch {
          continue
        }
        if (evt?.type === "chunk" && typeof evt.delta === "string") content += evt.delta
        else if (evt?.type === "done") done = evt
        else if (evt?.type === "error") errorMsg = String(evt.error_message || "Lỗi từ Central")
      }
    }
    if (done && typeof done.content_markdown === "string" && done.content_markdown.length >= content.length) content = done.content_markdown
    const ok = res.ok && !!done && done.status !== "error" && !errorMsg
    return {
      ok,
      answer: content,
      functionsCalled: Array.isArray(done?.meta?.functions_called) ? done.meta.functions_called.map(String) : [],
      latencyMs: Date.now() - started,
      error: ok ? null : (errorMsg || (done ? null : "Không nhận được sự kiện kết thúc") || `HTTP ${res.status}`)?.slice(0, 300) ?? null,
    }
  } catch (e: any) {
    const isTimeout = e?.name === "TimeoutError" || e?.name === "AbortError"
    return {
      ok: false,
      answer: "",
      functionsCalled: [],
      latencyMs: Date.now() - started,
      error: isTimeout ? `Hết thời gian chờ (${timeoutMs} ms)` : String(e?.cause?.code || e?.message || e).slice(0, 300),
    }
  }
}

/** Đánh dấu bỏ dở các lần chạy treo quá lâu. */
export async function abortStaleRuns(): Promise<void> {
  await ensureMonitoringTables()
  await query(
    `UPDATE ai_portal.central_regression_runs
     SET status = 'aborted', finished_at = now(), error = COALESCE(error, 'Bị gián đoạn (backend khởi động lại?)')
     WHERE status = 'running' AND started_at < now() - ($1::int * interval '1 hour')`,
    [STALE_RUN_HOURS]
  ).catch(() => {})
}

export async function hasRunningRun(): Promise<boolean> {
  await ensureMonitoringTables()
  const r = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM ai_portal.central_regression_runs
     WHERE status = 'running' AND started_at > now() - ($1::int * interval '1 hour')`,
    [STALE_RUN_HOURS]
  )
  return Number(r.rows[0]?.n || 0) > 0
}

export interface StartRunOptions {
  trigger: "manual" | "nightly"
  triggeredBy?: string | null
  /** Chỉ chạy một số câu (theo id) — dùng khi kiểm tra nhanh. */
  caseIds?: string[]
}

/**
 * Tạo bản ghi lần chạy và chạy nền (không chờ). Trả run id.
 * Nightly: chỉ một lần mỗi ngày (theo giờ VN) nhờ chỉ mục duy nhất ảo qua monitoring_state.
 */
export async function startRegressionRun(cfg: MonitoringConfig, opts: StartRunOptions): Promise<{ runId: string; total: number; skipped: number }> {
  await ensureMonitoringTables()
  const { cases, skipped } = await getApplicableCases()
  const selected = opts.caseIds?.length ? cases.filter((c) => opts.caseIds!.includes(c.id)) : cases
  if (selected.length === 0) throw new Error("Không có câu kiểm thử nào phù hợp với các công cụ đang cài.")
  const cred = await getCentralLlmCredentials().catch(() => null)
  const model = cred?.model || "default"
  const r = await query<{ id: string }>(
    `INSERT INTO ai_portal.central_regression_runs (trigger, status, suite_version, model, total, triggered_by, run_date)
     VALUES ($1, 'running', $2, $3, $4, $5, $6::date) RETURNING id::text`,
    [opts.trigger, REGRESSION_SUITE_VERSION, model, selected.length, opts.triggeredBy ?? null, vnDateOf()]
  )
  const runId = r.rows[0].id
  void executeRun(runId, selected, model, cfg).catch(async (e: any) => {
    console.error("[regression] run failed:", e?.message ?? e)
    await query(
      `UPDATE ai_portal.central_regression_runs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1::uuid`,
      [runId, String(e?.message ?? e).slice(0, 500)]
    ).catch(() => {})
  })
  return { runId, total: selected.length, skipped: skipped.length }
}

async function executeRun(runId: string, cases: RegressionCase[], model: string, cfg: MonitoringConfig): Promise<void> {
  const concurrency = Math.min(2, Math.max(1, cfg.regression_concurrency))
  const graded: Array<{ passed: boolean; score: number; latencyMs: number }> = []
  let idx = 0
  const worker = async () => {
    while (idx < cases.length) {
      const c = cases[idx++]
      const outcome = await askCentral(c.question, model, cfg.regression_case_timeout_ms)
      const g = gradeCase(c, outcome)
      graded.push({ passed: g.passed, score: g.score, latencyMs: outcome.latencyMs })
      await query(
        `INSERT INTO ai_portal.central_regression_results
           (run_id, case_id, category, question, passed, score, latency_ms, functions_called, checks, answer, error)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)`,
        [
          runId,
          c.id,
          c.category,
          c.question,
          g.passed,
          g.score,
          outcome.latencyMs,
          JSON.stringify(outcome.functionsCalled),
          JSON.stringify(g.checks),
          outcome.answer.slice(0, MAX_ANSWER_STORE),
          outcome.error ?? null,
        ]
      )
      const s = summarizeGrades(graded)
      await query(
        `UPDATE ai_portal.central_regression_runs SET completed = $2, passed = $3, score = $4, avg_latency_ms = $5 WHERE id = $1::uuid`,
        [runId, s.total, s.passed, s.score, s.avgLatencyMs]
      ).catch(() => {})
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, () => worker()))
  const s = summarizeGrades(graded)
  await query(
    `UPDATE ai_portal.central_regression_runs
     SET status = 'done', finished_at = now(), completed = $2, passed = $3, score = $4, avg_latency_ms = $5
     WHERE id = $1::uuid`,
    [runId, s.total, s.passed, s.score, s.avgLatencyMs]
  )
  console.log(`[regression] run ${runId} done: ${s.passed}/${s.total} passed, score ${s.score}`)
}

// ─── Đọc kết quả ─────────────────────────────────────────────────────────────

export interface RunRow {
  id: string
  trigger: string
  status: string
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

const RUN_COLS = `id::text, trigger, status, suite_version, model, total, completed, passed,
  score::float8 AS score, avg_latency_ms, triggered_by, error, started_at, finished_at`

export async function listRuns(limit = 20): Promise<RunRow[]> {
  await ensureMonitoringTables()
  const r = await query<RunRow>(
    `SELECT ${RUN_COLS} FROM ai_portal.central_regression_runs ORDER BY started_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)]
  )
  return r.rows
}

export interface ResultRow {
  case_id: string
  category: string | null
  question: string | null
  passed: boolean
  score: number | null
  latency_ms: number | null
  functions_called: string[] | null
  checks: Array<{ name: string; passed: boolean; detail?: string }> | null
  answer: string | null
  error: string | null
}

export async function getRunResults(runId: string): Promise<ResultRow[]> {
  const r = await query<ResultRow>(
    `SELECT case_id, category, question, passed, score::float8 AS score, latency_ms, functions_called, checks, answer, error
     FROM ai_portal.central_regression_results WHERE run_id = $1::uuid ORDER BY case_id`,
    [runId]
  )
  return r.rows
}

/** Chi tiết một lần chạy + so sánh với lần chạy hoàn tất trước đó. */
export async function getRunDetail(runId: string) {
  await ensureMonitoringTables()
  const runQ = await query<RunRow>(`SELECT ${RUN_COLS} FROM ai_portal.central_regression_runs WHERE id = $1::uuid`, [runId])
  const run = runQ.rows[0]
  if (!run) return null
  const prevQ = await query<RunRow>(
    `SELECT ${RUN_COLS} FROM ai_portal.central_regression_runs
     WHERE status = 'done' AND started_at < $1 AND id <> $2::uuid
     ORDER BY started_at DESC LIMIT 1`,
    [run.started_at, runId]
  )
  const prev = prevQ.rows[0] ?? null
  const results = await getRunResults(runId)
  const prevResults = prev ? await getRunResults(prev.id) : []
  const cmp = prev ? compareRuns(prevResults, results) : null
  return { run, previous: prev, results, comparison: cmp }
}
