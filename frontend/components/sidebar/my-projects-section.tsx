"use client"

import { useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FolderKanban, Plus, Users } from "lucide-react"
import { getProjectIcon } from "@/lib/project-icons"
import { useLanguage } from "@/contexts/language-context"
import type { Project } from "@/types"

type Props = {
    items: Project[]
    onSelect?: (r: Project) => void
    onEdit?: (r: Project) => void
    onAdd: () => void
    initialShowCount?: number
    paramKey?: string
    navMode?: "push" | "replace"
    /** Id dự án đang được chọn (để highlight trong danh sách) */
    activeProjectId?: string | null
    /** Bấm "Tất cả" mở dialog toàn bộ dự án */
    onSeeMoreClick?: () => void
}

export default function MyProjectsSection({
    items,
    onSelect,
    onEdit,
    onAdd,
    initialShowCount = 5,
    paramKey = "rid",
    navMode = "replace",
    activeProjectId = null,
    onSeeMoreClick,
}: Props) {
    const { t } = useLanguage()
    const sortedItems = useMemo(() => {
      return [...items].sort((a, b) => {
        const aTime = a.updated_at || a.created_at || ""
        const bTime = b.updated_at || b.created_at || ""
        if (aTime > bTime) return -1
        if (aTime < bTime) return 1
        return String(a.id).localeCompare(String(b.id))
      })
    }, [items])
    const list = sortedItems.slice(0, initialShowCount)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handlePick = (r: Project) => {
        if (onSelect) {
            onSelect(r)
            return
        }
        const sp = new URLSearchParams(searchParams?.toString())
        sp.set(paramKey, String(r.id))
        const url = `${pathname}?${sp.toString()}`
        navMode === "push" ? router.push(url, { scroll: false }) : router.replace(url, { scroll: false })
    }

    return (
        <div className="px-2">
            <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/15 dark:to-primary/10 rounded-xl p-4 border border-primary/20 dark:border-primary/30 shadow-sm">
                <div className="flex justify-between items-center mb-3 select-none">
                    <div className="flex-1 flex items-center min-w-0 rounded-lg py-1 -my-1">
                        <FolderKanban className="w-4 h-4 mr-2 flex-shrink-0 text-primary" />
                        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider truncate">
                            {t("projects.myProjects")}
                        </h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 rounded-lg text-primary"
                        onClick={(e) => { e.stopPropagation(); onAdd() }}
                        title={t("projects.addProject")}
                        aria-label={t("projects.addProject")}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <ul className="space-y-1">
                    {list.map((r) => {
                        const isActive = activeProjectId != null && String(r.id) === String(activeProjectId)
                        return (
                        <li key={String(r.id)} className="group relative flex items-center gap-1">
                            <div
                                className={`flex-1 flex items-center min-w-0 rounded-lg transition-all duration-200 cursor-pointer py-2 px-2 ${
                                    isActive
                                        ? "bg-white/90 dark:bg-gray-700/80 shadow-sm ring-1 ring-primary/30 dark:ring-primary/40"
                                        : "hover:bg-white/60 dark:hover:bg-gray-600/60"
                                }`}
                                onClick={() => handlePick(r)}
                                role="button"
                                tabIndex={0}
                                title={r.name ?? undefined}
                            >
                                {(() => {
                                  const IconComp = getProjectIcon(r.icon)
                                  return <IconComp className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                                })()}
                                <div className="flex-1 min-w-0 flex flex-col items-start">
                                    <span className="text-sm font-normal text-gray-700 dark:text-gray-300 truncate w-full" title={r.name ?? undefined}>{r.name}</span>
                                    {r.is_shared && (r.owner_display_name || r.owner_email) && (
                                        <span className="text-[10px] text-primary truncate w-full" title={`${t("projects.owner")}: ${r.owner_display_name || r.owner_email}`}>
                                            {t("projects.owner")}: {r.owner_display_name || r.owner_email}
                                        </span>
                                    )}
                                </div>
                                {r.is_shared && (
                                    <span className="ml-1.5 flex items-center gap-0.5 text-[10px] text-primary flex-shrink-0" title={t("projects.sharedWithYou")}>
                                        <Users className="h-3 w-3" />
                                    </span>
                                )}
                            </div>
                        </li>
                        )
                    })}
                </ul>

                {onSeeMoreClick && sortedItems.length > initialShowCount && (
                    <Button
                        variant="ghost"
                        className="w-full justify-center text-sm text-primary mt-2 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200"
                        onClick={onSeeMoreClick}
                    >
                        {t("projects.all")}
                    </Button>
                )}
            </div>
        </div>
    )
}
