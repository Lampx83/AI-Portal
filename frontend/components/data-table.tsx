"use client"

import { useMemo } from "react"

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
function collectAllKeys(items: any[]): string[] {
    const s = new Set<string>()
    for (const it of items) if (isPlainObject(it)) Object.keys(it).forEach((k) => s.add(k))
    return Array.from(s)
}

export function DataTable({ items }: { items: any[] }) {
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

                                    // Auto-link nếu cột tên "url" và là string
                                    if (col === "url" && typeof cell === "string") {
                                        return (
                                            <td key={col} className="align-top px-3 py-2">
                                                <a
                                                    href={cell}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline break-all"
                                                >
                                                    {cell}
                                                </a>
                                            </td>
                                        )
                                    }

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
