"use client"

import { useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  ChevronUp,
  FileText,
  FolderKanban,
  Pencil,
  Users,
} from "lucide-react"
import type { Research } from "@/types"

type Props = {
    items: Research[]
    onSelect?: (r: Research) => void
    onEdit?: (r: Research) => void
    onAdd: () => void
    initialShowCount?: number
    /** tên khóa param, mặc định 'rid' */
    paramKey?: string
    /** dùng push hay replace lịch sử, mặc định 'replace' để không làm dài history */
    navMode?: "push" | "replace"
}

export default function MyResearchSection({
    items,
    onSelect,
    onEdit,
    onAdd,
    initialShowCount = 5,
    paramKey = "rid",
    navMode = "replace",
}: Props) {
    const [listExpanded, setListExpanded] = useState(true)
    const [showAll, setShowAll] = useState(false)
    const sortedItems = useMemo(() => {
      return [...items].sort((a, b) => {
        const aTime = a.updated_at || a.created_at || ""
        const bTime = b.updated_at || b.created_at || ""
        if (aTime > bTime) return -1
        if (aTime < bTime) return 1
        return String(a.id).localeCompare(String(b.id))
      })
    }, [items])
    const list = showAll ? sortedItems : sortedItems.slice(0, initialShowCount)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handlePick = (r: Research) => {
        // Khi parent xử lý chọn (vd. chuyển sang soạn thảo main): chỉ gọi onSelect, không cập nhật URL trên path hiện tại
        if (onSelect) {
            onSelect(r)
            return
        }
        // Chỉ cập nhật query param khi không có onSelect
        const sp = new URLSearchParams(searchParams?.toString())
        sp.set(paramKey, String(r.id))
        const url = `${pathname}?${sp.toString()}`
        navMode === "push" ? router.push(url, { scroll: false }) : router.replace(url, { scroll: false })
    }

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
                        onClick={() => setListExpanded((v) => !v)}
                        title={listExpanded ? "Thu gọn danh sách" : "Mở rộng danh sách"}
                        aria-expanded={listExpanded}
                    >
                        {listExpanded ? (
                            <ChevronUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                    </Button>
                </div>

                {listExpanded && (
                <ul className="space-y-1">
                    {list.map((r) => (
                        <li key={String(r.id)} className="group relative flex items-center gap-1">
                            <div
                                className="flex-1 flex items-center min-w-0 rounded-lg hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 cursor-pointer py-2 px-2"
                                onClick={() => handlePick(r)}
                                role="button"
                                tabIndex={0}
                            >
                                <FileText className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                <span className="text-sm font-normal text-gray-700 dark:text-gray-300 truncate">{r.name}</span>
                                {r.is_shared && (
                                    <span className="ml-1.5 flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400" title="Được chia sẻ với bạn">
                                        <Users className="h-3 w-3" />
                                    </span>
                                )}
                            </div>
                            {onEdit && !r.is_shared && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => { e.stopPropagation(); onEdit(r); }}
                                    title="Chỉnh sửa"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
                )}

                {listExpanded && sortedItems.length > initialShowCount && (
                    <Button
                        variant="ghost"
                        className="w-full justify-center text-sm text-emerald-600 dark:text-emerald-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                        onClick={() => setShowAll((v) => !v)}
                    >
                        <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showAll ? "rotate-180" : ""}`} />
                        {showAll ? "Thu gọn" : "Tất cả"}
                    </Button>
                )}
            </div>
        </div>
    )
}
