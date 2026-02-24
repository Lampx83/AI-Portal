"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LayoutGrid } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import type { Assistant } from "@/lib/assistants"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  assistants: Assistant[]
  loading?: boolean
  isActiveRoute: (route: string) => boolean
  onAssistantClick: (alias: string) => void
  /** "See all" opens the apps list dialog */
  onSeeMoreClick?: () => void
  /** When true (e.g. on admin page), hide "Tất cả" button */
  hideSeeAllOnAdmin?: boolean
}

export default function ApplicationsSection({
  assistants,
  loading = false,
  isActiveRoute,
  onAssistantClick,
  onSeeMoreClick,
  hideSeeAllOnAdmin = false,
}: Props) {
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const APP_DISPLAY_NAMES: Record<string, string> = {}

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
          title={collapsed ? t("common.expand") : t("common.collapse")}
          aria-expanded={!collapsed}
        >
          <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center">
            <LayoutGrid className="w-4 h-4 mr-2" />
            {t("sidebar.apps")}
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
                        className={`flex-1 justify-start font-normal h-12 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg ${isActiveRoute(`/apps/${assistant.alias}`) ? "bg-white/80 dark:bg-gray-800/80" : ""} ${isUnhealthy ? "opacity-75" : ""}`}
                        onClick={() => onAssistantClick(assistant.alias)}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${assistant.bgColor} shadow-sm`}>
                          <assistant.Icon className={`h-5 w-5 ${assistant.iconColor}`} />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{displayName}</span>
                      </Button>
                    </li>
                  )
                })
              )}
            </ul>
            {onSeeMoreClick && !hideSeeAllOnAdmin && (
              <Button
                variant="ghost"
                className="w-full justify-center font-normal text-sm text-emerald-600 dark:text-emerald-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                onClick={onSeeMoreClick}
              >
                {t("projects.all")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
