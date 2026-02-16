"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LayoutGrid, MoreVertical, MessageSquarePlus, History } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Assistant } from "@/lib/assistants"
import { Skeleton } from "@/components/ui/skeleton"

const APP_DISPLAY_NAMES: Record<string, string> = {
  write: "Viết bài",
  data: "Dữ liệu",
}

type Props = {
  assistants: Assistant[]
  loading?: boolean
  isActiveRoute: (route: string) => boolean
  onAssistantClick: (alias: string) => void
  onNewChatWithAssistant?: (alias: string) => void
  onViewAssistantChatHistory?: (alias: string, name: string) => void
  /** "See all" opens the apps list dialog */
  onSeeMoreClick?: () => void
}

export default function ApplicationsSection({
  assistants,
  loading = false,
  isActiveRoute,
  onAssistantClick,
  onNewChatWithAssistant,
  onViewAssistantChatHistory,
  onSeeMoreClick,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)

  if (assistants.length === 0 && !loading) return null

  return (
    <div className="px-2">
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
        <div
          className="flex justify-between items-center mb-3 cursor-pointer select-none"
          onClick={() => setCollapsed((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed((v) => !v) } }}
          title={collapsed ? "Mở rộng" : "Thu gọn"}
          aria-expanded={!collapsed}
        >
          <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center">
            <LayoutGrid className="w-4 h-4 mr-2" />
            Apps
          </h3>
        </div>
        {!collapsed && (
          <>
            <ul className="space-y-2">
              {loading ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <li key={`skeleton-app-${index}`}>
                    <div className="w-full flex items-center h-12 px-3 rounded-lg bg-white/40 dark:bg-gray-800/40">
                      <Skeleton className="w-8 h-8 rounded-lg mr-3 flex-shrink-0 bg-gray-300 dark:bg-gray-600" />
                      <Skeleton className="h-4 flex-1 bg-gray-300 dark:bg-gray-600" />
                    </div>
                  </li>
                ))
              ) : (
                assistants.map((assistant) => {
                  const isUnhealthy = assistant.health === "unhealthy"
                  const displayName = APP_DISPLAY_NAMES[assistant.alias] ?? assistant.name
                  return (
                    <li key={assistant.alias} className="flex items-center gap-0 rounded-lg overflow-hidden group">
                      <Button
                        variant="ghost"
                        className={`flex-1 justify-start font-normal h-12 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-r-none ${isActiveRoute(`/assistants/${assistant.alias}`) ? "bg-white/80 dark:bg-gray-800/80" : ""} ${isUnhealthy ? "opacity-75" : ""}`}
                        onClick={() => onAssistantClick(assistant.alias)}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${assistant.bgColor} shadow-sm`}>
                          <assistant.Icon className={`h-5 w-5 ${assistant.iconColor}`} />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{displayName}</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-9 rounded-l-none hover:bg-white/60 dark:hover:bg-gray-800/60 opacity-70 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                            title="Apps"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                        {onNewChatWithAssistant && (
                          <DropdownMenuItem onClick={() => onNewChatWithAssistant(assistant.alias)}>
                            <MessageSquarePlus className="h-4 w-4 mr-2" />
                            Phiên mới
                          </DropdownMenuItem>
                        )}
                        {onViewAssistantChatHistory && (
                          <DropdownMenuItem onClick={() => onViewAssistantChatHistory(assistant.alias, displayName)}>
                            <History className="h-4 w-4 mr-2" />
                            Lịch sử
                          </DropdownMenuItem>
                        )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  )
                })
              )}
            </ul>
            {onSeeMoreClick && (
              <Button
                variant="ghost"
                className="w-full justify-center font-normal text-sm text-emerald-600 dark:text-emerald-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                onClick={onSeeMoreClick}
              >
                Tất cả
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
