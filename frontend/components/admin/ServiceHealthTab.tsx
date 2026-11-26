"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguage } from "@/contexts/language-context"
import {
  checkServicesNow,
  fmt,
  getServiceHealth,
  saveMonitoringConfig,
  type ExtraTarget,
  type MonitoringConfig,
  type ServiceStatus,
} from "@/lib/api/admin-monitoring"
import { AlertsList } from "@/components/admin/AdminAlerts"

const vnTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) : "—"

function StatusDot({ s }: { s: ServiceStatus["status"] }) {
  const cls = s === "up" ? "bg-emerald-500" : s === "down" ? "bg-red-500" : "bg-slate-400"
  return <span className={`inline-block h-3 w-3 rounded-full ${cls}`} aria-hidden />
}

function HistoryStrip({ h }: { h: ServiceStatus["history"] }) {
  if (!h.length) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-end gap-px h-4" aria-hidden>
      {h.slice(-48).map((x, i) => (
        <span key={i} title={`${vnTime(x.t)} · ${x.ok ? "OK" : "ERR"}${x.ms != null ? ` · ${x.ms} ms` : ""}`} className={`w-1 h-4 rounded-sm ${x.ok ? "bg-emerald-500/80" : "bg-red-500"}`} />
      ))}
    </div>
  )
}

type NumKey =
  | "health_interval_min"
  | "health_timeout_ms"
  | "regression_hour"
  | "alert_slow_p95_ms"
  | "alert_error_rate_pct"
  | "alert_min_questions"
  | "alert_window_hours"
  | "alert_down_minutes"
  | "alert_regression_drop_pct"

