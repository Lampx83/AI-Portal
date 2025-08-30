// app/assistants/[alias]/page.tsx
"use client"

import { useParams } from "next/navigation"
import { useState, useEffect, useMemo, useRef } from "react"
import { useAssistantsStore } from "@/lib/assistants-store"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, MapPin, LayoutGrid, List, Search, ChevronUp, ChevronDown } from "lucide-react"
import { fetchWithTimeout } from "@/lib/fetch-utils"
import { ChatInterface } from "@/components/chat-interface"
import { ChatSuggestions } from "@/components/chat-suggestions"

// ────────────────────────────────────────────────────────────
// 1) Helpers: render giá trị bất kỳ một cách an toàn
// ────────────────────────────────────────────────────────────
function isPlainObject(v: unknown): v is Record<string, any> {
    return typeof v === "object" && v !== null && !Array.isArray(v)
}

function formatValue(v: any): string {
    if (v === null) return "null"
    if (v === undefined) return "undefined"
    if (typeof v === "string") return v
    try {
        return JSON.stringify(v, null, 0)
    } catch {
        return String(v)
    }
}

function prettyKey(k: string) {
    return k
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ────────────────────────────────────────────────────────────
// 2) Grid động: hiển thị toàn bộ key–value, hỗ trợ lồng nhau
// ────────────────────────────────────────────────────────────
function RawGrid({ items }: { items: any[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((item, idx) => (
                <Card key={item?.id ?? idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="p-4">
                        <CardTitle className="text-base font-semibold break-words">
                            {item?.title ?? item?.name ?? item?.id ?? `Item #${idx + 1}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        <div className="space-y-2">
                            {/* Với object phẳng: render tất cả key–value; với lồng nhau: stringify gọn */}
                            {Object.keys(item ?? {}).map((key) => {
                                const val = item[key]
                                const isNested = isPlainObject(val) || Array.isArray(val)
                                return (
                                    <div key={key} className="text-sm">
                                        <div className="font-medium text-muted-foreground">{prettyKey(key)}</div>
                                        {isNested ? (
                                            <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-xs">
                                                {formatValue(val)}
                                            </pre>
                                        ) : (
                                            <div className="mt-1 break-words">{formatValue(val)}</div>
                                        )}
                                    </div>
                                )
                            })}
                            {/* Nếu item rỗng */}
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

// ────────────────────────────────────────────────────────────
// 3) Table động: hợp nhất tất cả keys làm cột
// ────────────────────────────────────────────────────────────
function collectAllKeys(items: any[]): string[] {
    const s = new Set<string>()
    for (const it of items) {
        if (isPlainObject(it)) {
            Object.keys(it).forEach((k) => s.add(k))
        }
    }
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
                            <td className="px-3 py-3 text-muted-foreground" colSpan={columns.length}>
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

// ────────────────────────────────────────────────────────────
// 4) Trang chính: thay vì chuẩn hóa, dùng trực tiếp dataItems
// ────────────────────────────────────────────────────────────
export default function AssistantPage() {
    const { alias } = useParams()
    const [hasMessages, setHasMessages] = useState(false) // 👈 THÊM

    const assistant = useAssistantsStore((s) => s.getByAlias(String(alias || "")))

    const [dataItems, setDataItems] = useState<any[]>([])
    const [viewMode, setViewMode] = useState<"card" | "list">("card")
    const [searchTerm, setSearchTerm] = useState("")
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [selectedModelId, setSelectedModelId] = useState<string>("")

    const askControllerRef = useRef<AbortController | null>(null)

    useEffect(() => {
        if (!assistant) return
        setIsLoading(true)
        const type = assistant?.provided_data_types?.[0]?.type
        const fetchData = async (type?: string) => {
            if (!type) {
                setDataItems([])
                setIsLoading(false)
                return
            }
            setIsLoading(true)
            try {
                const url = `${assistant.baseUrl}/data?type=${encodeURIComponent(type)}`
                const response = await fetch(url)
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
                const json = await response.json()
                setDataItems(Array.isArray(json?.items) ? json.items : [])
            } catch (e) {
                console.error(e)
                setDataItems([])
            } finally {
                setIsLoading(false)
            }
        }
        fetchData(type)
        if (assistant?.supported_models?.length) {
            setSelectedModelId(assistant.supported_models[0].model_id)
        }
    }, [assistant?.alias])

    // Tìm kiếm toàn văn trên mọi thuộc tính dạng chuỗi
    const filteredItems = useMemo(() => {
        if (!searchTerm) return dataItems
        const needle = searchTerm.toLowerCase()
        return dataItems.filter((it) => {
            try {
                // Ưu tiên duyệt nhanh các giá trị string, nếu không stringify
                for (const k of Object.keys(it ?? {})) {
                    const v = it[k]
                    if (typeof v === "string" && v.toLowerCase().includes(needle)) return true
                }
                return JSON.stringify(it).toLowerCase().includes(needle)
            } catch {
                return false
            }
        })
    }, [dataItems, searchTerm])

    // if (!assistant) {
    //     return <div className="p-6">Không tìm thấy trợ lý với alias: <b>{String(alias)}</b></div>
    // }

    const toggleCollapse = () => setIsCollapsed((p) => !p)

    async function callAgentAsk(prompt: string) {
        askControllerRef.current?.abort()
        const controller = new AbortController()
        askControllerRef.current = controller

        const body = {
            session_id: crypto.randomUUID(),
            user_id: "demo-user",
            model_id: selectedModelId,
            prompt,
            context: { language: "vi", project_id: "demo-project", extra_data: { example: "demo" } },
        }

        const res = await fetchWithTimeout(`${assistant.baseUrl}/ask`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            timeoutMs: 15000,
            signal: controller.signal,
        })
        if (!res.ok) {
            const t = await res.text().catch(() => "")
            throw new Error(`HTTP ${res.status}: ${t || res.statusText}`)
        }
        const json = await res.json()
        if (json?.status === "success") return json.content_markdown || ""
        throw new Error(json?.error_message || "Unknown error")
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className={`flex-1 min-h-0 overflow-auto transition-all duration-300 ${isCollapsed ? "max-h-16" : "max-h-none"}`}>

                {isCollapsed ? (
                    <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {assistant.name} ({dataItems.length})
                            </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={toggleCollapse}>
                            <ChevronDown className="h-4 w-4 mr-1" /> Mở rộng
                        </Button>
                    </div>
                ) : (
                    <div className="h-full p-4 sm:p-6 lg:p-8">
                        <div className="mx-auto flex h-full max-w-6xl flex-col min-h-0">
                            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold">{assistant.name}</h1>
                                    <p className="text-gray-500 dark:text-gray-400 mt-1">{assistant.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant={viewMode === "card" ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode("card")}>
                                        <LayoutGrid className="h-5 w-5" />
                                    </Button>
                                    <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode("list")}>
                                        <List className="h-5 w-5" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={toggleCollapse}>
                                        <ChevronUp className="h-4 w-4 mr-1" /> Thu gọn
                                    </Button>
                                </div>
                            </div>

                            {/* Thanh tìm kiếm áp dụng cho mọi thuộc tính */}
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

                            {isLoading ? (
                                <div className="flex justify-center items-center py-10">
                                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
                                </div>
                            ) : viewMode === "card" ? (
                                <RawGrid items={filteredItems} />
                            ) : (
                                <RawTable items={filteredItems} />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Gợi ý chat khi thu gọn */}
            {isCollapsed && assistant?.sample_prompts?.length > 0 && !hasMessages && (
                <div className="flex-1 min-h-0 overflow-auto p-4 border-b">
                    <ChatSuggestions
                        suggestions={assistant.sample_prompts}
                        onSuggestionClick={(s) => {
                            const input = document.querySelector<HTMLInputElement>('input[placeholder^="Nhập tin nhắn"]')
                            if (input) input.value = s
                        }}
                        assistantName={assistant.name}
                    />
                </div>
            )}

            <ChatInterface
                className="flex-1 min-h-0 border-t bg-background"
                assistantName={assistant.name}
                researchContext={null}
                onChatStart={() => {
                    setIsCollapsed(true)
                    setHasMessages(true) // 👈 khi bắt đầu chat, coi như đã có message
                }}

                onSendMessage={async (prompt, modelId) => {
                    const res = await fetch(`${assistant.baseUrl}/ask`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            session_id: crypto.randomUUID(),
                            user: "demo-user",
                            model_id: modelId,
                            prompt,
                            context: { language: "vi", project: "demo-project", extra_data: {} },
                        }),
                    })
                    const json = await res.json()
                    if (json?.status === "success") return json.content_markdown || ""
                    throw new Error(json?.error_message || "Unknown error")
                }}
                models={(assistant.supported_models || []).map((m) => ({ model_id: m.model_id, name: m.name }))}
            />
        </div>
    )
}
