"use client"

import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Paperclip } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

interface Message {
    id: string
    content: string
    sender: "user" | "assistant"
    timestamp: Date
    model?: string
    attachments?: File[]
}

interface ChatMessagesProps {
    messages: Message[]
    isLoading: boolean
    assistantName: string
    getModelColor: (modelName: string) => string
}

export function ChatMessages({
    messages,
    isLoading,
    assistantName,
    getModelColor,
}: ChatMessagesProps) {
    // Vùng cuộn chính
    const containerRef = useRef<HTMLDivElement>(null)

    // Auto-scroll xuống cuối khi có tin nhắn mới hoặc đang loading
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
    }, [messages, isLoading])

    return (
        <div
            ref={containerRef}
            className="h-full flex-1 min-h-0 overflow-auto p-4" // ✔ chuẩn
        >
            <div className="flex flex-col h-full">
                <div className="mt-auto space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-3 ${message.sender === "user"
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    }`}
                            >


                                <ReactMarkdown remarkPlugins={[remarkGfm]} >
                                    {String(message.content)}
                                </ReactMarkdown>

                                {!!message.attachments?.length && (
                                    <div className="mt-2 space-y-1">
                                        {message.attachments.map((file, index) => {
                                            const fileUrl = (file as any).url;
                                            return (
                                                <div key={index} className="text-xs opacity-75 flex items-center gap-1">
                                                    <Paperclip className="h-3 w-3" />
                                                    {fileUrl ? (
                                                        <a 
                                                            href={fileUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="underline hover:opacity-100"
                                                        >
                                                            {file.name}
                                                        </a>
                                                    ) : (
                                                        <span>{file.name}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <p className="text-xs opacity-75 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[80%]">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {assistantName} đang trả lời...
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
