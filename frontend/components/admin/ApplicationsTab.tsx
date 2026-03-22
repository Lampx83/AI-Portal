"use client"

import { useEffect, useState, useRef, useMemo } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getTools,
  getTool,
  patchTool,
  deleteTool,
  postInstallPackageStream,
  getCategories,
  getAgents,
  getToolPackageBlob,
  getToolDbBackupBlob,
  postToolDbRestore,
  type ToolRow,
  type InstallProgress,
  type CategoryRow,
  type AgentRow,
} from "@/lib/api/admin"
import { IconPicker } from "./IconPicker"
import { getIconComponent, AGENT_ICON_OPTIONS, type IconName } from "@/lib/assistants"
import { Settings2, Package, Trash2, Check, Loader2, Pin, CheckCircle, XCircle, GripVertical, Download, Database, Upload, MoreVertical } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"

const APP_ICONS: Record<string, "FileText" | "Database" | "Bot"> = {
  data: "Database",
  default: "Bot",
}

function formatAppUpdatedAt(
  updatedAt: string | undefined,
  t: (key: string) => string
): { formatted: string; timeAgo: string } | null {
  if (!updatedAt) return null
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return null
  const formatted = date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  const sec = (Date.now() - date.getTime()) / 1000
  let timeAgo: string
  if (sec < 60) timeAgo = t("admin.apps.timeAgo.justNow")
  else if (sec < 3600) timeAgo = t("admin.apps.timeAgo.minutesAgo").replace("{{n}}", String(Math.max(1, Math.floor(sec / 60))))
  else if (sec < 86400) timeAgo = t("admin.apps.timeAgo.hoursAgo").replace("{{n}}", String(Math.floor(sec / 3600)))
  else if (sec < 604800) timeAgo = t("admin.apps.timeAgo.daysAgo").replace("{{n}}", String(Math.floor(sec / 86400)))
  else if (sec < 2592000) timeAgo = t("admin.apps.timeAgo.weeksAgo").replace("{{n}}", String(Math.floor(sec / 604800)))
  else if (sec < 31536000) timeAgo = t("admin.apps.timeAgo.monthsAgo").replace("{{n}}", String(Math.floor(sec / 2592000)))
  else timeAgo = t("admin.apps.timeAgo.yearsAgo").replace("{{n}}", String(Math.floor(sec / 31536000)))
  return { formatted, timeAgo }
}

function formatBytes(bytes?: number): string {
  const value = Number(bytes ?? 0)
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = value
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx++
  }
  return `${size >= 100 || idx === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[idx]}`
}

