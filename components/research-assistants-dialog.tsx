"use client"

import type React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Users,
  BookCopy,
  Database,
  Quote,
  BarChart3,
  ShieldCheck,
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
  Bot,
  Info,
  Activity,
  DatabaseZap,
  Share2,
  Lock,
  Laptop,
} from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { ViewType } from "@/app/page"

const initialResearchAssistants = [
  {
    id: "experts",
    name: "Chuyên gia",
    Icon: Users,
    bgColor: "bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "conferences",
    name: "Hội thảo, Tạp chí & Quỹ",
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
    id: "translation",
    name: "Dịch thuật Học thuật",
    Icon: Languages,
    bgColor: "bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900/30 dark:to-teal-800/30",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
]

const initialAgentState = {
  name: "",
  ipOrId: "",
  status: "active",
  processingPower: "",
  existingData: "",
  knowledge: "",
  protocol: "FIPA-ACL",
  services: "",
  accessRights: "",
  security: "",
  environment: "",
}

interface ResearchAssistantsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  setActiveView: Dispatch<SetStateAction<ViewType>>
}

export function ResearchAssistantsDialog({ isOpen, onOpenChange, setActiveView }: ResearchAssistantsDialogProps) {
  const [assistants, setAssistants] = useState(initialResearchAssistants)
  const [isAddAgentDialogOpen, setAddAgentDialogOpen] = useState(false)
  const [newAgentData, setNewAgentData] = useState(initialAgentState)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setNewAgentData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSelectChange = (id: string, value: string) => {
    setNewAgentData((prev) => ({ ...prev, [id]: value }))
  }

  const handleAssistantClick = (view: ViewType) => {
    setActiveView(view)
    onOpenChange(false)
  }

  const handleAddAgent = () => {
    if (!newAgentData.name.trim()) return

    const newAgent = {
      id: newAgentData.name.toLowerCase().replace(/\s+/g, "-") + `-${Date.now()}`,
      name: newAgentData.name,
      Icon: Bot,
      bgColor: "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900/30 dark:to-gray-800/30",
      iconColor: "text-gray-600 dark:text-gray-400",
    }

    setAssistants((prev) => [...prev, newAgent])
    setNewAgentData(initialAgentState)
    setAddAgentDialogOpen(false)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Tất cả trợ lý nghiên cứu
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Chọn một trợ lý chuyên môn hoặc tạo một trợ lý mới để bắt đầu.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 py-6">
            {assistants.map((assistant) => (
              <Button
                key={assistant.id}
                variant="outline"
                className="h-28 flex flex-col items-center justify-center gap-2 text-center p-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
                onClick={() => handleAssistantClick(assistant.id as ViewType)}
              >
                <div className={`w-12 h-12 rounded-xl ${assistant.bgColor} flex items-center justify-center shadow-sm`}>
                  <assistant.Icon className={`h-6 w-6 ${assistant.iconColor}`} />
                </div>
                <span className="text-sm font-medium leading-tight text-gray-700 dark:text-gray-300">
                  {assistant.name}
                </span>
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-28 flex flex-col items-center justify-center gap-2 text-center p-3 border-dashed bg-transparent hover:bg-gray-100/80 dark:bg-transparent dark:hover:bg-gray-800/80"
              onClick={() => setAddAgentDialogOpen(true)}
            >
              <Plus className="h-8 w-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-500">Thêm mới</span>
            </Button>
          </div>

          {/* Online Research Tools */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Globe className="w-5 h-5 mr-2" />
              Công cụ trực tuyến
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6">
              {[
                {
                  name: "Scite.ai",
                  description: "Phân tích trích dẫn thông minh",
                  url: "https://scite.ai",
                  icon: Brain,
                },
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
                  className="h-24 w-28 flex-shrink-0 flex-col justify-center items-center gap-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/80 transition-all duration-200 p-2 rounded-lg"
                  onClick={() => window.open(tool.url, "_blank")}
                  title={tool.description}
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                    <tool.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-center font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
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
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6">
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
                  className="h-24 w-28 flex-shrink-0 flex-col justify-center items-center gap-2 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white/60 dark:hover:bg-gray-800/80 transition-all duration-200 p-2 rounded-lg"
                  onClick={() => window.open(tool.url, "_blank")}
                  title={tool.description}
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
                    <tool.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs text-center font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddAgentDialogOpen} onOpenChange={setAddAgentDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Khai báo Trợ lý AI mới</DialogTitle>
            <DialogDescription>
              Cung cấp thông tin chi tiết để cấu hình và quản lý Agent trong hệ thống.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
            <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Thông tin cơ bản
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Tên của Agent</Label>
                    <Input
                      id="name"
                      value={newAgentData.name}
                      onChange={handleInputChange}
                      placeholder="Để nhận diện và xác định mỗi Agent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ipOrId">Địa chỉ IP hoặc ID duy nhất</Label>
                    <Input
                      id="ipOrId"
                      value={newAgentData.ipOrId}
                      onChange={handleInputChange}
                      placeholder="Để xác định vị trí và định danh của Agent"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Trạng thái và khả năng
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Tình trạng hoạt động</Label>
                    <Select value={newAgentData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Chọn trạng thái" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Đang hoạt động</SelectItem>
                        <SelectItem value="paused">Tạm ngừng</SelectItem>
                        <SelectItem value="inactive">Không hoạt động</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="processingPower">Khả năng xử lý</Label>
                    <Textarea
                      id="processingPower"
                      value={newAgentData.processingPower}
                      onChange={handleInputChange}
                      placeholder="Mô tả tốc độ xử lý, dung lượng lưu trữ, khả năng đáp ứng..."
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <DatabaseZap className="w-4 h-4" />
                    Dữ liệu và tri thức
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="existingData">Dữ liệu hiện có</Label>
                    <Textarea
                      id="existingData"
                      value={newAgentData.existingData}
                      onChange={handleInputChange}
                      placeholder="Các tài nguyên và thông tin Agent đang quản lý hoặc có thể truy cập."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="knowledge">Tri thức và kinh nghiệm</Label>
                    <Textarea
                      id="knowledge"
                      value={newAgentData.knowledge}
                      onChange={handleInputChange}
                      placeholder="Các thông tin đã học hỏi và kinh nghiệm từ các tương tác trước đó."
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Tương tác và giao tiếp
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="protocol">Giao thức giao tiếp</Label>
                    <Input
                      id="protocol"
                      value={newAgentData.protocol}
                      onChange={handleInputChange}
                      placeholder="Ví dụ: FIPA-ACL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="services">Các dịch vụ và khả năng hỗ trợ</Label>
                    <Textarea
                      id="services"
                      value={newAgentData.services}
                      onChange={handleInputChange}
                      placeholder="Các dịch vụ mà Agent có thể cung cấp cho các Agent khác."
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    An ninh và quản lý quyền truy cập
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="accessRights">Quyền truy cập</Label>
                    <Textarea
                      id="accessRights"
                      value={newAgentData.accessRights}
                      onChange={handleInputChange}
                      placeholder="Các quyền và phân quyền để truy cập vào tài nguyên."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security">Cơ chế bảo mật</Label>
                    <Textarea
                      id="security"
                      value={newAgentData.security}
                      onChange={handleInputChange}
                      placeholder="Các biện pháp bảo mật để đảm bảo an toàn."
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4" />
                    Thông tin về môi trường
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="environment">Môi trường hoạt động</Label>
                    <Textarea
                      id="environment"
                      value={newAgentData.environment}
                      onChange={handleInputChange}
                      placeholder="Nền tảng phần cứng, hệ điều hành, mạng lưới..."
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <DialogFooter>
            <Button onClick={handleAddAgent}>Lưu Trợ lý</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
