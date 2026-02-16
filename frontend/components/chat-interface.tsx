// Chat interface
"use client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import type React from "react"
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import { ChatMessages } from "./ui/chat-messages"
import ChatComposer, { type UIModel } from "@/components/chat-composer"
import { ChatSuggestions } from "@/components/chat-suggestions"
import { createChatSession, appendMessage, setMessageFeedback } from "@/lib/chat"
import type { Project } from "@/types"
import { getIconComponent, type IconName } from "@/lib/assistants"
import { useLanguage } from "@/contexts/language-context"
// SpeechRecognition typings & helper
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

interface SpeechRecognitionAlternative {
  transcript: string
  confidence?: number
}
interface SpeechRecognitionResult {
  isFinal: boolean
  0: SpeechRecognitionAlternative
  length: number
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechRecognitionResult[]
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((ev: { error: string; message?: string }) => void) | null
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  start(): void
  stop(): void
  abort(): void
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as any
  return (w.SpeechRecognition || w.webkitSpeechRecognition) ?? null
}
// ───────────────────────────────────────────────────────────────────────────────

export type MessageAgent = { alias: string; name: string; icon: string }

interface Message {
  id: string
  content: string
  sender: "user" | "assistant"
  timestamp: Date
  model?: string
  attachments?: File[]
  format?: "text" | "markdown"
  /** Typewriter effect for new AI message */
  typingEffect?: boolean
  /** Agent(s) that replied (from orchestrator) */
  meta?: { agents?: MessageAgent[] }
  /** User like/dislike for assistant reply */
  feedback?: "like" | "dislike"
}

interface ChatInterfaceProps {
  assistantName: string
  projectContext: Project | null
  onChatStart?: () => void
  onSendMessage: (prompt: string, modelId: string, signal?: AbortSignal) => Promise<string | { content: string; meta?: { agents?: MessageAgent[] }; messageId?: string }>
  models: UIModel[]
  onMessagesChange?: (count: number) => void
  className?: string
  /** Session id for loading messages */
  sessionId?: string
  onFileUploaded?: (file: { name: string; url: string }) => void; // 👈 thêm
  /** Uploaded file URLs to show in message */
  uploadedFiles?: Array<{ name: string; url: string; status?: string }>
  /** Callback to clear uploaded files after send */
  onClearUploadedFiles?: () => void
  /** Override loading message (e.g. "Agents are replying...") */
  loadingMessage?: string
  /** Embed: agent icon and color (URL params) */
  embedIcon?: IconName
  embedTheme?: string
  /** Embed layout: input fixed bottom, messages scroll above */
  embedLayout?: boolean
  /** Composer layout: "stacked" = model top, input middle, send bottom */
  composerLayout?: "default" | "stacked"
  /** Sample prompts (max 3) when no messages (embed / floating) */
  sampleSuggestions?: string[]
  /** Assistant alias: for guest 1 message/assistant limit (localStorage) */
  assistantAlias?: string
  /** In project: selected assistant for chat — icon + name above input */
  selectedAssistantForDisplay?: { alias: string; name: string; icon?: string } | null
  /** Called when user clears assistant selection (project only) */
  onClearSelectedAssistant?: () => void
}

export type ChatInterfaceHandle = {
  applySuggestion: (text: string) => void
}

type DbAttachment = { file_name?: string; file_url?: string }

type DbMessage = {
  id: string
  session_id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
  attachments?: DbAttachment[]
  feedback?: "like" | "dislike"
}

// Helper map DB → UI. Attachments: { file_name, file_url } → { name, url } cho ChatMessages
function mapDbToUi(m: DbMessage): Message {
  const attachments = Array.isArray(m.attachments)
    ? m.attachments
        .filter((a) => a?.file_url)
        .map((a) => {
          const file = new File([], a.file_name || "file", { type: "application/octet-stream" })
          ;(file as any).url = a.file_url
          return file
        })
    : undefined
  return {
    id: m.id,
    content: m.content ?? "",
    sender: m.role === "assistant" ? "assistant" : "user",
    timestamp: new Date(m.created_at),
    format: "text",
    attachments: attachments?.length ? attachments : undefined,
    feedback: m.feedback === "like" || m.feedback === "dislike" ? m.feedback : undefined,
  }
}

