"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { Paperclip, Pencil, Copy, ThumbsUp, ThumbsDown, Send, X, Check } from "lucide-react"
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
import { getIconComponent, type IconName } from "@/lib/assistants"
import { getEmbedTheme } from "@/lib/embed-theme"
import { useToast } from "@/hooks/use-toast"
import { setMessageFeedback } from "@/lib/chat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
    /** Like/dislike của user cho câu trả lời trợ lý */
    feedback?: "like" | "dislike"
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
    /** Khi user sửa tin nhắn và bấm Gửi: (messageId, newContent) → parent xoá từ tin đó trở đi và gửi lại để có câu trả lời mới */
    onEditAndResend?: (messageId: string, newContent: string) => void
    /** ID phiên chat (có thì mới hiện nút like/dislike và gửi feedback) */
    sessionId?: string
    /** Sau khi gửi like/dislike lên server, gọi để cập nhật state: (messageId, feedback). feedback undefined = xóa trạng thái. */
    onFeedbackUpdated?: (messageId: string, feedback: "like" | "dislike" | undefined) => void
}

export function ChatMessages({
    messages,
    isLoading,
    assistantName,
    getModelColor,
    loadingMessage,
    embedIcon,
    embedTheme,
    onEditAndResend,
    sessionId,
    onFeedbackUpdated,
}: ChatMessagesProps) {
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
    const [editingDraft, setEditingDraft] = useState("")
    const [dislikeDialog, setDislikeDialog] = useState<{ messageId: string } | null>(null)
    const [dislikeReason, setDislikeReason] = useState<string | null>(null)
    const [dislikeComment, setDislikeComment] = useState("")
    const [dislikeSubmitting, setDislikeSubmitting] = useState(false)

    const DISLIKE_REASONS = [
        { id: "incorrect", label: "Sai hoặc thiếu thông tin" },
        { id: "not_asked", label: "Không đúng câu hỏi" },
        { id: "slow_buggy", label: "Chậm hoặc lỗi" },
        { id: "style_tone", label: "Phong cách trả lời" },
        { id: "other", label: "Khác" },
    ] as const
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
    const theme = getEmbedTheme(embedTheme)
    const EmbedIconComp = embedIcon ? getIconComponent(embedIcon) : null
    const containerRef = useRef<HTMLDivElement>(null)
    const previousSessionIdRef = useRef<string | undefined>(undefined)
    const { toast } = useToast()

    /** Chỉ cuộn xuống đáy nếu user đang ở gần đáy, để khi đang trả lời user vẫn có thể cuộn lên đọc mà không bị kéo xuống. */
    const SCROLL_THRESHOLD_PX = 120
    const scrollToBottomIfNear = useCallback(() => {
        const el = containerRef.current
        if (!el) return
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        if (distanceFromBottom <= SCROLL_THRESHOLD_PX) {
            el.scrollTop = el.scrollHeight
        }
    }, [])

    /** Khi chuyển trợ lý/session: luôn cuộn xuống đáy để xem tin nhắn mới nhất. Còn lại dùng scrollToBottomIfNear. */
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const sessionChanged = sessionId !== previousSessionIdRef.current
        if (sessionChanged) {
            previousSessionIdRef.current = sessionId
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight
            })
            setTimeout(() => {
                el.scrollTop = el.scrollHeight
            }, 80)
        } else {
            scrollToBottomIfNear()
        }
    }, [sessionId, messages, isLoading, scrollToBottomIfNear])

    const handleCopy = useCallback(
        (content: string, messageId: string) => {
            navigator.clipboard.writeText(content).then(
                () => {
                    setCopiedMessageId(messageId)
                    setTimeout(() => setCopiedMessageId(null), 2000)
                },
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
                                className={`flex flex-col ${message.sender === "user" ? "items-end group" : "items-start"}`}
                            >
                                <div
                                    className={`relative max-w-[80%] rounded-lg p-3 ${message.sender === "user"
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
                                    {/* Chế độ sửa inline cho tin nhắn user */}
                                    {message.sender === "user" && editingMessageId === message.id && onEditAndResend ? (
                                        <div className="space-y-2 min-w-[400px] sm:min-w-[480px]">
                                            <textarea
                                                value={editingDraft}
                                                onChange={(e) => setEditingDraft(e.target.value)}
                                                className="w-full min-h-[80px] px-3 py-2.5 text-sm rounded-md bg-white/20 text-white placeholder-white/70 border border-white/30 resize-y focus:outline-none focus:ring-2 focus:ring-white/50"
                                                placeholder="Sửa nội dung tin nhắn..."
                                                autoFocus
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    className="h-8 bg-white text-blue-600 hover:bg-white/90"
                                                    onClick={() => {
                                                        const trimmed = editingDraft.trim()
                                                        if (trimmed) onEditAndResend(message.id, trimmed)
                                                        setEditingMessageId(null)
                                                    }}
                                                >
                                                    <Send className="h-3.5 w-3.5 mr-1" />
                                                    Gửi
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 text-white hover:bg-white/20"
                                                    onClick={() => {
                                                        setEditingMessageId(null)
                                                        setEditingDraft("")
                                                    }}
                                                >
                                                    <X className="h-3.5 w-3.5 mr-1" />
                                                    Huỷ
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}
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
                                {!(message.sender === "user" && editingMessageId === message.id) && (
                                  <>
                                    {message.sender === "assistant" && message.typingEffect ? (
                                        <TypewriterMarkdown
                                            content={normalizeMessageContent(String(message.content))}
                                            animate
                                            speed={12}
                                            chunkSize={3}
                                            onTypingUpdate={scrollToBottomIfNear}
                                            components={markdownLinkComponents}
                                        />
                                    ) : (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={markdownLinkComponents}>
                                            {normalizeMessageContent(String(message.content))}
                                        </ReactMarkdown>
                                    )}
                                  </>
                                )}

                                {!(message.sender === "user" && editingMessageId === message.id) && !!message.attachments?.length && (
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

                                {!(message.sender === "user" && editingMessageId === message.id) && (
                                  <p className="text-xs opacity-75 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                                )}
                            </div>
                                {/* Nút Copy, Edit — cho tin nhắn user, dưới bong bóng, chỉ hiện khi hover */}
                                {message.sender === "user" && editingMessageId !== message.id && onEditAndResend && (
                                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 ${copiedMessageId === message.id ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                                                    onClick={() => handleCopy(message.content, message.id)}
                                                >
                                                    {copiedMessageId === message.id ? (
                                                        <Check className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{copiedMessageId === message.id ? "Đã copy" : "Sao chép tin nhắn"}</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground"
                                                    onClick={() => {
                                                        setEditingMessageId(message.id)
                                                        setEditingDraft(message.content)
                                                    }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Chỉnh sửa và hỏi lại</TooltipContent>
                                        </Tooltip>
                                    </div>
                                )}
                                {/* Nút Like, Dislike, Copy — bên ngoài bong bóng, dưới câu trả lời assistant */}
                                {message.sender === "assistant" && (
                                    <div className="flex items-center gap-1 mt-1.5">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 ${copiedMessageId === message.id ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                                                    onClick={() => handleCopy(message.content, message.id)}
                                                >
                                                    {copiedMessageId === message.id ? (
                                                        <Check className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{copiedMessageId === message.id ? "Đã copy" : "Sao chép câu trả lời"}</TooltipContent>
                                        </Tooltip>
                                        {sessionId && onFeedbackUpdated && UUID_RE.test(message.id) ? (
                                            <>
                                                {message.feedback !== "dislike" && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className={`h-8 w-8 ${message.feedback === "like" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                                                                onClick={async () => {
                                                                    try {
                                                                        const next = message.feedback === "like" ? "none" : "like"
                                                                        await setMessageFeedback(sessionId, message.id, next)
                                                                        onFeedbackUpdated(message.id, next === "none" ? undefined : "like")
                                                                    } catch (e: any) {
                                                                        toast({ title: "Không gửi được đánh giá", description: e?.message, variant: "destructive" })
                                                                    }
                                                                }}
                                                            >
                                                                <ThumbsUp className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{message.feedback === "like" ? "Bỏ đánh giá hữu ích" : "Hữu ích"}</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {message.feedback !== "like" && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className={`h-8 w-8 ${message.feedback === "dislike" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                                                                onClick={async () => {
                                                                    if (message.feedback === "dislike") {
                                                                        try {
                                                                            await setMessageFeedback(sessionId, message.id, "none")
                                                                            onFeedbackUpdated(message.id, undefined)
                                                                        } catch (e: any) {
                                                                            toast({ title: "Không xóa được đánh giá", description: e?.message, variant: "destructive" })
                                                                        }
                                                                    } else {
                                                                        setDislikeDialog({ messageId: message.id })
                                                                        setDislikeReason(null)
                                                                        setDislikeComment("")
                                                                    }
                                                                }}
                                                            >
                                                                <ThumbsDown className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{message.feedback === "dislike" ? "Bỏ đánh giá không hữu ích" : "Không hữu ích"}</TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                )}
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

            {/* Dialog báo lỗi khi user bấm Dislike */}
            <Dialog
                open={!!dislikeDialog}
                onOpenChange={(open) => {
                    if (!open) setDislikeDialog(null)
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Chia sẻ phản hồi</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground mb-3">
                        Chọn lý do phản hồi (hoặc mô tả thêm bên dưới):
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {DISLIKE_REASONS.map((r) => (
                            <Button
                                key={r.id}
                                type="button"
                                variant={dislikeReason === r.id ? "secondary" : "outline"}
                                size="sm"
                                className="text-xs h-8"
                                onClick={() => setDislikeReason(dislikeReason === r.id ? null : r.id)}
                            >
                                {r.label}
                            </Button>
                        ))}
                    </div>
                    <Textarea
                        placeholder="Chi tiết thêm (tùy chọn)"
                        value={dislikeComment}
                        onChange={(e) => setDislikeComment(e.target.value)}
                        className="min-h-[80px] resize-y"
                        maxLength={2000}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDislikeDialog(null)}
                            disabled={dislikeSubmitting}
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!sessionId || !dislikeDialog || !onFeedbackUpdated) return
                                setDislikeSubmitting(true)
                                try {
                                    const reasonLabel = DISLIKE_REASONS.find((r) => r.id === dislikeReason)?.label
                                    const comment = [reasonLabel, dislikeComment.trim()].filter(Boolean).join("\n\n")
                                    await setMessageFeedback(sessionId, dislikeDialog.messageId, "dislike", comment || undefined)
                                    onFeedbackUpdated(dislikeDialog.messageId, "dislike")
                                    setDislikeDialog(null)
                                    toast({ title: "Đã gửi phản hồi" })
                                } catch (e: any) {
                                    toast({ title: "Không gửi được phản hồi", description: e?.message, variant: "destructive" })
                                } finally {
                                    setDislikeSubmitting(false)
                                }
                            }}
                            disabled={dislikeSubmitting}
                        >
                            {dislikeSubmitting ? "Đang gửi…" : "Gửi phản hồi"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
