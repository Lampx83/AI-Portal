"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, FolderKanban, MessageSquare, PlusCircle } from "lucide-react"
import type { Research } from "@/types"

type Props = {
    items: Research[]
    onSelect: (r: Research) => void
    onAdd: () => void
    initialShowCount?: number
}

export default function MyResearchSection({
    items,
    onSelect,
    onAdd,
    initialShowCount = 10,
}: Props) {
    const [showAll, setShowAll] = useState(false)
    const list = showAll ? items : items.slice(0, initialShowCount)

    return (
        <div className="px-2">
            <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/30 dark:to-teal-950/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center">
                        <FolderKanban className="w-4 h-4 mr-2" />
                        Nghiên cứu của tôi
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg"
                        onClick={onAdd}
                        title="Thêm nghiên cứu"
                    >
                        <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </Button>
                </div>

                <ul className="space-y-1">
                    {list.map((r) => (
                        <li key={r.id} className="group relative">
                            <Button
                                asChild
                                variant="ghost"
                                className="flex-1 justify-start text-sm font-normal h-9 truncate hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 rounded-lg pr-2 w-full"
                            >
                                <div
                                    className="flex items-center w-full"
                                    onClick={() => onSelect(r)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <MessageSquare className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-700 dark:text-gray-300 truncate pr-2">{r.name}</span>
                                </div>
                            </Button>
                        </li>
                    ))}
                </ul>

                {items.length > initialShowCount && (
                    <Button
                        variant="ghost"
                        className="w-full justify-center text-sm text-emerald-600 dark:text-emerald-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                        onClick={() => setShowAll((v) => !v)}
                    >
                        <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showAll ? "rotate-180" : ""}`} />
                        Xem thêm
                    </Button>
                )}
            </div>
        </div>
    )
}
