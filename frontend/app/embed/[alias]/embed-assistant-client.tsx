"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChatInterface } from "@/components/chat-interface"
import { useAssistant } from "@/hooks/use-assistants"
import { API_CONFIG } from "@/lib/config"
import { fetchWithTimeout, SEND_TIMEOUT_MS } from "@/lib/fetch-utils"
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage"
import { getStoredSessionHistory, addOrUpdateSessionInHistory } from "@/lib/embed-session-history"
import { getOrCreateGuestDeviceId, setGuestAlreadySentForAssistant } from "@/lib/guest-device-id"
import { isValidEmbedIcon, EMBED_COLOR_OPTIONS } from "@/lib/embed-theme"
import type { IconName } from "@/lib/assistants"
import { transformAssistant } from "@/lib/assistants"
import type { AssistantResponse } from "@/lib/assistants"
import type { Assistant } from "@/lib/assistants"
import { MessageSquare, Plus, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const backendUrl = API_CONFIG.baseUrl

export function EmbedAssistantPageClient({
  alias,
  initialAssistantData,
}: {
  alias: string
  initialAssistantData: AssistantResponse | null
}) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Đang tải…</div>}>
      <EmbedAssistantPageImpl alias={alias} initialAssistantData={initialAssistantData} />
    </Suspense>
  )
}

