"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAgents, getAgent, postAgent, patchAgent, deleteAgent, type AgentRow } from "@/lib/api/admin"

export function AgentsTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [showInactive, setShowInactive] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<AgentRow> & { alias: string; base_url: string }>({
    alias: "",
    base_url: "",
    icon: "Bot",
    domain_url: null,
    display_order: 0,
    is_active: true,
    config_json: { isInternal: false },
  })

  const load = () => {
    setLoading(true)
    setError(null)
    getAgents()
      .then((d) => setAgents(d.agents))
      .catch((e) => setError(e?.message || "Lỗi tải agents"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = showInactive ? agents : agents.filter((a) => a.is_active)

  const openAdd = () => {
    setEditingId(null)
    setForm({
      alias: "",
      base_url: "",
      icon: "Bot",
      domain_url: null,
      display_order: 0,
      is_active: true,
      config_json: { isInternal: false },
    })
    setModalOpen(true)
  }

  const openEdit = async (id: string) => {
    try {
      const d = await getAgent(id)
      const a = d.agent
      setEditingId(id)
      setForm({
        alias: a.alias,
        base_url: a.base_url,
        icon: a.icon || "Bot",
        domain_url: a.domain_url ?? null,
        display_order: a.display_order ?? 0,
        is_active: a.is_active !== false,
        config_json: a.config_json ?? { isInternal: false },
      })
      setModalOpen(true)
    } catch (e) {
      alert((e as Error)?.message || "Lỗi tải agent")
    }
  }

  const saveAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      alias: form.alias.trim().toLowerCase(),
      base_url: form.base_url.trim(),
      icon: form.icon || "Bot",
      domain_url: form.domain_url?.trim() || null,
      display_order: Number(form.display_order) || 0,
      is_active: form.is_active,
      config_json: form.config_json ?? {},
    }
    try {
      if (editingId) {
        await patchAgent(editingId, body)
        alert("Đã cập nhật agent")
      } else {
        await postAgent(body)
        alert("Đã thêm agent mới")
      }
      setModalOpen(false)
      load()
    } catch (e) {
      alert((e as Error)?.message || "Lỗi lưu")
    }
  }

  const deactivate = async (id: string, alias: string) => {
    if (!confirm(`Vô hiệu hóa agent "${alias}"?`)) return
    try {
      await patchAgent(id, { is_active: false })
      load()
      alert("Đã vô hiệu hóa agent")
    } catch (e) {
      alert((e as Error)?.message || "Lỗi")
    }
  }

  const restore = async (id: string) => {
    try {
      await patchAgent(id, { is_active: true })
      load()
      alert("Đã kích hoạt lại agent")
    } catch (e) {
      alert((e as Error)?.message || "Lỗi")
    }
  }

  const remove = async (id: string, alias: string) => {
    if (!confirm(`Xóa (vô hiệu hóa) agent "${alias}"?`)) return
    try {
      await deleteAgent(id)
      load()
      alert("Đã vô hiệu hóa agent")
    } catch (e) {
      alert((e as Error)?.message || "Lỗi")
    }
  }

  if (loading) return <p className="text-muted-foreground py-8 text-center">Đang tải...</p>
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Quản lý Agents</h2>
      <p className="text-muted-foreground text-sm mb-4">
        Quản lý tất cả Agent (bao gồm agent chính/main). Thông tin agents được lưu trong database.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <Checkbox checked={showInactive} onCheckedChange={(c) => setShowInactive(c === true)} />
          Hiển thị cả agent đã vô hiệu hóa
        </label>
        <Button onClick={openAdd}>+ Thêm Agent</Button>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground">Chưa có agent nào</p>
        ) : (
          filtered.map((a) => (
            <Card key={a.id} className={!a.is_active ? "opacity-70" : ""}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold">{a.alias}</span>
                    {a.alias === "main" && (
                      <span className="text-xs px-2 py-0.5 rounded bg-sky-600 text-white">Agent chính</span>
                    )}
                    {(a.config_json as { isInternal?: boolean })?.isInternal && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-500 text-white">Nội bộ</span>
                    )}
                    {!a.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500 text-slate-900">Đã vô hiệu hóa</span>
                    )}
                    <span className="text-xs text-muted-foreground">#{a.display_order}</span>
                  </div>
                  <p className="text-sm text-muted-foreground break-all">{a.base_url}</p>
                  {a.domain_url && (
                    <p className="text-xs text-muted-foreground break-all">{a.domain_url}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(a.id)}>
                    Sửa
                  </Button>
                  {a.is_active ? (
                    <Button variant="destructive" size="sm" onClick={() => deactivate(a.id, a.alias)}>
                      Vô hiệu hóa
                    </Button>
                  ) : (
                    <Button variant="default" size="sm" onClick={() => restore(a.id)}>
                      Khôi phục
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa Agent" : "Thêm Agent mới"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveAgent} className="space-y-4">
            <div>
              <Label>Alias *</Label>
              <Input
                value={form.alias}
                onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))}
                placeholder="main, documents, experts..."
                pattern="[a-z0-9_-]+"
                required
              />
            </div>
            <div>
              <Label>Icon</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              >
                {["Bot", "Users", "FileText", "Database", "ListTodo", "ShieldCheck", "Award", "Newspaper"].map(
                  (opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <Label>Base URL *</Label>
              <Input
                type="url"
                value={form.base_url}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder="http://localhost:3001/api/main_agent/v1"
                required
              />
            </div>
            <div>
              <Label>Domain URL (tùy chọn)</Label>
              <Input
                type="url"
                value={form.domain_url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, domain_url: e.target.value || null }))}
                placeholder="https://research.neu.edu.vn/api/agents/..."
              />
            </div>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <Label>Thứ tự hiển thị</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.display_order ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) || 0 }))}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-6">
                <Checkbox
                  checked={form.is_active !== false}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c === true }))}
                />
                Kích hoạt
              </label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={(form.config_json as { isInternal?: boolean })?.isInternal === true}
                onCheckedChange={(c) =>
                  setForm((f) => ({ ...f, config_json: { ...f.config_json, isInternal: c === true } }))
                }
              />
              Agent nội bộ (base_url tự resolve)
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit">Lưu</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
