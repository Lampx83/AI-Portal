"use client"

import { useEffect, useRef, useCallback } from "react"
import { Paperclip, Pencil, Copy } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"
import type { Components } from "react-markdown"
import { TypewriterMarkdown } from "./typewriter-markdown"

const LINK_LONG_THRESHOLD = 50
const LINK_DISPLAY_MAX_LEN = 48

/** Chuẩn hóa nội dung tin nhắn: <br> và \\n hiển thị xuống dòng trong markdown */
function normalizeMessageContent(content: string): string {
  if (content == null || typeof content !== "string") return ""
  let s = content
  // Chuyển thẻ <br> (HTML) thành ký tự xuống dòng
  s = s.replace(/<br\s*\/?>/gi, "\n")
  // Trong markdown (GFM), "hai dấu cách + \\n" = xuống dòng (<br>). Giữ \\n thành xuống dòng.
  s = s.replace(/\n/g, "  \n")
  return s
}

const markdownLinkComponents: Components = {
  a: ({ href, children, ...rest }) => {
    const childText =
      typeof children === "string"
        ? children
        : Array.isArray(children)
          ? children.map((c) => (typeof c === "string" ? c : "")).join("")
          : ""
    const isLongUrl =
      (href != null && href.length > LINK_LONG_THRESHOLD) || childText.length > LINK_LONG_THRESHOLD
    const displayText = isLongUrl
      ? (href && href.length > LINK_DISPLAY_MAX_LEN
          ? `${href.slice(0, LINK_DISPLAY_MAX_LEN)}…`
          : childText.length > LINK_DISPLAY_MAX_LEN
            ? `${childText.slice(0, LINK_DISPLAY_MAX_LEN)}…`
            : href || childText)
      : children
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:opacity-80 break-all"
        title={href ?? undefined}
        {...rest}
      >
        {displayText}
      </a>
    )
  },
}
import { getIconComponent, type IconName } from "@/lib/research-assistants"
import { getEmbedTheme } from "@/lib/embed-theme"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface MessageAgent {
    alias: string
    name: string
    icon: string
}

interface Message {
    id: string
    content: string
    sender: "user" | "assistant"
    timestamp: Date
    model?: string
    attachments?: File[]
    /** Dùng hiệu ứng gõ chữ cho tin nhắn assistant mới */
    typingEffect?: boolean
    /** Agent(s) đã trả lời (orchestrator trả về) */
    meta?: { agents?: MessageAgent[] }
}

interface ChatMessagesProps {
    messages: Message[]
    isLoading: boolean
    assistantName: string
    getModelColor: (modelName: string) => string
    /** Nếu có: dùng thay cho "{assistantName} đang trả lời..." khi isLoading (vd: "Các agent phù hợp đang trả lời...") */
    loadingMessage?: string
    /** Khi nhúng (embed): icon và màu cho agent (từ URL ?icon=...&color=...) */
    embedIcon?: IconName
    embedTheme?: string
    /** Gọi khi user bấm "Chỉnh sửa" trên tin nhắn user: (messageId, content) → parent set input và xoá từ tin đó trở đi */
    onEditMessage?: (messageId: string, content: string) => void
}

