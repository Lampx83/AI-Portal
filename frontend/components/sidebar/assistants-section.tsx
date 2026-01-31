"use client"

import { Button } from "@/components/ui/button"
import { Bot, ChevronDown } from "lucide-react"
import type { ResearchAssistant } from "@/lib/research-assistants"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
    assistants: ResearchAssistant[]
    loading?: boolean
    limit?: number
    isActiveRoute: (route: string) => boolean
    onAssistantClick: (alias: string) => void
    onSeeMoreClick: () => void
}

export default function AssistantsSection({
    assistants,
    loading = false,
    limit = 10,
    isActiveRoute,
    onAssistantClick,
    onSeeMoreClick,
}: Props) {
    const toShow = assistants.slice(0, limit)

    return (
        <div className="px-2">
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50 shadow-sm">
                <h3 className="mb-3 text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center">
                    <Bot className="w-4 h-4 mr-2" />
                    Trợ lý và công cụ
                </h3>
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
                            <li key={assistant.alias}>
                                <Button
                                    variant="ghost"
                                    className={`w-full justify-start font-normal h-12 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg ${isActiveRoute(`/assistants/${assistant.alias}`) ? "bg-white/80 dark:bg-gray-800/80" : ""}`}
                                    onClick={() => onAssistantClick(assistant.alias)}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${assistant.bgColor} shadow-sm`}>
                                        <assistant.Icon className={`h-5 w-5 ${assistant.iconColor}`} />
                                    </div>
                                    <span className="text-gray-700 dark:text-gray-300">{assistant.name}</span>
                                </Button>
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
            </div>
        </div>
    )
}
