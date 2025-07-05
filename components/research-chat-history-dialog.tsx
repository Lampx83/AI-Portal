"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare, Search, Calendar, Trash2, ExternalLink } from "lucide-react"
import type { Research } from "@/app/page"

interface ChatHistoryItem {
  id: number
  title: string
  date: string
  messageCount: number
  assistant: string
  preview: string
}

interface ResearchChatHistoryDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  research: Research | null
}

export function ResearchChatHistoryDialog({ isOpen, onOpenChange, research }: ResearchChatHistoryDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([
    {
      id: 1,
      title: "Phân tích dữ liệu GDP Việt Nam",
      date: "2024-12-15",
      messageCount: 15,
      assistant: "Thống kê & Phân tích",
      preview: "Tôi cần phân tích xu hướng GDP của Việt Nam trong 5 năm gần đây...",
    },
    {
      id: 2,
      title: "Tìm tài liệu về lạm phát",
      date: "2024-12-14",
      messageCount: 8,
      assistant: "Chuyên gia",
      preview: "Bạn có thể giúp tôi tìm các nghiên cứu về lạm phát ở Việt Nam...",
    },
    {
      id: 3,
      title: "Kiểm tra trích dẫn bài báo",
      date: "2024-12-13",
      messageCount: 12,
      assistant: "Soạn thảo & Trích dẫn",
      preview: "Tôi cần kiểm tra định dạng trích dẫn APA cho bài báo...",
    },
    {
      id: 4,
      title: "Tìm hội thảo về kinh tế vĩ mô",
      date: "2024-12-12",
      messageCount: 6,
      assistant: "Hội thảo & Tạp chí",
      preview: "Có hội thảo nào về kinh tế vĩ mô sắp diễn ra không?",
    },
    {
      id: 5,
      title: "Dịch abstract sang tiếng Anh",
      date: "2024-12-11",
      messageCount: 10,
      assistant: "Dịch thuật Học thuật",
      preview: "Giúp tôi dịch phần tóm tắt này sang tiếng Anh...",
    },
  ])

  const filteredHistory = chatHistory.filter(
    (chat) =>
      chat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.assistant.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const deleteChatHistory = (id: number) => {
    setChatHistory(chatHistory.filter((chat) => chat.id !== id))
  }

  const getAssistantColor = (assistant: string) => {
    const colors = {
      "Chuyên gia": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "Hội thảo & Tạp chí": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      "Dữ liệu NEU": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      "Soạn thảo & Trích dẫn": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      "Thống kê & Phân tích": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
      "Dịch thuật Học thuật": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    }
    return (
      colors[assistant as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
    )
  }

  if (!research) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Lịch sử chat - {research.name}
          </DialogTitle>
          <DialogDescription>Xem lại tất cả các cuộc trò chuyện liên quan đến nghiên cứu này.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tiêu đề hoặc trợ lý..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="px-3 py-1">
            {filteredHistory.length} cuộc trò chuyện
          </Badge>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {filteredHistory.map((chat) => (
              <div
                key={chat.id}
                className="group p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{chat.title}</h3>
                      <Badge className={`text-xs ${getAssistantColor(chat.assistant)}`}>{chat.assistant}</Badge>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{chat.preview}</p>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(chat.date).toLocaleDateString("vi-VN")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>{chat.messageCount} tin nhắn</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Mở cuộc trò chuyện">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => deleteChatHistory(chat.id)}
                      title="Xóa cuộc trò chuyện"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredHistory.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Không tìm thấy cuộc trò chuyện
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm ? "Thử tìm kiếm với từ khóa khác" : "Chưa có cuộc trò chuyện nào cho nghiên cứu này"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