export const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(function ChatInterface(
  {
    assistantName,
    projectContext,
    onChatStart,
    onSendMessage,
    models,
    onMessagesChange,
    className,
    sessionId: sessionIdProp,
    onFileUploaded,
    uploadedFiles = [],
    onClearUploadedFiles,
    loadingMessage,
    embedIcon,
    embedTheme,
    embedLayout = false,
    composerLayout = "default",
    sampleSuggestions,
    assistantAlias,
    selectedAssistantForDisplay,
    onClearSelectedAssistant,
  },
  ref
) {
  const { t } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<UIModel | undefined>(models[0])
  const [isListening, setIsListening] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [partialText, setPartialText] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const { data: session } = useSession()
  // DB pagination
  const PAGE_SIZE = 50
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const hasMore = messages.length < total

  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)


  const [sessionId, setSessionId] = useState<string | undefined>(sessionIdProp || undefined)
  useEffect(() => setSessionId(sessionIdProp || undefined), [sessionIdProp])
  
  // Update selectedModel when models change
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0])
    }
  }, [models, selectedModel])
  const ensureSession = async () => {
    if (sessionId) return sessionId

    const userId = (session as any)?.user.id
    const s = await createChatSession({
      user_id: userId,
      title: projectContext?.name ?? "null",
      project_id: projectContext?.id != null ? String(projectContext.id) : undefined,
    })
    setSessionId(s.id)
    return s.id
  }


  // For parent to fill suggestion into input
  useImperativeHandle(ref, () => ({
    applySuggestion: (text: string) => {
      setInputValue(text)
      inputRef.current?.focus()
    },
  }))

  // Speech init
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      console.warn("Trình duyệt không hỗ trợ Web Speech API (SpeechRecognition).")
      recognitionRef.current = null
      return
    }
    const rec: SpeechRecognitionInstance = new Ctor()
    rec.lang = "vi-VN"
    rec.continuous = true
    rec.interimResults = true

    rec.onstart = () => {
      setIsListening(true)
      setPartialText("")
    }
    rec.onend = () => {
      if (isListening) {
        try { rec.start() } catch { }
        return
      }
      setIsListening(false)
    }
    rec.onerror = () => setIsListening(false)
    rec.onresult = (ev) => {
      let finalChunk = ""
      let interimChunk = ""
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        const alt = r[0]
        if (!alt) continue
        if (r.isFinal) finalChunk += alt.transcript + " "
        else interimChunk += alt.transcript
      }
      if (finalChunk) {
        setPartialText("")
        setInputValue((prev) => (prev ? (prev + " " + finalChunk).trim() : finalChunk.trim()))
      } else {
        setPartialText(interimChunk)
      }
    }

    recognitionRef.current = rec
    return () => {
      try { rec.stop() } catch { }
      recognitionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleListening = () => {
    const rec = recognitionRef.current
    if (!rec) {
      alert("Trình duyệt không hỗ trợ thu giọng nói hoặc trang chưa chạy trên HTTPS.")
      return
    }
    try {
      if (isListening) {
        rec.stop()
        setIsListening(false)
      } else {
        rec.start()
      }
    } catch {
      try { rec.abort() } catch { }
      setIsListening(false)
    }
  }

  // Helper: update messages
  const pushMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages(updater)
  }

  // Notify parent when messages change (using useEffect to avoid setState during render)
  useEffect(() => {
    onMessagesChange?.(messages.length)
  }, [messages.length, onMessagesChange])


  // Load messages from DB
  // Reset on sessionId change
  useEffect(() => {
    setMessages([])
    setOffset(0)
    setTotal(0)
    setLoadError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Load first page; abort previous fetch when sessionId changes
  useEffect(() => {
    if (!sessionId) return
    const ac = new AbortController()
    let cancelled = false
    const run = async () => {
      try {
        setLoadError(null)
        const { fetchChatMessages } = await import("@/lib/chat")
        const json = await fetchChatMessages(
          sessionId,
          { limit: PAGE_SIZE, offset: 0 },
          { signal: ac.signal }
        )
        const dbItems: DbMessage[] = json?.data ?? []
        const uiItems = dbItems.map(mapDbToUi)
        if (!cancelled) {
          setMessages(uiItems)
          setOffset(PAGE_SIZE)
          setTotal(uiItems.length)
        }
      } catch (e: any) {
        if (cancelled || e?.name === "AbortError") return
        setLoadError(e?.message ?? "Failed to load messages")
      }
    }
    run()
    return () => {
      cancelled = true
      ac.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Load more (older)
  // const loadMoreFromDb = async () => {
  //   if (!sessionId || loadingMore || messages.length >= total) return
  //   setLoadingMore(true)
  //   setLoadError(null)
  //   try {
  //     const res = await fetch(`/api/chat/sessions/${sessionId}/messages?limit=${PAGE_SIZE}&offset=${offset}`, {
  //       cache: "no-store",
  //     })
  //     if (!res.ok) throw new Error(`HTTP ${res.status}`)
  //     const json = await res.json()
  //     const dbItems: DbMessage[] = json?.data ?? []
  //     const uiItems = dbItems.map(mapDbToUi)
  //     // vì API trả theo thời gian tăng dần, nên append vào cuối mảng hiện tại
  //     setMessages((prev) => [...prev, ...uiItems])
  //     setOffset(offset + (json?.page?.limit ?? PAGE_SIZE))
  //     setTotal(json?.page?.total ?? total)
  //     onMessagesChange?.(messages.length + uiItems.length)
  //   } catch (e: any) {
  //     setLoadError(e?.message ?? "Không thể tải thêm tin nhắn")
  //   } finally {
  //     setLoadingMore(false)
  //   }
  // }
  // ─────────────────────────────────────────────────────────────────────────────

  // Send message
const [isStreaming, setIsStreaming] = useState(false)
const abortRef = useRef<AbortController | null>(null)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!inputValue.trim() && attachedFiles.length === 0 && uploadedFiles.length === 0) return
  // Guest can send; backend returns login prompt when quota exceeded
  if (messages.length === 0) onChatStart?.()

  const now = new Date()
  
  // Use uploaded file URLs for display once, avoid duplicate with attachedFiles
  const attachments: File[] = uploadedFiles.map((uf) => {
    const file = new File([], uf.name, { type: "application/octet-stream" })
    ;(file as any).url = uf.url
    return file
  })
  
  const userMessage: Message = {
    id: now.getTime().toString(),
    content: inputValue,
    sender: "user",
    timestamp: now,
    attachments: attachments.length > 0 ? attachments : undefined,
  }
  pushMessages((prev) => [...prev, userMessage])

  const promptToSend = inputValue
  setInputValue("")
  setAttachedFiles([])
  // Clear uploaded files after adding to message
  onClearUploadedFiles?.()
  setIsLoading(true)
  setIsStreaming(true)

  const controller = new AbortController()
  abortRef.current = controller

  if (!selectedModel) {
    pushMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content: "Lỗi: Không có model nào được chọn. Vui lòng chọn một model.",
        sender: "assistant",
        timestamp: new Date(),
        format: "text",
      },
    ])
    setIsLoading(false)
    setIsStreaming(false)
    return
  }

  try {
    const raw = await onSendMessage(promptToSend, selectedModel.model_id, controller.signal)
    const content = typeof raw === "string" ? raw : (raw as { content: string }).content
    const meta = typeof raw === "object" && raw !== null && "meta" in raw ? (raw as { meta?: { agents?: MessageAgent[] } }).meta : undefined
    const messageId = typeof raw === "object" && raw !== null && "messageId" in raw
      ? (raw as { messageId?: string }).messageId
      : (typeof raw === "object" && raw !== null && "assistant_message_id" in raw
        ? (raw as { assistant_message_id?: string }).assistant_message_id
        : undefined)

    const aiMessage: Message = {
      id: (messageId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(messageId)) ? messageId : (Date.now() + 1).toString(),
      content,
      sender: "assistant",
      timestamp: new Date(),
      model: selectedModel.name,
      format: "text",
      typingEffect: true,
      ...(meta?.agents?.length ? { meta: { agents: meta.agents } } : {}),
    }
    pushMessages((prev) => [...prev, aiMessage])
    setTotal((t) => Math.max(t, messages.length + 2))
  } catch (err: any) {
    if (err.name === "AbortError") {
      // pushMessages((prev) => [
      //   ...prev,
      //   {
      //     id: (Date.now() + 1).toString(),
      //     content: "Bạn đã dừng yêu cầu này.",
      //     sender: "assistant",
      //     timestamp: new Date(),
      //     model: selectedModel?.name,
      //     format: "text",
      //   },
      // ])
    } else {
      pushMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content: `Lỗi: ${err?.message || "Không rõ nguyên nhân"}.`,
          sender: "assistant",
          timestamp: new Date(),
          model: selectedModel?.name,
          format: "text",
        },
      ])
    }
  } finally {
    setIsLoading(false)
    setIsStreaming(false)
     requestAnimationFrame(() => {
    inputRef.current?.focus()
  })
    setTimeout(() => inputRef.current?.focus(), 0) // focus lại
  }
}

