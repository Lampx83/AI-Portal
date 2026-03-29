"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Bot, MoreVertical, MessageSquarePlus, History, PinOff } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/contexts/language-context"
import { removeStoredPinnedAssistant } from "@/lib/pinned-assistants-storage"
import type { Assistant } from "@/lib/assistants"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
    assistants: Assistant[]
    loading?: boolean
    limit?: number
    isActiveRoute: (route: string) => boolean
    onAssistantClick: (alias: string) => void
    onSeeMoreClick: () => void
    onNewChatWithAssistant?: (alias: string) => void
    onViewAssistantChatHistory?: (alias: string, name: string) => void
    /** When true (e.g. on admin page), hide "Tất cả" button */
    hideSeeAllOnAdmin?: boolean
}

export default function AssistantsSection({
    assistants,
    loading = false,
    limit = 10,
    isActiveRoute,
    onAssistantClick,
    onSeeMoreClick,
    onNewChatWithAssistant,
    onViewAssistantChatHistory,
    hideSeeAllOnAdmin = false,
}: Props) {
    const { t } = useLanguage()
    const [collapsed, setCollapsed] = useState(false)
    const canUnpin = !hideSeeAllOnAdmin
    const toShow = assistants.slice(0, limit)

    return (
        <div className="pl-1 pr-2">
            <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-red-950/30 rounded-xl py-4 px-3 border border-amber-100 dark:border-amber-900/50 shadow-sm">
                <div
                    className="flex justify-between items-center mb-3 cursor-pointer select-none"
                    onClick={() => setCollapsed((v) => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed((v) => !v) } }}
                    title={collapsed ? t("chat.expandList") : t("chat.collapseList")}
                    aria-expanded={!collapsed}
                >
                    <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center">
                        <Bot className="w-4 h-4 mr-2" />
                        {t("sidebar.assistantsTitle")}
                    </h3>
                </div>
                {!collapsed && (
                <>
                <ul className="space-y-2">
                    {loading ? (
                        // Show skeleton per item while loading
                        Array.from({ length: Math.min(limit, 5) }).map((_, index) => (
                            <li key={`skeleton-${index}`}>
                                <div className="w-full flex items-center h-12 pl-2 pr-2 rounded-lg bg-white/40 dark:bg-gray-800/40">
                                    <Skeleton className="w-8 h-8 rounded-lg mr-2 flex-shrink-0 bg-gray-300 dark:bg-gray-600" />
                                    <Skeleton className="h-4 flex-1 bg-gray-300 dark:bg-gray-600" />
                                </div>
                            </li>
                        ))
                    ) : (
                        // Show actual assistant list
                        toShow.map((assistant) => {
                            const isActive = isActiveRoute(`/assistants/${assistant.alias}`)
                            return (
                            <li key={assistant.alias} className="flex items-center gap-0 rounded-lg overflow-hidden group min-w-0">
                                <Button
                                    variant="ghost"
                                    className={`flex-1 min-w-0 justify-start font-normal h-12 pl-2 pr-1 hover:bg-transparent dark:hover:bg-transparent transition-all duration-200 rounded-r-none overflow-hidden hover:translate-x-0.5 ${isActive ? "text-amber-700 dark:text-amber-300 font-medium" : "text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-300"}`}
                                    onClick={() => onAssistantClick(assistant.alias)}
                                >
                                    <div className={`w-8 h-8 min-w-8 min-h-8 flex-shrink-0 aspect-square rounded-lg flex items-center justify-center mr-2 ${assistant.bgColor} shadow-sm transition-transform duration-200 group-hover:scale-105 ${isActive ? "ring-1 ring-amber-300 dark:ring-amber-700" : ""}`}>
                                        <assistant.Icon className={`h-5 w-5 shrink-0 ${assistant.iconColor}`} />
                                    </div>
                                    <span className="min-w-0 truncate" title={assistant.name ?? assistant.alias}>{assistant.name}</span>
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-12 w-8 shrink-0 rounded-l-none border-0 p-0 hover:bg-transparent dark:hover:bg-transparent transition-colors ${isActive ? "text-amber-700 dark:text-amber-300" : ""}`}
                                            onClick={(e) => e.stopPropagation()}
                                            title={t("sidebar.tools")}
                                        >
                                            <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {onNewChatWithAssistant && (
                                            <DropdownMenuItem onClick={() => onNewChatWithAssistant(assistant.alias)}>
                                                <MessageSquarePlus className="h-4 w-4 mr-2" />
                                                {t("sidebar.newSession")}
                                            </DropdownMenuItem>
                                        )}
                                        {onViewAssistantChatHistory && (
                                            <DropdownMenuItem onClick={() => onViewAssistantChatHistory(assistant.alias, assistant.name ?? assistant.alias)}>
                                                <History className="h-4 w-4 mr-2" />
                                                {t("sidebar.history")}
                                            </DropdownMenuItem>
                                        )}
                                        {canUnpin && (
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    removeStoredPinnedAssistant(assistant.alias)
                                                }}
                                            >
                                                <PinOff className="h-4 w-4 mr-2" />
                                                {t("tools.store.unpin")}
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        )})
                    )}
                </ul>
                {!loading && !hideSeeAllOnAdmin && (
                    <Button
                        variant="ghost"
                        className="w-full justify-center font-normal text-sm text-amber-600 dark:text-amber-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg py-2"
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
