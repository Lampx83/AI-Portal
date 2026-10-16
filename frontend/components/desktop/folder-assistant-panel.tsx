"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileSearch,
  FileText,
  FolderTree,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Unplug,
  X,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { chatRemarkPlugins, chatRehypePlugins, prepareChatMarkdown } from "@/lib/markdown-plugins"
import {
  getDesktopAgentBridge,
  type DesktopAgentEvent,
  type DesktopAgentSessionSummary,
  type DesktopAgentStatus,
  type DesktopChangeView,
  type DesktopLinkedFolder,
  type DesktopTranscriptItem,
  type NeuDesktopAgentBridge,
} from "@/lib/desktop-bridge"

type LiveTool = { kind: "tool"; callId: string; name: string; label: string; ok?: boolean; summary?: string; running: boolean; at: string }
type Item = DesktopTranscriptItem | LiveTool

const TOOL_ICON: Record<string, typeof FileText> = {
  list_files: FolderTree,
  read_file: FileText,
  search_text: Search,
  write_file: Pencil,
  edit_file: Pencil,
  rename_file: Pencil,
  delete_file: Trash2,
}

function DiffView({ change }: { change: DesktopChangeView }) {
  const rows: ReactNode[] = []
  change.hunks.forEach((h, hi) => {
    rows.push(
      <div key={`h${hi}`} className="px-2 py-0.5 text-[11px] text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 select-none">
        @@ −{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@
      </div>,
    )
    h.lines.forEach((l, li) => {
      const sign = l[0]
      const cls =
        sign === "+"
          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/25 dark:text-emerald-200"
          : sign === "-"
            ? "bg-rose-50 text-rose-900 dark:bg-rose-900/25 dark:text-rose-200"
            : "text-gray-700 dark:text-gray-300"
      rows.push(
        <div key={`h${hi}-${li}`} className={`px-2 whitespace-pre-wrap break-words ${cls}`} data-diff-line={sign === "+" ? "add" : sign === "-" ? "del" : "ctx"}>
          <span className="inline-block w-3 select-none opacity-60">{sign === "\\" ? " " : sign}</span>
          {l.slice(1)}
        </div>,
      )
    })
  })
  return <div className="max-h-80 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 font-mono text-xs leading-5">{rows}</div>
}

function ChangeCard({
  change,
  busy,
  onAccept,
  onReject,
  onUndo,
}: {
  change: DesktopChangeView
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onUndo: () => void
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(change.status === "pending")
  useEffect(() => {
    if (change.status !== "pending") setOpen(false)
  }, [change.status])
  const statusCls: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    accepted: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
    rejected: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    undone: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    conflict: "bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
    superseded: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  }
  const hasDiff = change.hunks.length > 0
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3 my-2" data-testid="agent-change" data-change-id={change.id} data-status={change.status}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-primary/10 text-primary text-[11px] font-semibold px-1.5 py-0.5">{t(`desktopAgent.kind.${change.kind}`)}</span>
        <span className="font-medium text-gray-900 dark:text-gray-100 break-all">
          {change.relPath}
          {change.kind === "rename" && change.newRelPath ? ` → ${change.newRelPath}` : ""}
        </span>
        {change.kind !== "rename" && !change.binary && (
          <span className="text-xs tabular-nums">
            <span className="text-emerald-700 dark:text-emerald-400">+{change.added}</span>{" "}
            <span className="text-rose-700 dark:text-rose-400">−{change.removed}</span>
          </span>
        )}
        <span className={`ml-auto rounded-full text-[11px] font-medium px-2 py-0.5 ${statusCls[change.status] ?? ""}`}>{t(`desktopAgent.status.${change.status}`)}</span>
      </div>
      {change.summary && <p className="text-xs text-muted-foreground mt-1">{change.summary}</p>}
      {change.error && change.status === "conflict" && <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{change.error}</p>}
      {change.binary && <p className="text-xs text-muted-foreground mt-1">{t("desktopAgent.binaryDelete")}</p>}
      {hasDiff && (
        <button type="button" className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {open ? t("desktopAgent.hideDiff") : t("desktopAgent.showDiff")}
        </button>
      )}
      {open && hasDiff && (
        <div className="mt-2">
          {change.format === "docx" && <p className="text-[11px] text-muted-foreground mb-1">{t("desktopAgent.docxNote")}</p>}
          <DiffView change={change} />
          {change.truncated && <p className="text-[11px] text-muted-foreground mt-1">{t("desktopAgent.diffTruncated")}</p>}
        </div>
      )}
      {(change.status === "pending" || change.status === "accepted") && (
        <div className="flex items-center gap-2 mt-2">
          {change.status === "pending" ? (
            <>
              <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={busy} onClick={onAccept} data-testid="agent-accept">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {t("desktopAgent.accept")}
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={busy} onClick={onReject} data-testid="agent-reject">
                <X className="h-3.5 w-3.5" />
                {t("desktopAgent.reject")}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={busy} onClick={onUndo} data-testid="agent-undo">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
              {t("desktopAgent.undo")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Khung «Trợ lý thư mục» trên trang dự án (chỉ trong ứng dụng desktop ≥ 0.2.0, khi dự án đã liên kết thư mục).
 * Agent chạy ở tiến trình chính của app; trang chỉ hiển thị và chuyển lệnh. Ghi tệp chỉ khi người dùng bấm Chấp nhận.
 */
export function FolderAssistantPanel({ projectId, linked }: { projectId: string; linked: DesktopLinkedFolder | null }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [api, setApi] = useState<NeuDesktopAgentBridge | null>(null)
  const [status, setStatus] = useState<DesktopAgentStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<DesktopAgentSessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [changes, setChanges] = useState<Record<string, DesktopChangeView>>({})
  const [stream, setStream] = useState("")
  const [runId, setRunId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [busyChange, setBusyChange] = useState<string | null>(null)
  const runRef = useRef<string | null>(null)
  const sendingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => setApi(getDesktopAgentBridge()), [])

  const fail = useCallback(
    (e: unknown) => toast({ title: t("desktopAgent.error"), description: (e as Error)?.message ?? String(e), variant: "destructive" }),
    [t, toast],
  )

  const refreshStatus = useCallback(async () => {
    if (!api) return
    try {
      setStatus(await api.agentGetStatus())
    } catch (e) {
      setStatus({ connected: false, server: "", secureStorage: false, error: (e as Error).message })
    }
  }, [api])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const connected = !!status?.connected
  const ready = connected && !!linked?.exists

  const loadSessions = useCallback(async () => {
    if (!api || !ready) return
    try {
      setSessions(await api.agentListSessions(projectId))
    } catch {
      setSessions([])
    }
  }, [api, ready, projectId])

  const loadSession = useCallback(
    async (id: string | null) => {
      if (!api) return
      setStream("")
      if (!id) {
        setSessionId(null)
        setItems([])
        setChanges({})
        setRunId(null)
        runRef.current = null
        return
      }
      try {
        const [s, ch] = await Promise.all([api.agentGetSession(projectId, id), api.agentListChanges(projectId, id)])
        setSessionId(s ? id : null)
        setItems(s?.transcript ?? [])
        setChanges(Object.fromEntries(ch.map((c) => [c.id, c])))
        runRef.current = s?.running ?? null
        setRunId(s?.running ?? null)
      } catch (e) {
        fail(e)
      }
    },
    [api, projectId, fail],
  )

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  // Đổi dự án → về trạng thái trống.
  useEffect(() => {
    void loadSession(null)
  }, [projectId, loadSession])

  useEffect(() => {
    if (!api) return
    return api.onAgentEvent((ev: DesktopAgentEvent) => {
      if (ev.type === "run_start") {
        if (ev.projectId !== projectId || !sendingRef.current) return
        runRef.current = ev.runId
        setRunId(ev.runId)
        setSessionId(ev.sessionId)
        return
      }
      if (ev.runId !== runRef.current) return
      const at = new Date().toISOString()
      switch (ev.type) {
        case "delta":
          setStream((s) => s + ev.text)
          break
        case "assistant":
          setStream("")
          setItems((xs) => [...xs, { kind: "assistant", text: ev.text, at }])
          break
        case "tool_start":
          setStream("")
          setItems((xs) => [...xs, { kind: "tool", callId: ev.callId, name: ev.name, label: ev.label, running: true, at }])
          break
        case "tool_end":
          setItems((xs) =>
            xs.map((x) => ("callId" in x && x.callId === ev.callId ? { ...x, running: false, ok: ev.ok, summary: ev.summary, label: ev.label || x.label } : x)),
          )
          break
        case "change":
          setChanges((m) => ({ ...m, [ev.change.id]: ev.change }))
          setItems((xs) => [...xs, { kind: "change", changeId: ev.change.id, at }])
          break
        case "notice":
          setItems((xs) => [...xs, { kind: "notice", level: ev.level, text: ev.text, at }])
          break
        case "run_end":
          runRef.current = null
          setRunId(null)
          setStream("")
          void loadSession(ev.sessionId)
          void loadSessions()
          if (ev.status === "error" && /kết nối lại|chưa kết nối/i.test(ev.message ?? "")) void refreshStatus()
          break
      }
    })
  }, [api, projectId, loadSession, loadSessions, refreshStatus])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items, stream])

  const send = async (text: string) => {
    if (!api || !text.trim() || runId) return
    setInput("")
    setItems((xs) => [...xs, { kind: "user", text: text.trim(), at: new Date().toISOString() }])
    sendingRef.current = true
    try {
      const r = await api.agentSend(projectId, sessionId, text.trim())
      runRef.current = r.runId
      setRunId((cur) => cur ?? r.runId)
      setSessionId(r.sessionId)
    } catch (e) {
      fail(e)
      setItems((xs) => xs.slice(0, -1))
      setInput(text)
    } finally {
      sendingRef.current = false
    }
  }

  const connect = async () => {
    if (!api) return
    setConnecting(true)
    setConnectError(null)
    try {
      setStatus(await api.agentConnect())
    } catch (e) {
      setConnectError((e as Error).message)
    } finally {
      setConnecting(false)
    }
  }

  const act = async (c: DesktopChangeView, kind: "accept" | "reject" | "undo") => {
    if (!api) return
    setBusyChange(c.id)
    try {
      const fn = kind === "accept" ? api.agentAcceptChange : kind === "reject" ? api.agentRejectChange : api.agentUndoChange
      const v = await fn(projectId, c.id)
      setChanges((m) => ({ ...m, [v.id]: v }))
      if (kind === "accept" && v.status === "accepted") toast({ title: t("desktopAgent.accepted").replace("{path}", v.newRelPath ?? v.relPath) })
      if (kind === "undo" && v.status === "undone") toast({ title: t("desktopAgent.undone").replace("{path}", v.relPath) })
    } catch (e) {
      // Xung đột/huỷ: tải lại trạng thái thật.
      try {
        const list = await api.agentListChanges(projectId, sessionId ?? undefined)
        setChanges(Object.fromEntries(list.map((x) => [x.id, x])))
      } catch {
        /* bỏ qua */
      }
      if ((e as Error)?.message !== "Đã huỷ") fail(e)
    } finally {
      setBusyChange(null)
    }
  }

  const pending = useMemo(() => Object.values(changes).filter((c) => c.status === "pending").length, [changes])

  if (!api || !projectId) return null

  const suggestions = ["summary", "proofread", "bib", "outline"].map((k) => t(`desktopAgent.suggest.${k}`))

  const renderItem = (it: Item, i: number): ReactNode => {
    switch (it.kind) {
      case "user":
        return (
          <div key={i} className="flex justify-end my-2">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">{it.text}</div>
          </div>
        )
      case "assistant":
        return (
          <div key={i} className="my-2 text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5" data-testid="agent-answer">
            <ReactMarkdown remarkPlugins={chatRemarkPlugins} rehypePlugins={chatRehypePlugins}>
              {prepareChatMarkdown(it.text)}
            </ReactMarkdown>
          </div>
        )
      case "tool": {
        const Icon = TOOL_ICON[it.name] ?? FileSearch
        const running = "running" in it && it.running
        const verb = t(`desktopAgent.tool.${it.name}`)
        return (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground my-1" data-testid="agent-tool">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : it.ok === false ? <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" /> : <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="shrink-0">{verb.startsWith("desktopAgent.") ? it.name : verb}</span>
            {it.label && <code className="truncate text-gray-700 dark:text-gray-300">{it.label}</code>}
            {!running && it.summary && <span className={`truncate ${it.ok === false ? "text-rose-600 dark:text-rose-400" : ""}`}>· {it.summary}</span>}
          </div>
        )
      }
      case "change": {
        const c = changes[it.changeId]
        if (!c || c.status === "superseded") return null
        return (
          <ChangeCard
            key={i}
            change={c}
            busy={busyChange === c.id}
            onAccept={() => void act(c, "accept")}
            onReject={() => void act(c, "reject")}
            onUndo={() => void act(c, "undo")}
          />
        )
      }
      case "notice":
        return (
          <div
            key={i}
            className={`flex items-start gap-1.5 text-xs my-2 ${it.level === "error" ? "text-rose-700 dark:text-rose-300" : it.level === "warn" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {it.text}
          </div>
        )
    }
  }

  return (
    <section className="w-full mb-8 text-left" aria-labelledby="desktop-agent-title" data-testid="folder-assistant">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/40">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <h2 id="desktop-agent-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("desktopAgent.title")}
          </h2>
          <span className="rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-[11px] font-medium px-2 py-0.5">{t("desktopAgent.badge")}</span>
          {ready && (
            <div className="ml-auto flex items-center gap-1">
              {pending > 0 && <span className="text-[11px] text-amber-700 dark:text-amber-300 mr-1">{t("desktopAgent.pendingCount").replace("{n}", String(pending))}</span>}
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" disabled={!!runId} onClick={() => void loadSession(null)} data-testid="agent-new">
                <Plus className="h-3.5 w-3.5" />
                {t("desktopAgent.newSession")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" disabled={!!runId} onClick={() => void loadSessions()}>
                    <History className="h-3.5 w-3.5" />
                    {t("desktopAgent.history")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-auto">
                  {sessions.length === 0 && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("desktopAgent.noHistory")}</DropdownMenuLabel>}
                  {sessions.map((s) => (
                    <DropdownMenuItem key={s.id} className="flex items-center gap-2 text-xs" onSelect={() => void loadSession(s.id)}>
                      <span className={`truncate flex-1 ${s.id === sessionId ? "font-semibold" : ""}`}>{s.title}</span>
                      <span className="text-muted-foreground shrink-0">{new Date(s.updatedAt).toLocaleDateString()}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="…">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {status?.user?.email && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">{t("desktopAgent.connectedAs").replace("{email}", status.user.email)}</DropdownMenuLabel>}
                  {sessionId && (
                    <DropdownMenuItem
                      className="text-xs gap-2"
                      disabled={!!runId}
                      onSelect={async () => {
                        await api.agentDeleteSession(projectId, sessionId).catch(fail)
                        void loadSession(null)
                        void loadSessions()
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("desktopAgent.deleteSession")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs gap-2"
                    onSelect={async () => {
                      setStatus(await api.agentDisconnect().catch(() => null))
                      void loadSession(null)
                    }}
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    {t("desktopAgent.disconnect")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {!linked?.exists ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{t("desktopAgent.needLink")}</p>
        ) : !status ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </p>
        ) : !connected ? (
          <div className="px-4 pb-4">
            <p className="text-sm text-muted-foreground mb-2">{t("desktopAgent.intro").replace("{name}", linked.name)}</p>
            <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
              {t("desktopAgent.privacy")}
            </p>
            <Button size="sm" className="gap-1.5" onClick={() => void connect()} disabled={connecting} data-testid="agent-connect">
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {connecting ? t("desktopAgent.connecting") : t("desktopAgent.connect")}
            </Button>
            {connectError && <p className="text-xs text-rose-700 dark:text-rose-300 mt-2">{connectError}</p>}
          </div>
        ) : (
          <div className="px-4 pb-3">
            {status.llm && !status.llm.available && <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{t("desktopAgent.llmUnavailable")}</p>}
            {!status.secureStorage && <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{t("desktopAgent.noSecureStorage")}</p>}
            <div ref={scrollRef} className="max-h-[32rem] min-h-[6rem] overflow-auto rounded-lg border border-gray-100 dark:border-gray-700/70 px-3 py-2" data-testid="agent-transcript">
              {items.length === 0 && !runId ? (
                <div className="py-2">
                  <p className="text-sm text-muted-foreground mb-2">{t("desktopAgent.intro").replace("{name}", linked.name)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-muted"
                        onClick={() => void send(s)}
                        data-testid="agent-suggestion"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                items.map(renderItem)
              )}
              {stream && (
                <div className="my-2 text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200" data-testid="agent-stream">
                  {stream}
                </div>
              )}
              {runId && !stream && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground my-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("desktopAgent.thinking")}
                </div>
              )}
            </div>
            <form
              className="mt-2 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                placeholder={t("desktopAgent.placeholder")}
                rows={2}
                maxLength={8000}
                className="min-h-[2.75rem] resize-none text-sm"
                data-testid="agent-input"
              />
              {runId ? (
                <Button type="button" variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => void api.agentStop(runId)} data-testid="agent-stop">
                  <Square className="h-3.5 w-3.5" />
                  {t("desktopAgent.stop")}
                </Button>
              ) : (
                <Button type="submit" size="sm" className="gap-1.5 h-9" disabled={!input.trim()} data-testid="agent-send">
                  <Send className="h-3.5 w-3.5" />
                  {t("desktopAgent.send")}
                </Button>
              )}
            </form>
          </div>
        )}
        <p className="flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-700/70 px-4 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3 shrink-0" />
          {t("desktopAgent.footer")}
        </p>
      </div>
    </section>
  )
}