function EmbedAssistantPageImpl({
  alias: aliasProp,
  initialAssistantData,
}: {
  alias: string
  initialAssistantData: AssistantResponse | null
}) {
  const params = useParams()
  const aliasParam = (Array.isArray(params?.alias) ? params?.alias[0] : params?.alias) ?? aliasProp
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sidEnsuredRef = useRef(false)

  const [sessionId, setSessionId] = useState(() => searchParams?.get("sid") ?? "")
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; status?: string }>>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const historyRequestedRef = useRef(false)
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search)
    if (q.get("history") === "true" || q.get("history") === "1" || q.get("history") === "yes")
      historyRequestedRef.current = true
  }

  const initialAssistant: Assistant | null =
    initialAssistantData ? transformAssistant(initialAssistantData) : null
  const { assistant: fetchedAssistant, loading: assistantLoading } = useAssistant(
    initialAssistant ? null : (aliasParam || null)
  )
  const assistant = initialAssistant ?? fetchedAssistant

  const colorParam = searchParams?.get("color") || searchParams?.get("theme") || ""
  const iconParam = searchParams?.get("icon") || ""
  const embedTheme = EMBED_COLOR_OPTIONS.some((c) => c.value === colorParam) ? colorParam : undefined
  const embedIcon: IconName | undefined = isValidEmbedIcon(iconParam) ? iconParam : undefined
  const historyParam = searchParams?.get("history") ?? ""
  const showHistoryFromParams =
    historyParam === "true" || historyParam === "1" || historyParam === "yes"
  if (showHistoryFromParams) historyRequestedRef.current = true
  const showHistory = showHistoryFromParams || historyRequestedRef.current

  const sid = searchParams?.get("sid") ?? sessionId
  const projectIdFromUrl = searchParams?.get("rid")?.trim() ?? ""
  const projectId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectIdFromUrl) ? projectIdFromUrl : null

  const [historyItems, setHistoryItems] = useState(() => getStoredSessionHistory(aliasParam))
  const [metadataName, setMetadataName] = useState<string | null>(null)

  useEffect(() => {
    if (!assistant?.baseUrl) return
    let cancelled = false
    const url = `${backendUrl}/api/agents/metadata?baseUrl=${encodeURIComponent(assistant.baseUrl)}`
    fetch(url)
      .then((r) => r.json())
      .then((data: { name?: string }) => {
        if (!cancelled && data?.name && typeof data.name === "string") {
          setMetadataName(data.name.trim())
        } else {
          setMetadataName(null)
        }
      })
      .catch(() => {
        if (!cancelled) setMetadataName(null)
      })
    return () => {
      cancelled = true
    }
  }, [assistant?.baseUrl])

  const displayName = metadataName ?? assistant?.name ?? assistant?.alias ?? aliasParam ?? "Trợ lý"

  const refreshHistoryFromStorage = () => {
    setHistoryItems(getStoredSessionHistory(aliasParam))
  }

  useEffect(() => {
    refreshHistoryFromStorage()
  }, [aliasParam, sid])

  useEffect(() => {
    if (!showHistory || typeof window === "undefined") return
    const onFocus = () => refreshHistoryFromStorage()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [showHistory, aliasParam])

  const buildSearchParams = (overrides?: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? "")
    if (historyRequestedRef.current) sp.set("history", "true")
    Object.entries(overrides ?? {}).forEach(([k, v]) => sp.set(k, v))
    return sp
  }

  useEffect(() => {
    if (sidEnsuredRef.current) return
    const currentSid = searchParams?.get("sid")
    if (currentSid) {
      setSessionId(currentSid)
      sidEnsuredRef.current = true
      return
    }
    const stored = getStoredSessionId(aliasParam)
    if (stored) {
      const sp = buildSearchParams({ sid: stored })
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
      setSessionId(stored)
      sidEnsuredRef.current = true
      return
    }
    const newSid = crypto.randomUUID()
    const sp = buildSearchParams({ sid: newSid })
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    setSessionId(newSid)
    sidEnsuredRef.current = true
  }, [pathname, searchParams, router, aliasParam])

  useEffect(() => {
    if (aliasParam && sid) setStoredSessionId(aliasParam, sid)
  }, [aliasParam, sid])

  const ensureSessionId = () => {
    if (searchParams?.get("sid")) return searchParams.get("sid")
    const newSid = crypto.randomUUID()
    setSessionId(newSid)
    const sp = buildSearchParams({ sid: newSid })
    router.replace(`${pathname}?${sp.toString()}`)
    return newSid
  }

  const setSessionInUrl = (newSid: string) => {
    const sp = buildSearchParams({ sid: newSid })
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  const startNewChat = () => {
    const newSid = crypto.randomUUID()
    const sp = buildSearchParams({ sid: newSid })
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  const stillLoading = !initialAssistant && assistantLoading
  if (stillLoading || !assistant) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        {stillLoading ? "Đang tải trợ lý…" : "Không tìm thấy trợ lý."}
      </div>
    )
  }

  const samplePrompts = (assistant.sample_prompts ?? []).slice(0, 3)
  const defaultMainPrompts = [
    "Bạn có thể giúp tôi tìm tài liệu về chủ đề này không?",
    "Tóm tắt giúp tôi các ý chính của tài liệu.",
    "Gợi ý cách viết phần phương pháp cho bài báo.",
  ]
  const fallback = aliasParam === "central" ? defaultMainPrompts : []
  const sampleSuggestions = samplePrompts.length >= 3 ? samplePrompts : [...samplePrompts, ...fallback].slice(0, 3)

  const chatArea = (
    <ChatInterface
      key={sid || "no-sid"}
      className="flex-1 min-h-0 bg-background"
      assistantName={displayName}
      assistantAlias={assistant.alias}
      projectContext={null}
      sessionId={sid || undefined}
      embedLayout
      embedIcon={embedIcon}
      embedTheme={embedTheme}
      sampleSuggestions={sampleSuggestions.length > 0 ? sampleSuggestions : undefined}
      onMessagesChange={() => {}}
      onChatStart={() => {
        ensureSessionId()
      }}
      onFileUploaded={(f) => setUploadedFiles((prev) => [...prev, { ...f, status: "done" }])}
      uploadedFiles={uploadedFiles}
      onClearUploadedFiles={() => setUploadedFiles([])}
      onSendMessage={async (prompt, modelId, signal) => {
          const trimmed = (prompt ?? "").replace(/\s+/g, " ").trim()
          const sessionTitle = trimmed ? trimmed.slice(0, 60) : "File đính kèm"
          const currentSid = ensureSessionId()
          const uploadedDocs = uploadedFiles.map((f) => ({ url: f.url, name: f.name }))
          setUploadedFiles([])

          const requestBody = {
            assistant_base_url: assistant.baseUrl,
            assistant_alias: assistant.alias,
            session_title: sessionTitle,
            user_id: null,
            guest_device_id: getOrCreateGuestDeviceId(),
            model_id: modelId,
            prompt,
            user: "embed-user",
            source: "embed",
            ...(projectId ? { project_id: projectId } : {}),
            context: {
              language: "vi",
              ...(projectId ? { project_id: projectId } : {}),
              extra_data: { document: uploadedDocs },
            },
          }

          const res = await fetchWithTimeout(
            `${backendUrl}/api/chat/sessions/${currentSid}/send`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
              signal,
              timeoutMs: SEND_TIMEOUT_MS,
            }
          )

          if (!res.ok) {
            const errorText = await res.text().catch(() => "")
            let errorMessage = `HTTP ${res.status}: ${res.statusText || "Unknown error"}`
            try {
              const errorJson = JSON.parse(errorText)
              errorMessage = errorJson?.message || errorJson?.error || errorMessage
            } catch {
              if (errorText) errorMessage = errorText
            }
            throw new Error(errorMessage)
          }

          const json = await res.json().catch(() => ({}))
          const isSuccess = json?.status === "success" || (json && "content_markdown" in json)
          if (isSuccess) {
            setGuestAlreadySentForAssistant(assistant.alias)
            if (showHistory && currentSid) {
              addOrUpdateSessionInHistory(assistant.alias, currentSid, sessionTitle)
              setHistoryItems(() => getStoredSessionHistory(assistant.alias))
              queueMicrotask(() => setHistoryItems(getStoredSessionHistory(assistant.alias)))
            }
            const content = json?.content_markdown ?? ""
            const agents = json?.meta?.agents
            const messageId = json.assistant_message_id ?? undefined
            if (agents?.length || messageId) return { content, ...(agents?.length ? { meta: { agents } } : {}), ...(messageId ? { messageId } : {}) }
            return content
          }
          throw new Error(json?.error || "Send failed")
        }}
        models={(assistant.supported_models || []).map((m: { model_id: string; name?: string }) => ({
          model_id: m.model_id,
          name: m.name ?? m.model_id,
        }))}
      />
  )

  if (showHistory) {
    const AssistantIcon = assistant.Icon
    const sidebarContent = (
      <>
        <div className="p-3 pr-3 border-b border-border flex items-center gap-2 text-sm font-medium text-foreground shrink-0">
          <span className="flex items-center justify-center size-8 rounded-md bg-primary/10 text-primary shrink-0">
            <AssistantIcon className="size-4" />
          </span>
          <span className="truncate">{displayName}</span>
        </div>
        <div className="p-2 shrink-0">
          <Button type="button" variant="default" size="sm" className="w-full gap-1" onClick={startNewChat}>
            <Plus className="size-4" />
            Cuộc trò chuyện mới
          </Button>
        </div>
        <div className="px-2 pt-1 pb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground shrink-0">
          <MessageSquare className="size-3.5 shrink-0" />
          Lịch sử chat
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
          {historyItems.length === 0 ? (
            <li className="text-xs text-muted-foreground py-2 px-2">Chưa có cuộc trò chuyện nào.</li>
          ) : (
            historyItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSessionInUrl(item.id)
                    setSidebarOpen(false)
                  }}
                  className={`w-full text-left text-sm py-2 px-2 rounded-md truncate block ${
                    item.id === sid
                      ? "bg-primary/15 text-primary font-medium"
                      : "hover:bg-muted text-foreground"
                  }`}
                  title={item.title}
                >
                  {item.title || "Cuộc trò chuyện"}
                </button>
              </li>
            ))
          )}
        </ul>
      </>
    )
    return (
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity ${
              sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className={`flex flex-col w-56 min-w-0 shrink-0 border-r border-border bg-background
              fixed md:relative inset-y-0 left-0 z-50 md:z-auto
              transition-transform duration-200 ease-out md:translate-x-0
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}
          >
            <div className="absolute top-2 right-2 md:hidden">
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu">
                <X className="size-4" />
              </Button>
            </div>
            {sidebarContent}
          </aside>
        </>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute top-2 left-2 z-10 md:hidden size-9 shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu lịch sử"
          >
            <Menu className="size-5" />
          </Button>
          {chatArea}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {chatArea}
    </div>
  )
}
