// app/assistants/[alias]/page.tsx
"use client"

import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// ⬇️ Bỏ Input, Search khỏi import vì đã chuyển sang component con
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, LayoutGrid, List, ChevronUp, ChevronDown } from "lucide-react"
import { fetchWithTimeout } from "@/lib/fetch-utils"
import { ChatInterface } from "@/components/chat-interface"
import { ChatSuggestions } from "@/components/chat-suggestions"
import { researchAssistants } from "@/components/sidebar"
import { AssistantDataPane } from "@/components/assistant-data-pane"  // 👈 thêm

export default function AssistantPage() {
    const params = useParams()
    const aliasParam = Array.isArray(params?.alias) ? params.alias[0] : (params?.alias ?? "")
    const [hasMessages, setHasMessages] = useState(false)

    const assistant = useMemo(
        () => (researchAssistants || []).find((a: any) => a.alias === aliasParam),
        [aliasParam]
    )

    const [dataItems, setDataItems] = useState<any[]>([])
    const [viewMode, setViewMode] = useState<"card" | "list">("card")
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

    const toggleCollapse = () => setIsCollapsed((p) => !p)

    if (!assistant) {
        return <div className="p-6">Không tìm thấy trợ lý với alias: <b>{String(aliasParam)}</b></div>
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
                                    <Button
                                        variant={viewMode === "card" ? "secondary" : "ghost"}
                                        size="icon"
                                        onClick={() => setViewMode("card")}
                                    >
                                        <LayoutGrid className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant={viewMode === "list" ? "secondary" : "ghost"}
                                        size="icon"
                                        onClick={() => setViewMode("list")}
                                    >
                                        <List className="h-5 w-5" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={toggleCollapse}>
                                        <ChevronUp className="h-4 w-4 mr-1" /> Thu gọn
                                    </Button>
                                </div>
                            </div>

                            {/* ⬇️ Phần “data” đã tách thành component */}
                            <AssistantDataPane items={dataItems} isLoading={isLoading} viewMode={viewMode} />
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
                    setHasMessages(true)
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
                models={(assistant.supported_models || []).map((m: any) => ({ model_id: m.model_id, name: m.name }))}
            />
        </div>
    )
}
