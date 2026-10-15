"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, FlaskConical, Loader2, Play, RefreshCw, XCircle } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguage } from "@/contexts/language-context"
import {
  fmt,
  getRegressionOverview,
  getRegressionRun,
  startRegressionRun,
  type RegressionCase,
  type RegressionResult,
  type RegressionRun,
} from "@/lib/api/admin-monitoring"

const vnTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) : "—"

type Detail = Awaited<ReturnType<typeof getRegressionRun>>

export function CentralRegressionTab() {
  const { t } = useLanguage()
  const [runs, setRuns] = useState<RegressionRun[]>([])
  const [cases, setCases] = useState<RegressionCase[]>([])
  const [skipped, setSkipped] = useState<Array<{ id: string; requires_tool?: string }>>([])
  const [nightly, setNightly] = useState<{ mode: string; hour: number; active: boolean } | null>(null)
  const [suiteVersion, setSuiteVersion] = useState("")
  const [selectedRun, setSelectedRun] = useState<string>("")
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "failed" | "changed">("all")
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getRegressionOverview()
      setRuns(r.runs)
      setCases(r.cases)
      setSkipped(r.skipped_cases)
      setNightly(r.nightly)
      setSuiteVersion(r.suite_version)
      setSelectedRun((cur) => cur || r.runs[0]?.id || "")
    } catch (e) {
      setError((e as Error)?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return
    try {
      setDetail(await getRegressionRun(id))
    } catch (e) {
      setError((e as Error)?.message || String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selectedRun) void loadDetail(selectedRun)
  }, [selectedRun, loadDetail])

  const running = runs.some((r) => r.status === "running")
  // Đang chạy → làm mới mỗi 5 giây
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      void load()
      if (selectedRun) void loadDetail(selectedRun)
    }, 5000)
    return () => clearInterval(id)
  }, [running, selectedRun, load, loadDetail])

  const runNow = async () => {
    setStarting(true)
    setError(null)
    try {
      const r = await startRegressionRun()
      setSelectedRun(r.run_id)
      await load()
      window.dispatchEvent(new Event("admin-alerts-updated"))
    } catch (e) {
      setError((e as Error)?.message || String(e))
    } finally {
      setStarting(false)
    }
  }

  const trend = useMemo(
    () =>
      runs
        .filter((r) => r.status === "done")
        .slice(0, 20)
        .reverse()
        .map((r) => ({
          label: vnTime(r.started_at).slice(0, 10),
          pass_rate: r.total ? Math.round((r.passed / r.total) * 1000) / 10 : 0,
          score: r.score ?? 0,
        })),
    [runs]
  )

  const changeMap = useMemo(() => new Map((detail?.comparison?.diffs ?? []).map((d) => [d.case_id, d.change])), [detail])
  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases])

  const rows: RegressionResult[] = useMemo(() => {
    const all = detail?.results ?? []
    if (filter === "failed") return all.filter((r) => !r.passed)
    if (filter === "changed") return all.filter((r) => ["regressed", "fixed"].includes(changeMap.get(r.case_id) || ""))
    return all
  }, [detail, filter, changeMap])

  const statusLabel = (s: string) => t(`admin.mon.reg.status.${s}`)
  const changeBadge = (c?: string) => {
    if (c === "regressed") return <span className="text-xs rounded px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{t("admin.mon.reg.regressed")}</span>
    if (c === "fixed") return <span className="text-xs rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{t("admin.mon.reg.fixed")}</span>
    return null
  }

  const run = detail?.run
  const prev = detail?.previous

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FlaskConical className="h-5 w-5" /> {t("admin.mon.reg.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {fmt(t("admin.mon.reg.subtitle"), { n: cases.length, v: suiteVersion })}
            {skipped.length ? ` ${fmt(t("admin.mon.reg.skipped"), { n: skipped.length })}` : ""}
          </p>
          {nightly ? (
            <p className="text-xs text-muted-foreground">
              {nightly.active ? fmt(t("admin.mon.reg.nightlyOn"), { h: String(nightly.hour).padStart(2, "0") }) : t("admin.mon.reg.nightlyOff")}
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => void runNow()} disabled={starting || running}>
            {starting || running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="ml-1.5">{running ? t("admin.mon.reg.running") : t("admin.mon.reg.runNow")}</span>
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.reg.runs")}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.mon.reg.startedAt")}</TableHead>
                  <TableHead>{t("admin.mon.reg.trigger")}</TableHead>
                  <TableHead>{t("admin.mon.reg.statusCol")}</TableHead>
                  <TableHead className="text-right">{t("admin.mon.reg.passed")}</TableHead>
                  <TableHead className="text-right">{t("admin.mon.reg.score")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">{t("admin.mon.reg.noRuns")}</TableCell></TableRow>
                ) : (
                  runs.map((r) => (
                    <TableRow key={r.id} className={`cursor-pointer ${r.id === selectedRun ? "bg-muted" : ""}`} onClick={() => setSelectedRun(r.id)}>
                      <TableCell className="whitespace-nowrap text-sm">{vnTime(r.started_at)}</TableCell>
                      <TableCell className="text-sm">{t(`admin.mon.reg.trigger.${r.trigger}`)}</TableCell>
                      <TableCell className="text-sm">
                        {statusLabel(r.status)}
                        {r.status === "running" ? ` (${r.completed}/${r.total})` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.passed}/{r.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.score != null ? r.score.toFixed(1) : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.reg.trend")}</CardTitle></CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <ChartContainer
                config={{
                  pass_rate: { label: t("admin.mon.reg.passRate"), color: "hsl(var(--chart-1))" },
                  score: { label: t("admin.mon.reg.score"), color: "hsl(var(--chart-2))" },
                }}
                className="w-full h-[240px]"
              >
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="pass_rate" stroke="var(--color-pass_rate)" strokeWidth={2} />
                  <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} strokeDasharray="4 3" />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">{t("admin.mon.reg.noRuns")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {run ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{fmt(t("admin.mon.reg.detailTitle"), { time: vnTime(run.started_at) })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div>{t("admin.mon.reg.passed")}: <b className="tabular-nums">{run.passed}/{run.total}</b></div>
              <div>{t("admin.mon.reg.score")}: <b className="tabular-nums">{run.score != null ? run.score.toFixed(1) : "—"}</b></div>
              <div>{t("admin.mon.reg.avgLatency")}: <b className="tabular-nums">{run.avg_latency_ms != null ? `${(run.avg_latency_ms / 1000).toFixed(1)} s` : "—"}</b></div>
              <div>{t("admin.mon.reg.model")}: <b>{run.model || "—"}</b></div>
              {prev ? (
                <div>
                  {fmt(t("admin.mon.reg.vsPrev"), {
                    p: `${prev.passed}/${prev.total}`,
                    s: prev.score != null ? prev.score.toFixed(1) : "—",
                    r: detail?.comparison?.regressed ?? 0,
                    f: detail?.comparison?.fixed ?? 0,
                  })}
                </div>
              ) : null}
              {run.error ? <div className="text-red-600">{run.error}</div> : null}
            </div>
            <div className="flex gap-2">
              {(["all", "failed", "changed"] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                  {t(`admin.mon.reg.filter.${f}`)}
                </Button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]" />
                    <TableHead>{t("admin.mon.reg.case")}</TableHead>
                    <TableHead>{t("admin.mon.reg.question")}</TableHead>
                    <TableHead>{t("admin.mon.reg.functions")}</TableHead>
                    <TableHead className="text-right">{t("admin.mon.reg.time")}</TableHead>
                    <TableHead>{t("admin.mon.reg.failedChecks")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-muted-foreground">{t("admin.mon.common.noData")}</TableCell></TableRow>
                  ) : (
                    rows.map((r) => (
                      <Fragment key={r.case_id}>
                        <TableRow className="cursor-pointer align-top" onClick={() => setExpanded(expanded === r.case_id ? null : r.case_id)}>
                          <TableCell>
                            {r.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            <div className="font-mono">{r.case_id}</div>
                            <div className="text-xs text-muted-foreground">{r.category}</div>
                            {changeBadge(changeMap.get(r.case_id))}
                          </TableCell>
                          <TableCell className="text-sm min-w-[240px]">{r.question}</TableCell>
                          <TableCell className="text-xs font-mono">{(r.functions_called || []).join(", ") || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm whitespace-nowrap">{r.latency_ms != null ? `${(r.latency_ms / 1000).toFixed(1)} s` : "—"}</TableCell>
                          <TableCell className="text-xs">
                            {(r.checks || []).filter((c) => !c.passed).map((c) => (
                              <div key={c.name}>
                                <b>{c.name}</b>
                                {c.detail ? `: ${c.detail}` : ""}
                              </div>
                            ))}
                            {r.error ? <div className="text-red-600">{r.error}</div> : null}
                          </TableCell>
                        </TableRow>
                        {expanded === r.case_id ? (
                          <TableRow>
                            <TableCell />
                            <TableCell colSpan={5}>
                              <div className="text-xs text-muted-foreground mb-1">
                                {t("admin.mon.reg.criteria")}: <code className="break-all">{JSON.stringify(caseMap.get(r.case_id)?.expect ?? {})}</code>
                              </div>
                              <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded p-2 max-h-[320px] overflow-auto">{r.answer || "—"}</pre>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
