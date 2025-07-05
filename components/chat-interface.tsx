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
import { ChatSuggestions } from "./chat-suggestions"

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
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

    // Call onChatStart when user sends first message
    if (messages.length === 0 && onChatStart) {
      onChatStart()
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setAttachedFiles([])
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Tôi hiểu câu hỏi của bạn về "${inputValue}". Đây là phản hồi từ ${assistantName} sử dụng mô hình ${selectedModel.name}. ${
          researchContext ? `Dựa trên bối cảnh nghiên cứu "${researchContext.name}", ` : ""
        }tôi sẽ cung cấp thông tin chi tiết và hữu ích cho bạn.${
          attachedFiles.length > 0 ? ` Tôi đã xem xét ${attachedFiles.length} file đính kèm của bạn.` : ""
        }`,
        sender: "assistant",
        timestamp: new Date(),
        model: selectedModel.name,
      }
      setMessages((prev) => [...prev, aiMessage])
      setIsLoading(false)
    }, 1000)
  }

  const getModelColor = (modelName: string) => {
    const model = AI_MODELS.find((m) => m.name === modelName)
    return model?.color || "bg-gray-500"
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <ChatSuggestions
            suggestions={CHAT_SUGGESTIONS}
            onSuggestionClick={handleSuggestionClick}
            assistantName={assistantName}
          />
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.sender === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                }`}
              >
                {message.sender === "assistant" && message.model && (
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      <div className={`w-2 h-2 rounded-full ${getModelColor(message.model)} mr-1`} />
                      {message.model}
                    </Badge>
                  </div>
                )}

                <p className="text-sm">{message.content}</p>

                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.attachments.map((file, index) => (
                      <div key={index} className="text-xs opacity-75 flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {file.name}
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs opacity-75 mt-1">{message.timestamp.toLocaleTimeString()}</p>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[80%]">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">{assistantName} đang trả lời...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t dark:border-gray-800">
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
