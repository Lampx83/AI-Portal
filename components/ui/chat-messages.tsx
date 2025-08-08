"use client"

import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Paperclip } from "lucide-react"

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
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isLoading])

    return (
        <div
            className={`flex-1 overflow-y-auto ${messages.length > 0 ? "p-4 space-y-4" : ""
                }`}
        >
            {
                messages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                            className={`max-w-[80%] rounded-lg p-3 ${message.sender === "user"
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                }`}
                        >
                            {message.sender === "assistant" && message.model && (
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="secondary" className="text-xs">
                                        <div className={`w-2 h-2 rounded-full ${getModelColor(message.model)} mr-1`} />
                                        {message.model}
                                    </Badge>
                                </div>
                            )}

                            <p className="text-sm">{message.content}</p>

                            {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {message.attachments.map((file, index) => (
                                        <div key={index} className="text-xs opacity-75 flex items-center gap-1">
                                            <Paperclip className="h-3 w-3" />
                                            {file.name}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="text-xs opacity-75 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                        </div>
                    </div>
                ))
            }
            {
                isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[80%]">
                            <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{assistantName} đang trả lời...</span>
                            </div>
                        </div>
                    </div>
                )
            }
            <div ref={messagesEndRef} />
        </div >
    )
}