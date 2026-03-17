"use client"

import Link from "next/link"
import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTools } from "@/hooks/use-tools"
import { useToolsDisplayOrder, setToolsDisplayOrder } from "@/hooks/use-tools-display-order"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutGrid, Plus, Pin, PinOff, Info, MoreVertical, GripVertical, Upload, Trash2, Settings2 } from "lucide-react"
import { addStoredPinnedTool, removeStoredPinnedTool, MAX_PINNED_TOOLS } from "@/lib/pinned-tools-storage"
import { reorderToolInStorage, insertToolAt } from "@/lib/tools-display-order-storage"
import { useSession } from "next-auth/react"
import { installPackageForUser, uninstallPackageForUser } from "@/lib/api/tools-api"
import type { Assistant } from "@/lib/assistants"
import { GUEST_USER_ID } from "@/lib/chat"


interface ToolsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  setActiveView?: (assistantId: string) => void
}

export function ToolsDialog({ isOpen, onOpenChange, setActiveView }: ToolsDialogProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const { toast } = useToast()
  const { data: session } = useSession()
  const { tools, userPinnedAliases, loading, refetch } = useTools()
  const displayOrder = useToolsDisplayOrder()
  const userPinnedSet = new Set(userPinnedAliases.map((a) => a.toLowerCase()))
  const canPinMore = userPinnedAliases.length < MAX_PINNED_TOOLS
  const [selectedTool, setSelectedTool] = useState<Assistant | null>(null)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [draggedAlias, setDraggedAlias] = useState<string | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const [installing, setInstalling] = useState(false)
  const [uninstallingAlias, setUninstallingAlias] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const APP_DISPLAY_NAMES: Record<string, string> = {}

  const effectiveOrder = useMemo(() => {
    const orderSet = new Set(displayOrder)
    if (displayOrder.length === 0) return tools.map((a) => a.alias.trim().toLowerCase())
    const rest = tools.filter((a) => !orderSet.has(a.alias.trim().toLowerCase())).map((a) => a.alias.trim().toLowerCase())
    return [...displayOrder, ...rest]
  }, [displayOrder, tools])

  const orderedTools = useMemo(() => {
    const orderMap = new Map(effectiveOrder.map((a, i) => [a, i]))
    return tools.slice().sort((a, b) => {
      const i = orderMap.get(a.alias.trim().toLowerCase()) ?? 1e9
      const j = orderMap.get(b.alias.trim().toLowerCase()) ?? 1e9
      return i - j
    })
  }, [tools, effectiveOrder])

  const handleToolClick = (alias: string) => {
    onOpenChange(false)
    router.push(`/tools/${alias}`)
  }

  const handlePin = (e: React.MouseEvent, alias: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!addStoredPinnedTool(alias)) {
      toast({ title: t("tools.store.pinLimitReached"), variant: "destructive" })
    }
  }

  const handleUnpin = (e: React.MouseEvent, alias: string) => {
    e.preventDefault()
    e.stopPropagation()
    removeStoredPinnedTool(alias)
  }

  const handleInfoClick = (e: React.MouseEvent, tool: Assistant) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedTool(tool)
    setInfoDialogOpen(true)
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
    const nextOrder = insertToolAt(aliasToMove, index, effectiveOrder)
    setToolsDisplayOrder(nextOrder)
    setDraggedAlias(null)
    setDropIndicatorIndex(null)
  }

  const handleInstallClick = () => {
    fileInputRef.current?.click()
  }

  const handleInstallFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (userId === GUEST_USER_ID) {
      toast({ title: t("tools.dialog.guestCannotInstall"), variant: "destructive" })
      return
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({ title: t("tools.dialog.installErrorFormat"), variant: "destructive" })
      return
    }
    setInstalling(true)
    try {
      await installPackageForUser(file)
      toast({ title: t("tools.dialog.installSuccess") })
      refetch()
    } catch (err) {
      toast({
        title: t("tools.dialog.installError"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setInstalling(false)
    }
  }

  const handleUninstall = async (e: React.MouseEvent, alias: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (uninstallingAlias) return
    setUninstallingAlias(alias)
    try {
      await uninstallPackageForUser(alias)
      toast({ title: t("tools.dialog.uninstallSuccess") })
      refetch()
    } catch (err) {
      toast({
        title: t("tools.dialog.uninstallError"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setUninstallingAlias(null)
    }
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            {t("sidebar.tools")}
          </DialogTitle>
          <DialogDescription>
            {t("tools.dialog.descriptionNew")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {loading ? (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`sk-${i}`} className="h-32 flex flex-col items-center justify-center gap-3 p-4 bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <Skeleton className="w-14 h-14 rounded-xl bg-gray-300 dark:bg-gray-600" />
                  <Skeleton className="h-4 w-20 bg-gray-300 dark:bg-gray-600" />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="grid grid-cols-3 md:grid-cols-5 gap-4 relative"
              onDragOver={handleDragOverGrid}
              onDrop={handleDropByIndex}
            >
              {orderedTools.map((assistant: Assistant, cardIndex: number) => {
                const isUnhealthy = assistant.health === "unhealthy"
                const displayName = APP_DISPLAY_NAMES[assistant.alias] ?? assistant.name
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
                    className={`relative flex flex-col rounded-xl overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm h-36 ${isDragging ? "opacity-50" : ""} ${
                      isUserPinned
                        ? "border border-gray-200 dark:border-gray-700"
                        : "border border-dashed border-gray-300 dark:border-gray-600"
                    }`}
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
                      onClick={() => !isUnhealthy && handleToolClick(assistant.alias)}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isUnhealthy) handleToolClick(assistant.alias) }}
                      className={`flex-1 flex flex-col items-center justify-center gap-3 p-4 pt-8 pl-4 h-full rounded-b-none cursor-pointer ${isUnhealthy ? "cursor-not-allowed opacity-100" : "hover:bg-white/80 dark:hover:bg-gray-800/80"} hover:shadow-md`}
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
                            {t("tools.dialog.info")}
                          </DropdownMenuItem>
                          {(assistant as { user_installed?: boolean }).user_installed && (
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300"
                              onClick={(e) => handleUninstall(e, assistant.alias)}
                              disabled={!!uninstallingAlias}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              {uninstallingAlias === assistant.alias ? t("tools.dialog.uninstalling") : t("tools.dialog.uninstall")}
                            </DropdownMenuItem>
                          )}
                          {isUserPinned ? (
                            <DropdownMenuItem onClick={(e) => handleUnpin(e, assistant.alias)}>
                              <PinOff className="h-3.5 w-3.5 mr-2" />
                              {t("tools.store.unpin")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={(e) => handlePin(e, assistant.alias)}
                              disabled={!canPinMore}
                              title={!canPinMore ? t("tools.store.pinLimitReached") : undefined}
                            >
                              <Pin className="h-3.5 w-3.5 mr-2" />
                              {t("tools.store.pin")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-sm ${isUnhealthy ? "opacity-60" : ""} ${isUserPinned ? assistant.bgColor : "bg-gray-100 dark:bg-gray-800"}`}>
                        <assistant.Icon className={`h-7 w-7 ${isUnhealthy ? "opacity-60" : ""} ${isUserPinned ? assistant.iconColor : "text-gray-500 dark:text-gray-400"}`} />
                      </div>
                      <span className={`text-sm font-medium leading-tight text-center ${isUnhealthy ? "text-gray-400 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"}`}>
                        {displayName}
                      </span>
                    </div>
                  </div>
                )
              })}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={installing}
                    className="h-36 flex flex-col items-center justify-center gap-3 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = "move"
                      setDropIndicatorIndex(orderedTools.length)
                    }}
                    onDrop={handleDropByIndex}
                  >
                    <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm">
                      <Plus className="h-7 w-7 text-gray-500 dark:text-gray-400" />
                    </div>
                    <span className="text-sm font-medium leading-tight text-gray-700 dark:text-gray-300">
                      {installing ? t("tools.dialog.installing") : t("tools.dialog.addTool")}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="min-w-[220px]">
                  <DropdownMenuItem onClick={handleInstallClick} disabled={installing}>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("tools.dialog.addToolFromFile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin" onClick={() => onOpenChange(false)}>
                      <Settings2 className="h-4 w-4 mr-2" />
                      {t("tools.dialog.addToolForEveryone")}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleInstallFile}
                disabled={installing}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {selectedTool && (
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0" aria-describedby="tool-info-desc">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${selectedTool.bgColor} flex items-center justify-center`}>
                <selectedTool.Icon className={`h-6 w-6 ${selectedTool.iconColor}`} />
              </div>
              <div>
                <div className="text-xl font-bold">{selectedTool.name}</div>
                <div className="text-sm font-normal text-muted-foreground">{selectedTool.alias}</div>
              </div>
            </DialogTitle>
            <DialogDescription id="tool-info-desc" className="sr-only">{t("tools.dialog.info")}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
            {(selectedTool as { baseUrl?: string }).baseUrl && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t("tools.dialog.baseUrl")}</h4>
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded break-all">{(selectedTool as { baseUrl?: string }).baseUrl}</code>
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t("tools.dialog.health")}</h4>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  selectedTool.health === "healthy"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                }`}
              >
                {selectedTool.health === "healthy" ? t("tools.dialog.healthy") : t("tools.dialog.unhealthy")}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}
