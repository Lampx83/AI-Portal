"use client"
import AddAssistantDialog from "@/components/add-assistant-dialog"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAssistants } from "@/hooks/use-assistants"
import { useTools } from "@/hooks/use-tools"
import { usePinnedAssistants } from "@/hooks/use-pinned-assistants"
import { useAssistantsDisplayOrder, setAssistantsDisplayOrder } from "@/hooks/use-assistants-display-order"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { safeRandomUUID } from "@/lib/crypto-polyfill"
import { addStoredPinnedAssistant, removeStoredPinnedAssistant, MAX_PINNED_ASSISTANTS } from "@/lib/pinned-assistants-storage"
import { reorderAssistantInStorage, insertAssistantAt } from "@/lib/assistants-display-order-storage"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Info, Bot, Pin, PinOff, MoreVertical, GripVertical } from "lucide-react"
import type { Assistant } from "@/lib/assistants"

const APP_DISPLAY_NAMES: Record<string, string> = {}

interface AssistantsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  setActiveView?: (assistantId: string) => void
  /** Show assistants list + Add assistant only (do not show Apps) */
  assistantsOnly?: boolean
}

export function AssistantsDialog({ isOpen, onOpenChange, setActiveView, assistantsOnly = true }: AssistantsDialogProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null)
  const { assistants, loading: assistantsLoading } = useAssistants()
  const { tools, loading: toolsLoading } = useTools()
  const userPinnedAliases = usePinnedAssistants().userPinnedAliases
  const userPinnedSet = new Set(userPinnedAliases.map((a) => a.toLowerCase()))
  const canPinMore = userPinnedAliases.length < MAX_PINNED_ASSISTANTS
  const loading = assistantsOnly ? assistantsLoading : (assistantsLoading || toolsLoading)
  const displayOrder = useAssistantsDisplayOrder()
  const [draggedAlias, setDraggedAlias] = useState<string | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)

  const otherAssistants = useMemo(
    () => assistants.filter((a) => a && !["central", "main"].includes(a.alias)),
    [assistants]
  )

  const effectiveOrder = useMemo(() => {
    const orderSet = new Set(displayOrder)
    if (displayOrder.length === 0) return otherAssistants.map((a) => a.alias.trim().toLowerCase())
    const rest = otherAssistants
      .filter((a) => !orderSet.has(a.alias.trim().toLowerCase()))
      .map((a) => a.alias.trim().toLowerCase())
    return [...displayOrder, ...rest]
  }, [displayOrder, otherAssistants])

  const orderedAssistants = useMemo(() => {
    const orderMap = new Map(effectiveOrder.map((a, i) => [a, i]))
    return otherAssistants.slice().sort((a, b) => {
      const i = orderMap.get(a.alias.trim().toLowerCase()) ?? 1e9
      const j = orderMap.get(b.alias.trim().toLowerCase()) ?? 1e9
      return i - j
    })
  }, [otherAssistants, effectiveOrder])

  const handleAssistantClick = (alias: string) => {
    setActiveView?.(alias)
    const sid = safeRandomUUID()
    router.push(`/assistants/${alias}?sid=${sid}`)
    onOpenChange(false)
  }

  const handleInfoClick = (e: React.MouseEvent, assistant: Assistant) => {
    e.stopPropagation()
    setSelectedAssistant(assistant)
    setInfoDialogOpen(true)
  }

  const handlePinAssistant = (e: React.MouseEvent, alias: string) => {
    e.stopPropagation()
    if (!addStoredPinnedAssistant(alias)) {
      toast({ title: t("assistants.dialog.pinLimitReached"), variant: "destructive" })
    }
  }

  const handleUnpinAssistant = (e: React.MouseEvent, alias: string) => {
    e.stopPropagation()
    removeStoredPinnedAssistant(alias)
  }

  const handleDragStart = (e: React.DragEvent, alias: string) => {
    e.dataTransfer.setData("text/plain", alias)
    e.dataTransfer.effectAllowed = "move"
    setDraggedAlias(alias)
  }

  const handleDragEnd = () => {
    setDraggedAlias(null)
    setDropIndicatorIndex(null)
  }

  const handleDragOverCard = (e: React.DragEvent, cardIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (draggedAlias == null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mid = rect.left + rect.width / 2
    const insertBefore = e.clientX < mid ? cardIndex : cardIndex + 1
    setDropIndicatorIndex(insertBefore)
  }

  const handleDragOverGrid = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDropByIndex = (e: React.DragEvent) => {
    e.preventDefault()
    const aliasToMove = e.dataTransfer.getData("text/plain")
    if (!aliasToMove) return
    const index = dropIndicatorIndex ?? 0
    const nextOrder = insertAssistantAt(aliasToMove, index, effectiveOrder)
    setAssistantsDisplayOrder(nextOrder)
    setDraggedAlias(null)
    setDropIndicatorIndex(null)
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
          <p className="text-sm text-muted-foreground mt-1">
            {t("assistants.dialog.pinLimitHint")} {t("assistants.dialog.pinnedCount").replace("{count}", String(userPinnedAliases.length)).replace("{max}", String(MAX_PINNED_ASSISTANTS))}
          </p>
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
                  return (
                    <div
                      className="grid grid-cols-3 md:grid-cols-5 gap-4 relative"
                      onDragOver={handleDragOverGrid}
                      onDrop={handleDropByIndex}
                    >
                      {orderedAssistants.map((assistant, cardIndex) => {
                        const isUnhealthy = assistant.health === "unhealthy"
                        const isUserPinned = userPinnedSet.has(assistant.alias.toLowerCase())
                        const isDragging = draggedAlias === assistant.alias
                        const showLineBefore = dropIndicatorIndex === cardIndex && draggedAlias != null
                        const showLineAfter = dropIndicatorIndex === cardIndex + 1 && draggedAlias != null
                        return (
                          <div
                            key={assistant.alias}
                            draggable
                            onDragStart={(e) => handleDragStart(e, assistant.alias)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOverCard(e, cardIndex)}
                            onDrop={handleDropByIndex}
                            className={`relative flex flex-col rounded-xl overflow-hidden backdrop-blur-sm shadow-sm h-36 ${
                              isUserPinned
                                ? "bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700"
                                : "bg-gray-100 dark:bg-gray-800/80 border border-dashed border-gray-300 dark:border-gray-600"
                            } ${isDragging ? "opacity-50" : ""}`}
                          >
                            {showLineBefore && (
                              <div
                                className="absolute left-0 top-0 bottom-0 w-1 -translate-x-1/2 rounded-full bg-emerald-500 dark:bg-emerald-400 pointer-events-none z-20"
                                aria-hidden
                              />
                            )}
                            {showLineAfter && (
                              <div
                                className="absolute right-0 top-0 bottom-0 w-1 translate-x-1/2 rounded-full bg-emerald-500 dark:bg-emerald-400 pointer-events-none z-20"
                                aria-hidden
                              />
                            )}
                            <div
                              className="absolute left-2 top-2 z-10 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 touch-none"
                              onPointerDown={(e) => e.stopPropagation()}
                              aria-hidden
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => !isUnhealthy && handleAssistantClick(assistant.alias)}
                              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isUnhealthy) handleAssistantClick(assistant.alias) }}
                              className={`flex-1 flex flex-col items-center justify-center gap-3 text-center p-4 pt-8 pl-4 h-full rounded-b-none cursor-pointer ${isUnhealthy ? "cursor-not-allowed opacity-100" : "hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-md"}`}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 z-10"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleInfoClick(e, assistant) }}>
                                    <Info className="h-3.5 w-3.5 mr-2" />
                                    {t("assistants.dialog.info")}
                                  </DropdownMenuItem>
                                  {isUserPinned ? (
                                    <DropdownMenuItem onClick={(e) => handleUnpinAssistant(e, assistant.alias)}>
                                      <PinOff className="h-3.5 w-3.5 mr-2" />
                                      {t("tools.store.unpin")}
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={(e) => handlePinAssistant(e, assistant.alias)}
                                      disabled={!canPinMore}
                                      title={!canPinMore ? t("assistants.dialog.pinLimitReached") : undefined}
                                    >
                                      <Pin className="h-3.5 w-3.5 mr-2" />
                                      {t("tools.store.pin")} ({userPinnedAliases.length}/{MAX_PINNED_ASSISTANTS})
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <div className="relative">
                                <div className={`w-14 h-14 rounded-xl ${assistant.bgColor} flex items-center justify-center shadow-sm ${isUnhealthy ? "opacity-60" : ""}`}>
                                  <assistant.Icon className={`h-7 w-7 ${assistant.iconColor} ${isUnhealthy ? "opacity-60" : ""}`} />
                                </div>
                                <div
                                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                                    assistant.health === "healthy" ? "bg-green-500" : "bg-red-500"
                                  }`}
                                  title={assistant.health === "healthy" ? t("assistants.dialog.healthy") : t("assistants.dialog.unhealthy")}
                                />
                              </div>
                              <span className={`text-sm font-medium leading-tight ${isUnhealthy ? "text-gray-400 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"}`}>
                                {assistant.name}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      <Button
                        variant="outline"
                        className="h-36 flex flex-col items-center justify-center gap-3 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
                        onClick={() => setAddOpen(true)}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = "move"
                          setDropIndicatorIndex(orderedAssistants.length)
                        }}
                        onDrop={handleDropByIndex}
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
          <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0" aria-describedby="assistant-info-desc">
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
            <DialogDescription id="assistant-info-desc" className="sr-only">Thông tin chi tiết trợ lý</DialogDescription>
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
