"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, Loader2, RefreshCw } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguage } from "@/contexts/language-context"
import { getUsageStats, fmt, type UsageStats } from "@/lib/api/admin-monitoring"

const PRESETS = [7, 30, 90] as const

const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${(v * 100).toFixed(digits)}%`)
const sec = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`)
const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground mt-0.5">{sub}</div> : null}
    </div>
  )
}

export function UsageStatsTab() {
  const { t, toolNames } = useLanguage()
  const [preset, setPreset] = useState<number | null>(7)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [data, setData] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: { days?: number; from?: string; to?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const d = await getUsageStats(p)
      setData(d)
      setFrom(d.range.from)
      setTo(d.range.to)
    } catch (e) {
      setError((e as Error)?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load({ days: 7 })
  }, [load])

  const providerLabel = (p: string) => {
    const key = `admin.mon.provider.${p}`
    const v = t(key)
    return v === key ? p : v
  }
  const toolLabel = (alias: string) => toolNames?.[alias] || alias

  const dailyChart = useMemo(
    () => (data?.daily ?? []).map((d) => ({ ...d, label: shortDay(d.day) })),
    [data]
  )
  const retentionChart = useMemo(
    () =>
      (data?.retention.users.series ?? []).map((d, i) => ({
        label: shortDay(d.day),
        users: d.rate == null ? null : Math.round(d.rate * 1000) / 10,
        guests: (() => {
          const g = data?.retention.guests.series[i]
          return g?.rate == null ? null : Math.round(g.rate * 1000) / 10
        })(),
      })),
    [data]
  )

  const lineConfig = {
    active_users: { label: t("admin.mon.usage.activeUsers"), color: "hsl(var(--chart-1))" },
    new_users: { label: t("admin.mon.usage.newUsers"), color: "hsl(var(--chart-2))" },
    active_guest_devices: { label: t("admin.mon.usage.activeGuests"), color: "hsl(var(--chart-3))" },
  }
  const barConfig = {
    questions: { label: t("admin.mon.usage.questions"), color: "hsl(var(--chart-1))" },
    logins: { label: t("admin.mon.usage.logins"), color: "hsl(var(--chart-4))" },
  }
  const retConfig = {
    users: { label: t("admin.mon.usage.retentionUsers"), color: "hsl(var(--chart-1))" },
    guests: { label: t("admin.mon.usage.retentionGuests"), color: "hsl(var(--chart-3))" },
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> {t("admin.mon.usage.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("admin.mon.usage.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {PRESETS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={preset === d ? "default" : "outline"}
              onClick={() => {
                setPreset(d)
                void load({ days: d })
              }}
              disabled={loading}
            >
              {fmt(t("admin.mon.usage.lastDays"), { n: d })}
            </Button>
          ))}
          <Input type="date" className="w-[150px] h-9" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("admin.mon.usage.from")} />
          <span className="text-muted-foreground">–</span>
          <Input type="date" className="w-[150px] h-9" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("admin.mon.usage.to")} />
          <Button
            size="sm"
            variant="outline"
            disabled={loading || !from || !to}
            onClick={() => {
              setPreset(null)
              void load({ from, to })
            }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1.5">{t("admin.mon.common.apply")}</span>
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div> : null}
      {!data && loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("admin.mon.common.loading")}</div>
      ) : null}

      {data ? (
        <>
          <p className="text-xs text-muted-foreground">
            {fmt(t("admin.mon.usage.rangeNote"), { from: data.range.from, to: data.range.to, days: data.range.days })}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Kpi label={t("admin.mon.usage.newUsers")} value={data.totals.new_users} />
            <Kpi label={t("admin.mon.usage.activeUsers")} value={data.totals.active_users} />
            <Kpi label={t("admin.mon.usage.activeGuests")} value={data.totals.active_guest_devices} />
            <Kpi label={t("admin.mon.usage.logins")} value={data.totals.logins} />
            <Kpi label={t("admin.mon.usage.questions")} value={data.totals.questions} />
            <Kpi label={t("admin.mon.usage.toolViews")} value={data.totals.tool_views} />
            <Kpi label={t("admin.mon.usage.surveyResponses")} value={data.totals.survey_responses} />
            <Kpi
              label={t("admin.mon.usage.feedback")}
              value={data.totals.feedback_new}
              sub={fmt(t("admin.mon.usage.feedbackOpen"), { n: data.totals.feedback_open })}
            />
            <Kpi
              label={t("admin.mon.usage.retentionUsers")}
              value={pct(data.retention.users.rate)}
              sub={fmt(t("admin.mon.usage.retentionSub"), { r: data.retention.users.returned, c: data.retention.users.cohort })}
            />
            <Kpi
              label={t("admin.mon.usage.retentionGuests")}
              value={pct(data.retention.guests.rate)}
              sub={fmt(t("admin.mon.usage.retentionSub"), { r: data.retention.guests.returned, c: data.retention.guests.cohort })}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.usage.chartUsers")}</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={lineConfig} className="w-full h-[260px]">
                  <LineChart data={dailyChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="active_users" stroke="var(--color-active_users)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="new_users" stroke="var(--color-new_users)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="active_guest_devices" stroke="var(--color-active_guest_devices)" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.usage.chartActivity")}</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={barConfig} className="w-full h-[260px]">
                  <BarChart data={dailyChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="questions" fill="var(--color-questions)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="logins" fill="var(--color-logins)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.usage.loginsByProvider")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.mon.usage.provider")}</TableHead>
                      <TableHead className="text-right">{t("admin.mon.usage.logins")}</TableHead>
                      <TableHead className="text-right">{t("admin.mon.usage.distinctUsers")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logins_by_provider.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-muted-foreground">{t("admin.mon.common.noData")}</TableCell></TableRow>
                    ) : (
                      data.logins_by_provider.map((p) => (
                        <TableRow key={p.provider}>
                          <TableCell>{providerLabel(p.provider)}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.logins}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.users}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">{t("admin.mon.usage.feedbackTitle")}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>{t("admin.mon.usage.feedbackNew")}: <b className="tabular-nums">{data.feedback.new_in_range}</b></div>
                    <div>{t("admin.mon.usage.feedbackOpenTotal")}: <b className="tabular-nums">{data.feedback.open_total}</b></div>
                    <div>{t("admin.mon.usage.feedbackResolved")}: <b className="tabular-nums">{data.feedback.resolved_in_range}</b></div>
                    <div>{t("admin.mon.usage.messageVotes")}: <b className="tabular-nums">👍 {data.feedback.message_likes} · 👎 {data.feedback.message_dislikes}</b></div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.usage.retentionChart")}</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={retConfig} className="w-full h-[220px]">
                  <LineChart data={retentionChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis tickLine={false} axisLine={false} width={36} unit="%" domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="var(--color-users)" strokeWidth={2} connectNulls={false} />
                    <Line type="monotone" dataKey="guests" stroke="var(--color-guests)" strokeWidth={2} connectNulls={false} strokeDasharray="4 3" />
                  </LineChart>
                </ChartContainer>
                <p className="text-xs text-muted-foreground mt-2">{t("admin.mon.usage.retentionNote")}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.usage.assistantsTitle")}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.mon.usage.assistant")}</TableHead>
                    <TableHead className="text-right">{t("admin.mon.usage.questions")}</TableHead>
                    <TableHead className="text-right">{t("admin.mon.usage.askers")}</TableHead>
                    <TableHead className="text-right">{t("admin.mon.usage.unanswered")}</TableHead>
                    <TableHead className="text-right">{t("admin.mon.usage.errorRate")}</TableHead>
                    <TableHead className="text-right">{t("admin.mon.usage.avgTime")}</TableHead>
                    <TableHead className="text-right">p95</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assistants.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-muted-foreground">{t("admin.mon.common.noData")}</TableCell></TableRow>
                  ) : (
                    data.assistants.map((a) => (
                      <TableRow key={a.alias}>
                        <TableCell className="font-medium">{a.alias}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.questions}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.askers}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.unanswered + a.errored}</TableCell>
                        <TableCell className={`text-right tabular-nums ${(a.error_rate ?? 0) >= 0.1 ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}>{pct(a.error_rate)}</TableCell>
                        <TableCell className="text-right tabular-nums">{sec(a.avg_ms)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${(a.p95_ms ?? 0) > 30000 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>{sec(a.p95_ms)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2">{t("admin.mon.usage.errorRateNote")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.usage.toolsTitle")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {data.tools.length > 0 ? (
                <ChartContainer
                  config={{
                    users: { label: t("admin.mon.usage.toolUsers"), color: "hsl(var(--chart-1))" },
                    guest_devices: { label: t("admin.mon.usage.toolGuests"), color: "hsl(var(--chart-3))" },
                  }}
                  className="w-full"
                  style={{ height: Math.max(160, data.tools.length * 26 + 40) }}
                >
                  <BarChart data={data.tools.map((x) => ({ ...x, name: toolLabel(x.alias) }))} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={150} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="users" stackId="a" fill="var(--color-users)" />
                    <Bar dataKey="guest_devices" stackId="a" fill="var(--color-guest_devices)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : null}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.mon.usage.tool")}</TableHead>
                      <TableHead className="text-right">{t("admin.mon.usage.views")}</TableHead>
                      <TableHead className="text-right">{t("admin.mon.usage.toolUsers")}</TableHead>
                      <TableHead className="text-right">{t("admin.mon.usage.toolGuests")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tools.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-muted-foreground">{t("admin.mon.common.noData")}</TableCell></TableRow>
                    ) : (
                      data.tools.map((x) => (
                        <TableRow key={x.alias}>
                          <TableCell>{toolLabel(x.alias)}</TableCell>
                          <TableCell className="text-right tabular-nums">{x.views}</TableCell>
                          <TableCell className="text-right tabular-nums">{x.users}</TableCell>
                          <TableCell className="text-right tabular-nums">{x.guest_devices}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.usage.surveysTitle")}</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {data.surveys.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.mon.common.noData")}</p> : null}
              {data.surveys.map((s) => (
                <div key={s.survey_id} className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {fmt(t("admin.mon.usage.surveyStats"), { n: s.responses, u: s.from_users, g: s.from_guests, shown: s.shown, done: s.completed })}
                    </div>
                  </div>
                  {s.likert.length > 0 ? (
                    <div className="space-y-1.5">
                      {s.likert.map((q) => (
                        <div key={q.question_id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_200px_auto] items-center gap-2 text-sm">
                          <div className="truncate" title={q.title}>{q.title}</div>
                          <div className="hidden sm:block h-2 rounded bg-muted overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${q.avg != null ? ((q.avg - 1) / 4) * 100 : 0}%` }} />
                          </div>
                          <div className="tabular-nums text-right w-[92px]">
                            <b>{q.avg != null ? q.avg.toFixed(2) : "—"}</b>
                            <span className="text-muted-foreground"> /5 · n={q.n}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">{fmt(t("admin.mon.usage.generated"), { ms: data.generated_ms })}</p>
        </>
      ) : null}
    </div>
  )
}
