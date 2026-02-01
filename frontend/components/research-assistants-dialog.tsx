"use client"
import AddAssistantDialog from "@/components/add-assistant-dialog"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useResearchAssistants } from "@/hooks/use-research-assistants"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
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
  Info,
  Play,
  Loader2,
  Copy,
  Check,
} from "lucide-react"
import type { ResearchAssistant } from "@/lib/research-assistants"

interface ResearchAssistantsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function ResearchAssistantsDialog({ isOpen, onOpenChange }: ResearchAssistantsDialogProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [selectedAssistant, setSelectedAssistant] = useState<ResearchAssistant | null>(null)
  const { assistants, loading } = useResearchAssistants()
  
  // Test API states
  const [dataLoading, setDataLoading] = useState(false)
  const [askLoading, setAskLoading] = useState(false)
  const [dataResponse, setDataResponse] = useState<string>("")
  const [askResponse, setAskResponse] = useState<string>("")
  const [dataCurlCommand, setDataCurlCommand] = useState<string>("")
  const [askCurlCommand, setAskCurlCommand] = useState<string>("")
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [dataQuery, setDataQuery] = useState<string>("type=documents")
  const [askPayload, setAskPayload] = useState<string>(JSON.stringify({
    session_id: "test-session",
    model_id: "gpt-4",
    user: "test-user",
    prompt: "Xin chào, bạn có thể giúp tôi không?"
  }, null, 2))

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleAssistantClick = (alias: string) => {
    const sid = crypto.randomUUID()
    router.push(`/assistants/${alias}?sid=${sid}`)
    onOpenChange(false)
  }

  const handleInfoClick = (e: React.MouseEvent, assistant: ResearchAssistant) => {
    e.stopPropagation() // Ngăn không cho trigger onClick của Button
    setSelectedAssistant(assistant)
    setInfoDialogOpen(true)
    // Reset test states khi mở dialog mới
    setDataResponse("")
    setAskResponse("")
    setDataCurlCommand("")
    setAskCurlCommand("")
    setDataQuery("type=documents")
    setAskPayload(JSON.stringify({
      session_id: "test-session",
      model_id: "gpt-4",
      user: "test-user",
      prompt: "Xin chào, bạn có thể giúp tôi không?"
    }, null, 2))
  }

  const generateCurlCommand = (method: "GET" | "POST", url: string, payload?: any): string => {
    if (method === "GET") {
      return `curl -X GET "${url}" \\\n  -H "Content-Type: application/json"`
    } else {
      // Format JSON payload một dòng với spaces để dễ đọc
      const jsonPayload = payload ? JSON.stringify(payload) : "{}"
      // Escape single quotes cho shell (dùng single quotes để wrap JSON)
      const escapedPayload = jsonPayload.replace(/'/g, "'\\''")
      return `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${escapedPayload}'`
    }
  }

  const handleTestData = async () => {
    if (!selectedAssistant) return
    setDataLoading(true)
    setDataResponse("")
    try {
      // Thử cả /data và /v1/data
      const urls = [
        `${selectedAssistant.baseUrl}/data?${dataQuery}`,
        `${selectedAssistant.baseUrl}/v1/data?${dataQuery}`
      ]
      
      // Generate curl command cho URL đầu tiên
      setDataCurlCommand(generateCurlCommand("GET", urls[0]))
      
      let lastError = ""
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          })
          let data
          try {
            data = await res.json()
          } catch {
            data = await res.text()
          }
          setDataResponse(JSON.stringify({
            url,
            status: res.status,
            statusText: res.statusText,
            data
          }, null, 2))
          // Update curl command với URL thành công
          setDataCurlCommand(generateCurlCommand("GET", url))
          setDataLoading(false)
          return
        } catch (err: any) {
          lastError = err.message
        }
      }
      setDataResponse(`Error: ${lastError}`)
    } catch (err: any) {
      setDataResponse(`Error: ${err.message}`)
    } finally {
      setDataLoading(false)
    }
  }

  const handleTestAsk = async () => {
    if (!selectedAssistant) return
    setAskLoading(true)
    setAskResponse("")
    try {
      let payload
      try {
        payload = JSON.parse(askPayload)
      } catch {
        setAskResponse("Error: Invalid JSON payload")
        setAskLoading(false)
        return
      }

      // Thử cả /ask và /v1/ask
      // Nếu baseUrl đã kết thúc bằng /v1, không thêm /v1 nữa
      const baseUrl = selectedAssistant.baseUrl.replace(/\/v1\/?$/, '')
      const urls = [
        `${baseUrl}/v1/ask`,
        `${baseUrl}/ask`
      ]
      
      // Generate curl command cho URL đầu tiên
      setAskCurlCommand(generateCurlCommand("POST", urls[0], payload))
      
      let lastError: any = null
      let lastResponse: Response | null = null
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          
          let data
          try {
            data = await res.json()
          } catch {
            data = await res.text()
          }
          
          // Nếu status không OK, vẫn hiển thị response để debug
          if (!res.ok) {
            lastError = {
              url,
              status: res.status,
              statusText: res.statusText,
              data
            }
            lastResponse = res
            // Tiếp tục thử URL tiếp theo
            continue
          }
          
          // Thành công
          setAskResponse(JSON.stringify({
            url,
            status: res.status,
            statusText: res.statusText,
            data
          }, null, 2))
          // Update curl command với URL thành công
          setAskCurlCommand(generateCurlCommand("POST", url, payload))
          setAskLoading(false)
          return
        } catch (err: any) {
          lastError = {
            url,
            error: err.message
          }
        }
      }
      
      // Nếu tất cả đều fail, hiển thị lỗi chi tiết
      if (lastError) {
        setAskResponse(JSON.stringify({
          error: "Tất cả các endpoint đều thất bại",
          lastAttempt: lastError,
          payload: payload
        }, null, 2))
      } else {
        setAskResponse(`Error: Không thể kết nối đến API`)
      }
    } catch (err: any) {
      setAskResponse(`Error: ${err.message}`)
    } finally {
      setAskLoading(false)
    }
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Trợ lý và công cụ nghiên cứu
          </DialogTitle>
          <DialogDescription>
            Chọn một trợ lý để bắt đầu làm việc
          </DialogDescription>
        </DialogHeader>
        
        {/* Danh sách tất cả các trợ lý */}
        <div className="py-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            Trợ lý AI
          </h3>
          {loading ? (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="h-32 flex flex-col items-center justify-center gap-3 p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                  <Skeleton className="w-14 h-14 rounded-xl bg-gray-300 dark:bg-gray-600" />
                  <Skeleton className="h-4 w-20 bg-gray-300 dark:bg-gray-600" />
                </div>
              ))}
            </div>
          ) : assistants.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Không có trợ lý nào</div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {assistants
                .filter((assistant) => assistant && assistant.alias !== "main") // Lọc bỏ trợ lý main
                .map((assistant) => {
                  const isUnhealthy = assistant.health === "unhealthy"
                  return (
                    <div key={assistant.alias} className="relative">
                      <Button
                        variant="outline"
                        disabled={isUnhealthy}
                        className={`h-32 w-full flex flex-col items-center justify-center gap-3 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 rounded-xl shadow-sm relative disabled:opacity-100 ${
                          isUnhealthy
                            ? "cursor-not-allowed"
                            : "hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-md"
                        }`}
                        onClick={() => !isUnhealthy && handleAssistantClick(assistant.alias)}
                      >
                        <div className="relative">
                          <div className={`w-14 h-14 rounded-xl ${assistant.bgColor} flex items-center justify-center shadow-sm ${isUnhealthy ? "opacity-60" : ""}`}>
                            <assistant.Icon className={`h-7 w-7 ${assistant.iconColor} ${isUnhealthy ? "opacity-60" : ""}`} />
                          </div>
                          {/* Health indicator */}
                          <div
                            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                              assistant.health === "healthy" ? "bg-green-500" : "bg-red-500"
                            }`}
                            title={assistant.health === "healthy" ? "Trợ lý hoạt động bình thường" : "Trợ lý không khả dụng"}
                          />
                        </div>
                        <span className={`text-sm font-medium leading-tight ${isUnhealthy ? "text-gray-400 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"}`}>
                          {assistant.name}
                        </span>
                      </Button>
                      {/* Info icon */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 left-2 h-6 w-6 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 z-10"
                        onClick={(e) => handleInfoClick(e, assistant)}
                        title="Xem thông tin chi tiết"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
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
          )}
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
    </Dialog>

    {/* Dialog thêm trợ lý */}
    <AddAssistantDialog open={addOpen} onOpenChange={setAddOpen} />

    {/* Dialog thông tin chi tiết trợ lý */}
    {selectedAssistant && (
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
          <DialogContent className="sm:max-w-3xl h-screen max-h-screen flex flex-col m-0 rounded-none !translate-x-[-50%] !translate-y-[-50%] !top-[50%] !left-[50%] !w-screen !max-w-screen p-0">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${selectedAssistant.bgColor} flex items-center justify-center`}>
                  <selectedAssistant.Icon className={`h-6 w-6 ${selectedAssistant.iconColor}`} />
                </div>
                <div>
                  <div className="text-xl font-bold">{selectedAssistant.name}</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {selectedAssistant.alias}
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden min-h-0 px-6 pb-6 h-full">
              <TabsList className="grid w-full grid-cols-3 shrink-0 mb-4">
                <TabsTrigger value="info">Thông tin</TabsTrigger>
                <TabsTrigger value="test-data">Test API Data</TabsTrigger>
                <TabsTrigger value="test-ask">Test API Ask</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="!mt-0 min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:overflow-y-auto">
                <div className="space-y-4 h-full">
              {/* Description */}
              {selectedAssistant?.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mô tả</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAssistant.description}</p>
                </div>
              )}

              {/* Version & Developer */}
              <div className="grid grid-cols-2 gap-4">
                {selectedAssistant?.version && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Phiên bản</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAssistant.version}</p>
                  </div>
                )}
                {selectedAssistant?.developer && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nhà phát triển</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAssistant.developer}</p>
                  </div>
                )}
              </div>

              {/* Base URL */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Base URL</h4>
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded break-all">
                  {selectedAssistant?.baseUrl}
                </code>
              </div>

              {/* Capabilities */}
              {selectedAssistant?.capabilities && selectedAssistant.capabilities.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Khả năng</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAssistant.capabilities.map((capability, index) => (
                      <span
                        key={index}
                        className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Supported Models */}
              {selectedAssistant?.supported_models && selectedAssistant.supported_models.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mô hình hỗ trợ</h4>
                  <div className="space-y-2">
                    {selectedAssistant.supported_models.map((model, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{model.name}</div>
                        {model.model_id && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            ID: <code>{model.model_id}</code>
                          </div>
                        )}
                        {model.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{model.description}</div>
                        )}
                        {model.accepted_file_types && model.accepted_file_types.length > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Loại file: {model.accepted_file_types.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Prompts */}
              {selectedAssistant?.sample_prompts && selectedAssistant.sample_prompts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ví dụ câu hỏi</h4>
                  <ul className="space-y-1">
                    {selectedAssistant.sample_prompts.map((prompt, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                        • {prompt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Provided Data Types */}
              {selectedAssistant?.provided_data_types && selectedAssistant.provided_data_types.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Loại dữ liệu cung cấp</h4>
                  <div className="space-y-1">
                    {selectedAssistant.provided_data_types.map((dataType, index) => (
                      <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                        • {dataType.type}
                        {dataType.description && (
                          <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">
                            ({dataType.description})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact */}
              {selectedAssistant?.contact && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Liên hệ</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAssistant.contact}</p>
                </div>
              )}

              {/* Status */}
              {selectedAssistant?.status && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Trạng thái</h4>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      selectedAssistant.status === "active"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {selectedAssistant.status === "active" ? "Đang hoạt động" : "Không hoạt động"}
                  </span>
                </div>
              )}

              {/* Health Status */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tình trạng sức khỏe</h4>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    selectedAssistant?.health === "healthy"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  }`}
                >
                  {selectedAssistant?.health === "healthy" ? "Khỏe mạnh" : "Không khả dụng"}
                </span>
              </div>
                </div>
              </TabsContent>

              <TabsContent value="test-data" className="!mt-0 min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:overflow-hidden">
                <div className="space-y-4 flex-1 flex flex-col min-h-0 h-full">
                  <div>
                    <Label htmlFor="data-query">Query Parameters</Label>
                    <Input
                      id="data-query"
                      value={dataQuery}
                      onChange={(e) => setDataQuery(e.target.value)}
                      placeholder="type=documents&limit=10"
                      className="mt-1 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ví dụ: type=documents, type=experts, type=review
                    </p>
                  </div>
                  <Button
                    onClick={handleTestData}
                    disabled={dataLoading}
                    className="w-full"
                  >
                    {dataLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang gọi API...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Gọi API Data
                      </>
                    )}
                  </Button>
                  {dataCurlCommand && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Curl Command</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(dataCurlCommand, "data-curl")}
                        >
                          {copiedField === "data-curl" ? (
                            <Check className="w-3 h-3 mr-1 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 mr-1" />
                          )}
                          Copy
                        </Button>
                      </div>
                      <Textarea
                        value={dataCurlCommand}
                        readOnly
                        className="font-mono text-xs min-h-[80px]"
                      />
                    </div>
                  )}
                  {dataResponse && (
                    <div className="flex-1 flex flex-col min-h-0">
                      <Label>Response</Label>
                      <Textarea
                        value={dataResponse}
                        readOnly
                        className="flex-1 mt-1 font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="test-ask" className="!mt-0 min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:overflow-hidden">
                <div className="space-y-4 flex-1 flex flex-col min-h-0 h-full">
                  <div className="flex flex-col shrink-0">
                    <Label htmlFor="ask-payload">Request Payload (JSON)</Label>
                    <Textarea
                      id="ask-payload"
                      value={askPayload}
                      onChange={(e) => setAskPayload(e.target.value)}
                      className="mt-1 font-mono text-xs min-h-[150px] max-h-[200px]"
                      placeholder='{"session_id": "test", "model_id": "gpt-4", "prompt": "..."}'
                    />
                  </div>
                  <Button
                    onClick={handleTestAsk}
                    disabled={askLoading}
                    className="w-full"
                  >
                    {askLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang gọi API...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Gọi API Ask
                      </>
                    )}
                  </Button>
                  {askCurlCommand && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Curl Command</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(askCurlCommand, "ask-curl")}
                        >
                          {copiedField === "ask-curl" ? (
                            <Check className="w-3 h-3 mr-1 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 mr-1" />
                          )}
                          Copy
                        </Button>
                      </div>
                      <Textarea
                        value={askCurlCommand}
                        readOnly
                        className="font-mono text-xs min-h-[100px]"
                      />
                    </div>
                  )}
                  {askResponse && (
                    <div className="flex-1 flex flex-col min-h-0">
                      <Label>Response</Label>
                      <Textarea
                        value={askResponse}
                        readOnly
                        className="flex-1 mt-1 font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}