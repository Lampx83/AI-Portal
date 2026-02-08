// components/chat-interface.tsx (hoặc đúng path file bạn đang dùng)
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
import type { Research } from "@/types"
import type { IconName } from "@/lib/research-assistants"

// ───────────────── SpeechRecognition typings tối giản & helper ─────────────────
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
  /** Hiệu ứng gõ chữ cho tin nhắn AI mới từ API */
  typingEffect?: boolean
  /** Agent(s) đã trả lời (main orchestrator trả về) */
  meta?: { agents?: MessageAgent[] }
  /** Like/dislike của user cho câu trả lời trợ lý */
  feedback?: "like" | "dislike"
}

interface ChatInterfaceProps {
  assistantName: string
  researchContext: Research | null
  onChatStart?: () => void
  onSendMessage: (prompt: string, modelId: string, signal?: AbortSignal) => Promise<string | { content: string; meta?: { agents?: MessageAgent[] } }>
  models: UIModel[]
  onMessagesChange?: (count: number) => void
  className?: string
  /** 👇 mới thêm: id phiên chat để ChatInterface tự tải message */
  sessionId?: string
  onFileUploaded?: (file: { name: string; url: string }) => void; // 👈 thêm
  /** 👇 Danh sách files đã upload (URLs) để hiển thị trong tin nhắn */
  uploadedFiles?: Array<{ name: string; url: string; status?: string }>
  /** 👇 Callback để clear uploaded files sau khi gửi */
  onClearUploadedFiles?: () => void
  /** 👇 Khi có: hiện thay cho "{assistantName} đang trả lời..." lúc loading (vd. chat điều phối: "Các agent phù hợp đang trả lời...") */
  loadingMessage?: string
  /** 👇 Khi nhúng (embed): icon và màu cho agent (từ URL ?icon=...&color=...) */
  embedIcon?: IconName
  embedTheme?: string
  /** 👇 Bật layout embed: ô chat cố định dưới, tin nhắn cuộn phía trên (dùng khi render trong /embed/...) */
  embedLayout?: boolean
  /** 👇 Layout composer: "stacked" = model trên, input giữa, send dưới (trợ lý viết) */
  composerLayout?: "default" | "stacked"
  /** 👇 Gợi ý mẫu (tối đa 3) hiển thị khi chưa có tin nhắn (embed / floating) */
  sampleSuggestions?: string[]
  /** 👇 Alias trợ lý: dùng để giới hạn khách 1 tin/trợ lý (localStorage), nếu đã gửi thì hiện thông báo đăng nhập */
  assistantAlias?: string
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
    researchContext,
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
  },
  ref
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<UIModel | undefined>(models[0])
  const [isListening, setIsListening] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [partialText, setPartialText] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const { data: session } = useSession()
  // phân trang DB
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
  
  // Cập nhật selectedModel khi models thay đổi
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
      title: researchContext?.name ?? "null",
      research_id: researchContext?.id != null ? String(researchContext.id) : undefined,
    })
    setSessionId(s.id)
    return s.id
  }


  // Cho parent gọi để đổ gợi ý vào input
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

  // Helper: cập nhật messages
  const pushMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages(updater)
  }

  // Notify parent when messages change (using useEffect to avoid setState during render)
  useEffect(() => {
    onMessagesChange?.(messages.length)
  }, [messages.length, onMessagesChange])


  // ────────────────────── TẢI MESSAGE TỪ DB (ngay trong component này) ──────────────────────
  // Reset khi đổi sessionId
  useEffect(() => {
    setMessages([])
    setOffset(0)
    setTotal(0)
    setLoadError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Nạp trang đầu
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    const run = async () => {
      try {
        setLoadError(null)
        // Import fetchChatMessages từ lib/chat
        const { fetchChatMessages } = await import("@/lib/chat")
        const json = await fetchChatMessages(sessionId, {
          limit: PAGE_SIZE,
          offset: 0,
        })
        const dbItems: DbMessage[] = json?.data ?? []
        const uiItems = dbItems.map(mapDbToUi)
        if (!cancelled) {
          setMessages(uiItems)
          setOffset(PAGE_SIZE)
          setTotal(uiItems.length)
          // onMessagesChange will be called via useEffect when messages state updates
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? "Không thể tải tin nhắn")
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Nạp thêm (cũ hơn)
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

  // Gửi tin nhắn
const [isStreaming, setIsStreaming] = useState(false)
const abortRef = useRef<AbortController | null>(null)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!inputValue.trim() && attachedFiles.length === 0 && uploadedFiles.length === 0) return
  // Khách vẫn được gửi; khi hết quota backend trả nội dung yêu cầu đăng nhập
  if (messages.length === 0) onChatStart?.()

  const now = new Date()
  
  // Chỉ dùng file đã upload (có URL) để hiển thị 1 lần có link, tránh lặp với bản không link từ attachedFiles
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
  // Clear uploaded files sau khi đã thêm vào message
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

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
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
      {/* Hiển thị lỗi tải */}
      {loadError && (
        <div className="px-3 py-2 text-xs text-red-500 border-b shrink-0">{loadError}</div>
      )}

      {/* Vùng tin nhắn — luôn flex-1 để ô chat cố định dưới (embed + chat agent) */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Sample prompts khi chưa có tin nhắn (embed / floating: main, data) */}
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
        {/* Nút tải thêm cũ hơn */}
        {messages.length > 0 && sessionId && hasMore && (
          <div className="px-3 py-2 shrink-0">
            <button
              disabled={loadingMore}
              className="text-sm underline opacity-80 disabled:opacity-50"
            >
              {loadingMore ? "Đang tải..." : "Tải thêm tin nhắn cũ"}
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

      {/* Ô chat luôn stick ở bottom — shrink-0 cho mọi chat */}
      <div className="shrink-0 border-t bg-background">
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
