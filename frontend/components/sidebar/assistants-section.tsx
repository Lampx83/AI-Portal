"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Bot, ChevronDown, ChevronUp, MoreVertical, MessageSquarePlus, History } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ResearchAssistant } from "@/lib/research-assistants"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
    assistants: ResearchAssistant[]
    loading?: boolean
    limit?: number
    isActiveRoute: (route: string) => boolean
    onAssistantClick: (alias: string) => void
    onSeeMoreClick: () => void
    onNewChatWithAssistant?: (alias: string) => void
    onViewAssistantChatHistory?: (alias: string, name: string) => void
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
}: Props) {
    const [collapsed, setCollapsed] = useState(false)
    const toShow = assistants.slice(0, limit)

    return (
        <div className="px-2">
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50 shadow-sm">
                <div
                    className="flex justify-between items-center mb-3 cursor-pointer select-none"
                    onClick={() => setCollapsed((v) => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed((v) => !v) } }}
                    title={collapsed ? "Mở rộng danh sách" : "Thu gọn danh sách"}
                    aria-expanded={!collapsed}
                >
                    <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center">
                        <Bot className="w-4 h-4 mr-2" />
                        Trợ lý và công cụ
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg pointer-events-none"
                        title={collapsed ? "Mở rộng danh sách" : "Thu gọn danh sách"}
                        aria-hidden
                    >
                        {collapsed ? (
                            <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                            <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                    </Button>
                </div>
                {!collapsed && (
                <>
                <ul className="space-y-2">
                    {loading ? (
                        // Hiển thị skeleton cho từng item khi đang loading
                        Array.from({ length: Math.min(limit, 5) }).map((_, index) => (
                            <li key={`skeleton-${index}`}>
                                <div className="w-full flex items-center h-12 px-3 rounded-lg bg-white/40 dark:bg-gray-800/40">
                                    <Skeleton className="w-8 h-8 rounded-lg mr-3 flex-shrink-0 bg-gray-300 dark:bg-gray-600" />
                                    <Skeleton className="h-4 flex-1 bg-gray-300 dark:bg-gray-600" />
                                </div>
                            </li>
                        ))
                    ) : (
                        // Hiển thị danh sách trợ lý thực tế
                        toShow.map((assistant) => (
                            <li key={assistant.alias} className="flex items-center gap-0 rounded-lg overflow-hidden group">
                                <Button
                                    variant="ghost"
                                    className={`flex-1 justify-start font-normal h-12 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-r-none ${isActiveRoute(`/assistants/${assistant.alias}`) ? "bg-white/80 dark:bg-gray-800/80" : ""}`}
                                    onClick={() => onAssistantClick(assistant.alias)}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${assistant.bgColor} shadow-sm`}>
                                        <assistant.Icon className={`h-5 w-5 ${assistant.iconColor}`} />
                                    </div>
                                    <span className="text-gray-700 dark:text-gray-300">{assistant.name}</span>
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-12 w-9 rounded-l-none hover:bg-white/60 dark:hover:bg-gray-800/60 opacity-70 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => e.stopPropagation()}
                                            title="Công cụ"
                                        >
                                            <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {onNewChatWithAssistant && (
                                            <DropdownMenuItem onClick={() => onNewChatWithAssistant(assistant.alias)}>
                                                <MessageSquarePlus className="h-4 w-4 mr-2" />
                                                Trò chuyện mới
                                            </DropdownMenuItem>
                                        )}
                                        {onViewAssistantChatHistory && (
                                            <DropdownMenuItem onClick={() => onViewAssistantChatHistory(assistant.alias, assistant.name ?? assistant.alias)}>
                                                <History className="h-4 w-4 mr-2" />
                                                Lịch sử trò chuyện
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        ))
                    )}
                </ul>
                {!loading && (
                    <Button
                        variant="ghost"
                        className="w-full justify-center font-normal text-sm text-blue-600 dark:text-blue-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                        onClick={onSeeMoreClick}
                    >
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Tất cả
                    </Button>
                )}
                </>
                )}
            </div>
        </div>
    )
}
