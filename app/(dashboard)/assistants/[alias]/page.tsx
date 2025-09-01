// app/assistants/[alias]/page.tsx
"use client"
import { useSession } from "next-auth/react"

import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, LayoutGrid, List, ChevronUp, ChevronDown } from "lucide-react"
import { ChatInterface, ChatInterfaceHandle } from "@/components/chat-interface"
import { ChatSuggestions } from "@/components/chat-suggestions"
import { researchAssistants } from "@/lib/research-assistants"
import { AssistantDataPane } from "@/components/assistant-data-pane"

// 👇 Thêm Tabs của shadcn/ui
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function AssistantPage() {
    const chatRef = useRef<ChatInterfaceHandle>(null)

    const params = useParams()
    const aliasParam = Array.isArray(params?.alias) ? params.alias[0] : (params?.alias ?? "")
    const [hasMessages, setHasMessages] = useState(false)

    const assistant = useMemo(
        () => (researchAssistants || []).find((a: any) => a.alias === aliasParam),
        [aliasParam]
    )

    // 👉 Nếu có nhiều loại data, ta dùng tab. Lấy danh sách type + nhãn
    const dataTypes = useMemo(
        () => (assistant?.provided_data_types ?? []).map((d: any) => ({ type: d.type, label: d.label ?? d.type })),
        [assistant?.alias]
    )

    const [activeType, setActiveType] = useState<string>(dataTypes?.[0]?.type ?? "")
    const [viewMode, setViewMode] = useState<"card" | "list">("card")
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // 👉 Cache dữ liệu theo type để không fetch lại nhiều lần
    const [itemsByType, setItemsByType] = useState<Record<string, any[]>>({})
    const [loadingByType, setLoadingByType] = useState<Record<string, boolean>>({})

    // model
    const [selectedModelId, setSelectedModelId] = useState<string>("")

    useEffect(() => {
        if (!assistant) return
        // reset khi đổi assistant
        setItemsByType({})
        setLoadingByType({})
        setActiveType(dataTypes?.[0]?.type ?? "")
        setIsLoading(true)

        if (assistant?.supported_models?.length) {
            setSelectedModelId(assistant.supported_models[0].model_id)
        }
    }, [assistant?.alias]) // eslint-disable-line react-hooks/exhaustive-deps


    // 👉 Fetch theo activeType (có cache)
    useEffect(() => {
        if (!assistant || !activeType) {
            setIsLoading(false)
            return
        }
        // nếu đã có cache thì không fetch lại
        if (itemsByType[activeType]) {
            setIsLoading(false)
            return
        }

        const run = async () => {
            setIsLoading(true)
            setLoadingByType((m) => ({ ...m, [activeType]: true }))
            try {
                const url = `${assistant.baseUrl}/data?type=${encodeURIComponent(activeType)}`
                const res = await fetch(url)
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
                const json = await res.json()
                const items = Array.isArray(json?.items) ? json.items : []
                setItemsByType((m) => ({ ...m, [activeType]: items }))
            } catch (e) {
                console.error(e)
                setItemsByType((m) => ({ ...m, [activeType]: [] }))
            } finally {
                setIsLoading(false)
                setLoadingByType((m) => ({ ...m, [activeType]: false }))
            }
        }
        run()
    }, [assistant?.baseUrl, activeType]) // eslint-disable-line react-hooks/exhaustive-deps

    const toggleCollapse = () => setIsCollapsed((p) => !p)

    if (!assistant) {
        return <div className="p-6">Không tìm thấy trợ lý với alias: <b>{String(aliasParam)}</b></div>
    }

    const itemsCurrent = itemsByType[activeType] ?? []
    const totalCount = Object.values(itemsByType).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)


    const { data: session } = useSession()

    const isOrchestrator = assistant?.alias === "main"
    const greetingName = session?.user?.name || session?.user?.email || "bạn"

    const headerTitle = isOrchestrator
        ? `Xin chào, ${greetingName} 👋`
        : assistant.name

    const headerSubtitle = isOrchestrator
        ? "Bạn đã sẵn sàng khám phá chưa?"
        : assistant.description

    const shouldShowSuggestions =
        !!assistant?.sample_prompts?.length &&
        !hasMessages &&
        (isCollapsed || !activeType)

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                className={`flex-1 min-h-0 transition-all duration-300 ${(isCollapsed || shouldShowSuggestions) ? "max-h-40 overflow-auto" : "max-h-none overflow-visible"
                    }`}
            >
                {isCollapsed ? (
                    <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {assistant.name} ({totalCount || itemsCurrent.length})
                            </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={toggleCollapse}>
                            <ChevronDown className="h-4 w-4 mr-1" /> Mở rộng
                        </Button>
                    </div>
                ) : (
                    <div className="h-full p-4 sm:p-6 lg:p-8">
                        <div className="flex h-full w-full max-w-none flex-col min-h-0">
                            <div className="mb-4 flex flex-col gap-4 md:flex-col lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <h1 className="text-2xl font-bold">{headerTitle}</h1>
                                    <p className="text-gray-500 dark:text-gray-400 mt-1">{headerSubtitle}</p>
                                </div>
                                {!!activeType && (
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant={viewMode === "card" ? "secondary" : "ghost"}
                                            size="icon"
                                            onClick={() => setViewMode("card")}
                                            aria-label="Xem dạng thẻ"
                                        >
                                            <LayoutGrid className="h-5 w-5" />
                                        </Button>
                                        <Button
                                            variant={viewMode === "list" ? "secondary" : "ghost"}
                                            size="icon"
                                            onClick={() => setViewMode("list")}
                                            aria-label="Xem dạng bảng"
                                        >
                                            <List className="h-5 w-5" />
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={toggleCollapse}>
                                            <ChevronUp className="h-4 w-4 mr-1" /> Thu gọn
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* 👇 Nếu có nhiều type thì hiện Tabs; nếu chỉ 1 thì hiện thẳng */}
                            {dataTypes.length > 1 ? (
                                <Tabs value={activeType} onValueChange={setActiveType} className="flex-1 min-h-0 flex flex-col">
                                    <TabsList className="mb-4 w-full overflow-auto">
                                        {dataTypes.map((dt) => (
                                            <TabsTrigger key={dt.type} value={dt.type} className="whitespace-nowrap">
                                                {dt.label}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>

                                    {dataTypes.map((dt) => (
                                        <TabsContent key={dt.type} value={dt.type} className="flex-1 min-h-0">
                                            <AssistantDataPane
                                                items={dt.type === activeType ? itemsCurrent : (itemsByType[dt.type] ?? [])}
                                                isLoading={dt.type === activeType ? (isLoading || !!loadingByType[dt.type]) : !!loadingByType[dt.type]}
                                                viewMode={viewMode}
                                            />
                                        </TabsContent>
                                    ))}
                                </Tabs>
                            ) : (
                                <AssistantDataPane
                                    items={itemsCurrent}
                                    isLoading={isLoading || !!loadingByType[activeType]}
                                    viewMode={viewMode}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Gợi ý chat khi thu gọn */}
            {
                shouldShowSuggestions && (
                    <div className="flex-1 min-h-0 overflow-auto p-4 border-b">
                        <ChatSuggestions
                            suggestions={assistant.sample_prompts}
                            onSuggestionClick={(s) => {
                                chatRef.current?.applySuggestion(s)
                            }}
                            assistantName={assistant.name}
                        />
                    </div>
                )
            }

            <ChatInterface
                ref={chatRef}
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
        </div >
    )
}
