// components/assistant-data-pane.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react"
import { DataGrid } from "@/components/data-grid"
import { DataTable } from "@/components/data-table"

const PAGE_SIZE_OPTIONS = [10, 50, 100] as const
const DEFAULT_PAGE_SIZE = 50
type ViewMode = "card" | "list"

export function AssistantDataPane({
    items,
    isLoading,
    viewMode,
    pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
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

    const [pageSize, setPageSize] = useState(() =>
        PAGE_SIZE_OPTIONS.includes(initialPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
            ? initialPageSize
            : DEFAULT_PAGE_SIZE
    )
    const [page, setPage] = useState(1)
    const total = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    useEffect(() => { setPage(1) }, [searchTerm, items])
    useEffect(() => {
        setPage((p) => Math.min(p, totalPages))
    }, [pageSize, totalPages])

    const startIdx = (page - 1) * pageSize
    const endIdx = Math.min(startIdx + pageSize, total)
    const pageItems = filteredItems.slice(startIdx, endIdx)

    const topBar = !isLoading && total > 0 && (
        <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                    Hiển thị
                    <Select
                        value={String(pageSize)}
                        onValueChange={(v) => setPageSize(Number(v))}
                    >
                        <SelectTrigger className="h-8 w-[70px]" aria-label="Số mục mỗi trang">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                    {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    mục / trang
                </span>
                <span>
                    <span className="font-medium text-foreground">{startIdx + 1}</span>–
                    <span className="font-medium text-foreground">{endIdx}</span> trong tổng{" "}
                    <span className="font-medium text-foreground">{total}</span> mục
                </span>
            </div>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} aria-label="Trang đầu">
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Trang trước">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-sm whitespace-nowrap">
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
    )

    return (
        <div className="flex flex-col h-full min-h-0">
            {topBar}
            {isLoading ? (
                <div className="flex justify-center items-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
                </div>
            ) : viewMode === "card" ? (
                <div className="flex-1 min-h-0 overflow-auto">
                    <DataGrid items={pageItems} />
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                    {/* Table container với scroll */}
                    <div className="flex-1 min-h-0 overflow-auto">
                        <DataTable items={pageItems} />
                    </div>
                </div>
            )}
        </div>
    )
}
