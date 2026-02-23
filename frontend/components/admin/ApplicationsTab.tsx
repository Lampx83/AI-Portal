"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { getTools, getTool, patchTool, deleteTool, postInstallPackageStream, type ToolRow, type InstallProgress } from "@/lib/api/admin"
import { getIconComponent, type IconName } from "@/lib/assistants"
import { Settings2, Package, Trash2, Check, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLanguage } from "@/contexts/language-context"

const APP_ICONS: Record<string, "FileText" | "Database" | "Bot"> = {
  data: "Database",
  default: "Bot",
}

export function ApplicationsTab() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apps, setApps] = useState<ToolRow[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    is_active: boolean
    display_order: number
    daily_message_limit: string
    routing_hint: string
  }>({
    is_active: true,
    display_order: 0,
    daily_message_limit: "",
    routing_hint: "",
  })
  const [packageFile, setPackageFile] = useState<File | null>(null)
  const [packageOpen, setPackageOpen] = useState(false)
  const [installingPackage, setInstallingPackage] = useState(false)
  const [installSteps, setInstallSteps] = useState<InstallProgress[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const loadRetriedRef = useRef(false)

  const load = (opts?: { silentFail?: boolean }) => {
    setLoading(true)
    setError(null)
    getTools()
      .then((d) => {
        setApps(d.tools ?? [])
      })
      .catch((e) => {
        if (!opts?.silentFail) setError(e?.message || t("admin.apps.loadError"))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!error || loadRetriedRef.current) return
    const t = setTimeout(() => {
      loadRetriedRef.current = true
      load()
    }, 2000)
    return () => clearTimeout(t)
  }, [error])

  const [editingConfigJson, setEditingConfigJson] = useState<Record<string, unknown>>({})

  const openEdit = async (id: string) => {
    try {
      const d = await getTool(id)
      const a = d.tool
      const cfg = (a.config_json ?? {}) as Record<string, unknown>
      setEditingConfigJson(cfg)
      setEditId(id)
      setForm({
        is_active: a.is_active !== false,
        display_order: a.display_order ?? 0,
        daily_message_limit: cfg.daily_message_limit != null ? String(cfg.daily_message_limit) : "",
        routing_hint: (cfg.routing_hint as string) ?? "",
      })
    } catch (e) {
      setError((e as Error)?.message || t("admin.apps.loadError"))
    }
  }

  const saveApp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    setSaving(true)
    try {
      const dailyLimit = form.daily_message_limit.trim()
      const configJson: Record<string, unknown> = {
        ...editingConfigJson,
        isInternal: true,
        routing_hint: form.routing_hint.trim() || undefined,
        daily_message_limit:
          dailyLimit !== "" && /^\d+$/.test(dailyLimit) ? parseInt(dailyLimit, 10) : undefined,
      }
      await patchTool(editId, {
        is_active: form.is_active,
        display_order: form.display_order,
        config_json: configJson,
      })
      setEditId(null)
      load()
    } catch (e) {
      setError((e as Error)?.message || t("admin.apps.saveError"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("admin.apps.loading")}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={load}>
          {t("admin.apps.retry")}
        </Button>
      </div>
    )
  }

  const handleInstallPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!packageFile) return
    setInstallingPackage(true)
    setInstallSteps([])
    try {
      const fd = new FormData()
      fd.append("package", packageFile)
      await postInstallPackageStream(fd, (p) => {
        setInstallSteps((prev) => {
          const i = prev.findIndex((s) => s.step === p.step)
          const next = [...prev]
          if (i >= 0) next[i] = p
          else next.push(p)
          return next
        })
      })
      setPackageOpen(false)
      setPackageFile(null)
      setInstallSteps([])
      load()
    } catch (e) {
      setError((e as Error)?.message ?? t("admin.apps.saveError"))
    } finally {
      setInstallingPackage(false)
      setInstallSteps([])
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const idToRemove = deleteId
    setDeleting(true)
    try {
      await deleteTool(idToRemove)
      setDeleteId(null)
      setApps((prev) => prev.filter((a) => a.id !== idToRemove))
      load({ silentFail: true })
    } catch (e) {
      setError((e as Error)?.message ?? t("admin.apps.saveError"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold mb-1">{t("admin.apps.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.apps.subtitle")}
          </p>
        </div>
        <Button type="button" onClick={() => setPackageOpen(true)} className="gap-1.5">
          <Package className="h-4 w-4" />
          Cài đặt từ gói
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {apps.map((app) => {
          const IconName = (APP_ICONS[app.alias] ?? app.icon ?? "Bot") as IconName
          const IconComp = getIconComponent(IconName)
          const label = app.name ?? app.alias
          const cfg = (app.config_json ?? {}) as { daily_message_limit?: number; routing_hint?: string }
          return (
            <Card key={app.id} className={!app.is_active ? "opacity-70" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconComp className="h-5 w-5 text-muted-foreground" />
                    {label}
                    <span className="text-xs font-normal text-muted-foreground">({app.alias})</span>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(app.id)} className="gap-1">
                      <Settings2 className="h-4 w-4" />
                      {t("admin.apps.configure")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(app.id)} className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                      {t("admin.apps.delete")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">{t("admin.apps.status")}</span>{" "}
                  {app.is_active ? t("admin.apps.on") : t("admin.apps.off")}
                </p>
                {cfg.daily_message_limit != null && (
                  <p>
                    <span className="text-muted-foreground">{t("admin.apps.dailyLimit")}</span> {cfg.daily_message_limit}
                  </p>
                )}
                {cfg.routing_hint && (
                  <p className="text-muted-foreground" title={t("admin.apps.routingHint")}>
                    📌 {cfg.routing_hint}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.apps.configureApp")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveApp} className="space-y-4">
            <div>
              <Label>{t("admin.apps.dailyLimitLabel")}</Label>
              <Input
                type="number"
                min={0}
                value={form.daily_message_limit}
                onChange={(e) => setForm((f) => ({ ...f, daily_message_limit: e.target.value }))}
                placeholder={t("admin.apps.dailyLimitPlaceholder")}
              />
            </div>
            <div>
              <Label>{t("admin.apps.routingHintLabel")}</Label>
              <Input
                value={form.routing_hint}
                onChange={(e) => setForm((f) => ({ ...f, routing_hint: e.target.value }))}
                placeholder={t("admin.apps.routingHintPlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.apps.routingHintHelp")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-24"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) || 0 }))}
              />
              <Label>{t("admin.apps.displayOrder")}</Label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c === true }))}
              />
              {t("admin.apps.enableApp")}
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditId(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={packageOpen} onOpenChange={(open) => { setPackageOpen(open); if (!open) { setPackageFile(null); setInstallSteps([]) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cài đặt từ gói</DialogTitle>
            <DialogDescription>
              Chọn file .zip chứa manifest ứng dụng (ví dụ write-app-package.zip). Có thể cài đè ứng dụng đã có (cùng alias), không cần xoá trước.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInstallPackage} className="space-y-4">
            {!installingPackage && (
              <div>
                <Label>File gói (.zip)</Label>
                <Input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setPackageFile(e.target.files?.[0] ?? null)}
                />
                {packageFile && <p className="text-xs text-muted-foreground mt-1">{packageFile.name}</p>}
              </div>
            )}
            {installingPackage && installSteps.length > 0 && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">Tiến trình cài đặt</p>
                <ul className="space-y-2">
                  {installSteps.map((s, i) => (
                    <li key={s.step + i} className="flex items-center gap-2 text-sm">
                      {s.status === "done" ? (
                        <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      )}
                      <span className={s.status === "done" ? "text-muted-foreground" : ""}>{s.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {installingPackage && installSteps.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Đang gửi gói và bắt đầu cài đặt…</span>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPackageOpen(false)} disabled={installingPackage}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!packageFile || installingPackage}>
                {installingPackage ? "Đang cài…" : "Cài đặt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.apps.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.apps.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={async (e) => {
                  e.preventDefault()
                  await handleDelete()
                }}
              >
                {deleting ? t("admin.apps.deleting") : t("admin.apps.delete")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