export function ServiceHealthTab({ onOpenTab }: { onOpenTab?: (tab: string) => void }) {
  const { t } = useLanguage()
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [cfg, setCfg] = useState<MonitoringConfig | null>(null)
  const [disabledByEnv, setDisabledByEnv] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newHeader, setNewHeader] = useState<Record<number, { k: string; v: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getServiceHealth()
      setServices(r.services)
      setCfg(r.config)
      setDisabledByEnv(r.disabled_by_env)
    } catch (e) {
      setError((e as Error)?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60_000)
    return () => clearInterval(id)
  }, [load])

  const checkNow = async () => {
    setChecking(true)
    setError(null)
    try {
      const r = await checkServicesNow()
      setServices(r.services)
      window.dispatchEvent(new Event("admin-alerts-updated"))
    } catch (e) {
      setError((e as Error)?.message || String(e))
    } finally {
      setChecking(false)
    }
  }

  const save = async (next: MonitoringConfig) => {
    setSaving(true)
    setMsg(null)
    setError(null)
    try {
      const r = await saveMonitoringConfig(next)
      setCfg(r.config)
      setMsg(t("admin.mon.common.saved"))
      window.dispatchEvent(new Event("admin-alerts-updated"))
      void load()
    } catch (e) {
      setError((e as Error)?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const setNum = (k: NumKey, v: string) => cfg && setCfg({ ...cfg, [k]: Number(v) })
  const updateExtra = (i: number, patch: Partial<ExtraTarget>) =>
    cfg && setCfg({ ...cfg, extra_targets: cfg.extra_targets.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const toggleDisabled = (key: string, enabled: boolean) => {
    if (!cfg) return
    const set = new Set(cfg.disabled_targets)
    if (enabled) set.delete(key)
    else set.add(key)
    void save({ ...cfg, disabled_targets: Array.from(set) })
  }

  const up = services.filter((s) => s.status === "up").length
  const down = services.filter((s) => s.status === "down").length

  const numField = (k: NumKey, label: string, opts?: { min?: number; max?: number; step?: number }) => (
    <label className="text-sm space-y-1 block">
      <span className="text-muted-foreground">{label}</span>
      <Input type="number" className="h-9" value={cfg ? String(cfg[k]) : ""} min={opts?.min} max={opts?.max} step={opts?.step} onChange={(e) => setNum(k, e.target.value)} />
    </label>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-5 w-5" /> {t("admin.mon.health.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.mon.health.subtitle")}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => void checkNow()} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            <span className="ml-1.5">{t("admin.mon.health.checkNow")}</span>
          </Button>
        </div>
      </div>

      {disabledByEnv ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">{t("admin.mon.health.disabledByEnv")}</div>
      ) : null}
      {error ? <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div> : null}

      <AlertsList onOpenTab={onOpenTab} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("admin.mon.health.services")}{" "}
            <span className="text-sm font-normal text-muted-foreground">{fmt(t("admin.mon.health.summary"), { up, down, total: services.length })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.mon.health.service")}</TableHead>
                <TableHead className="text-right">{t("admin.mon.health.latency")}</TableHead>
                <TableHead className="text-right">{t("admin.mon.health.uptime")}</TableHead>
                <TableHead>{t("admin.mon.health.history")}</TableHead>
                <TableHead>{t("admin.mon.health.lastCheck")}</TableHead>
                <TableHead>{t("admin.mon.health.lastError")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">{loading ? t("admin.mon.common.loading") : t("admin.mon.common.noData")}</TableCell></TableRow>
              ) : (
                services.map((s) => (
                  <TableRow key={s.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusDot s={s.status} />
                        <div className="min-w-0">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground break-all">{s.url}</div>
                          {s.status === "down" && s.down_since ? (
                            <div className="text-xs text-red-600 dark:text-red-400">{fmt(t("admin.mon.health.downFor"), { m: s.down_minutes ?? 0 })}</div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {s.last_latency_ms != null ? `${s.last_latency_ms} ms` : "—"}
                      {s.avg_latency_ms != null ? <div className="text-xs text-muted-foreground">{fmt(t("admin.mon.health.avg"), { ms: s.avg_latency_ms })}</div> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.uptime_pct != null ? `${s.uptime_pct}%` : "—"}</TableCell>
                    <TableCell><HistoryStrip h={s.history} /></TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {vnTime(s.last_checked_at)}
                      {s.last_status_code != null ? <span className="text-xs text-muted-foreground"> · HTTP {s.last_status_code}</span> : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.last_error_at ? (
                        <>
                          <div className="whitespace-nowrap">{vnTime(s.last_error_at)}</div>
                          <div className="text-xs text-muted-foreground break-all">{s.last_error}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-2">{t("admin.mon.health.note")}</p>
        </CardContent>
      </Card>

      {cfg ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("admin.mon.cfg.title")}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <Switch checked={cfg.health_enabled} onCheckedChange={(v) => setCfg({ ...cfg, health_enabled: !!v })} id="mon-health-enabled" />
              <label htmlFor="mon-health-enabled" className="text-sm">{t("admin.mon.cfg.healthEnabled")}</label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {numField("health_interval_min", t("admin.mon.cfg.interval"), { min: 1, max: 60 })}
              {numField("health_timeout_ms", t("admin.mon.cfg.timeout"), { min: 500, max: 15000, step: 500 })}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">{t("admin.mon.cfg.extraTargets")}</div>
              <p className="text-xs text-muted-foreground">{t("admin.mon.cfg.extraTargetsHint")}</p>
              {cfg.extra_targets.map((x, i) => (
                <div key={i} className="rounded-md border p-2 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[200px_1fr_auto]">
                    <Input className="h-9" placeholder={t("admin.mon.cfg.name")} value={x.name} onChange={(e) => updateExtra(i, { name: e.target.value })} />
                    <Input className="h-9" placeholder="http://10.x.x.x:8000/health" value={x.url} onChange={(e) => updateExtra(i, { url: e.target.value })} />
                    <Button size="icon" variant="ghost" onClick={() => setCfg({ ...cfg, extra_targets: cfg.extra_targets.filter((_, j) => j !== i) })} aria-label={t("admin.mon.cfg.remove")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{t("admin.mon.cfg.headers")}:</span>
                    {Object.keys(x.headers || {}).map((hk) => (
                      <span key={hk} className="rounded bg-muted px-2 py-0.5">
                        {hk}: ••••{" "}
                        <button
                          className="ml-1 text-red-600"
                          onClick={() => {
                            const h = { ...(x.headers || {}) }
                            delete h[hk]
                            updateExtra(i, { headers: h })
                          }}
                          aria-label={t("admin.mon.cfg.remove")}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <Input className="h-7 w-[140px]" placeholder={t("admin.mon.cfg.headerName")} value={newHeader[i]?.k ?? ""} onChange={(e) => setNewHeader({ ...newHeader, [i]: { k: e.target.value, v: newHeader[i]?.v ?? "" } })} />
                    <Input className="h-7 w-[160px]" type="password" placeholder={t("admin.mon.cfg.headerValue")} value={newHeader[i]?.v ?? ""} onChange={(e) => setNewHeader({ ...newHeader, [i]: { k: newHeader[i]?.k ?? "", v: e.target.value } })} />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={!newHeader[i]?.k?.trim() || !newHeader[i]?.v}
                      onClick={() => {
                        updateExtra(i, { headers: { ...(x.headers || {}), [newHeader[i].k.trim()]: newHeader[i].v } })
                        setNewHeader({ ...newHeader, [i]: { k: "", v: "" } })
                      }}
                    >
                      {t("admin.mon.cfg.addHeader")}
                    </Button>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setCfg({ ...cfg, extra_targets: [...cfg.extra_targets, { key: "", name: "", url: "" }] })}>
                <Plus className="h-4 w-4" /> <span className="ml-1">{t("admin.mon.cfg.addTarget")}</span>
              </Button>
            </div>

            {services.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">{t("admin.mon.cfg.enabledTargets")}</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[...services.map((s) => ({ key: s.key, name: s.name })), ...cfg.disabled_targets.filter((k) => !services.some((s) => s.key === k)).map((k) => ({ key: k, name: k }))].map((s) => (
                    <label key={s.key} className="flex items-center gap-2 text-sm">
                      <Switch checked={!cfg.disabled_targets.includes(s.key)} onCheckedChange={(v) => toggleDisabled(s.key, !!v)} />
                      <span className="truncate" title={s.key}>{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-medium">{t("admin.mon.cfg.alertThresholds")}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {numField("alert_window_hours", t("admin.mon.cfg.windowHours"), { min: 1, max: 168 })}
                {numField("alert_min_questions", t("admin.mon.cfg.minQuestions"), { min: 1 })}
                {numField("alert_error_rate_pct", t("admin.mon.cfg.errorRatePct"), { min: 1, max: 100 })}
                {numField("alert_slow_p95_ms", t("admin.mon.cfg.slowP95"), { min: 1000, step: 1000 })}
                {numField("alert_down_minutes", t("admin.mon.cfg.downMinutes"), { min: 5 })}
                {numField("alert_regression_drop_pct", t("admin.mon.cfg.regressionDrop"), { min: 1, max: 100 })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">{t("admin.mon.cfg.nightly")}</div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm space-y-1 block">
                  <span className="text-muted-foreground">{t("admin.mon.cfg.nightlyMode")}</span>
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm block"
                    value={cfg.regression_nightly}
                    onChange={(e) => setCfg({ ...cfg, regression_nightly: e.target.value as MonitoringConfig["regression_nightly"] })}
                  >
                    <option value="auto">{t("admin.mon.cfg.nightlyAuto")}</option>
                    <option value="on">{t("admin.mon.cfg.nightlyOn")}</option>
                    <option value="off">{t("admin.mon.cfg.nightlyOff")}</option>
                  </select>
                </label>
                <div className="w-[120px]">{numField("regression_hour", t("admin.mon.cfg.nightlyHour"), { min: 0, max: 23 })}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={() => void save(cfg)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1.5">{t("admin.mon.common.save")}</span>
              </Button>
              {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
