"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Bell, Info, OctagonAlert, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { getAdminAlerts, fmt, type AdminAlert } from "@/lib/api/admin-monitoring"

const POLL_MS = 120_000

export function useAdminAlerts(poll = true) {
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const refresh = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const r = await getAdminAlerts(force)
      setAlerts(r.alerts || [])
    } catch {
      /* không có quyền / backend chưa có API → không hiện cảnh báo */
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [])
  useEffect(() => {
    void refresh()
    if (!poll) return
    const id = setInterval(() => void refresh(), POLL_MS)
    const onUpdate = () => void refresh(true)
    window.addEventListener("admin-alerts-updated", onUpdate)
    return () => {
      clearInterval(id)
      window.removeEventListener("admin-alerts-updated", onUpdate)
    }
  }, [refresh, poll])
  return { alerts, loading, loaded, refresh }
}

export function alertText(a: AdminAlert, t: (k: string) => string): string {
  const vars = {
    subject: a.subject,
    value: a.type === "assistant_slow" && a.value != null ? (a.value / 1000).toFixed(1) : a.value ?? "",
    threshold: a.type === "assistant_slow" && a.threshold != null ? (a.threshold / 1000).toFixed(0) : a.threshold ?? "",
    detail: a.detail ?? "",
  }
  return fmt(t(`admin.mon.alert.${a.type}`), vars)
}

const sevStyle: Record<AdminAlert["severity"], string> = {
  critical: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
}

function SevIcon({ s }: { s: AdminAlert["severity"] }) {
  if (s === "critical") return <OctagonAlert className="h-4 w-4 shrink-0" />
  if (s === "warning") return <AlertTriangle className="h-4 w-4 shrink-0" />
  return <Info className="h-4 w-4 shrink-0" />
}

/** Danh sách cảnh báo (dùng trong tab Tình trạng dịch vụ). */
export function AlertsList({ onOpenTab }: { onOpenTab?: (tab: string) => void }) {
  const { t } = useLanguage()
  const { alerts, loading, loaded, refresh } = useAdminAlerts(true)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold flex items-center gap-2"><Bell className="h-4 w-4" /> {t("admin.mon.alerts.title")}</h3>
        <span className="text-sm text-muted-foreground">({alerts.length})</span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void refresh(true)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {loaded && alerts.length === 0 ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          {t("admin.mon.alerts.none")}
        </div>
      ) : null}
      {alerts.map((a) => (
        <div key={a.id} className={`rounded-md border p-3 text-sm flex items-start gap-2 ${sevStyle[a.severity]}`}>
          <SevIcon s={a.severity} />
          <div className="min-w-0 flex-1">
            <div>{alertText(a, t)}</div>
            {a.since ? (
              <div className="text-xs opacity-80 mt-0.5">
                {t("admin.mon.alerts.since")}: {new Date(a.since).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
              </div>
            ) : null}
            {a.type === "service_down" && a.detail ? <div className="text-xs opacity-80 mt-0.5 break-all">{a.detail}</div> : null}
          </div>
          {onOpenTab ? (
            <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => onOpenTab(a.tab)}>
              {t("admin.mon.alerts.open")}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** Biểu tượng chuông + huy hiệu số cảnh báo trên thanh tiêu đề Admin. */
export function AdminAlertsBadge({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage()
  const { alerts } = useAdminAlerts(true)
  const critical = alerts.filter((a) => a.severity === "critical").length
  const warn = alerts.filter((a) => a.severity === "warning").length
  const n = critical + warn
  const label = n > 0 ? fmt(t("admin.mon.alerts.badge"), { n }) : t("admin.mon.alerts.none")
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-10 w-10 rounded-full hover:bg-white/10 text-white border-0"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Bell className="h-5 w-5" />
      {n > 0 ? (
        <span
          className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] leading-[18px] font-semibold text-white text-center ${critical > 0 ? "bg-red-600" : "bg-amber-500"}`}
        >
          {n > 99 ? "99+" : n}
        </span>
      ) : null}
    </Button>
  )
}
