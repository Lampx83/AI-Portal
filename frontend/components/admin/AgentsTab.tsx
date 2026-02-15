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
import {
  getAgents,
  getAgent,
  postAgent,
  patchAgent,
  deleteAgent,
  deleteAgentPermanent,
  exportAgentsFetch,
  importAgents,
  getAdminChatSessions,
  getAdminChatMessages,
  type AgentRow,
  type AdminChatSession,
  type AdminChatMessage,
} from "@/lib/api/admin"
import { getIconComponent, AGENT_ICON_OPTIONS, type IconName } from "@/lib/assistants"
import { AgentTestModal } from "./AgentTestModal"
import { AgentTestsTab } from "./AgentTestsTab"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageSquare, User, Bot, ChevronLeft, Copy, Check, Download, Upload, Trash2 } from "lucide-react"
import { EMBED_COLOR_OPTIONS, EMBED_ICON_OPTIONS } from "@/lib/embed-theme"
import { ScrollArea } from "@/components/ui/scroll-area"

export function AgentsTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [showInactive, setShowInactive] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testAgent, setTestAgent] = useState<{ baseUrl: string; alias: string } | null>(null)
  const [embedAgentAlias, setEmbedAgentAlias] = useState<string | null>(null)
  const [embedColor, setEmbedColor] = useState<string>("")
  const [embedIconOption, setEmbedIconOption] = useState<string>("")
  const [embedDomainAllowAll, setEmbedDomainAllowAll] = useState<boolean>(false)
  const [embedDomainList, setEmbedDomainList] = useState<string>("")
  const [embedDailyLimit, setEmbedDailyLimit] = useState<string>("")
  const [embedDomainSaving, setEmbedDomainSaving] = useState(false)
  const [copiedEmbedCode, setCopiedEmbedCode] = useState(false)
  const [conversationsOpen, setConversationsOpen] = useState(false)
  const [conversationFilterAlias, setConversationFilterAlias] = useState<string>("")
  const [conversationFilterSource, setConversationFilterSource] = useState<string>("")
  const [sessionsList, setSessionsList] = useState<AdminChatSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsPage, setSessionsPage] = useState({ limit: 30, offset: 0, total: 0 })
  const [selectedSession, setSelectedSession] = useState<AdminChatSession | null>(null)
  const [sessionMessages, setSessionMessages] = useState<AdminChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importInputRef, setImportInputRef] = useState<HTMLInputElement | null>(null)
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

  useEffect(() => {
    if (embedAgentAlias) {
      const agent = agents.find((a) => a.alias === embedAgentAlias)
      if (agent) {
        const c = (agent.config_json as { embed_allow_all?: boolean; embed_allowed_domains?: string[]; embed_daily_message_limit?: number | null }) ?? {}
        setEmbedDomainAllowAll(c.embed_allow_all === true)
        setEmbedDomainList((c.embed_allowed_domains ?? []).join("\n"))
        const limit = c.embed_daily_message_limit
        setEmbedDailyLimit(limit != null && Number.isInteger(limit) && limit > 0 ? String(limit) : "")
      }
    }
  }, [embedAgentAlias, agents])

  // Reset "đã copy" khi đổi màu/icon (mã nhúng thay đổi, cần copy lại)
  useEffect(() => {
    setCopiedEmbedCode(false)
  }, [embedColor, embedIconOption])

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
    if (!confirm(`Xóa agent "${alias}"? Agent sẽ ẩn khỏi danh sách và có thể khôi phục sau.`)) return
    try {
      await deleteAgent(id)
      load()
      toast({ title: "Đã xóa", description: "Agent đã ẩn. Có thể khôi phục bằng nút Khôi phục." })
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message, variant: "destructive" })
    }
  }

  const removePermanent = async (id: string, alias: string) => {
    if (!confirm(`Xóa vĩnh viễn agent "${alias}"? Sẽ không thể khôi phục.`)) return
    try {
      await deleteAgentPermanent(id)
      load()
      toast({ title: "Đã xóa vĩnh viễn", description: `Agent "${alias}" đã bị xóa khỏi database.` })
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message, variant: "destructive" })
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportAgentsFetch()
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "agents-export.json"
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Đã xuất file", description: "agents-export.json" })
    } catch (e) {
      toast({ title: "Lỗi xuất file", description: (e as Error)?.message, variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string
        const data = JSON.parse(text) as { agents?: unknown[] }
        const agentsList = Array.isArray(data?.agents) ? data.agents : []
        if (agentsList.length === 0) {
          toast({ title: "File không hợp lệ", description: "Thiếu mảng agents", variant: "destructive" })
          return
        }
        const res = await importAgents({ agents: agentsList })
        toast({ title: "Đã nhập", description: res.message })
        load()
      } catch (err) {
        toast({ title: "Lỗi nhập file", description: (err as Error)?.message, variant: "destructive" })
      } finally {
        setImporting(false)
        e.target.value = ""
      }
    }
    reader.readAsText(file, "utf-8")
  }

  const loadConversations = () => {
    setSessionsLoading(true)
    getAdminChatSessions({
      assistant_alias: conversationFilterAlias || undefined,
      source: conversationFilterSource || undefined,
      limit: sessionsPage.limit,
      offset: sessionsPage.offset,
    })
      .then((res) => {
        setSessionsList(res.data)
        setSessionsPage((p) => ({ ...p, total: res.page.total }))
      })
      .catch((e) => toast({ title: "Lỗi", description: (e as Error)?.message, variant: "destructive" }))
      .finally(() => setSessionsLoading(false))
  }

  const openConversations = (agentAlias?: string) => {
    setSelectedSession(null)
    setConversationFilterAlias(agentAlias ?? "")
    setSessionsPage((p) => ({ ...p, offset: 0 }))
    setConversationsOpen(true)
  }

  useEffect(() => {
    if (conversationsOpen && !selectedSession) {
      loadConversations()
    }
  }, [conversationsOpen, conversationFilterAlias, conversationFilterSource, sessionsPage.offset, selectedSession])

  const viewSessionDetail = (session: AdminChatSession) => {
    setSelectedSession(session)
    setSessionMessages([])
    setMessagesLoading(true)
    getAdminChatMessages(session.id, { limit: 500 })
      .then((res) => setSessionMessages(res.data))
      .catch((e) => toast({ title: "Lỗi", description: (e as Error)?.message, variant: "destructive" }))
      .finally(() => setMessagesLoading(false))
  }

  const backToSessionList = () => {
    setSelectedSession(null)
    setSessionMessages([])
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
        Quản lý tất cả Agent (bao gồm trợ lý chính/central). Thông tin agents được lưu trong database.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <Checkbox checked={showInactive} onCheckedChange={(c) => setShowInactive(c === true)} />
          Hiển thị cả agent đã vô hiệu hóa
        </label>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? "Đang xuất…" : <><Download className="h-4 w-4 mr-1" /> Xuất file</>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => importInputRef?.click()}
            disabled={importing}
          >
            {importing ? "Đang nhập…" : <><Upload className="h-4 w-4 mr-1" /> Nhập từ file</>}
          </Button>
          <input
            ref={setImportInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button onClick={openAdd}>+ Thêm Agent</Button>
        </div>
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
                    {(() => {
                      const IconComp = getIconComponent((a.icon || "Bot") as IconName)
                      return (
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                          <IconComp className="h-4 w-4 text-muted-foreground" />
                        </span>
                      )
                    })()}
                    <span className="font-semibold">{a.alias}</span>
                    {a.alias === "central" && (
                      <span className="text-xs px-2 py-0.5 rounded bg-sky-600 text-white">Trợ lý chính</span>
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
                  {((a.config_json as { routing_hint?: string })?.routing_hint) && (
                    <p className="text-xs text-muted-foreground mt-1" title="Gợi ý routing">
                      📌 {(a.config_json as { routing_hint: string }).routing_hint}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openConversations(a.alias)}
                    title="Xem hội thoại gửi đến agent này"
                    className="gap-1"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Xem hội thoại
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEmbedAgentAlias(a.alias)}
                    title="Mã nhúng (Embed)"
                  >
                    Mã nhúng
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTestAgent({ baseUrl: a.base_url, alias: a.alias })
                      setTestModalOpen(true)
                    }}
                    title="Test Agent"
                  >
                    🧪 Test
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEdit(a.id)}>
                    Sửa
                  </Button>
                  {a.is_active ? (
                    <Button variant="destructive" size="sm" onClick={() => remove(a.id, a.alias)} title="Ẩn agent (có thể khôi phục)">
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Xóa
                    </Button>
                  ) : (
                    <>
                      <Button variant="default" size="sm" onClick={() => restore(a.id)}>
                        Khôi phục
                      </Button>
                      {a.alias !== "central" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePermanent(a.id, a.alias)}
                          title="Xóa hẳn khỏi database"
                        >
                          Xóa vĩnh viễn
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <hr className="my-8 border-border" />
      <AgentTestsTab />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa Agent" : "Thêm Agent mới"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveAgent} className="space-y-4">
            <div>
              <Label>Alias *</Label>
              <Input
                value={form.alias}
                onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))}
                placeholder="central, documents, experts..."
                pattern="[a-z0-9_-]+"
                required
              />
            </div>
            <div>
              <Label>Icon</Label>
              <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 mt-1">
                {AGENT_ICON_OPTIONS.map((iconName) => {
                  const IconComp = getIconComponent(iconName)
                  const isSelected = (form.icon || "Bot") === iconName
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: iconName }))}
                      title={iconName}
                      className={`shrink-0 p-2 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-input bg-background hover:bg-muted"
                      }`}
                    >
                      <IconComp className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
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
                placeholder="https://your-domain.com/api/agents/..."
              />
            </div>
            <div>
              <Label>Gợi ý Routing (routing_hint)</Label>
              <Input
                value={((form.config_json as { routing_hint?: string })?.routing_hint ?? "")}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    config_json: { ...f.config_json, routing_hint: e.target.value || undefined },
                  }))
                }
                placeholder="Ví dụ: Hội thảo, công bố, publication, conference..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Các từ khóa giúp LLM router chọn đúng agent khi câu hỏi liên quan.
              </p>
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

      {testAgent && (
        <AgentTestModal
          open={testModalOpen}
          onOpenChange={setTestModalOpen}
          baseUrl={testAgent.baseUrl}
          alias={testAgent.alias}
        />
      )}

      <Dialog open={!!embedAgentAlias} onOpenChange={(open) => {
        if (!open) {
          setEmbedAgentAlias(null)
          setCopiedEmbedCode(false)
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mã nhúng (Embed)</DialogTitle>
          </DialogHeader>
          {embedAgentAlias && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nhúng trợ lý <strong>{embedAgentAlias}</strong> vào website khác. Người dùng không cần đăng nhập.
              </p>
              <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
                <Label className="text-sm font-medium">Domain cho phép nhúng</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={embedDomainAllowAll}
                    onCheckedChange={(c) => setEmbedDomainAllowAll(c === true)}
                  />
                  <span className="text-sm">Cho phép nhúng vào tất cả các trang</span>
                </label>
                {!embedDomainAllowAll && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Domain được phép nhúng (mỗi dòng một domain)</Label>
                    <textarea
                      className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={embedDomainList}
                      onChange={(e) => setEmbedDomainList(e.target.value)}
                      placeholder={"https://example.com\nhttps://app.neu.edu.vn"}
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Giới hạn tin nhắn mỗi ngày (embed)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Không giới hạn"
                    value={embedDailyLimit}
                    onChange={(e) => setEmbedDailyLimit(e.target.value.replace(/[^0-9]/g, ""))}
                    className="mt-1 w-32"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Để trống hoặc 0 = không giới hạn. Vượt quá thì embed tạm thời không trả lời đến ngày mai.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Màu (khi nhúng)</Label>
                  <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setEmbedColor("")}
                      title="Mặc định"
                      className={`shrink-0 p-1.5 rounded-lg border-2 transition-colors ${
                        !embedColor ? "border-primary bg-primary/10" : "border-input bg-background hover:bg-muted"
                      }`}
                    >
                      <span className="block w-6 h-6 rounded-full bg-muted border border-border" />
                    </button>
                    {EMBED_COLOR_OPTIONS.map((c) => {
                      const selected = embedColor === c.value
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setEmbedColor(c.value)}
                          title={c.label}
                          className={`shrink-0 p-1.5 rounded-lg border-2 transition-colors ${
                            selected ? `${c.border} ${c.bg}` : "border-input bg-background hover:bg-muted"
                          }`}
                        >
                          <span className={`block w-6 h-6 rounded-full ${c.bg} border-2 ${selected ? c.border : "border-transparent"}`} />
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Icon (khi nhúng)</Label>
                  <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setEmbedIconOption("")}
                      title="Mặc định"
                      className={`shrink-0 p-2 rounded-lg border-2 transition-colors ${
                        !embedIconOption ? "border-primary bg-primary/10" : "border-input bg-background hover:bg-muted"
                      }`}
                    >
                      <span className="block w-5 h-5 text-muted-foreground text-xs flex items-center justify-center">—</span>
                    </button>
                    {EMBED_ICON_OPTIONS.map((iconName) => {
                      const IconComp = getIconComponent(iconName as IconName)
                      const selected = embedIconOption === iconName
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setEmbedIconOption(iconName)}
                          title={iconName}
                          className={`shrink-0 p-2 rounded-lg border-2 transition-colors ${
                            selected ? "border-primary bg-primary/10" : "border-input bg-background hover:bg-muted"
                          }`}
                        >
                          <IconComp className="h-5 w-5 text-muted-foreground" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              {(() => {
                const base = typeof window !== "undefined" ? window.location.origin : ""
                const path = `/embed/${embedAgentAlias}`
                const params = new URLSearchParams()
                if (embedColor) params.set("color", embedColor)
                if (embedIconOption) params.set("icon", embedIconOption)
                const qs = params.toString()
                const src = `${base}${path}${qs ? `?${qs}` : ""}`
                const code = `<iframe src="${src}" width="100%" height="600" frameborder="0" title="Trợ lý ${embedAgentAlias}"></iframe>`
                return (
                  <div className="relative rounded-md border bg-muted/50">
                    <textarea
                      readOnly
                      className="w-full min-h-[80px] p-3 pr-10 text-xs font-mono bg-transparent border-0 resize-none focus:outline-none focus:ring-0"
                      value={code}
                      rows={3}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 shrink-0"
                      title={copiedEmbedCode ? "Đã sao chép" : "Sao chép mã embed"}
                      onClick={() => {
                        navigator.clipboard.writeText(code).then(
                          () => {
                            setCopiedEmbedCode(true)
                            toast({ title: "Đã sao chép mã nhúng vào clipboard", duration: 3000 })
                            setTimeout(() => setCopiedEmbedCode(false), 3000)
                          },
                          () => toast({ title: "Không thể copy", variant: "destructive" })
                        )
                      }}
                    >
                      {copiedEmbedCode ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                )
              })()}

              <div className="pt-2 border-t flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={embedDomainSaving}
                  onClick={async () => {
                    const agent = agents.find((a) => a.alias === embedAgentAlias)
                    if (!agent) return
                    setEmbedDomainSaving(true)
                    try {
                      const dailyLimitRaw = embedDailyLimit.trim()
                      const embed_daily_message_limit =
                        dailyLimitRaw === "" ? null : Math.max(0, parseInt(dailyLimitRaw, 10) || 0) || null
                      await patchAgent(agent.id, {
                        config_json: {
                          ...(agent.config_json ?? {}),
                          embed_allow_all: embedDomainAllowAll,
                          embed_allowed_domains: embedDomainList
                            .split("\n")
                            .map((d) => d.trim())
                            .filter(Boolean),
                          embed_daily_message_limit: embed_daily_message_limit,
                        },
                      })
                      await load()
                      toast({ title: "Đã lưu cấu hình embed", duration: 2000 })
                    } catch (e) {
                      toast({ title: "Lỗi", description: (e as Error)?.message, variant: "destructive" })
                    } finally {
                      setEmbedDomainSaving(false)
                    }
                  }}
                >
                  {embedDomainSaving ? "Đang lưu..." : "Lưu cấu hình Embed"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Xem hội thoại (ẩn danh tính người nhắn) */}
      <Dialog open={conversationsOpen} onOpenChange={(open) => !open && (setConversationsOpen(false), backToSessionList())}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {selectedSession ? (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={backToSessionList}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  Chi tiết hội thoại
                </>
              ) : (
                "Hội thoại gửi đến Agents"
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedSession
                ? "Nội dung tin nhắn và kết quả trả về. Danh tính người nhắn được ẩn."
                : "Lọc theo agent, bấm Xem để xem nguyên hội thoại và thông tin phiên."}
            </p>
          </DialogHeader>

          {!selectedSession ? (
            <div className="px-6 py-4 space-y-4 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Lọc theo agent:</span>
                <Select
                  value={conversationFilterAlias || "all"}
                  onValueChange={(v) => {
                    setConversationFilterAlias(v === "all" ? "" : v)
                    setSessionsPage((p) => ({ ...p, offset: 0 }))
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tất cả" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {filtered.map((a) => (
                      <SelectItem key={a.id} value={a.alias}>
                        {a.alias}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground ml-2">Nguồn:</span>
                <Select
                  value={conversationFilterSource || "all"}
                  onValueChange={(v) => {
                    setConversationFilterSource(v === "all" ? "" : v)
                    setSessionsPage((p) => ({ ...p, offset: 0 }))
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Tất cả" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="embed">Mã nhúng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border rounded-md overflow-auto flex-1 min-h-0">
                {sessionsLoading ? (
                  <p className="p-4 text-muted-foreground text-center">Đang tải...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tiêu đề / Phiên</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Nguồn</TableHead>
                        <TableHead>Tin nhắn</TableHead>
                        <TableHead>Cập nhật</TableHead>
                        <TableHead className="w-20">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionsList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Không có phiên nào
                          </TableCell>
                        </TableRow>
                      ) : (
                        sessionsList.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium max-w-[200px] truncate" title={s.title ?? s.id}>
                              {s.title || "(Không tiêu đề)"}
                            </TableCell>
                            <TableCell>{s.assistant_alias}</TableCell>
                            <TableCell>
                              <span className={s.source === "embed" ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}>
                                {s.source === "embed" ? "Mã nhúng" : "Web"}
                              </span>
                            </TableCell>
                            <TableCell>{s.message_count}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {s.updated_at ? new Date(s.updated_at).toLocaleString("vi-VN") : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => viewSessionDetail(s)}>
                                Xem
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
              {sessionsPage.total > sessionsList.length && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sessionsPage.offset === 0}
                    onClick={() => setSessionsPage((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sessionsPage.offset + sessionsList.length >= sessionsPage.total}
                    onClick={() => setSessionsPage((p) => ({ ...p, offset: p.offset + p.limit }))}
                  >
                    Sau
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-4 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1 mb-4 shrink-0">
                <p><strong>Tiêu đề:</strong> {selectedSession.title || "(Không tiêu đề)"}</p>
                <p><strong>Agent:</strong> {selectedSession.assistant_alias}</p>
                <p><strong>Nguồn:</strong> {selectedSession.source === "embed" ? "Mã nhúng" : "Web"}</p>
                <p><strong>Người nhắn:</strong> {selectedSession.user_display ?? "Người dùng"}</p>
                <p><strong>Tạo lúc:</strong> {selectedSession.created_at ? new Date(selectedSession.created_at).toLocaleString("vi-VN") : "—"}</p>
                <p><strong>Cập nhật:</strong> {selectedSession.updated_at ? new Date(selectedSession.updated_at).toLocaleString("vi-VN") : "—"}</p>
                <p><strong>Số tin nhắn:</strong> {selectedSession.message_count}</p>
              </div>
              <ScrollArea className="flex-1 min-h-0 border rounded-md p-4">
                {messagesLoading ? (
                  <p className="text-muted-foreground text-center py-4">Đang tải tin nhắn...</p>
                ) : sessionMessages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Không có tin nhắn</p>
                ) : (
                  <div className="space-y-4 pr-4">
                    {sessionMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`rounded-lg p-3 max-w-[85%] min-w-0 ${
                            m.role === "user"
                              ? "bg-primary/10 rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          }`}
                        >
                          <div className={`flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1 ${m.role === "user" ? "justify-end" : ""}`}>
                            {m.role === "user" ? (
                              <>
                                <span>{m.created_at ? new Date(m.created_at).toLocaleString("vi-VN") : ""}</span>
                                <User className="h-3.5 w-3.5 shrink-0" />
                                <span>Người dùng</span>
                              </>
                            ) : (
                              <>
                                <Bot className="h-3.5 w-3.5 shrink-0" />
                                <span>{m.assistant_alias || "Trợ lý"}</span>
                                <span>{m.created_at ? new Date(m.created_at).toLocaleString("vi-VN") : ""}</span>
                                {m.response_time_ms != null && (
                                  <span className="text-muted-foreground">({m.response_time_ms} ms)</span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {m.content || "(Nội dung trống)"}
                          </div>
                          {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Đính kèm: {m.attachments.map((a: { file_name?: string }) => a.file_name || "file").join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
