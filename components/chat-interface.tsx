"use client"

import type React from "react"
import MarkdownViewer from "@/components/markdown-viewer";

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
  format?: "text" | "markdown"
}

interface ChatInterfaceProps {
  assistantName: string
  researchContext: Research | null
  onChatStart?: () => void
  onSendMessage: (prompt: string, modelId: string) => Promise<string>
  models: { model_id: string; name: string }[]
  onMessagesChange?: (count: number) => void   // 👈 sửa đúng tên
  className?: string                            // 👈 thêm để nhận className từ parent
}
``

export function ChatInterface({
  assistantName,
  researchContext,
  onChatStart,
  onSendMessage,
  models,
  onMessagesChange,             // 👈 NHẬN PROP
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(models[0])
  const [isListening, setIsListening] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Helper: cập nhật messages và báo số lượng mới
  const pushMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages(prev => {
      const next = updater(prev)
      onMessagesChange?.(next.length)       // 👈 báo về Parent
      return next
    })
  }


  // DEBUG: FAKE LONG — hàm tạo Markdown rất dài
  function generateFakeMarkdown(sections = 40): string {
    const parts: string[] = []
    parts.push(`# Báo cáo thử nghiệm hiển thị (FAKE)\n\n> Mục tiêu: kiểm tra cuộn, render Markdown (bảng, danh sách, code, trích dẫn), và hiệu năng UI.\n`)
    for (let i = 1; i <= sections; i++) {
      parts.push(`\n---\n\n## Phần ${i}\n`)
      parts.push(`Đoạn văn mẫu: Lorem ipsum dolor sit amet, **consectetur** adipiscing elit. Vestibulum in _ligula_ sed arcu semper aliquet. Số liệu *giả lập* cho mục đích test.\n`)
      parts.push(`### Danh sách\n- Ý 1: kiểm tra word-wrap và **bold**\n- Ý 2: \`inline code\` và ký tự dài\n- Ý 3: emoji ✅🔥⭐️\n`)
      parts.push(`### Bảng\n\n| Cột | Giá trị | Ghi chú |\n|---:|:------|:-------|\n| ${i} | ${(i * 13) % 97} | Dòng test |\n| ${i + 1} | ${(i * 29) % 113} | Dòng test |\n`)
      parts.push(`### Mã nguồn\n\`\`\`ts\nfunction f${i}(x: number): number {\n  // giả lập độ dài\n  return x * ${i} + ${i * 2};\n}\n\`\`\`\n`)
      parts.push(`> Trích dẫn: “Kiểm thử giao diện cần dữ liệu đủ dài để bộc lộ lỗi cuộn.”\n`)
    }
    parts.push(`\n---\n\n## Kết luận\nNội dung fake đã sinh ra **rất dài** để kiểm tra vùng cuộn, sticky footer, và hiệu ứng khi render Markdown.\n`)
    return parts.join("\n")
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
    pushMessages((prev) => [...prev, userMessage]) // 👈 SỬA

    const promptToSend = inputValue
    setInputValue("")
    setAttachedFiles([])
    setIsLoading(true)

    try {
      // DEBUG: FAKE LONG — nếu người dùng gõ /fake thì bỏ qua API và sinh nội dung dài
      if (promptToSend.trim().startsWith("/")) {
        let content = ""
        if (promptToSend.trim().startsWith("/short")) {
          content = generateFakeMarkdown(0) // Tăng số section để dài hơn
        }
        else if (promptToSend.trim().startsWith("/normal")) {
          content = generateFakeMarkdown(5) // Tăng số section để dài hơn
        }
        else if (promptToSend.trim().startsWith("/long")) {
          content = generateFakeMarkdown(10) // Tăng số section để dài hơn
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content,
          sender: "assistant",
          timestamp: new Date(),
          model: selectedModel.name,
          format: "markdown",
        }
        pushMessages((prev) => [...prev, aiMessage]) // 👈 SỬA
        return
      }


      const raw = await onSendMessage(promptToSend, selectedModel.model_id)

      // Hỗ trợ các trường hợp trả về:
      // 1) string thường
      // 2) JSON object có content_markdown
      // 3) JSON string có content_markdown
      let content = ""
      let format: "text" | "markdown" = "text"

      const tryParse = (val: any) => {
        if (typeof val === "string") {
          // thử parse nếu là JSON string
          try {
            const obj = JSON.parse(val)
            return obj
          } catch {
            return val // vẫn là chuỗi thường
          }
        }
        return val
      }

      const parsed = tryParse(raw)

      if (parsed && typeof parsed === "object") {
        if (typeof parsed.content_markdown === "string") {
          //content = parsed.content_markdown
          content = "Sinh viên NEU (Đại học Kinh tế Quốc dân) có thể phù hợp với các hội thảo sau:\n\n1. **PIT 42 HATHI**  \n   - Chủ đề: IoT trong quản lý tài nguyên, bảo tồn, dữ liệu và vai trò cộng đồng.  \n   - Phù hợp với sinh viên quan tâm đến công nghệ IoT và quản lý tài nguyên.  \n   - Link: [PIT 42 HATHI](https://easychair.org/cfp/PIT42HATHI)\n\n2. **MIA2025**  \n   - Chủ đề: Mô hình hóa số liệu môi trường biển, tài nguyên tái tạo, và hệ sinh thái biển.  \n   - Phù hợp với sinh viên nghiên cứu về môi trường, kinh tế biển hoặc tài nguyên.  \n   - Link: [MIA2025](https://easychair.org/cfp/MIA2025)\n\n3. **SCAI 2025**  \n   - Chủ đề: Trí tuệ nhân tạo, học máy, hệ thống thông minh và tác động xã hội của AI.  \n   - Phù hợp với sinh viên ngành công nghệ thông tin, khoa học dữ liệu.  \n   - Link: [SCAI 2025](https://easychair.org/cfp/scai2025)\n\n4. **WAAI-2025**  \n   - Chủ đề: Ứng dụng AI trong giáo dục, quản lý, học máy, xử lý ngôn ngữ tự nhiên.  \n   - Phù hợp với sinh viên ngành AI, quản trị hoặc phân tích dữ liệu.  \n   - Link: [WAAI-2025](https://easychair.org/cfp/WAAI2025)\n\n5. **CHItaly2025**  \n   - Hội thảo về tương tác người-máy và thiết kế trải nghiệm người dùng.  \n   - Phù hợp với sinh viên ngành công nghệ thông tin hoặc thiết kế sản phẩm.  \n   - Link: [CHItaly2025](https://easychair.org/cfp/CHItaly2025)\n\nLưu ý: Sinh viên nên xem chi tiết chủ đề và yêu cầu của từng hội thảo để chọn phù hợp nhất."
          format = "markdown"
        } else if (typeof parsed.content === "string") {
          // fallback khi backend dùng "content"
          content = parsed.content
          format = "text"
        } else {
          // không có field mong muốn -> stringify để không mất thông tin
          content = JSON.stringify(parsed, null, 2)
          format = "text"
        }
      } else if (typeof parsed === "string") {
        content = parsed
        format = "text"
      } else {
        content = String(raw ?? "")
        format = "text"
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content,
        sender: "assistant",
        timestamp: new Date(),
        model: selectedModel.name,
        format,
      }
      pushMessages((prev) => [...prev, aiMessage]) // 👈 SỬA
    } catch (err: any) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Xin lỗi, có lỗi khi gọi API: ${err?.message || "Không rõ nguyên nhân"}.`,
        sender: "assistant",
        timestamp: new Date(),
        model: selectedModel.name,
        format: "text",
      }
      pushMessages((prev) => [...prev, aiMessage]) // 👈 SỬA
    } finally {
      setIsLoading(false)
    }
  }

  const getModelColor = (modelName: string) => {
    const model = models.find((m) => m.name === modelName)
    return model ? "bg-green-500" : "bg-gray-500"
  }

  return (
    <div
      className={`flex ${messages.length > 0 ? "flex-1 min-h-0" : "flex-none"} flex-col dark:bg-gray-950`}
    >
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        assistantName={assistantName}
        getModelColor={getModelColor}
      />
      <div className="flex-shrink-0 p-4 border-t dark:border-gray-800 ">
        {/* File đính kèm */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4" />
                <span className="truncate max-w-32">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="h-4 w-4 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Form gửi tin nhắn */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent flex-shrink-0">
                <div className={`w-2 h-2 rounded-full bg-green-500`} />
                {selectedModel.name}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {models.map((model) => (
                <DropdownMenuItem key={model.model_id} onClick={() => setSelectedModel(model)} className="gap-2">
                  <div className={`w-2 h-2 rounded-full bg-green-500`} />
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
              <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 w-8 p-0">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsListening(!isListening)} className="h-8 w-8 p-0">
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <input ref={fileInputRef} type="file" multiple onChange={(e) => setAttachedFiles(Array.from(e.target.files || []))} className="hidden" accept="*/*" />
      </div>
    </div>
  )
}