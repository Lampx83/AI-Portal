"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  fetchAllAdminChatSessions,
  fetchAllAdminChatMessages,
  boundsForChatExportPreset,
  type AgentRow,
  type AdminChatSession,
  type AdminChatMessage,
  type AdminChatExportDatePreset,
} from "@/lib/api/admin"
import { getIconComponent, AGENT_ICON_OPTIONS, type IconName } from "@/lib/assistants"
import { AgentTestModal } from "./AgentTestModal"
import { AgentTestsTab } from "./AgentTestsTab"
import { TestEmbedTab } from "./TestEmbedTab"
import { CentralAgentConfig } from "./CentralAgentTab"
import { IconPicker } from "./IconPicker"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
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
import { MessageSquare, User, Bot, ChevronLeft, Copy, Check, Download, Upload, Trash2, Settings2, Code, FlaskConical, Pin, RotateCcw, CheckCircle, XCircle, GripVertical } from "lucide-react"
import { EMBED_COLOR_OPTIONS, EMBED_ICON_OPTIONS } from "@/lib/embed-theme"
import { buildAgentConversationsWorkbook, downloadAgentConversationsXlsx } from "@/lib/export-agent-conversations-xlsx"

const DATE_LOCALE: Record<string, string> = { vi: "vi-VN", en: "en-US", zh: "zh-CN", hi: "hi-IN", es: "es-ES" }