export function ChatMessages({
    messages,
    isLoading,
    assistantName,
    getModelColor,
    loadingMessage,
    embedIcon,
    embedTheme,
    onEditMessage,
}: ChatMessagesProps) {
    const theme = getEmbedTheme(embedTheme)
    const EmbedIconComp = embedIcon ? getIconComponent(embedIcon) : null
    const containerRef = useRef<HTMLDivElement>(null)
    const { toast } = useToast()

    const scrollToBottom = useCallback(() => {
        const el = containerRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, isLoading, scrollToBottom])

    const handleCopy = useCallback(
        (content: string) => {
            navigator.clipboard.writeText(content).then(
                () => toast({ title: "Đã copy câu trả lời vào clipboard" }),
                () => toast({ title: "Không thể copy", variant: "destructive" })
            )
        },
        [toast]
    )

    return (
        <div
            ref={containerRef}
            className="h-full flex-1 min-h-0 overflow-auto px-4 pt-4 pb-8"
        >
            <TooltipProvider delayDuration={300}>
                <div className="flex flex-col h-full">
                    <div className="mt-auto space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`group relative max-w-[80%] rounded-lg p-3 pr-10 ${message.sender === "user"
                                        ? "bg-blue-500 text-white"
                                        : theme
                                            ? `${theme.bg} ${theme.text}`
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        }`}
                                >
                                    {message.sender === "assistant" && EmbedIconComp && !message.meta?.agents?.length && (
                                        <div className={`flex items-center gap-1.5 mb-2 ${theme ? theme.text : "text-muted-foreground"}`}>
                                            <div className={`flex items-center justify-center w-6 h-6 rounded ${theme ? theme.bg : "bg-muted"}`}>
                                                <EmbedIconComp className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="text-xs font-medium">{assistantName}</span>
                                        </div>
                                    )}
                                    {/* Nút hành động: Edit (user) / Copy (assistant) */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {message.sender === "user" && onEditMessage ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-current hover:bg-white/20"
                                                        onClick={() => onEditMessage(message.id, message.content)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Chỉnh sửa và hỏi lại</TooltipContent>
                                            </Tooltip>
                                        ) : null}
                                        {message.sender === "assistant" ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
                                                        onClick={() => handleCopy(message.content)}
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Sao chép câu trả lời</TooltipContent>
                                            </Tooltip>
                                        ) : null}
                                    </div>
                                    {message.sender === "assistant" && message.meta?.agents?.length ? (
                                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                        {message.meta.agents.length === 1 ? (
                                            <>
                                                <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10">
                                                    {(() => {
                                                        const Icon = getIconComponent((message.meta.agents[0].icon || "Bot") as IconName)
                                                        return <Icon className="h-3.5 w-3.5 text-primary" />
                                                    })()}
                                                </div>
                                                <span className="text-xs text-muted-foreground">{message.meta.agents[0].name}</span>
                                            </>
                                        ) : (
                                            message.meta.agents.map((a) => {
                                                const Icon = getIconComponent((a.icon || "Bot") as IconName)
                                                return (
                                                    <div
                                                        key={a.alias}
                                                        className="flex items-center justify-center w-6 h-6 rounded bg-primary/10"
                                                        title={a.name}
                                                    >
                                                        <Icon className="h-3.5 w-3.5 text-primary" />
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                ) : null}
                                {message.sender === "assistant" && message.typingEffect ? (
                                    <TypewriterMarkdown
                                        content={normalizeMessageContent(String(message.content))}
                                        animate
                                        speed={12}
                                        chunkSize={3}
                                        onTypingUpdate={scrollToBottom}
                                        components={markdownLinkComponents}
                                    />
                                ) : (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={markdownLinkComponents}>
                                        {normalizeMessageContent(String(message.content))}
                                    </ReactMarkdown>
                                )}

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
                            <div className={`rounded-lg p-3 max-w-[80%] ${theme ? theme.bg : "bg-gray-100 dark:bg-gray-800"}`}>
                                <div className="flex items-center gap-2">
                                    {EmbedIconComp ? (
                                        <div className={`flex items-center justify-center w-8 h-8 rounded ${theme ? theme.bg : "bg-muted"}`}>
                                            <EmbedIconComp className={`h-4 w-4 ${theme ? theme.text : "text-muted-foreground"}`} />
                                        </div>
                                    ) : (
                                        <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${theme ? theme.border : "border-blue-500"}`}></div>
                                    )}
                                    <span className={`text-sm ${theme ? theme.text : "text-gray-600 dark:text-gray-400"}`}>
                                        {loadingMessage ?? `${assistantName} đang trả lời...`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </TooltipProvider>
        </div>
    )
}
