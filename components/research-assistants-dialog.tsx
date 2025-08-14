"use client"
import AddAssistantDialog from "@/components/AddAssistantDialog"
import { useState } from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Users,
  BookCopy,
  Database,
  Quote,
  BarChart3,
  ShieldCheck,
  Award,
  Languages,
  Globe,
  Download,
  Brain,
  Search,
  Network,
  Zap,
  FileText,
  BarChart,
  Eye,
  BookOpen,
  Users2,
  Plus,
} from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { ViewType } from "@/app/page"

const researchAssistants = [
  {
    id: "experts",
    name: "Chuyên gia",
    Icon: Users,
    bgColor: "bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "conferences",
    name: "Hội thảo, Tạp chí",
    Icon: BookCopy,
    bgColor: "bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "neu-data",
    name: "Dữ liệu NEU",
    Icon: Database,
    bgColor: "bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  {
    id: "citation",
    name: "Soạn thảo & Trích dẫn",
    Icon: Quote,
    bgColor: "bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    id: "statistics",
    name: "Thống kê & Phân tích",
    Icon: BarChart3,
    bgColor: "bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "plagiarism",
    name: "Kiểm tra Đạo văn",
    Icon: ShieldCheck,
    bgColor: "bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  {
    id: "grants",
    name: "Xin tài trợ & Quỹ",
    Icon: Award,
    bgColor: "bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30",
    iconColor: "text-yellow-600 dark:text-yellow-400",
  },
  {
    id: "translation",
    name: "Dịch thuật Học thuật",
    Icon: Languages,
    bgColor: "bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900/30 dark:to-teal-800/30",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
]

interface ResearchAssistantsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  setActiveView: Dispatch<SetStateAction<ViewType>>
}

export function ResearchAssistantsDialog({ isOpen, onOpenChange, setActiveView }: ResearchAssistantsDialogProps) {
  const [addOpen, setAddOpen] = useState(false)
  const handleAssistantClick = (view: ViewType) => {
    setActiveView(view)
    onOpenChange(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Trợ lý và công cụ nghiên cứu
          </DialogTitle>

        </DialogHeader>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4 py-6">
          {researchAssistants.map((assistant) => (
            <Button
              key={assistant.id}
              variant="outline"
              className="h-32 flex flex-col items-center justify-center gap-3 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
              onClick={() => handleAssistantClick(assistant.id as ViewType)}
            >
              <div className={`w-14 h-14 rounded-xl ${assistant.bgColor} flex items-center justify-center shadow-sm`}>
                <assistant.Icon className={`h-7 w-7 ${assistant.iconColor}`} />
              </div>
              <span className="text-sm font-medium leading-tight text-gray-700 dark:text-gray-300">
                {assistant.name}
              </span>
            </Button>
          ))}
          <Button
            variant="outline"
            className="h-32 flex flex-col items-center justify-center gap-3 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
            onClick={() => setAddOpen(true)}
          >
            <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm">
              <Plus className="h-7 w-7 text-gray-500 dark:text-gray-400" />
            </div>
            <span className="text-sm font-medium leading-tight text-gray-700 dark:text-gray-300">Thêm trợ lý</span>
          </Button>
        </div>

        {/* Online Research Tools */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            Công cụ trực tuyến
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { name: "Scite.ai", description: "Phân tích trích dẫn thông minh", url: "https://scite.ai", icon: Brain },
              {
                name: "Research Rabbit",
                description: "Khám phá tài liệu nghiên cứu",
                url: "https://researchrabbit.ai",
                icon: Search,
              },
              {
                name: "Semantic Scholar",
                description: "Tìm kiếm bài báo khoa học",
                url: "https://semanticscholar.org",
                icon: BookOpen,
              },
              {
                name: "Connected Papers",
                description: "Trực quan hóa mạng lưới nghiên cứu",
                url: "https://connectedpapers.com",
                icon: Network,
              },
              { name: "Elicit", description: "Trợ lý AI cho nghiên cứu", url: "https://elicit.org", icon: Zap },
            ].map((tool) => (
              <Button
                key={tool.name}
                variant="outline"
                className="h-auto text-left justify-start bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 p-3 rounded-lg"
                onClick={() => window.open(tool.url, "_blank")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                    <tool.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Downloadable Tools */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <Download className="w-5 h-5 mr-2" />
            Phần mềm tải về
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {[
              {
                name: "EndNote",
                description: "Quản lý tài liệu tham khảo",
                url: "https://endnote.com",
                icon: FileText,
              },
              {
                name: "NVivo",
                description: "Phân tích dữ liệu định tính",
                url: "https://lumivero.com/products/nvivo/",
                icon: BarChart,
              },
              {
                name: "VOSviewer",
                description: "Trực quan hóa mạng lưới khoa học",
                url: "https://vosviewer.com",
                icon: Eye,
              },
              { name: "Zotero", description: "Quản lý tài liệu miễn phí", url: "https://zotero.org", icon: BookOpen },
              { name: "Mendeley", description: "Mạng xã hội nghiên cứu", url: "https://mendeley.com", icon: Users2 },
            ].map((tool) => (
              <Button
                key={tool.name}
                variant="outline"
                className="h-auto text-left justify-start bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 p-3 rounded-lg"
                onClick={() => window.open(tool.url, "_blank")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
                    <tool.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
      {/* Dialog thêm trợ lý */}
      <AddAssistantDialog open={addOpen} onOpenChange={setAddOpen} />

    </Dialog>
  )
}