export function AgentsTab() {
  const { toast } = useToast()
  const { t, locale } = useLanguage()
  const dateLocale = DATE_LOCALE[locale] || "en-US"
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
  const [centralSettingsOpen, setCentralSettingsOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingConversations, setExportingConversations] = useState(false)
  const [exportConversationDatePreset, setExportConversationDatePreset] = useState<AdminChatExportDatePreset>("all")
  const [importing, setImporting] = useState(false)
  const [importInputRef, setImportInputRef] = useState<HTMLInputElement | null>(null)
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [checkingBaseUrl, setCheckingBaseUrl] = useState(false)
  const [form, setForm] = useState<Partial<AgentRow> & { alias: string; base_url: string; display_name?: string }>({
    alias: "",
    base_url: "",
    icon: "Bot",
    display_order: 0,
    is_active: true,
    pinned: false,
    config_json: {},
    display_name: "",
  })

  const load = () => {
    setLoading(true)
    setError(null)
    getAgents()
      .then((d) => setAgents(d.agents))
      .catch((e) => setError(e?.message || t("admin.agents.loadError")))
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

  useEffect(() => {
    setCopiedEmbedCode(false)
  }, [embedColor, embedIconOption])

  const filtered = showInactive ? agents : agents.filter((a) => a.is_active)
  const sortedAgents = useMemo(
    () => [...filtered].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.alias.localeCompare(b.alias)),
    [filtered]
  )

  function arrayMove<T>(arr: T[], from: number, to: number): T[] {
    const copy = [...arr]
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
  }

  const handleAgentDragStart = (e: React.DragEvent, id: string, index: number) => {
    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"
    setDraggedAgentId(id)
    setDraggedIndex(index)
  }
  const handleAgentDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const rect = e.currentTarget.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const insertIndex = e.clientY < mid ? index : index + 1
    setDropIndex(insertIndex)
  }
  const handleAgentDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const insertIndex = dropIndex
    setDropIndex(null)
    if (draggedAgentId == null || draggedIndex == null || insertIndex == null) return
    const toIndex = draggedIndex < insertIndex ? insertIndex - 1 : insertIndex
    if (toIndex === draggedIndex) {
      setDraggedAgentId(null)
      setDraggedIndex(null)
      return
    }
    const newOrder = arrayMove(sortedAgents, draggedIndex, toIndex)
    setDraggedAgentId(null)
    setDraggedIndex(null)
    setReordering(true)
    try {
      await Promise.all(newOrder.map((agent, i) => patchAgent(agent.id, { display_order: i })))
      load()
      toast({ title: t("admin.agents.orderSaved"), description: t("admin.agents.orderSavedDesc") })
    } catch (err) {
      toast({ title: t("common.error"), description: (err as Error)?.message, variant: "destructive" })
    } finally {
      setReordering(false)
    }
  }
  const handleAgentDragEnd = () => {
    setDraggedAgentId(null)
    setDraggedIndex(null)
    setDropIndex(null)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm({
      alias: "",
      base_url: "",
      icon: "Bot",
      display_order: 0,
      is_active: true,
      pinned: false,
      config_json: {},
      display_name: "",
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
        display_order: a.display_order ?? 0,
        is_active: a.is_active !== false,
        pinned: !!a.pinned,
        config_json: a.config_json ?? {},
        display_name: ((a.config_json as { displayName?: string })?.displayName ?? "") || "",
      })
      setModalOpen(true)
    } catch (e) {
      alert((e as Error)?.message || t("admin.agents.agentLoadError"))
    }
  }

  const saveAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    const alias = form.alias.trim().toLowerCase()
    const body = {
      alias,
      base_url: form.base_url.trim(),
      icon: form.icon || "Bot",
      display_order: Number(form.display_order) || 0,
      is_active: alias === "central" ? true : form.is_active,
      pinned: form.pinned,
      config_json: {
        ...(form.config_json ?? {}),
        displayName:
          typeof form.display_name === "string" && form.display_name.trim()
            ? form.display_name.trim()
            : undefined,
      },
    }
    try {
      if (editingId) {
        await patchAgent(editingId, body)
        alert(t("admin.agents.saved"))
      } else {
        await postAgent(body)
        alert(t("admin.agents.added"))
      }
      setModalOpen(false)
      load()
    } catch (e) {
      alert((e as Error)?.message || t("admin.agents.saveError"))
    }
  }

  const checkAgentBaseUrl = async () => {
    const raw = form.base_url.trim()
    if (!raw) {
      toast({ title: t("common.error"), description: "Vui lòng nhập Base URL trước khi kiểm tra.", variant: "destructive" })
      return
    }
    const base = raw.replace(/\/+$/, "")
    const metadataUrl = `${base}/metadata`
    setCheckingBaseUrl(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(metadataUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) {
        throw new Error(`Metadata trả về HTTP ${res.status}.`)
      }
      const data = await res.json().catch(() => ({}))
      const name = typeof (data as { name?: unknown }).name === "string" ? (data as { name: string }).name : ""
      toast({
        title: "URL hợp lệ",
        description: name ? `Đã kết nối /metadata thành công (${name}).` : "Đã kết nối /metadata thành công.",
      })
    } catch (e) {
      toast({
        title: "Không kiểm tra được URL",
        description: (e as Error)?.message || "Không thể gọi endpoint /metadata.",
        variant: "destructive",
      })
    } finally {
      setCheckingBaseUrl(false)
    }
  }

  const restore = async (id: string) => {
    try {
      await patchAgent(id, { is_active: true })
      load()
      alert(t("admin.agents.activated"))
    } catch (e) {
      alert((e as Error)?.message || t("common.error"))
    }
  }

  const remove = async (id: string, alias: string) => {
    if (!confirm(t("admin.agents.deleteConfirm").replace("{alias}", alias))) return
    try {
      await deleteAgent(id)
      load()
      toast({ title: t("admin.agents.deleted"), description: t("admin.agents.deletedDesc") })
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error)?.message, variant: "destructive" })
    }
  }

  const removePermanent = async (id: string, alias: string) => {
    if (!confirm(t("admin.agents.deletePermanentConfirm").replace("{alias}", alias))) return
    try {
      await deleteAgentPermanent(id)
      load()
      toast({ title: t("admin.agents.deletedPermanent"), description: t("admin.agents.deletedPermanentDesc").replace("{alias}", alias) })
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error)?.message, variant: "destructive" })
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
      toast({ title: t("admin.agents.exported"), description: "agents-export.json" })
    } catch (e) {
      toast({ title: t("admin.agents.exportError"), description: (e as Error)?.message, variant: "destructive" })
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
          toast({ title: t("admin.agents.invalidFile"), description: t("admin.agents.invalidFileDesc"), variant: "destructive" })
          return
        }
        const res = await importAgents({ agents: agentsList })
        toast({ title: t("admin.agents.imported"), description: res.message })
        load()
      } catch (err) {
        toast({ title: t("admin.agents.importError"), description: (err as Error)?.message, variant: "destructive" })
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
      .catch((e) => toast({ title: t("common.error"), description: (e as Error)?.message, variant: "destructive" }))
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
      .catch((e) => toast({ title: t("common.error"), description: (e as Error)?.message, variant: "destructive" }))
      .finally(() => setMessagesLoading(false))
  }

  const backToSessionList = () => {
    setSelectedSession(null)
    setSessionMessages([])
  }

  const handleExportConversationsExcel = async () => {
    setExportingConversations(true)
    try {
      const dateBounds = boundsForChatExportPreset(exportConversationDatePreset)
      const sessions = await fetchAllAdminChatSessions({
        assistant_alias: conversationFilterAlias || undefined,
        source: conversationFilterSource || undefined,
        ...dateBounds,
      })
      if (sessions.length === 0) {
        toast({
          title: t("admin.agents.exportConversationsEmpty"),
          variant: "destructive",
        })
        return
      }
      const messagesBySessionId = new Map<string, AdminChatMessage[]>()
      let totalMessages = 0
      for (const s of sessions) {
        const msgs = await fetchAllAdminChatMessages(s.id)
        messagesBySessionId.set(s.id, msgs)
        totalMessages += msgs.length
      }
      const labels = {
        sheetSessions: t("admin.agents.export.sheetSessions"),
        sheetMessages: t("admin.agents.export.sheetMessages"),
        sessionId: t("admin.agents.export.sessionId"),
        title: t("admin.agents.export.title"),
        agent: t("admin.agents.export.agent"),
        source: t("admin.agents.export.source"),
        messageCount: t("admin.agents.export.messageCount"),
        created: t("admin.agents.export.created"),
        updated: t("admin.agents.export.updated"),
        order: t("admin.agents.export.order"),
        senderDisplay: t("admin.agents.export.senderDisplay"),
        role: t("admin.agents.export.role"),
        contentType: t("admin.agents.export.contentType"),
        content: t("admin.agents.export.content"),
        messageTime: t("admin.agents.export.messageTime"),
        model: t("admin.agents.export.model"),
        attachments: t("admin.agents.export.attachments"),
        msgAssistant: t("admin.agents.export.msgAssistant"),
        sourceWeb: t("admin.agents.sourceWeb"),
        sourceEmbed: t("admin.agents.sourceEmbed"),
        roleUser: t("admin.agents.export.roleUser"),
        roleAssistant: t("admin.agents.export.roleAssistant"),
        roleSystem: t("admin.agents.export.roleSystem"),
        roleTool: t("admin.agents.export.roleTool"),
        roleOther: t("admin.agents.export.roleOther"),
      }
      const wb = buildAgentConversationsWorkbook(sessions, messagesBySessionId, labels)
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
      const rangeSlug =
        exportConversationDatePreset === "all"
          ? "all"
          : exportConversationDatePreset === "today"
            ? "today"
            : exportConversationDatePreset === "last3"
              ? "3d"
              : exportConversationDatePreset === "last7"
                ? "7d"
                : "30d"
      downloadAgentConversationsXlsx(wb, `agent-conversations-${rangeSlug}-${stamp}`)
      const rangeLabel =
        exportConversationDatePreset === "all"
          ? t("admin.agents.exportRangeAll")
          : exportConversationDatePreset === "today"
            ? t("admin.agents.exportRangeToday")
            : exportConversationDatePreset === "last3"
              ? t("admin.agents.exportRangeLast3")
              : exportConversationDatePreset === "last7"
                ? t("admin.agents.exportRangeLast7")
                : t("admin.agents.exportRangeLast30")
      toast({
        title: t("admin.agents.exportConversationsDone"),
        description: t("admin.agents.exportConversationsDoneDesc")
          .replace("{sessions}", String(sessions.length))
          .replace("{messages}", String(totalMessages))
          .replace("{range}", rangeLabel),
      })
    } catch (e) {
      toast({
        title: t("common.error"),
        description: (e as Error)?.message ?? String(e),
        variant: "destructive",
      })
    } finally {
      setExportingConversations(false)
    }
  }

  if (loading) return <p className="text-muted-foreground py-8 text-center">{t("admin.agents.loading")}</p>
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold mb-1">{t("admin.agents.manageTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("admin.agents.manageSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox checked={showInactive} onCheckedChange={(c) => setShowInactive(c === true)} />
              {t("admin.agents.showInactive")}
            </label>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? t("admin.agents.exporting") : <><Download className="h-4 w-4 mr-1" /> {t("admin.agents.exportFile")}</>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef?.click()}
              disabled={importing}
            >
              {importing ? t("admin.agents.importing") : <><Upload className="h-4 w-4 mr-1" /> {t("admin.agents.importFromFile")}</>}
            </Button>
            <input
              ref={setImportInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button onClick={openAdd}>+ {t("admin.agents.addAgentButton")}</Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-muted-foreground">{t("admin.agents.noAgents")}</p>
        ) : (
          <p className="text-sm text-muted-foreground mb-2">{t("admin.agents.dragToReorder")}</p>
        )}
        {filtered.length === 0 ? null : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedAgents.map((a, index) => {
              const IconComp = getIconComponent((a.icon || "Bot") as IconName)
              const label = a.name ?? a.alias
              const cfg = (a.config_json ?? {}) as { routing_hint?: string; hide_from_sidebar?: boolean }
              const isDragging = a.id === draggedAgentId
              return (
                <div
                  key={a.id}
                  onDragOver={(e) => handleAgentDragOver(e, index)}
                  onDrop={(e) => handleAgentDrop(e)}
                  onDragLeave={() => setDropIndex(null)}
                  className="relative"
                >
                  {dropIndex === index && (
                    <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary rounded-full z-20 pointer-events-none" aria-hidden />
                  )}
                  {dropIndex === index + 1 && (
                    <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full z-20 pointer-events-none" aria-hidden />
                  )}
                  <Card className={`relative ${!a.is_active ? "opacity-70" : ""} ${isDragging ? "opacity-60" : ""}`}>
                    <span
                      draggable
                      onDragStart={(e) => handleAgentDragStart(e, a.id, index)}
                      onDragEnd={handleAgentDragEnd}
                      className="absolute left-2 top-2 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground z-10"
                      title={t("admin.agents.dragToReorder")}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base flex flex-wrap items-center gap-2 min-w-0 pl-6">
                          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                            <IconComp className="h-4 w-4 text-muted-foreground" />
                          </span>
                        <span className="truncate">{label}</span>
                        <span className="text-xs font-normal text-muted-foreground shrink-0">({a.alias})</span>
                        {a.alias === "central" && (
                          <span className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground shrink-0">{t("admin.agents.central")}</span>
                        )}
                        {!a.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500 text-slate-900 shrink-0">{t("admin.agents.disabled")}</span>
                        )}
                        {cfg.hide_from_sidebar && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100 shrink-0">
                            Ẩn panel trái
                          </span>
                        )}
                        {a.pinned && (
                          <span
                            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0"
                            title={t("admin.apps.pinnedOnHome")}
                          >
                            <Pin className="h-3.5 w-3.5" />
                            <span>{t("admin.apps.pinned")}</span>
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openConversations(a.alias)}
                          title={t("admin.agents.viewConversations")}
                          className="h-8 w-8"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEmbedAgentAlias(a.alias)}
                          title={t("admin.agents.embedCodeTitle")}
                          className="h-8 w-8"
                        >
                          <Code className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setTestAgent({ baseUrl: a.base_url, alias: a.alias })
                            setTestModalOpen(true)
                          }}
                          title={t("admin.agents.testAgent")}
                          className="h-8 w-8"
                        >
                          <FlaskConical className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" size="icon" onClick={() => a.alias === "central" ? setCentralSettingsOpen(true) : openEdit(a.id)} className="h-8 w-8" title={t("admin.agents.configure")}>
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        {a.alias !== "central" && (
                          a.is_active ? (
                            <Button variant="destructive" size="icon" onClick={() => remove(a.id, a.alias)} title={t("admin.agents.hideAgent")} className="h-8 w-8">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <>
                              <Button variant="default" size="icon" onClick={() => restore(a.id)} title={t("admin.agents.restore")} className="h-8 w-8">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => removePermanent(a.id, a.alias)}
                                title={t("admin.agents.deleteFromDb")}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p className="text-muted-foreground break-all">{a.base_url}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="flex items-center gap-1.5">
                        {a.is_active ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                        )}
                        <span className="text-muted-foreground">{t("admin.apps.status")}</span>{" "}
                        {a.is_active ? t("admin.apps.on") : t("admin.apps.off")}
                      </span>
                      <span className="text-muted-foreground">#{a.display_order}</span>
                    </div>
                    {cfg.routing_hint && (
                      <p className="text-muted-foreground" title={t("admin.agents.routingHint")}>
                        📌 {cfg.routing_hint}
                      </p>
                    )}
                  </CardContent>
                </Card>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <hr className="my-8 border-border" />
      <AgentTestsTab />

      <hr className="my-8 border-border" />
      <TestEmbedTab />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t("admin.agents.editAgent") : t("admin.agents.addAgent")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveAgent} className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label>{t("admin.agents.baseUrlLabel")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={checkAgentBaseUrl}
                  disabled={checkingBaseUrl || !form.base_url.trim()}
                >
                  {checkingBaseUrl ? "Đang kiểm tra..." : "Check URL"}
                </Button>
              </div>
              <Input
                type="url"
                value={form.base_url}
                onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder={t("admin.agents.baseUrlPlaceholder")}
                required
              />
            </div>
            <div>
              <Label>{t("admin.agents.aliasLabel")}</Label>
              <Input
                value={form.alias}
                onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))}
                placeholder={t("admin.agents.aliasPlaceholderShort")}
                pattern="[a-z0-9_-]+"
                required
                className="font-mono"
              />
            </div>
            <div>
              <Label>{t("admin.agents.displayNameLabel")}</Label>
              <Input
                value={form.display_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder={t("admin.agents.displayNamePlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.agents.displayNameHelp")}
              </p>
            </div>
            <div>
              <IconPicker
                label={t("admin.agents.iconLabel")}
                value={form.icon || "Bot"}
                onChange={(icon) => setForm((f) => ({ ...f, icon }))}
                moreLabel={t("admin.icons.more")}
                lessLabel={t("admin.icons.less")}
              />
            </div>
            <div>
              <Label>{t("admin.agents.routingHintLabel")}</Label>
              <Input
                value={((form.config_json as { routing_hint?: string })?.routing_hint ?? "")}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    config_json: { ...f.config_json, routing_hint: e.target.value || undefined },
                  }))
                }
                placeholder={t("admin.agents.aliasPlaceholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.agents.routingHintHelp")}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">{t("admin.apps.visibilitySection")}</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-24"
                  value={form.display_order ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) || 0 }))}
                />
                <Label className="font-normal">{t("admin.apps.displayOrder")}</Label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.is_active !== false}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c === true }))}
                />
                {t("admin.agents.activate")}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.pinned === true}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, pinned: c === true }))}
                />
                {t("admin.apps.pinnedOnHome")}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={((form.config_json as { hide_from_sidebar?: boolean } | undefined)?.hide_from_sidebar) !== true}
                  onCheckedChange={(c) =>
                    setForm((f) => ({
                      ...f,
                      config_json: {
                        ...(f.config_json ?? {}),
                        hide_from_sidebar: c !== true,
                      },
                    }))
                  }
                />
                Hiện ở panel bên trái
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                {t("admin.agents.cancel")}
              </Button>
              <Button type="submit">{t("common.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog cài đặt riêng cho Trợ lý chính (Central) — chỉ LLM + system prompt, không có alias/icon/base_url/tên hiển thị */}
      <Dialog open={centralSettingsOpen} onOpenChange={setCentralSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {t("admin.central.dialogTitle")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("admin.central.dialogDesc")}
            </p>
          </DialogHeader>
          <CentralAgentConfig embedded />
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
            <DialogTitle>{t("admin.agents.embedCodeTitle")}</DialogTitle>
          </DialogHeader>
          {embedAgentAlias && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("admin.agents.embedIntro").replace("{alias}", embedAgentAlias)}
              </p>
              <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
                <Label className="text-sm font-medium">{t("admin.agents.embedDomainsTitle")}</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={embedDomainAllowAll}
                    onCheckedChange={(c) => setEmbedDomainAllowAll(c === true)}
                  />
                  <span className="text-sm">{t("admin.agents.allowAllDomains")}</span>
                </label>
                {!embedDomainAllowAll && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("admin.agents.allowedDomainsLabel")}</Label>
                    <textarea
                      className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={embedDomainList}
                      onChange={(e) => setEmbedDomainList(e.target.value)}
                      placeholder={t("admin.agents.allowedDomainsPlaceholder")}
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">{t("admin.agents.embedLimitLabel")}</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder={t("admin.agents.noLimit")}
                    value={embedDailyLimit}
                    onChange={(e) => setEmbedDailyLimit(e.target.value.replace(/[^0-9]/g, ""))}
                    className="mt-1 w-32"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("admin.agents.embedLimitHelp")}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{t("admin.agents.colorLabel")}</Label>
                  <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setEmbedColor("")}
                      title={t("admin.agents.defaultColor")}
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
                  <Label className="text-xs text-muted-foreground mb-2 block">{t("admin.agents.iconLabelEmbed")}</Label>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEmbedIconOption("")}
                      title={t("admin.agents.defaultColor")}
                      className={`shrink-0 p-1.5 rounded-md border-2 transition-colors ${
                        !embedIconOption ? "border-primary bg-primary/10" : "border-input bg-background hover:bg-muted"
                      }`}
                    >
                      <span className="block w-4 h-4 text-muted-foreground text-xs flex items-center justify-center">—</span>
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
                          className={`shrink-0 p-1.5 rounded-md border-2 transition-colors ${
                            selected ? "border-primary bg-primary/10" : "border-input bg-background hover:bg-muted"
                          }`}
                        >
                          <IconComp className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              {(() => {
                const base = typeof window !== "undefined" ? window.location.origin : ""
                const path = `/assistant-embed/${embedAgentAlias}`
                const params = new URLSearchParams()
                if (embedColor) params.set("color", embedColor)
                if (embedIconOption) params.set("icon", embedIconOption)
                const qs = params.toString()
                const src = `${base}${path}${qs ? `?${qs}` : ""}`
                const code = `<iframe src="${src}" width="100%" height="600" frameborder="0" title="${t("admin.agents.embedIframeTitle").replace("{alias}", embedAgentAlias)}"></iframe>`
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
                      title={copiedEmbedCode ? t("admin.agents.copied") : t("admin.agents.copyEmbedCode")}
                      onClick={() => {
                        navigator.clipboard.writeText(code).then(
                          () => {
                            setCopiedEmbedCode(true)
                            toast({ title: t("admin.agents.embedCopied"), duration: 3000 })
                            setTimeout(() => setCopiedEmbedCode(false), 3000)
                          },
                          () => toast({ title: t("admin.agents.copyFailed"), variant: "destructive" })
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
                      toast({ title: t("admin.agents.embedConfigSaved"), duration: 2000 })
                    } catch (e) {
                      toast({ title: t("common.error"), description: (e as Error)?.message, variant: "destructive" })
                    } finally {
                      setEmbedDomainSaving(false)
                    }
                  }}
                >
                  {embedDomainSaving ? t("common.saving") : t("settings.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conversations (anonymous) */}
      <Dialog open={conversationsOpen} onOpenChange={(open) => !open && (setConversationsOpen(false), backToSessionList())}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0 min-h-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {selectedSession ? (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={backToSessionList}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {t("admin.agents.conversationDetail")}
                </>
              ) : (
                t("admin.agents.conversationsTitle")
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedSession
                ? t("admin.agents.conversationsDescFull")
                : t("admin.agents.conversationsDescFilter")}
            </p>
          </DialogHeader>

          {!selectedSession ? (
            <div className="px-6 py-4 space-y-4 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("admin.agents.filterByAgent")}</span>
                <Select
                  value={conversationFilterAlias || "all"}
                  onValueChange={(v) => {
                    setConversationFilterAlias(v === "all" ? "" : v)
                    setSessionsPage((p) => ({ ...p, offset: 0 }))
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t("admin.agents.all")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.agents.all")}</SelectItem>
                    {filtered.map((a) => (
                      <SelectItem key={a.id} value={a.alias}>
                        {a.alias}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground ml-2">{t("admin.agents.source")}</span>
                <Select
                  value={conversationFilterSource || "all"}
                  onValueChange={(v) => {
                    setConversationFilterSource(v === "all" ? "" : v)
                    setSessionsPage((p) => ({ ...p, offset: 0 }))
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t("admin.agents.all")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.agents.all")}</SelectItem>
                    <SelectItem value="web">{t("admin.agents.sourceWeb")}</SelectItem>
                    <SelectItem value="embed">{t("admin.agents.sourceEmbed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
                <span className="text-sm text-muted-foreground">
                  {t("admin.agents.exportDateRange")}
                </span>
                <Select
                  value={exportConversationDatePreset}
                  onValueChange={(v) => setExportConversationDatePreset(v as AdminChatExportDatePreset)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.agents.exportRangeAll")}</SelectItem>
                    <SelectItem value="today">{t("admin.agents.exportRangeToday")}</SelectItem>
                    <SelectItem value="last3">{t("admin.agents.exportRangeLast3")}</SelectItem>
                    <SelectItem value="last7">{t("admin.agents.exportRangeLast7")}</SelectItem>
                    <SelectItem value="last30">{t("admin.agents.exportRangeLast30")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="default"
                  className="shrink-0"
                  disabled={sessionsLoading || exportingConversations}
                  onClick={handleExportConversationsExcel}
                >
                  {exportingConversations ? (
                    t("admin.agents.exportConversationsRunning")
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      {t("admin.agents.exportConversationsExcel")}
                    </>
                  )}
                </Button>
              </div>
              <div className="border rounded-md overflow-auto flex-1 min-h-0">
                {sessionsLoading ? (
                  <p className="p-4 text-muted-foreground text-center">{t("admin.agents.loadingSessions")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.agents.colTitleSession")}</TableHead>
                        <TableHead>{t("admin.agents.colAgent")}</TableHead>
                        <TableHead>{t("admin.agents.colSource")}</TableHead>
                        <TableHead>{t("admin.agents.colMessages")}</TableHead>
                        <TableHead>{t("admin.agents.colUpdated")}</TableHead>
                        <TableHead className="w-20">{t("admin.agents.colActions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionsList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            {t("admin.agents.noSessions")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        sessionsList.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium max-w-[200px] truncate" title={s.title ?? s.id}>
                              {s.title || t("admin.agents.noTitle")}
                            </TableCell>
                            <TableCell>{s.assistant_alias}</TableCell>
                            <TableCell>
                              <span className={s.source === "embed" ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}>
                                {s.source === "embed" ? t("admin.agents.sourceEmbed") : t("admin.agents.sourceWeb")}
                              </span>
                            </TableCell>
                            <TableCell>{s.message_count}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {s.updated_at ? new Date(s.updated_at).toLocaleString(dateLocale) : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => viewSessionDetail(s)}>
                                {t("admin.agents.viewButton")}
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
                    {t("admin.agents.prevPage")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sessionsPage.offset + sessionsList.length >= sessionsPage.total}
                    onClick={() => setSessionsPage((p) => ({ ...p, offset: p.offset + p.limit }))}
                  >
                    {t("admin.agents.nextPage")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-4 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1 mb-4 shrink-0">
                <p><strong>{t("admin.agents.titleLabel")}</strong> {selectedSession.title || t("admin.agents.noTitle")}</p>
                <p><strong>{t("admin.agents.colAgent")}:</strong> {selectedSession.assistant_alias}</p>
                <p><strong>{t("admin.agents.sourceLabel")}</strong> {selectedSession.source === "embed" ? t("admin.agents.sourceEmbed") : t("admin.agents.sourceWeb")}</p>
                <p><strong>{t("admin.agents.senderLabel")}</strong> {selectedSession.user_display ?? t("admin.agents.userDisplay")}</p>
                <p><strong>{t("admin.agents.sessionCreated")}:</strong> {selectedSession.created_at ? new Date(selectedSession.created_at).toLocaleString(dateLocale) : "—"}</p>
                <p><strong>{t("admin.agents.sessionUpdated")}:</strong> {selectedSession.updated_at ? new Date(selectedSession.updated_at).toLocaleString(dateLocale) : "—"}</p>
                <p><strong>{t("admin.agents.messageCountLabel")}:</strong> {selectedSession.message_count}</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain border rounded-md p-4">
                {messagesLoading ? (
                  <p className="text-muted-foreground text-center py-4">{t("admin.agents.loadingMessages")}</p>
                ) : sessionMessages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">{t("admin.agents.noMessages")}</p>
                ) : (
                  <div className="space-y-4">
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
                                <span>{m.created_at ? new Date(m.created_at).toLocaleString(dateLocale) : ""}</span>
                                <User className="h-3.5 w-3.5 shrink-0" />
                                <span>{t("admin.agents.userDisplay")}</span>
                              </>
                            ) : (
                              <>
                                <Bot className="h-3.5 w-3.5 shrink-0" />
                                <span>{m.assistant_alias || t("admin.agents.assistantLabel")}</span>
                                <span>{m.created_at ? new Date(m.created_at).toLocaleString(dateLocale) : ""}</span>
                                {m.response_time_ms != null && (
                                  <span className="text-muted-foreground">({m.response_time_ms} ms)</span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {m.content || t("admin.agents.emptyContent")}
                          </div>
                          {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {t("admin.agents.attachmentsLabel")}: {m.attachments.map((a: { file_name?: string }) => a.file_name || "file").join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
