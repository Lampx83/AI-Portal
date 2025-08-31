"use client"

import type React from "react"
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react"
import { ChatMessages } from "./ui/chat-messages"
import ChatComposer, { type UIModel } from "@/components/chat-composer"
import type { Research } from "@/app/page"

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
  researchContext: Research | null
  onChatStart?: () => void
  onSendMessage: (prompt: string, modelId: string) => Promise<string>
  models: UIModel[]
  onMessagesChange?: (count: number) => void
  className?: string
}

export type ChatInterfaceHandle = {
  applySuggestion: (text: string) => void
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

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

  // Gửi tin nhắn
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() && attachedFiles.length === 0) return
    if (messages.length === 0) onChatStart?.()

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
      attachments: attachedFiles.length ? [...attachedFiles] : undefined,
    }
    pushMessages((prev) => [...prev, userMessage])
    const promptToSend = inputValue

    setInputValue("")
    setAttachedFiles([])
    setIsLoading(true)

    try {
      const raw = await onSendMessage(promptToSend, selectedModel.model_id)
      const content = typeof raw === "string" ? raw : JSON.stringify(raw)
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content,
        sender: "assistant",
        timestamp: new Date(),
        model: selectedModel.name,
        format: "text",
      }
      pushMessages((prev) => [...prev, aiMessage])
    } catch (err: any) {
      pushMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content: `Xin lỗi, có lỗi khi gọi API: ${err?.message || "Không rõ nguyên nhân"}.`,
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
    <div className={`flex ${messages.length > 0 ? "flex-1 min-h-0" : "flex-none"} flex-col dark:bg-gray-950`}>
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
