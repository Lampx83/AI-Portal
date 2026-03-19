"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LayoutGrid, MoreVertical, PinOff } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/contexts/language-context"
import { removeStoredPinnedTool } from "@/lib/pinned-tools-storage"
import type { Assistant } from "@/lib/assistants"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  assistants: Assistant[]
  loading?: boolean
  isActiveRoute: (route: string) => boolean
  onAssistantClick: (alias: string) => void
  /** "See all" opens the apps list dialog, or navigates if seeAllHref is set */
  onSeeMoreClick?: () => void
  /** When set, "All" is a link to this href (e.g. /tools) instead of calling onSeeMoreClick */
  seeAllHref?: string
  /** When true (e.g. on admin page), hide "Tất cả" button */
  hideSeeAllOnAdmin?: boolean
}

export default function ApplicationsSection({
  assistants,
  loading = false,
  isActiveRoute,
  onAssistantClick,
  onSeeMoreClick,
  seeAllHref,
  hideSeeAllOnAdmin = false,
}: Props) {
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const APP_DISPLAY_NAMES: Record<string, string> = {}

  return (
    <div className="pl-1 pr-2">
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 rounded-xl py-4 px-3 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
        <div
          className="flex justify-between items-center mb-3 cursor-pointer select-none"
          onClick={() => setCollapsed((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed((v) => !v) } }}
          title={collapsed ? t("common.expand") : t("common.collapse")}
          aria-expanded={!collapsed}
        >
          <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center">
            <LayoutGrid className="w-4 h-4 mr-2" />
            {t("sidebar.tools")}
          </h3>
        </div>
        {!collapsed && (
          <>
            <ul className="space-y-2">
              {loading ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <li key={`skeleton-app-${index}`}>
                    <div className="w-full flex items-center h-12 pl-2 pr-2 rounded-lg bg-white/40 dark:bg-gray-800/40">
                      <Skeleton className="w-8 h-8 rounded-lg mr-2 flex-shrink-0 bg-gray-300 dark:bg-gray-600" />
                      <Skeleton className="h-4 flex-1 bg-gray-300 dark:bg-gray-600" />
                    </div>
                  </li>
                ))
              ) : (
                assistants.map((assistant) => {
                  const isUnhealthy = assistant.health === "unhealthy"
                  const displayName = APP_DISPLAY_NAMES[assistant.alias] ?? assistant.name
                  return (
                    <li key={assistant.alias} className="flex items-center gap-0 rounded-lg overflow-hidden group min-w-0">
                      <Button
                        variant="ghost"
                        className={`flex-1 min-w-0 justify-start font-normal h-12 pl-2 pr-1 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-r-none overflow-hidden ${isActiveRoute(`/tools/${assistant.alias}`) ? "bg-white/80 dark:bg-gray-800/80" : ""} ${isUnhealthy ? "opacity-75" : ""}`}
                        onClick={() => onAssistantClick(assistant.alias)}
                      >
                        <div className={`w-8 h-8 min-w-8 min-h-8 flex-shrink-0 aspect-square rounded-lg flex items-center justify-center mr-2 ${assistant.bgColor} shadow-sm`}>
                          <assistant.Icon className={`h-5 w-5 shrink-0 ${assistant.iconColor}`} />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 min-w-0 truncate" title={displayName}>{displayName}</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-8 shrink-0 rounded-l-none border-0 p-0 hover:bg-white/60 dark:hover:bg-gray-800/60"
                            onClick={(e) => e.stopPropagation()}
                            title={t("common.actions")}
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              removeStoredPinnedTool(assistant.alias)
                            }}
                          >
                            <PinOff className="h-4 w-4 mr-2" />
                            {t("tools.store.unpin")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  )
                })
              )}
            </ul>
            {(onSeeMoreClick || seeAllHref) && !hideSeeAllOnAdmin && (
              seeAllHref ? (
                <Link
                  href={seeAllHref}
                  className="flex w-full justify-center font-normal text-sm text-emerald-600 dark:text-emerald-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg py-2"
                >
                  {t("projects.all")}
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-center font-normal text-sm text-emerald-600 dark:text-emerald-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                  onClick={onSeeMoreClick}
                >
                  {t("projects.all")}
                </Button>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
