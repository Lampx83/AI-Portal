"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  FolderKanban,
  MessageSquare,
  PlusCircle,
  Users,
  BookCopy,
  Database,
  ChevronDown,
  Quote,
  BarChart3,
  ShieldCheck,
  Award,
  Languages,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Bot,
  History,
  Edit,
  MoreHorizontal,
  Share,
  FileText
} from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { Research } from "@/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"


import type { AgentMetadata } from "@/lib/agent-types"

export interface ResearchAssistant extends AgentMetadata {
  alias: string
  Icon: any
  bgColor: string
  iconColor: string
}

export const researchAssistants: ResearchAssistant[] = [
  {
    alias: "document-assistant-demo",
    name: "Document Assistant Demo",
    description: "Tìm kiếm và tóm tắt tài liệu demo",
    version: "1.2.0",
    developer: "Nhóm Demo",
    capabilities: ["search", "summarize", "explain"],
    supported_models: [
      {
        model_id: "demo-model",
        name: "Demo Model",
        description: "Mô hình demo trả kết quả giả lập",
      },
    ],
    sample_prompts: [
      "Tóm tắt tài liệu về AI",
      "Giải thích khái niệm machine learning",
    ],
    provided_data_types: [
      {
        type: "documents",
        description: "Danh sách tài liệu demo",
      },
    ],
    contact: "demo@example.com",
    status: "active",
    Icon: FileText,
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    iconColor: "text-cyan-600 dark:text-cyan-400",
    baseUrl: "http://localhost:3000/api/demo_agent/v1"
  },
  {
    alias: "experts",
    name: "Nhà nghiên cứu",
    description: "Tìm kiếm, giới thiệu và kết nối với các nhà nghiên cứu phù hợp.",
    version: "1.0.0",
    supported_models: [
      { model_id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { model_id: "gpt-4o", name: "GPT-4o" },
    ],
    provided_data_types: [
      { type: "experts", description: "Danh sách chuyên gia, hồ sơ và lĩnh vực nghiên cứu." },
    ],
    sample_prompts: [
      "Liệt kê các chuyên gia nghiên cứu về kinh tế Việt Nam",
      "Tìm nhà khoa học chuyên về trí tuệ nhân tạo tại NEU",
    ],
    capabilities: ["search", "recommendation"],
    Icon: Users,
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    baseUrl: "http://localhost:3000/api/demo_agent/v1"
  },
  {
    alias: "conferences",
    name: "Hội thảo, Tạp chí",
    description: "Cung cấp thông tin hội thảo, tạp chí khoa học và các sự kiện học thuật.",
    version: "1.0.0",
    supported_models: [
      { model_id: "gpt-4o", name: "GPT-4o" },
    ],
    provided_data_types: [
      { type: "conferences", description: "Danh sách hội thảo, tạp chí và sự kiện học thuật." },
    ],
    sample_prompts: [
      "Tìm hội thảo quốc tế về kinh tế năm 2025",
      "Liệt kê các tạp chí Q1 trong lĩnh vực CNTT",
    ],
    capabilities: ["search", "filter", "sort"],
    Icon: BookCopy,
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    alias: "neu-data",
    name: "Dữ liệu NEU",
    description: "Truy xuất dữ liệu nghiên cứu, thống kê và các nguồn dữ liệu nội bộ của NEU.",
    version: "1.0.0",
    supported_models: [
      { model_id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
    provided_data_types: [
      { type: "datasets", description: "Các bộ dữ liệu nội bộ từ NEU." },
    ],
    sample_prompts: [
      "Liệt kê các bộ dữ liệu về kinh tế vĩ mô của NEU",
      "Tìm dữ liệu khảo sát sinh viên năm 2023",
    ],
    capabilities: ["data-query", "analysis"],
    Icon: Database,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  {
    alias: "citation",
    name: "Soạn thảo & Trích dẫn",
    description: "Hỗ trợ soạn thảo văn bản học thuật và quản lý trích dẫn.",
    version: "1.0.0",
    supported_models: [
      { model_id: "gpt-4o", name: "GPT-4o" },
    ],
    provided_data_types: [
      { type: "citations", description: "Quản lý và tạo trích dẫn học thuật." },
    ],
    sample_prompts: [
      "Tạo trích dẫn APA cho tài liệu này",
      "Viết phần tổng quan tài liệu cho chủ đề X",
    ],
    capabilities: ["writing", "citation-format"],
    Icon: Quote,
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    alias: "statistics",
    name: "Thống kê & Phân tích",
    description: "Hỗ trợ phân tích dữ liệu và thống kê cho nghiên cứu.",
    version: "1.0.0",
    supported_models: [
      { model_id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
    provided_data_types: [
      { type: "statistics", description: "Kết quả phân tích dữ liệu thống kê." },
    ],
    sample_prompts: [
      "Phân tích hồi quy tuyến tính cho bộ dữ liệu này",
      "Tính hệ số tương quan Pearson",
    ],
    capabilities: ["analysis", "visualization"],
    Icon: BarChart3,
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    alias: "plagiarism",
    name: "Kiểm tra Đạo văn",
    description: "Phát hiện và báo cáo các nội dung trùng lặp hoặc đạo văn.",
    version: "1.0.0",
    supported_models: [
      { model_id: "plagiarism-checker-v1", name: "Plagiarism Checker" },
    ],
    provided_data_types: [
      { type: "plagiarism-reports", description: "Báo cáo đạo văn chi tiết." },
    ],
    sample_prompts: [
      "Kiểm tra đạo văn cho đoạn văn này",
      "So sánh nội dung với các nguồn mở",
    ],
    capabilities: ["plagiarism-detection"],
    Icon: ShieldCheck,
    bgColor: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  {
    alias: "grants",
    name: "Xin tài trợ & Quỹ",
    description: "Tìm kiếm và hỗ trợ viết hồ sơ xin tài trợ nghiên cứu.",
    version: "1.0.0",
    supported_models: [
      { model_id: "gpt-4o", name: "GPT-4o" },
    ],
    provided_data_types: [
      { type: "grants", description: "Danh sách các quỹ và chương trình tài trợ." },
    ],
    sample_prompts: [
      "Tìm quỹ tài trợ nghiên cứu AI",
      "Tạo đề xuất xin tài trợ cho dự án Y",
    ],
    capabilities: ["search", "proposal-writing"],
    Icon: Award,
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    iconColor: "text-yellow-600 dark:text-yellow-400",
  },
  {
    alias: "translation",
    name: "Dịch thuật Học thuật",
    description: "Dịch và hiệu đính tài liệu học thuật.",
    version: "1.0.0",
    supported_models: [
      { model_id: "gpt-4o", name: "GPT-4o" },
    ],
    provided_data_types: [
      { type: "translations", description: "Bản dịch học thuật." },
    ],
    sample_prompts: [
      "Dịch đoạn văn này sang tiếng Anh học thuật",
      "Hiệu đính bài báo khoa học bằng tiếng Anh",
    ],
    capabilities: ["translation", "proofreading"],
    Icon: Languages,
    bgColor: "bg-teal-100 dark:bg-teal-900/30",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
]


const myResearchData: Research[] = [
  { id: 1, name: "Dự án Kinh tế Vĩ mô Q3" },
  { id: 2, name: "Phân tích thị trường BĐS" },
  { id: 3, name: "Nghiên cứu lạm phát Việt Nam" },
  { id: 4, name: "Tác động FDI đến tăng trưởng" },
  { id: 5, name: "Chính sách tiền tệ 2024" },
]

const initialChatHistory = [
  { id: 1, title: "So sánh lạm phát 2022-2023" },
  { id: 2, title: "Các mô hình kinh tế lượng" },
  { id: 3, title: "Tác động của FDI đến việc làm" },
  { id: 4, title: "Phân tích chuỗi cung ứng" },
]

interface SidebarProps {
  setActiveView: (view: string) => void
  setActiveResearch: Dispatch<SetStateAction<Research | null>>
  onAddResearchClick: () => void
  onSeeMoreClick: () => void
  onEditResearchClick: (research: Research) => void
  onViewChatHistoryClick: (research: Research) => void
  onNewChatClick: () => void
}

export function Sidebar({
  setActiveView,
  setActiveResearch,
  onAddResearchClick,
  onSeeMoreClick,
  onEditResearchClick,
  onViewChatHistoryClick,
  onNewChatClick,
}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chatHistory, setChatHistory] = useState(initialChatHistory)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const assistantsToShow = researchAssistants.slice(0, 3)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [showAllResearch, setShowAllResearch] = useState(false)

  const researchToShow = showAllResearch ? myResearchData : myResearchData.slice(0, 3)

  const handleDeleteHistoryItem = (id: number) => {
    setChatHistory((prev) => prev.filter((item) => item.id !== id))
  }

  const handleClearHistory = () => {
    setChatHistory([])
  }

  const historyToShow = showAllHistory ? chatHistory : chatHistory.slice(0, 3)

  const handleAssistantClick = (assistantId: string) => {
    router.push(`/assistants/${assistantId}`)
  }

  const handleResearchClick = (research: Research) => {
    setActiveResearch(research)
    router.push(`/research/${research.id}`)
  }

  const isActiveRoute = (route: string) => {
    return pathname === route || pathname.startsWith(route)
  }

  return (
    <aside
      className={`${isCollapsed ? "w-20" : "w-[300px]"
        } bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 flex flex-col h-full border-r border-gray-200 dark:border-gray-800 transition-all duration-300 py-4 px-2.5`}
    >
      {!isCollapsed ? (
        <>
          <div className="mb-6 relative flex justify-center items-center h-10">
            <Button
              className="justify-center bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={() => router.push("/")}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Trò chuyện mới
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 h-10 w-10 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto -mx-2 space-y-6">
            {/* Trợ lý nghiên cứu */}
            <div className="px-2">
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50 shadow-sm">
                <h3 className="mb-3 text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center">
                  <Bot className="w-4 h-4 mr-2" />
                  Trợ lý và công cụ
                </h3>
                <ul className="space-y-2">
                  {assistantsToShow.map((assistant) => (
                    <li key={assistant.alias}>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start font-normal h-12 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg ${isActiveRoute(`/assistants/${assistant.id}`) ? "bg-white/80 dark:bg-gray-800/80" : ""
                          }`}
                        onClick={() => handleAssistantClick(assistant.alias)}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${assistant.bgColor} shadow-sm`}
                        >
                          <assistant.Icon className={`h-5 w-5 ${assistant.iconColor}`} />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{assistant.name}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="ghost"
                  className="w-full justify-center font-normal text-sm text-blue-600 dark:text-blue-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                  onClick={onSeeMoreClick}
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Xem thêm
                </Button>
              </div>
            </div>

            {/* Nghiên cứu của tôi */}
            <div className="px-2">
              <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/30 dark:to-teal-950/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center">
                    <FolderKanban className="w-4 h-4 mr-2" />
                    Nghiên cứu của tôi
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg"
                    onClick={onAddResearchClick}
                  >
                    <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </Button>
                </div>
                <ul className="space-y-1">
                  {researchToShow.map((research) => (
                    <li key={research.id} className="group relative">
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          className={`flex-1 justify-start text-sm font-normal h-9 truncate hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg pr-8 ${isActiveRoute(`/research/${research.id}`) ? "bg-white/80 dark:bg-gray-800/80" : ""
                            }`}
                          onClick={() => handleResearchClick(research)}
                        >
                          <FolderKanban className="h-4 w-4 mr-2 text-emerald-500 dark:text-emerald-400" />
                          <span className="text-gray-700 dark:text-gray-300 truncate pr-2">{research.name}</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 absolute right-1 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/80 dark:hover:bg-gray-700/80"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditResearchClick(research)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onViewChatHistoryClick(research)}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Xem chat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  ))}
                </ul>
                {myResearchData.length > 3 && (
                  <Button
                    variant="ghost"
                    className="w-full justify-center text-sm text-emerald-600 dark:text-emerald-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                    onClick={() => setShowAllResearch(!showAllResearch)}
                  >
                    <ChevronDown
                      className={`h-4 w-4 mr-2 transition-transform ${showAllResearch ? "rotate-180" : ""}`}
                    />
                    Xem thêm
                  </Button>
                )}
              </div>
            </div>

            {/* Lịch sử chat */}
            <div className="px-2">
              <div className="bg-gradient-to-br from-gray-100 via-slate-100 to-gray-200 dark:from-gray-800/50 dark:via-slate-800/50 dark:to-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
                    <History className="w-4 h-4 mr-2" />
                    Lịch sử chat
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 rounded-lg"
                    onClick={handleClearHistory}
                    title="Xóa toàn bộ lịch sử"
                  >
                    <Trash2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </Button>
                </div>
                <ul className="space-y-1">
                  {historyToShow.map((chat) => (
                    <li key={chat.id} className="group relative">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm font-normal h-9 hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 rounded-lg"
                      >
                        <MessageSquare className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300 truncate">{chat.title}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/80 dark:hover:bg-gray-600/80 rounded flex-shrink-0"
                            >
                              <MoreHorizontal className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Đổi tên
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Share className="mr-2 h-4 w-4" />
                              Chia sẻ
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteHistoryItem(chat.id)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Button>
                    </li>
                  ))}
                </ul>
                {chatHistory.length > 3 && (
                  <Button
                    variant="ghost"
                    className="w-full justify-center text-sm text-gray-500 dark:text-gray-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200"
                    onClick={() => setShowAllHistory(!showAllHistory)}
                  >
                    <ChevronDown
                      className={`h-4 w-4 mr-2 transition-transform ${showAllHistory ? "rotate-180" : ""}`}
                    />
                    Xem thêm
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Collapsed View */
        <div className="flex flex-col items-center space-y-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg"
            onClick={() => router.push("/")}
            title="Trò chuyện mới"
          >
            <PlusCircle className="h-5 w-5" />
          </Button>

          {/* Collapsed Assistant Icons */}
          <div className="flex flex-col items-center space-y-2">
            {assistantsToShow.map((assistant) => (
              <Button
                key={assistant.id}
                variant="ghost"
                size="icon"
                className={`h-10 w-10 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg ${isActiveRoute(`/assistants/${assistant.id}`) ? "bg-gray-200 dark:bg-gray-800" : ""
                  }`}
                onClick={() => handleAssistantClick(assistant.id)}
                title={assistant.name}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center ${assistant.bgColor}`}>
                  <assistant.Icon className={`h-4 w-4 ${assistant.iconColor}`} />
                </div>
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg"
              onClick={onSeeMoreClick}
              title="Xem thêm trợ lý"
            >
              <ChevronDown className="h-3 w-3 text-gray-500" />
            </Button>
          </div>
        </div>
      )}
    </aside>
  )
}
