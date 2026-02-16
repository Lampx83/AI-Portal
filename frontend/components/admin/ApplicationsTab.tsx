"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { getTools, getTool, patchTool, type ToolRow } from "@/lib/api/admin"
import { getIconComponent, type IconName } from "@/lib/assistants"
import { FileText, Database, Settings2 } from "lucide-react"

const APP_ALIASES = ["write", "data"] as const
const APP_LABELS: Record<string, string> = {
  write: "Write",
  data: "Data",
}
const APP_ICONS: Record<string, "FileText" | "Database"> = {
  write: "FileText",
  data: "Database",
}

export function ApplicationsTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apps, setApps] = useState<ToolRow[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    base_url: string
    is_active: boolean
    display_order: number
    daily_message_limit: string
    routing_hint: string
  }>({
    base_url: "",
    is_active: true,
    display_order: 0,
    daily_message_limit: "",
    routing_hint: "",
  })

  const load = () => {
    setLoading(true)
    setError(null)
    getTools()
      .then((d) => {
        setApps(d.tools ?? [])
      })
      .catch((e) => setError(e?.message || "Failed to load apps"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const [editingConfigJson, setEditingConfigJson] = useState<Record<string, unknown>>({})

  const openEdit = async (id: string) => {
    try {
      const d = await getTool(id)
      const a = d.tool
      const cfg = (a.config_json ?? {}) as Record<string, unknown>
      setEditingConfigJson(cfg)
      setEditId(id)
      setForm({
        base_url: a.base_url ?? "",
        is_active: a.is_active !== false,
        display_order: a.display_order ?? 0,
        daily_message_limit: cfg.daily_message_limit != null ? String(cfg.daily_message_limit) : "",
        routing_hint: (cfg.routing_hint as string) ?? "",
      })
    } catch (e) {
      setError((e as Error)?.message || "Lỗi tải cấu hình")
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
        base_url: form.base_url.trim(),
        is_active: form.is_active,
        display_order: form.display_order,
        config_json: configJson,
      })
      setEditId(null)
      load()
    } catch (e) {
      setError((e as Error)?.message || "Lỗi lưu")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading apps…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={load}>
          Thử lại
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Apps</h2>
        <p className="text-sm text-muted-foreground">
          Two built-in apps: <strong>Write</strong> (write) and <strong>Data</strong> (data). You can configure base URL, message limits, and routing hints.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {APP_ALIASES.map((alias) => {
          const app = apps.find((a) => a.alias === alias)
          const IconName = APP_ICONS[alias] ?? "FileText"
          const IconComp = getIconComponent(IconName as IconName)
          const label = APP_LABELS[alias] ?? alias
          if (!app) {
            return (
              <Card key={alias} className="border-dashed opacity-70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconComp className="h-5 w-5" />
                    {label}
                  </CardTitle>
                  <CardDescription>
                    App not in database. Run setup step 4 or install via Plugins to create.
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          }
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
                  <Button variant="outline" size="sm" onClick={() => openEdit(app.id)} className="gap-1">
                    <Settings2 className="h-4 w-4" />
                    Configure
                  </Button>
                </div>
                <CardDescription className="text-xs break-all">{app.base_url}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {app.is_active ? "On" : "Off"}
                </p>
                {cfg.daily_message_limit != null && (
                  <p>
                    <span className="text-muted-foreground">Daily message limit:</span> {cfg.daily_message_limit}
                  </p>
                )}
                {cfg.routing_hint && (
                  <p className="text-muted-foreground" title="Routing hint">
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
            <DialogTitle>Configure app</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveApp} className="space-y-4">
            <div>
              <Label>Base URL *</Label>
              <Input
                type="url"
                value={form.base_url}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder="http://localhost:3001/api/write_agent/v1"
                required
              />
            </div>
            <div>
              <Label>Daily message limit (empty = default 100)</Label>
              <Input
                type="number"
                min={0}
                value={form.daily_message_limit}
                onChange={(e) => setForm((f) => ({ ...f, daily_message_limit: e.target.value }))}
                placeholder="100"
              />
            </div>
            <div>
              <Label>Routing hint (optional)</Label>
              <Input
                value={form.routing_hint}
                onChange={(e) => setForm((f) => ({ ...f, routing_hint: e.target.value }))}
                placeholder="e.g. Write, edit..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Keywords help the LLM choose the right app when the user asks.
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
              <Label>Display order</Label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c === true }))}
              />
              Enable app
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
