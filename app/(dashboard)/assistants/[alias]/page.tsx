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

export default function AssistantPage() {
    const { alias } = useParams()
    const assistant = useAssistantsStore((s) => s.getByAlias(String(alias || "")))

    const [dataItems, setDataItems] = useState<any[]>([])
    const [viewMode, setViewMode] = useState<"card" | "list">("card")
    const [searchTerm, setSearchTerm] = useState("")
    const [filterType, setFilterType] = useState("all")
    const [sortKey, setSortKey] = useState("date")
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [selectedModelId, setSelectedModelId] = useState<string>("")

    const askControllerRef = useRef<AbortController | null>(null)

    // Load data & default model
    useEffect(() => {
        if (!assistant) return
        setIsLoading(true)
        const type = assistant?.provided_data_types?.[0]?.type
        if (type) {
            fetchWithTimeout(`${assistant.baseUrl}/data?type=${encodeURIComponent(type)}`)
                .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
                .then((json) => setDataItems(json?.items || []))
                .catch(() => setDataItems([]))
                .finally(() => setIsLoading(false))
        } else {
            setIsLoading(false)
        }
        if (assistant?.supported_models?.[0]) {
            setSelectedModelId(assistant.supported_models[0].model_id)
        }
    }, [assistant?.alias])

    const normalizedData = useMemo(() => {
        return dataItems.map((item: any) => ({
            id: item.id,
            title: item.title || item.id,
            type: item.type || assistant?.provided_data_types?.[0]?.type || "Khác",
            date: item.date || item.created_time || "2025-01-01",
            location: item.location || (item.country ? `${item.country}, ${item.region}` : ""),
            tags: item.tags || [],
        }))
    }, [dataItems, assistant?.provided_data_types])

    const filteredData = useMemo(() => {
        let arr = [...normalizedData]
        if (searchTerm) {
            arr = arr.filter((pub) => pub.title.toLowerCase().includes(searchTerm.toLowerCase()))
        }
        if (filterType !== "all") {
            arr = arr.filter((pub) => pub.type.includes(filterType))
        }
        arr.sort((a, b) => {
            if (sortKey === "title") return a.title.localeCompare(b.title)
            return new Date(a.date).getTime() - new Date(b.date).getTime()
        })
        return arr
    }, [searchTerm, filterType, sortKey, normalizedData])

    if (!assistant) {
        return (
            <div className="p-6">
                Không tìm thấy trợ lý với alias: <b>{alias}</b>
            </div>
        )
    }

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
            context: {
                language: "vi",
                project_id: "demo-project",
                extra_data: {
                    example: "demo",
                },
            },
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
        if (json?.status === "success") {
            return json.content_markdown || ""
        }
        throw new Error(json?.error_message || "Unknown error")
    }

    return (
        <div className="flex h-full min-h-0 flex-col"> {/* quan trọng để flex hoạt động đúng */}
            {/* Data View (header khi collapsed) */}
            <div className={`flex-1 min-h-0 overflow-auto  overflow-hidden transition-all duration-300 ${isCollapsed ? "max-h-16" : "max-h-none"}`}>
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
                        <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden">
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

                            {viewMode === "list" && (
                                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                                    <div className="relative w-full sm:flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <Input placeholder="Tìm kiếm..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    </div>
                                    <div className="flex w-full sm:w-auto gap-4">
                                        <Select value={filterType} onValueChange={setFilterType}>
                                            <SelectTrigger className="w-full sm:w-[180px]">
                                                <SelectValue placeholder="Lọc theo loại" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tất cả</SelectItem>
                                                <SelectItem value="Hội thảo">Hội thảo</SelectItem>
                                                <SelectItem value="Tạp chí">Tạp chí</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Select value={sortKey} onValueChange={setSortKey}>
                                            <SelectTrigger className="w-full sm:w-[180px]">
                                                <SelectValue placeholder="Sắp xếp" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="date">Ngày</SelectItem>
                                                <SelectItem value="title">Tên (A-Z)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {isLoading ? (
                                <div className="flex justify-center items-center py-10">
                                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
                                </div>
                            ) : viewMode === "card" ? (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {filteredData.map((item) => (
                                        <Card key={item.id} className="hover:shadow-lg transition-shadow">
                                            <CardHeader className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <Badge>{item.type}</Badge>
                                                        <CardTitle className="mt-1.5 text-base font-semibold">{item.title}</CardTitle>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4 pt-2">
                                                <div className="flex items-center text-xs text-gray-500 gap-4">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span>{new Date(item.date).toLocaleDateString("vi-VN")}</span>
                                                    {item.location && (
                                                        <>
                                                            <MapPin className="w-3.5 h-3.5" />
                                                            <span>{item.location}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </CardContent>
                                            {item.tags?.length > 0 && (
                                                <CardFooter className="p-4 pt-0">
                                                    {item.tags.map((tag: string) => (
                                                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                                                    ))}
                                                </CardFooter>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="border rounded-lg">
                                    {filteredData.map((item, idx) => (
                                        <div key={item.id} className={`p-4 ${idx < filteredData.length - 1 ? "border-b" : ""}`}>
                                            <div className="flex items-center gap-4">
                                                <Badge>{item.type}</Badge>
                                                <h3 className="font-semibold">{item.title}</h3>
                                            </div>
                                            <div className="flex items-center gap-6 mt-2 text-sm text-muted-foreground">
                                                <Calendar className="w-4 h-4" /> {new Date(item.date).toLocaleDateString("vi-VN")}
                                                {item.location && (<><MapPin className="w-4 h-4" /> {item.location}</>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Suggestions khi thu gọn: chiếm toàn bộ phần còn lại để đẩy Chat xuống đáy */}
            {isCollapsed && assistant?.sample_prompts?.length > 0 && (
                <div className="flex-1 min-h-0 overflow-auto p-4 border-b"> {/* 👈 flex-1 + overflow-auto */}
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

            {/* Chat ở đáy: flex-none để luôn nằm dưới cùng */}
            <ChatInterface
                className="flex-none border-t bg-background"
                assistantName={assistant.name}
                researchContext={null}
                onChatStart={() => setIsCollapsed(true)}
                onSendMessage={async (prompt, modelId) => {
                    const res = await fetch(`${assistant.baseUrl}/ask`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            session_id: crypto.randomUUID(),
                            user_id: "demo-user",
                            model_id: modelId,
                            prompt,
                            context: {
                                language: "vi",
                                project_id: "demo-project",
                                extra_data: {},
                            },
                        }),
                    })
                    const json = await res.json()
                    if (json?.status === "success") return json.content_markdown || ""
                    throw new Error(json?.error_message || "Unknown error")
                }}
                models={(assistant.supported_models || []).map((m) => ({
                    model_id: m.model_id,
                    name: m.name,
                }))}
            />
        </div>
    )
}
