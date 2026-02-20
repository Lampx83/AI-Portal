"use client"
import AddAssistantDialog from "@/components/add-assistant-dialog"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAssistants } from "@/hooks/use-assistants"
import { useTools } from "@/hooks/use-tools"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Info, Bot } from "lucide-react"
import type { Assistant } from "@/lib/assistants"

const APP_DISPLAY_NAMES: Record<string, string> = { data: "Dữ liệu" }

interface AssistantsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  setActiveView?: (assistantId: string) => void
  /** Show assistants list + Add assistant only (do not show Apps) */
  assistantsOnly?: boolean
}

export function AssistantsDialog({ isOpen, onOpenChange, setActiveView, assistantsOnly = true }: AssistantsDialogProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null)
  const { assistants, loading: assistantsLoading } = useAssistants()
  const { tools, loading: toolsLoading } = useTools()
  const loading = assistantsOnly ? assistantsLoading : (assistantsLoading || toolsLoading)

  const handleAssistantClick = (alias: string) => {
    setActiveView?.(alias)
    const sid = crypto.randomUUID()
    router.push(`/assistants/${alias}?sid=${sid}`)
    onOpenChange(false)
  }

  const handleInfoClick = (e: React.MouseEvent, assistant: Assistant) => {
    e.stopPropagation()
    setSelectedAssistant(assistant)
    setInfoDialogOpen(true)
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-brand flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Trợ lý
          </DialogTitle>
          <DialogDescription>
            Chọn một trợ lý để bắt đầu làm việc. Thêm trợ lý mới qua nút bên dưới hoặc tại trang quản trị.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-8">
          {loading ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <Bot className="w-5 h-5 mr-2" />
                Trợ lý AI
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`sk-${i}`} className="h-32 flex flex-col items-center justify-center gap-3 p-4 bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <Skeleton className="w-14 h-14 rounded-xl bg-gray-300 dark:bg-gray-600" />
                    <Skeleton className="h-4 w-20 bg-gray-300 dark:bg-gray-600" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* AI assistants (excluding central, data) */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Bot className="w-5 h-5 mr-2" />
                  Trợ lý AI
                </h3>
                {(() => {
                  const otherAssistants = assistants.filter(
                    (a) => a && !["central", "main", "data"].includes(a.alias)
                  )
                  return (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                      {otherAssistants.map((assistant) => {
                        const isUnhealthy = assistant.health === "unhealthy"
                        return (
                          <div key={assistant.alias} className="relative">
                            <Button
                              variant="outline"
                              disabled={isUnhealthy}
                              className={`h-32 w-full flex flex-col items-center justify-center gap-3 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 rounded-xl shadow-sm relative disabled:opacity-100 ${
                                isUnhealthy ? "cursor-not-allowed" : "hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-md"
                              }`}
                              onClick={() => !isUnhealthy && handleAssistantClick(assistant.alias)}
                            >
                              <div className="relative">
                                <div className={`w-14 h-14 rounded-xl ${assistant.bgColor} flex items-center justify-center shadow-sm ${isUnhealthy ? "opacity-60" : ""}`}>
                                  <assistant.Icon className={`h-7 w-7 ${assistant.iconColor} ${isUnhealthy ? "opacity-60" : ""}`} />
                                </div>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 left-2 h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary z-10"
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
                  )
                })()}
              </div>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>

    <AddAssistantDialog open={addOpen} onOpenChange={setAddOpen} />

    {selectedAssistant && (
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
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

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              {selectedAssistant?.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mô tả</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAssistant.description}</p>
                </div>
              )}

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

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Base URL</h4>
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded break-all">
                  {selectedAssistant?.baseUrl}
                </code>
              </div>

              {selectedAssistant?.capabilities && selectedAssistant.capabilities.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Khả năng</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAssistant.capabilities.map((capability, index) => (
                      <span
                        key={index}
                        className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

              {selectedAssistant?.contact && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Liên hệ</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAssistant.contact}</p>
                </div>
              )}

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
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
