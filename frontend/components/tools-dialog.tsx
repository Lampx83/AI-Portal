"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTools } from "@/hooks/use-tools"
import { useLanguage } from "@/contexts/language-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutGrid, Plus } from "lucide-react"
import type { Assistant } from "@/lib/assistants"


interface ToolsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  setActiveView?: (assistantId: string) => void
}

export function ToolsDialog({ isOpen, onOpenChange, setActiveView }: ToolsDialogProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const { tools, loading } = useTools()
  const APP_DISPLAY_NAMES: Record<string, string> = {}

  const handleToolClick = (alias: string) => {
    onOpenChange(false)
    router.push(`/apps/${alias}`)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            {t("sidebar.apps")}
          </DialogTitle>
          <DialogDescription>
            Choose an app to use. Manage and add apps in Admin.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {loading ? (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`sk-${i}`} className="h-32 flex flex-col items-center justify-center gap-3 p-4 bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <Skeleton className="w-14 h-14 rounded-xl bg-gray-300 dark:bg-gray-600" />
                  <Skeleton className="h-4 w-20 bg-gray-300 dark:bg-gray-600" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {tools.map((assistant: Assistant) => {
                const isUnhealthy = assistant.health === "unhealthy"
                const displayName = APP_DISPLAY_NAMES[assistant.alias] ?? assistant.name
                return (
                  <Button
                    key={assistant.alias}
                    variant="outline"
                    disabled={isUnhealthy}
                    className={`h-32 flex flex-col items-center justify-center gap-3 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 rounded-xl shadow-sm relative disabled:opacity-100 ${
                      isUnhealthy ? "cursor-not-allowed" : "hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-md"
                    }`}
                    onClick={() => !isUnhealthy && handleToolClick(assistant.alias)}
                  >
                    <div className={`w-14 h-14 rounded-xl ${assistant.bgColor} flex items-center justify-center shadow-sm ${isUnhealthy ? "opacity-60" : ""}`}>
                      <assistant.Icon className={`h-7 w-7 ${assistant.iconColor} ${isUnhealthy ? "opacity-60" : ""}`} />
                    </div>
                    <span className={`text-sm font-medium leading-tight ${isUnhealthy ? "text-gray-400 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"}`}>
                      {displayName}
                    </span>
                  </Button>
                )
              })}
              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
                asChild
              >
                <Link href="/admin" onClick={() => onOpenChange(false)}>
                  <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm">
                    <Plus className="h-7 w-7 text-gray-500 dark:text-gray-400" />
                  </div>
                  <span className="text-sm font-medium leading-tight text-gray-700 dark:text-gray-300">Add app</span>
                </Link>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
