// components/assistant-data-pane.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react"
import { DataGrid } from "@/components/data-grid"
import { DataTable } from "@/components/data-table"

type ViewMode = "card" | "list"

export function AssistantDataPane({
    items,
    isLoading,
    viewMode,
    pageSize = 6,
}: {
    items: any[]
    isLoading: boolean
    viewMode: ViewMode
    pageSize?: number
}) {
    const [searchTerm, setSearchTerm] = useState("")
    const filteredItems = useMemo(() => {
        if (!searchTerm) return items
        const needle = searchTerm.toLowerCase()
        return items.filter((it) => {
            try {
                for (const k of Object.keys(it ?? {})) {
                    const v = it[k]
                    if (typeof v === "string" && v.toLowerCase().includes(needle)) return true
                }
                return JSON.stringify(it).toLowerCase().includes(needle)
            } catch { return false }
        })
    }, [items, searchTerm])

    const [page, setPage] = useState(1)
    const total = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    useEffect(() => { setPage(1) }, [searchTerm, items])

    const startIdx = (page - 1) * pageSize
    const endIdx = Math.min(startIdx + pageSize, total)
    const pageItems = filteredItems.slice(startIdx, endIdx)

    return (
        <>
            {isLoading ? (
                <div className="flex justify-center items-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
                </div>
            ) : viewMode === "card" ? (
                <DataGrid items={pageItems} />
            ) : (
                <DataTable items={pageItems} />
            )}

            {!isLoading && total > 0 && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                        Hiển thị <span className="font-medium">{startIdx + 1}</span>–<span className="font-medium">{endIdx}</span>{" "}
                        trong tổng số <span className="font-medium">{total}</span> mục
                    </div>

                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} aria-label="Trang đầu">
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Trang trước">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <span className="px-2 text-sm">
                            Trang <span className="font-medium">{page}</span>/<span className="font-medium">{totalPages}</span>
                        </span>

                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Trang sau">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Trang cuối">
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}
