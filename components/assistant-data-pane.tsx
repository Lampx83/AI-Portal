"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

type ViewMode = "card" | "list"

function isPlainObject(v: unknown): v is Record<string, any> {
    return typeof v === "object" && v !== null && !Array.isArray(v)
}
function formatValue(v: any): string {
    if (v === null) return "null"
    if (v === undefined) return "undefined"
    if (typeof v === "string") return v
    try { return JSON.stringify(v, null, 0) } catch { return String(v) }
}
function prettyKey(k: string) {
    return k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ─ Grid ─ */
function RawGrid({ items }: { items: any[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((item, idx) => (
                <Card key={item?.id ?? idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="p-4">
                        <CardTitle className="text-base font-semibold break-words">
                            {item?.title ?? item?.name ?? item?.id ?? `Item #${idx + 1}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        <div className="space-y-2">
                            {Object.keys(item ?? {}).map((key) => {
                                const val = item[key]
                                const isNested = isPlainObject(val) || Array.isArray(val)
                                return (
                                    <div key={key} className="text-sm flex gap-2">
                                        <div className="font-medium text-muted-foreground whitespace-nowrap">
                                            {prettyKey(key)}:
                                        </div>
                                        {isNested ? (
                                            <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 text-xs flex-1">
                                                {formatValue(val)}
                                            </pre>
                                        ) : (
                                            <div className="break-words flex-1">{formatValue(val)}</div>
                                        )}
                                    </div>
                                )
                            })}

                            {(!item || Object.keys(item).length === 0) && (
                                <div className="text-sm text-muted-foreground">∅ (Không có thuộc tính)</div>
                            )}
                        </div>
                    </CardContent>

                    {Array.isArray(item?.tags) && item.tags.length > 0 && (
                        <CardFooter className="p-4 pt-0 flex flex-wrap gap-2">
                            {item.tags.map((t: any, i: number) => (
                                <Badge key={`${t}-${i}`} variant="secondary" className="text-xs">
                                    {String(t)}
                                </Badge>
                            ))}
                        </CardFooter>
                    )}
                </Card>
            ))}
        </div>
    )
}

/* ─ Table ─ */
function collectAllKeys(items: any[]): string[] {
    const s = new Set<string>()
    for (const it of items) if (isPlainObject(it)) Object.keys(it).forEach((k) => s.add(k))
    return Array.from(s)
}

function RawTable({ items }: { items: any[] }) {
    const columns = useMemo(() => collectAllKeys(items), [items])
    return (
        <div className="w-full overflow-auto border rounded-lg">
            <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                    <tr>
                        {columns.map((col) => (
                            <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                {prettyKey(col)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-3 text-muted-foreground" colSpan={columns.length || 1}>
                                Không có dữ liệu
                            </td>
                        </tr>
                    ) : (
                        items.map((row, rIdx) => (
                            <tr key={row?.id ?? rIdx} className="border-t">
                                {columns.map((col) => {
                                    const cell = row?.[col]
                                    const nested = isPlainObject(cell) || Array.isArray(cell)
                                    return (
                                        <td key={col} className="align-top px-3 py-2">
                                            {nested ? (
                                                <pre className="max-h-40 overflow-auto rounded bg-muted/30 p-2 text-xs">
                                                    {formatValue(cell)}
                                                </pre>
                                            ) : (
                                                <span className="break-words">{formatValue(cell)}</span>
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}

/* ─ AssistantDataPane với phân trang ─ */
export function AssistantDataPane({
    items,
    isLoading,
    viewMode,
    pageSize = 6, // 👈 mặc định 6/phần trang
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
            } catch {
                return false
            }
        })
    }, [items, searchTerm])

    const [page, setPage] = useState(1)
    const total = filteredItems.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    // Reset về trang 1 khi dữ liệu hoặc từ khóa thay đổi
    useEffect(() => { setPage(1) }, [searchTerm, items])

    const startIdx = (page - 1) * pageSize
    const endIdx = Math.min(startIdx + pageSize, total)
    const pageItems = filteredItems.slice(startIdx, endIdx)

    return (
        <>
            {/* Search */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                        placeholder="Tìm kiếm toàn bộ dữ liệu…"
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center items-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
                </div>
            ) : viewMode === "card" ? (
                <RawGrid items={pageItems} />
            ) : (
                <RawTable items={pageItems} />
            )}

            {/* Pagination */}
            {!isLoading && total > 0 && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                        Hiển thị <span className="font-medium">{startIdx + 1}</span>–<span className="font-medium">{endIdx}</span>{" "}
                        trong tổng số <span className="font-medium">{total}</span> mục
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            aria-label="Trang đầu"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            aria-label="Trang trước"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <span className="px-2 text-sm">
                            Trang <span className="font-medium">{page}</span>/<span className="font-medium">{totalPages}</span>
                        </span>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            aria-label="Trang sau"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                            aria-label="Trang cuối"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}
