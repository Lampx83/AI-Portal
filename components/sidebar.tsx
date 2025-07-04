"use client"

import { useState } from "react"
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
  Languages,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Bot,
  History,
} from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { ViewType, Research } from "@/app/page"

const researchAssistants = [
  {
    id: "experts",
    name: "Chuyên gia",
    Icon: Users,
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "conferences",
    name: "Hội thảo, Tạp chí & Quỹ",
    Icon: BookCopy,
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "neu-data",
    name: "Dữ liệu NEU",
    Icon: Database,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  {
    id: "citation",
    name: "Soạn thảo & Trích dẫn",
    Icon: Quote,
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    id: "statistics",
    name: "Thống kê & Phân tích",
    Icon: BarChart3,
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "plagiarism",
    name: "Kiểm tra Đạo văn",
    Icon: ShieldCheck,
    bgColor: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  {
    id: "translation",
    name: "Dịch thuật Học thuật",
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
  setActiveView: Dispatch<SetStateAction<ViewType>>
  setActiveResearch: Dispatch<SetStateAction<Research | null>>
  onAddResearchClick: () => void
  onSeeMoreClick: () => void
}

export function Sidebar({ setActiveView, setActiveResearch, onAddResearchClick, onSeeMoreClick }: SidebarProps) {
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

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-[300px]"
      } bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 flex flex-col h-full border-r border-gray-200 dark:border-gray-800 transition-all duration-300`}
    >
      {!isCollapsed ? (
        <>
          <div className="mb-6 relative flex justify-center items-center h-10">
            <Button
              className="justify-center bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={() => setActiveView("chat")}
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
                  Trợ lý nghiên cứu
                </h3>
                <ul className="space-y-2">
                  {assistantsToShow.map((assistant) => (
                    <li key={assistant.id}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start font-normal h-12 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg"
                        onClick={() => setActiveView(assistant.id as ViewType)}
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
                  className="w-full justify-start font-normal text-sm text-blue-600 dark:text-blue-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                  onClick={onSeeMoreClick}
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  {`Xem thêm ${researchAssistants.length - 3} trợ lý`}
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
                    <li key={research.id}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm font-normal h-9 truncate hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg"
                        onClick={() => setActiveResearch(research)}
                      >
                        <FolderKanban className="h-4 w-4 mr-2 text-emerald-500 dark:text-emerald-400" />
                        <span className="text-gray-700 dark:text-gray-300">{research.name}</span>
                      </Button>
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
                    {showAllResearch ? "Thu gọn" : `Xem thêm ${myResearchData.length - 3} nghiên cứu`}
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
                        className="w-full justify-start text-sm font-normal h-9 truncate pr-8 hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 rounded-lg"
                      >
                        <MessageSquare className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">{chat.title}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        onClick={() => handleDeleteHistoryItem(chat.id)}
                        title="Xóa mục này"
                      >
                        <X className="h-4 w-4 text-red-500 dark:text-red-400" />
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
                    {showAllHistory ? "Thu gọn" : `Xem thêm ${chatHistory.length - 3} mục`}
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
            onClick={() => setActiveView("chat")}
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
                className="h-10 w-10 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg"
                onClick={() => setActiveView(assistant.id as ViewType)}
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