export function ApplicationsTab() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apps, setApps] = useState<ToolRow[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    is_active: boolean
    display_order: number
    pinned: boolean
    routing_hint: string
    display_name: string
    icon: string
    api_proxy_target: string
    category_id: string | null
    floating_assistant_enabled: boolean
    floating_assistant_alias: string
  }>({
    is_active: true,
    display_order: 0,
    pinned: false,
    routing_hint: "",
    display_name: "",
    icon: "Bot",
    api_proxy_target: "",
    category_id: null,
    floating_assistant_enabled: false,
    floating_assistant_alias: "",
  })
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [packageFile, setPackageFile] = useState<File | null>(null)
  const [packageOpen, setPackageOpen] = useState(false)
  const [installingPackage, setInstallingPackage] = useState(false)
  const [installSteps, setInstallSteps] = useState<InstallProgress[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const loadRetriedRef = useRef(false)
  const [draggedToolId, setDraggedToolId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [downloadingPackageId, setDownloadingPackageId] = useState<string | null>(null)
  const [backingUpDbId, setBackingUpDbId] = useState<string | null>(null)
  const [restoringDbId, setRestoringDbId] = useState<string | null>(null)
  const [reinstallingAppId, setReinstallingAppId] = useState<string | null>(null)
  const restoreDbInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const reinstallInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const sortedApps = useMemo(
    () => [...apps].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.alias.localeCompare(b.alias)),
    [apps]
  )
  function arrayMove<T>(arr: T[], from: number, to: number): T[] {
    const copy = [...arr]
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
  }
  const handleToolDragStart = (e: React.DragEvent, id: string, index: number) => {
    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"
    setDraggedToolId(id)
    setDraggedIndex(index)
  }
  const handleToolDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const rect = e.currentTarget.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const insertIndex = e.clientY < mid ? index : index + 1
    setDropIndex(insertIndex)
  }
  const handleToolDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const insertIndex = dropIndex
    setDropIndex(null)
    if (draggedToolId == null || draggedIndex == null || insertIndex == null) return
    const toIndex = draggedIndex < insertIndex ? insertIndex - 1 : insertIndex
    if (toIndex === draggedIndex) {
      setDraggedToolId(null)
      setDraggedIndex(null)
      return
    }
    const newOrder = arrayMove(sortedApps, draggedIndex, toIndex)
    setDraggedToolId(null)
    setDraggedIndex(null)
    setReordering(true)
    try {
      await Promise.all(newOrder.map((app, i) => patchTool(app.id, { display_order: i })))
      load()
      toast({ title: t("admin.apps.orderSaved"), description: t("admin.apps.orderSavedDesc") })
    } catch (err) {
      setError((err as Error)?.message ?? t("admin.apps.saveError"))
    } finally {
      setReordering(false)
    }
  }
  const handleToolDragEnd = () => {
    setDraggedToolId(null)
    setDraggedIndex(null)
    setDropIndex(null)
  }

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
    getCategories().then((d) => setCategories(d.categories ?? [])).catch(() => setCategories([]))
    getAgents().then((d) => setAgents((d.agents ?? []).filter((a) => a.is_active !== false))).catch(() => setAgents([]))
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
        pinned: !!a.pinned,
        routing_hint: (cfg.routing_hint as string) ?? "",
        display_name: (cfg.displayName as string) ?? "",
        icon: (a.icon && AGENT_ICON_OPTIONS.includes(a.icon as IconName)) ? a.icon : "Bot",
        api_proxy_target: (cfg.apiProxyTarget as string) ?? "",
        category_id: a.category_id ?? null,
        floating_assistant_enabled: cfg.floatingAssistantEnabled === true,
        floating_assistant_alias: typeof cfg.floatingAssistantAlias === "string" ? cfg.floatingAssistantAlias : "",
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
      const configJson: Record<string, unknown> = {
        ...editingConfigJson,
        isInternal: true,
        routing_hint: form.routing_hint.trim() || undefined,
        displayName: form.display_name.trim() || undefined,
        // Locale/limit override is removed: always follow Portal/user language and Limits tab.
        locale: undefined,
        daily_message_limit: undefined,
        apiProxyTarget: form.api_proxy_target.trim() || undefined,
        floatingAssistantEnabled: form.floating_assistant_enabled,
        floatingAssistantAlias: form.floating_assistant_enabled ? form.floating_assistant_alias.trim() || undefined : undefined,
      }
      await patchTool(editId, {
        is_active: form.is_active,
        display_order: form.display_order,
        pinned: form.pinned,
        icon: form.icon || "Bot",
        config_json: configJson,
        category_id: form.category_id || null,
      })
      setEditId(null)
      load()
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("portal-database-changed", "1")
          window.dispatchEvent(new Event("portal-database-changed"))
        }
      } catch {
        // ignore
      }
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

  const handleDownloadPackage = async (app: ToolRow) => {
    setDownloadingPackageId(app.id)
    try {
      const blob = await getToolPackageBlob(app.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${app.alias}-package-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error)?.message ?? t("admin.apps.saveError"))
    } finally {
      setDownloadingPackageId(null)
    }
  }

  const handleBackupToolDb = async (app: ToolRow) => {
    setBackingUpDbId(app.id)
    try {
      const blob = await getToolDbBackupBlob(app.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${app.alias}-db-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error)?.message ?? t("admin.apps.saveError"))
    } finally {
      setBackingUpDbId(null)
    }
  }

  const handleRestoreToolDb = async (app: ToolRow, file: File | null) => {
    if (!file) return
    setRestoringDbId(app.id)
    try {
      const formData = new FormData()
      formData.append("file", file)
      await postToolDbRestore(app.id, formData)
      toast({ title: "Khôi phục dữ liệu thành công", description: `Đã khôi phục database cho ${app.name ?? app.alias}.` })
      load({ silentFail: true })
    } catch (e) {
      setError((e as Error)?.message ?? t("admin.apps.saveError"))
    } finally {
      setRestoringDbId(null)
    }
  }

  const handleReinstallFromZip = async (app: ToolRow, file: File | null) => {
    if (!file) return
    setReinstallingAppId(app.id)
    try {
      const fd = new FormData()
      fd.append("package", file)
      await postInstallPackageStream(fd, () => {})
      toast({ title: "Cài lại thành công", description: `Ứng dụng ${app.name ?? app.alias} đã được cài lại.` })
      load({ silentFail: true })
    } catch (e) {
      setError((e as Error)?.message ?? t("admin.apps.saveError"))
    } finally {
      setReinstallingAppId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold mb-1">{t("admin.apps.title")}</h2>
        </div>
        <Button type="button" onClick={() => setPackageOpen(true)} className="gap-1.5" title="Cài đặt từ gói">
          <Package className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sortedApps.map((app, index) => {
          const IconName = (APP_ICONS[app.alias] ?? app.icon ?? "Bot") as IconName
          const IconComp = getIconComponent(IconName)
          const label = app.name ?? app.alias
          const cfg = (app.config_json ?? {}) as { routing_hint?: string }
          const isDragging = app.id === draggedToolId
          return (
            <div
              key={app.id}
              onDragOver={(e) => handleToolDragOver(e, index)}
              onDrop={(e) => handleToolDrop(e)}
              onDragLeave={() => setDropIndex(null)}
              className="relative"
            >
              {dropIndex === index && (
                <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary rounded-full z-20 pointer-events-none" aria-hidden />
              )}
              {dropIndex === index + 1 && (
                <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full z-20 pointer-events-none" aria-hidden />
              )}
            <Card className={`relative ${!app.is_active ? "opacity-70" : ""} ${isDragging ? "opacity-60" : ""}`}>
              <span
                draggable
                onDragStart={(e) => handleToolDragStart(e, app.id, index)}
                onDragEnd={handleToolDragEnd}
                className="absolute left-2 top-2 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground z-10"
                title={t("admin.apps.dragToReorder")}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconComp className="h-5 w-5 text-muted-foreground" />
                    {label}
                    <span className="text-xs font-normal text-muted-foreground">({app.alias})</span>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" onClick={() => openEdit(app.id)} className="h-8 w-8" title={t("admin.apps.configure")}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDeleteId(app.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title={t("admin.apps.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Thao tác thêm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleBackupToolDb(app)} disabled={backingUpDbId === app.id}>
                          <Database className="h-4 w-4 mr-2" />
                          {backingUpDbId === app.id ? "Đang backup DB..." : "Backup DB"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => restoreDbInputRefs.current[app.id]?.click()} disabled={restoringDbId === app.id}>
                          <Upload className="h-4 w-4 mr-2" />
                          {restoringDbId === app.id ? "Đang khôi phục..." : "Khôi phục DB"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadPackage(app)} disabled={downloadingPackageId === app.id}>
                          <Download className="h-4 w-4 mr-2" />
                          {downloadingPackageId === app.id ? "Đang tải..." : "Tải ZIP app"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => reinstallInputRefs.current[app.id]?.click()} disabled={reinstallingAppId === app.id}>
                          <Package className="h-4 w-4 mr-2" />
                          {reinstallingAppId === app.id ? "Đang cài lại..." : "Cài lại từ ZIP"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    {app.is_active ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                    )}
                    <span className="text-muted-foreground">{t("admin.apps.status")}</span>{" "}
                    {app.is_active ? t("admin.apps.on") : t("admin.apps.off")}
                  </span>
                  {app.pinned && (
                    <span
                      className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                      title={t("admin.apps.pinnedOnHome")}
                    >
                      <Pin className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{t("admin.apps.pinned")}</span>
                    </span>
                  )}
                </div>
                {cfg.routing_hint && (
                  <p className="text-muted-foreground" title={t("admin.apps.routingHint")}>
                    📌 {cfg.routing_hint}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Dung lượng: {formatBytes(app.total_size_bytes)} (app {formatBytes(app.app_size_bytes)} + db {formatBytes(app.db_size_bytes)})
                </p>
                {(() => {
                  const updated = formatAppUpdatedAt(app.updated_at, t)
                  return updated ? (
                    <p className="text-muted-foreground text-xs mt-1" title={updated.formatted}>
                      {t("admin.apps.updatedAt")} {updated.formatted} ({updated.timeAgo})
                    </p>
                  ) : null
                })()}
                <input
                  ref={(el) => {
                    restoreDbInputRefs.current[app.id] = el
                  }}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    handleRestoreToolDb(app, file).finally(() => {
                      e.target.value = ""
                    })
                  }}
                />
                <input
                  ref={(el) => {
                    reinstallInputRefs.current[app.id] = el
                  }}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    handleReinstallFromZip(app, file).finally(() => {
                      e.target.value = ""
                    })
                  }}
                />
              </CardContent>
            </Card>
            </div>
          )
        })}
      </div>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("admin.apps.configureApp")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveApp} className="space-y-4">
            <div>
              <Label>{t("admin.apps.displayNameLabel")}</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder={t("admin.apps.displayNamePlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.apps.displayNameHelp")}
              </p>
            </div>
            <div>
              <IconPicker
                label={t("admin.apps.iconLabel")}
                value={form.icon || "Bot"}
                onChange={(icon) => setForm((f) => ({ ...f, icon }))}
                moreLabel={t("admin.icons.more")}
                lessLabel={t("admin.icons.less")}
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
            {(editingConfigJson.frontendOnly === true) && (
              <div>
                <Label>API Proxy Target (URL)</Label>
                <Input
                  value={form.api_proxy_target}
                  onChange={(e) => setForm((f) => ({ ...f, api_proxy_target: e.target.value }))}
                  placeholder="http://localhost:8001"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Backend URL cho tool frontend-only. Portal sẽ proxy request từ iframe tới URL này (vd. backend LibrarySearch).
                </p>
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-sm font-medium">Nhúng trợ lý nổi trên công cụ</p>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={form.floating_assistant_enabled}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, floating_assistant_enabled: c === true }))}
                />
                Bật floating assistant ở góc phải dưới
              </label>
              {form.floating_assistant_enabled && (
                <div className="grid gap-1.5 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center">
                  <Label className="text-sm sm:text-xs text-muted-foreground">Trợ lý</Label>
                  <Select
                    value={form.floating_assistant_alias || "none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, floating_assistant_alias: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Chọn trợ lý" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không chọn</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.alias}>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{a.name || a.alias}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{a.base_url}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
              <p className="text-sm font-medium">{t("admin.apps.visibilitySection")}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-20 h-9"
                    value={form.display_order}
                    onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) || 0 }))}
                  />
                  <Label className="font-normal text-sm">{t("admin.apps.displayOrder")}</Label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={form.is_active}
                    onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c === true }))}
                  />
                  {t("admin.apps.enableApp")}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={form.pinned}
                    onCheckedChange={(c) => setForm((f) => ({ ...f, pinned: c === true }))}
                  />
                  {t("admin.apps.pinnedOnHome")}
                </label>
              </div>
              <div>
                <Label className="text-sm">{t("admin.apps.storeCategory")}</Label>
                <Select
                  value={form.category_id ?? "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder={t("admin.apps.storeCategoryPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("admin.apps.storeCategoryNone")}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("admin.apps.storeCategoryHint")}
                </p>
              </div>
            </div>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Cài đặt từ gói</DialogTitle>
            <DialogDescription>
              Chọn file .zip chứa manifest ứng dụng. Có thể cài đè ứng dụng đã có (cùng alias), không cần xoá trước.
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
