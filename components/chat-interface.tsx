// components/chat-interface.tsx (hoặc đúng path file bạn đang dùng)
"use client"
import { useSession } from "next-auth/react"
import type React from "react"
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react"
import { ChatMessages } from "./ui/chat-messages"
import ChatComposer, { type UIModel } from "@/components/chat-composer"
import { createChatSession, appendMessage } from "@/lib/api/chat"

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

interface Message {
  id: string
  content: string
  sender: "user" | "assistant"
  timestamp: Date
  model?: string
  attachments?: File[]
  format?: "text" | "markdown"
}

interface ChatInterfaceProps {
  assistantName: string
  researchContext: null
  onChatStart?: () => void
  onSendMessage: (prompt: string, modelId: string) => Promise<string>
  models: UIModel[]
  onMessagesChange?: (count: number) => void
  className?: string
  /** 👇 mới thêm: id phiên chat để ChatInterface tự tải message */
  sessionId?: string
}

export type ChatInterfaceHandle = {
  applySuggestion: (text: string) => void
}

type DbMessage = {
  id: string
  session_id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
}

// Helper map DB → UI
function mapDbToUi(m: DbMessage): Message {
  return {
    id: m.id,
    content: m.content ?? "",
    sender: m.role === "assistant" ? "assistant" : "user",
    timestamp: new Date(m.created_at),
    format: "text",
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
  },
  ref
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(models[0])
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
  const ensureSession = async () => {
    if (sessionId) return sessionId

    const userId = (session as any)?.user.id
    const s = await createChatSession({ user_id: userId, title: researchContext?.name ?? "null" })
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

  // Helper: cập nhật messages + báo parent
  const pushMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev)
      onMessagesChange?.(next.length)
      return next
    })
  }

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
  // useEffect(() => {
  //   if (!sessionId) return
  //   let cancelled = false
  //   const run = async () => {
  //     try {
  //       setLoadError(null)
  //       const res = await fetch(`/api/chat/sessions/${sessionId}/messages?limit=${PAGE_SIZE}&offset=0`, {
  //         cache: "no-store",
  //       })
  //       if (!res.ok) throw new Error(`HTTP ${res.status}`)
  //       const json = await res.json()
  //       const dbItems: DbMessage[] = json?.data ?? []
  //       const uiItems = dbItems.map(mapDbToUi)
  //       if (!cancelled) {
  //         setMessages(uiItems)
  //         setOffset(json?.page?.limit ?? PAGE_SIZE)
  //         setTotal(json?.page?.total ?? uiItems.length)
  //         onMessagesChange?.(uiItems.length)
  //       }
  //     } catch (e: any) {
  //       if (!cancelled) setLoadError(e?.message ?? "Không thể tải tin nhắn")
  //     }
  //   }
  //   run()
  //   return () => { cancelled = true }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [sessionId])

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() && attachedFiles.length === 0) return
    if (messages.length === 0) onChatStart?.()

    const now = new Date()
    const userMessage: Message = {
      id: now.getTime().toString(),
      content: inputValue,
      sender: "user",
      timestamp: now,
      attachments: attachedFiles.length ? [...attachedFiles] : undefined,
    }

    pushMessages((prev) => [...prev, userMessage])

    const promptToSend = inputValue
    setInputValue("")
    setAttachedFiles([])
    setIsLoading(true)

    try {

      const t0 = performance.now()
      const raw = await onSendMessage(promptToSend, selectedModel.model_id)
      const t1 = performance.now()
      const content = typeof raw === "string" ? raw : JSON.stringify(raw)



      // 5) Render ra UI
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content,
        sender: "assistant",
        timestamp: new Date(),
        model: selectedModel.name,
        format: "text",
      }
      pushMessages((prev) => [...prev, aiMessage])
      setTotal((t) => Math.max(t, messages.length + 2))
    } catch (err: any) {
      pushMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content: `Xin lỗi, có lỗi khi gửi tin nhắn: ${err?.message || "Không rõ nguyên nhân"}.`,
          sender: "assistant",
          timestamp: new Date(),
          model: selectedModel.name,
          format: "text",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const getModelColor = (modelName: string) => {
    const model = models.find((m) => m.name === modelName)
    return model ? "bg-green-500" : "bg-gray-500"
  }

  return (
    <div className={`flex ${messages.length > 0 ? "flex-1 min-h-0" : "flex-none"} flex-col dark:bg-gray-950 ${className ?? ""}`}>

      {/* Hiển thị lỗi tải */}
      {loadError && (
        <div className="px-3 py-2 text-xs text-red-500 border-b">{loadError}</div>
      )}

      {/* Nút tải thêm cũ hơn */}
      {sessionId && hasMore && (
        <div className="px-3 py-2">
          <button
            // onClick={loadMoreFromDb}
            disabled={loadingMore}
            className="text-sm underline opacity-80 disabled:opacity-50"
          >
            {loadingMore ? "Đang tải..." : "Tải thêm tin nhắn cũ"}
          </button>
        </div>
      )}

      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        assistantName={assistantName}
        getModelColor={getModelColor}
      />

      <ChatComposer
        assistantName={assistantName}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        inputValue={inputValue}
        onInputChange={setInputValue}
        isLoading={isLoading}
        partialText={partialText}
        isListening={isListening}
        toggleListening={toggleListening}
        attachedFiles={attachedFiles}
        setAttachedFiles={setAttachedFiles}
        fileInputRef={fileInputRef}
        inputRef={inputRef}
        onSubmit={handleSubmit}
      />
    </div>
  )
})