const handleStop = () => {
  abortRef.current?.abort()
  setIsStreaming(false)
  setIsLoading(false)
  setTimeout(() => inputRef.current?.focus(), 0)
}


  const getModelColor = (modelName: string) => {
    const model = models.find((m) => m.name === modelName)
    return model ? "bg-green-500" : "bg-gray-500"
  }

  const isEmbed = embedLayout || !!(embedIcon ?? embedTheme)

  return (
    <div
      className={`flex flex-col dark:bg-gray-950 ${className ?? ""} flex-1 min-h-0`}
    >
      {/* Load error */}
      {loadError && (
        <div className="px-3 py-2 text-xs text-red-500 border-b shrink-0">{loadError}</div>
      )}

      {/* Messages area — flex-1 so input stays at bottom */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Sample prompts when no messages (embed / floating) */}
        {messages.length === 0 && sampleSuggestions && sampleSuggestions.length > 0 && (
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <ChatSuggestions
              suggestions={sampleSuggestions}
              onSuggestionClick={(text) => {
                setInputValue(text)
                inputRef.current?.focus()
              }}
              assistantName={assistantName}
            />
          </div>
        )}
        {/* Load older */}
        {messages.length > 0 && sessionId && hasMore && (
          <div className="px-3 py-2 shrink-0">
            <button
              disabled={loadingMore}
              className="text-sm underline opacity-80 disabled:opacity-50"
            >
              {loadingMore ? t("chat.loadingMore") : t("chat.loadMore")}
            </button>
          </div>
        )}

        {(messages.length > 0 || !sampleSuggestions?.length) && (
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          assistantName={assistantName}
          getModelColor={getModelColor}
          loadingMessage={loadingMessage}
          embedIcon={embedIcon}
          embedTheme={embedTheme}
          sessionId={sessionId ?? undefined}
          onFeedbackUpdated={(messageId, feedback) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
            )
          }}
          onEditAndResend={(messageId, content) => {
            const idx = messages.findIndex((m) => m.id === messageId)
            if (idx === -1) return
            setInputValue(content)
            pushMessages((prev) => prev.slice(0, idx))
            setTotal((t) => Math.min(t, idx))
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
        />
        )}

      </div>

      {/* Chat input sticky at bottom */}
      <div className="shrink-0 bg-background">
        {selectedAssistantForDisplay && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-muted-foreground border-t border-border/50 bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              {(() => {
                const Icon = getIconComponent((selectedAssistantForDisplay.icon || "Bot") as IconName);
                return (
                  <>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("chat.workingWith")} <strong className="text-foreground">{selectedAssistantForDisplay.name}</strong></span>
                  </>
                );
              })()}
            </div>
            {onClearSelectedAssistant && selectedAssistantForDisplay && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs shrink-0"
                onClick={onClearSelectedAssistant}
                title={t("chat.cancelSelectAssistant")}
              >
                {t("common.cancel")}
              </Button>
            )}
          </div>
        )}
        <ChatComposer
          assistantName={assistantName}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        inputValue={inputValue}
        onInputChange={setInputValue}
        isLoading={isLoading}
        isStreaming={isStreaming}
        onStop={handleStop}
        partialText={partialText}
        isListening={isListening}
        toggleListening={toggleListening}
        attachedFiles={attachedFiles}
        setAttachedFiles={setAttachedFiles}
        fileInputRef={fileInputRef}
        inputRef={inputRef}
        onSubmit={handleSubmit}
        onFileUploaded={onFileUploaded}
        layout={composerLayout}
        />
      </div>
    </div>
  )
})
