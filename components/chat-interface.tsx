"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Send, Mic, MicOff, Paperclip, X, ChevronDown } from "lucide-react"
import type { Research } from "@/app/page"
import type { SpeechRecognition } from "web-speech-api"
import { ChatMessages } from "./ui/chat-messages"


interface Message {
  id: string
  content: string
  sender: "user" | "assistant"
  timestamp: Date
  model?: string
  attachments?: File[]
}

interface ChatInterfaceProps {
  assistantName: string
  researchContext: Research | null
  onChatStart?: () => void
}

const AI_MODELS = [
  { id: "gpt-4", name: "GPT-4", color: "bg-green-500" },
  { id: "claude-3", name: "Claude 3", color: "bg-orange-500" },
  { id: "gemini-pro", name: "Gemini Pro", color: "bg-blue-500" },
  { id: "llama-2", name: "Llama 2", color: "bg-purple-500" },
  { id: "mistral-7b", name: "Mistral 7B", color: "bg-red-500" },
]

const CHAT_SUGGESTIONS = [
  "Tìm kiếm các bài báo mới nhất về AI trong y tế.",
  "Tóm tắt nghiên cứu về biến đổi khí hậu của giáo sư Nguyễn Văn A.",
  "Phân tích xu hướng công nghệ blockchain trong 5 năm tới.",
  "Đề xuất các chuyên gia về kinh tế số tại trường.",
  "Giải thích về thuật toán học sâu Convolutional Neural Networks (CNN).",
  "So sánh các phương pháp nghiên cứu định tính và định lượng.",
]

export function ChatInterface({ assistantName, researchContext, onChatStart }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0])
  const [isListening, setIsListening] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)


  const askControllerRef = useRef<AbortController | null>(null)

  async function askBackend(prompt: string, context?: Research | null) {
    // Hủy request cũ (nếu có)
    askControllerRef.current?.abort()
    const controller = new AbortController()
    askControllerRef.current = controller

    const body: Record<string, any> = { prompt }
    // ✅ Nếu muốn gửi kèm bối cảnh vào backend
    if (context) {
      body.context = {
        id: context.id,
        name: context.name,
        // tuỳ bạn muốn gửi gì thêm
      }
    }

    const res = await fetch("https://neu-research-backend.vercel.app/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`API error ${res.status}: ${text || res.statusText}`)
    }

    // Không chắc response shape? Bắt an toàn:
    const data = await res.json().catch(async () => {
      const text = await res.text()
      try { return JSON.parse(text) } catch { return { answer: text } }
    })

    // Chuẩn hóa field trả về
    return data.answer ?? data.result ?? data.output ?? data.message ?? JSON.stringify(data)
  }



  useEffect(() => {
  }, [messages])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = "vi-VN"

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInputValue((prev) => prev + transcript)
        setIsListening(false)
      }

      recognitionRef.current.onerror = () => {
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
  }, [])

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true)
      recognitionRef.current.start()
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setAttachedFiles((prev) => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() && attachedFiles.length === 0) return

    if (messages.length === 0 && onChatStart) onChatStart()

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    const promptToSend = inputValue // giữ lại vì sẽ clear input bên dưới
    setInputValue("")
    setAttachedFiles([])
    setIsLoading(true)

    try {
      const answer = await askBackend(promptToSend, researchContext)

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: answer,
        sender: "assistant",
        timestamp: new Date(),
        model: selectedModel.name,
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch (err: any) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Xin lỗi, có lỗi khi gọi API: ${err?.message || "Không rõ nguyên nhân"}.`,
        sender: "assistant",
        timestamp: new Date(),
        model: selectedModel.name,
      }
      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const getModelColor = (modelName: string) => {
    const model = AI_MODELS.find((m) => m.name === modelName)
    return model?.color || "bg-gray-500"
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
  }

  return (
    <div className="flex flex-col dark:bg-gray-950">
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        assistantName={assistantName}
        getModelColor={getModelColor}
      />

      {/* Input Area */}
      <div className="  flex-shrink-0 p-4 border-t dark:border-gray-800">
        {/* Attached Files */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm"
              >
                <Paperclip className="h-4 w-4" />
                <span className="truncate max-w-32">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="h-4 w-4 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${selectedModel.color}`} />
                {selectedModel.name}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {AI_MODELS.map((model) => (
                <DropdownMenuItem key={model.id} onClick={() => setSelectedModel(model)} className="gap-2">
                  <div className={`w-2 h-2 rounded-full ${model.color}`} />
                  {model.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Nhập tin nhắn cho ${assistantName} (${selectedModel.name})...`}
              className="pr-20"
              disabled={isLoading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 p-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={isListening ? stopListening : startListening}
                className={`h-8 w-8 p-0 ${isListening ? "text-red-500" : ""}`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)}>
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept="*/*" />
      </div>
    </div>
  )
}
