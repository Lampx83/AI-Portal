"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

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

export function DataGrid({ items }: { items: any[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((item, idx) => {
                const displayTitle = item?.title ?? item?.name ?? item?.id ?? `Item #${idx + 1}`
                const usedKey = item?.title ? "title" : item?.name ? "name" : item?.id ? "id" : null

                return (
                    <Card key={item?.id ?? idx} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base font-semibold break-words">
                                {displayTitle}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                            <div className="space-y-2">
                                {Object.keys(item ?? {})
                                    .filter((key) => key !== usedKey) // drop property used as title
                                    .map((key) => {
                                        const val = item[key]
                                        const isNested = isPlainObject(val) || Array.isArray(val)

                                        return (
                                            <div key={key} className="text-sm flex gap-2">
                                                <div className="font-medium text-muted-foreground whitespace-nowrap">
                                                    {prettyKey(key)}:
                                                </div>

                                                {/* auto-link: key === "url" */}
                                                {key === "url" && typeof val === "string" ? (
                                                    <a
                                                        href={val}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline break-all flex-1"
                                                    >
                                                        {val}
                                                    </a>
                                                ) : isNested ? (
                                                    <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 text-xs flex-1">
                                                        {formatValue(val)}
                                                    </pre>
                                                ) : (
                                                    <div className="break-words flex-1">{formatValue(val)}</div>
                                                )}
                                            </div>
                                        )
                                    })}

                                {(!item || Object.keys(item).filter((k) => k !== usedKey).length === 0) && (
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
                )
            })}
        </div>
    )
}
