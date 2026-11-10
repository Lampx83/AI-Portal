"use client"

import { useEffect, useRef, useCallback, useState, useMemo } from "react"
import Link from "next/link"
import { Paperclip, Pencil, Copy, ThumbsUp, ThumbsDown, Send, X, Check, AlertCircle, CircleStop } from "lucide-react"
import ReactMarkdown from "react-markdown"
import "katex/dist/katex.min.css"
import { chatRemarkPlugins, chatRehypePlugins, prepareChatMarkdown } from "@/lib/markdown-plugins"
import type { Components } from "react-markdown"
import { TypewriterMarkdown } from "./typewriter-markdown"

const LINK_LONG_THRESHOLD = 50
const LINK_DISPLAY_MAX_LEN = 48

/** Normalize message content while preserving markdown block structure */
function normalizeMessageContent(content: string): string {
  if (content == null || typeof content !== "string") return ""
  let s = content
  // Normalize HTML/newline encodings from backend/LLM output.
  s = s.replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/\\n/g, "\n")
  s = s.replace(/\r\n?/g, "\n")
  // Keep table header title consistent in Vietnamese.
  s = s
    .split("\n")
    .map((line) =>
      line.includes("|")
        ? line.replace(/điểm trúng tuyển/gi, "Điểm trúng tuyển")
        : line
    )
    .join("\n")
  return s
}

function getBasePath(): string {
  return (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "").replace(/\/+$/, "") || ""
}

function createMarkdownLinkComponents(basePath: string): Components {
  return {
    a: ({ href, children, ...rest }) => {
      const childText =
        typeof children === "string"
          ? children
          : Array.isArray(children)
            ? children.map((c) => (typeof c === "string" ? c : "")).join("")
            : ""
      // Link nội bộ tới công cụ. Model đôi khi bịa /agents/ hoặc /assistants/ —
      // coi như /tools/ (backend đã sửa alias trong bản cuối; đây là lưới cho lúc
      // stream). basePath (/tuyen-sinh) phải thêm, nếu không sẽ 404.
      const internalHref =
        href != null && /^\/(tools|agents|assistants)\//.test(href)
          ? href.replace(/^\/(agents|assistants)\//, "/tools/")
          : null
      const isInternalTool = internalHref != null
      const resolvedHref = isInternalTool ? `${basePath}${internalHref}` : (href ?? "#")
      const isLongUrl =
        (href != null && href.length > LINK_LONG_THRESHOLD) || childText.length > LINK_LONG_THRESHOLD
      const displayText = isLongUrl
        ? (href && href.length > LINK_DISPLAY_MAX_LEN
            ? `${href.slice(0, LINK_DISPLAY_MAX_LEN)}…`
            : childText.length > LINK_DISPLAY_MAX_LEN
              ? `${childText.slice(0, LINK_DISPLAY_MAX_LEN)}…`
              : href || childText)
        : children
      if (isInternalTool) {
        return (
          <Link
            href={resolvedHref}
            className="underline hover:opacity-80 break-all"
            title={href ?? undefined}
            {...rest}
          >
            {displayText}
          </Link>
        )
      }
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
}

import { getIconComponent, type IconName } from "@/lib/assistants"
import { getEmbedTheme } from "@/lib/embed-theme"
import { useLanguage } from "@/contexts/language-context"
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
    /** Typewriter effect for new assistant message */
    typingEffect?: boolean
    /** Agent(s) that replied (from orchestrator) */
    meta?: { agents?: MessageAgent[] }
    /** User like/dislike for assistant reply */
    feedback?: "like" | "dislike"
    /** error = trợ lý lỗi/hết giờ; partial = người dùng đã dừng — hiện kiểu thông báo, không như câu trả lời bình thường */
    status?: "error" | "partial"
}

interface ChatMessagesProps {
    messages: Message[]
    isLoading: boolean
    assistantName: string
    getModelColor: (modelName: string) => string
    compactMessageText?: boolean
    /** Override for "{assistantName} is replying..." when isLoading */
    loadingMessage?: string
    /** Embed: agent icon and color (from URL params) */
    embedIcon?: IconName
    embedTheme?: string
    /** On user edit + send: (messageId, newContent) → parent truncates from that message and resends */
    onEditAndResend?: (messageId: string, newContent: string) => void
    /** Session id (required for like/dislike and feedback) */
    sessionId?: string
    /** After sending like/dislike: (messageId, feedback). feedback undefined = clear. */
    onFeedbackUpdated?: (messageId: string, feedback: "like" | "dislike" | undefined) => void
    /** Alias trợ lý đang chat — để hiện dòng trạng thái chờ phù hợp (vd. Tạp chí, hội thảo) */
    assistantAlias?: string
}

export function ChatMessages({
    messages,
    isLoading,
    assistantName,
    getModelColor,
    compactMessageText = false,
    loadingMessage,
    embedIcon,
    embedTheme,
    onEditAndResend,
    sessionId,
    onFeedbackUpdated,
    assistantAlias,
}: ChatMessagesProps) {
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
    const [editingDraft, setEditingDraft] = useState("")
    const basePath = getBasePath()
    const markdownLinkComponents = useMemo(() => createMarkdownLinkComponents(basePath), [basePath])
    const [dislikeDialog, setDislikeDialog] = useState<{ messageId: string } | null>(null)
    const [dislikeReason, setDislikeReason] = useState<string | null>(null)
    const [dislikeComment, setDislikeComment] = useState("")
    const [dislikeSubmitting, setDislikeSubmitting] = useState(false)
    const { t } = useLanguage()

    const [statusStep, setStatusStep] = useState<{ step: string; tools: string[] } | null>(null)
    useEffect(() => {
        if (!isLoading) {
            setStatusStep(null)
            return
        }
        const onStatus = (e: Event) => {
            const d = (e as CustomEvent).detail as { step?: string; tools?: string[] } | undefined
            if (d?.step) setStatusStep({ step: d.step, tools: d.tools ?? [] })
        }
        window.addEventListener("chat-status", onStatus)
        return () => window.removeEventListener("chat-status", onStatus)
    }, [isLoading])
    const statusText = statusStep
        ? statusStep.step === "tool"
            ? t("chat.status.tool").replace("{tools}", statusStep.tools.join(", "))
            : statusStep.step === "composing"
                ? t("chat.status.composing")
                : statusStep.step === "analyzing"
                    ? t("chat.status.analyzing")
                    : undefined
        : undefined
    // Trợ lý trả lời không qua luồng (không có sự kiện trạng thái): báo tiến độ theo thời gian chờ, chỉ đổi chữ 2 lần (không đếm giây để khỏi vẽ lại cả danh sách tin).
    const [waitStage, setWaitStage] = useState<0 | 1 | 2>(0)
    useEffect(() => {
        setWaitStage(0)
        if (!isLoading) return
        const t1 = setTimeout(() => setWaitStage(1), 2_000)
        const t2 = setTimeout(() => setWaitStage(2), 25_000)
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
        }
    }, [isLoading])
    const waitHint =
        waitStage === 2
            ? t("chat.status.longWait")
            : waitStage === 1 && assistantAlias === "publish"
                ? t("chat.status.publishSearching")
                : undefined
    // Hỏi nhanh «Câu trả lời có giúp ích không?» dưới câu trả lời mới nhất
    const [quickDislikeFor, setQuickDislikeFor] = useState<string | null>(null)
    const [quickDismissed, setQuickDismissed] = useState<Set<string>>(() => new Set())
    const [quickThanksFor, setQuickThanksFor] = useState<string | null>(null)
    const lastMessage = messages.length ? messages[messages.length - 1] : undefined
    const quickFeedbackId =
        !isLoading &&
        sessionId &&
        onFeedbackUpdated &&
        lastMessage &&
        lastMessage.sender === "assistant" &&
        !lastMessage.status &&
        UUID_RE.test(lastMessage.id) &&
        !lastMessage.feedback &&
        !quickDismissed.has(lastMessage.id)
            ? lastMessage.id
            : null
    const QUICK_DISLIKE_REASONS = [
        { id: "incorrect", labelKey: "chat.reasonIncorrect" },
        { id: "not_asked", labelKey: "chat.reasonNotAsked" },
        { id: "too_long", labelKey: "chat.reasonTooLong" },
        { id: "other", labelKey: "chat.reasonOther" },
    ] as const
    const sendQuickFeedback = async (messageId: string, kind: "like" | "dislike", comment?: string) => {
        if (!sessionId || !onFeedbackUpdated) return
        try {
            await setMessageFeedback(sessionId, messageId, kind, comment)
            onFeedbackUpdated(messageId, kind)
            setQuickDislikeFor(null)
            setQuickThanksFor(messageId)
            setTimeout(() => setQuickThanksFor((cur) => (cur === messageId ? null : cur)), 2500)
        } catch (e: any) {
            toast({ title: t("chat.ratingSendError"), description: e?.message, variant: "destructive" })
        }
    }
    const DISLIKE_REASONS = [
        { id: "incorrect", labelKey: "chat.reasonIncorrect" as const },
        { id: "not_asked", labelKey: "chat.reasonNotAsked" as const },
        { id: "slow_buggy", labelKey: "chat.reasonSlowBuggy" as const },
        { id: "style_tone", labelKey: "chat.reasonStyleTone" as const },
        { id: "other", labelKey: "chat.reasonOther" as const },
    ] as const
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
    const theme = getEmbedTheme(embedTheme)
    const EmbedIconComp = embedIcon ? getIconComponent(embedIcon) : null
    const containerRef = useRef<HTMLDivElement>(null)
    const previousSessionIdRef = useRef<string | undefined>(undefined)
    const previousMessagesLengthRef = useRef(messages.length)
    const { toast } = useToast()

    /** Scroll to bottom only if user is near bottom (avoid pulling while reading). */
    const SCROLL_THRESHOLD_PX = 120
    const scrollToBottomIfNear = useCallback(() => {
        const el = containerRef.current
        if (!el) return
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        if (distanceFromBottom <= SCROLL_THRESHOLD_PX) {
            el.scrollTop = el.scrollHeight
        }
    }, [])

    const scrollToBottom = useCallback(() => {
        const el = containerRef.current
        if (el) {
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight
            })
            setTimeout(() => {
                el.scrollTop = el.scrollHeight
            }, 50)
        }
    }, [])

    /** When a message is sent or loading starts: scroll so the new message and "assistant is replying..." bubble are visible. */
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const sessionChanged = sessionId !== previousSessionIdRef.current
        const messagesLengthIncreased = messages.length > previousMessagesLengthRef.current
        previousMessagesLengthRef.current = messages.length
        if (sessionChanged) {
            previousSessionIdRef.current = sessionId
            scrollToBottom()
        } else if (messagesLengthIncreased || isLoading) {
            scrollToBottom()
        } else {
            scrollToBottomIfNear()
        }
    }, [sessionId, messages.length, isLoading, scrollToBottom, scrollToBottomIfNear])

    const handleCopy = useCallback(
        (content: string, messageId: string) => {
            navigator.clipboard.writeText(content).then(
                () => {
                    setCopiedMessageId(messageId)
                    setTimeout(() => setCopiedMessageId(null), 2000)
                },
                () => toast({ title: t("chat.copyFailed"), variant: "destructive" })
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
                                    className={`relative max-w-[88%] rounded-lg p-3 ${message.sender === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : message.status === "error"
                                            ? "bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-900/60"
                                            : theme
                                            ? `${theme.bg} ${theme.text}`
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        } ${compactMessageText ? "text-[13px]" : "text-sm"}`}
                                >
                                    {message.sender === "assistant" && EmbedIconComp && !message.meta?.agents?.length && (
                                        <div className={`flex items-center gap-1.5 mb-2 ${theme ? theme.text : "text-muted-foreground"}`}>
                                            <div className={`flex items-center justify-center w-6 h-6 rounded ${theme ? theme.bg : "bg-muted"}`}>
                                                <EmbedIconComp className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="text-xs font-medium">{assistantName}</span>
                                        </div>
                                    )}
                                    {/* Inline edit for user message */}
                                    {message.sender === "user" && editingMessageId === message.id && onEditAndResend ? (
                                        <div className="space-y-2 min-w-[400px] sm:min-w-[480px]">
                                            <textarea
                                                value={editingDraft}
                                                onChange={(e) => setEditingDraft(e.target.value)}
                                                className="w-full min-h-[80px] px-3 py-2.5 text-sm rounded-md bg-white/20 text-white placeholder-white/70 border border-white/30 resize-y focus:outline-none focus:ring-2 focus:ring-white/50"
                                                placeholder={t("chat.editMessagePlaceholder")}
                                                autoFocus
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    className="h-8 bg-white text-primary hover:bg-white/90"
                                                    onClick={() => {
                                                        const trimmed = editingDraft.trim()
                                                        if (trimmed) onEditAndResend(message.id, trimmed)
                                                        setEditingMessageId(null)
                                                    }}
                                                >
                                                    <Send className="h-3.5 w-3.5 mr-1" />
                                                    {t("chat.send")}
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
                                                    {t("common.cancel")}
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
                                {message.sender === "assistant" && message.status && (
                                    <div
                                        className={`flex items-center gap-1.5 mb-1.5 text-xs font-medium ${message.status === "error" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}
                                        role={message.status === "error" ? "alert" : undefined}
                                    >
                                        {message.status === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <CircleStop className="h-3.5 w-3.5" />}
                                        <span>{message.status === "error" ? t("chat.replyErrorLabel") : t("chat.replyStoppedLabel")}</span>
                                    </div>
                                )}
                                {!(message.sender === "user" && editingMessageId === message.id) && (
                                  <>
                                    <div className={message.sender === "assistant" ? "chat-md" : undefined}>
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
                                        <ReactMarkdown remarkPlugins={chatRemarkPlugins} rehypePlugins={chatRehypePlugins} components={markdownLinkComponents}>
                                            {prepareChatMarkdown(normalizeMessageContent(String(message.content)))}
                                        </ReactMarkdown>
                                    )}
                                    </div>
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
                                  <p className={`${compactMessageText ? "text-[11px]" : "text-xs"} opacity-75 mt-1`}>{message.timestamp.toLocaleTimeString()}</p>
                                )}
                            </div>
                                {/* Copy, Edit — under user bubble, on hover */}
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
                                            <TooltipContent>{copiedMessageId === message.id ? t("chat.copied") : t("chat.copyMessage")}</TooltipContent>
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
                                            <TooltipContent>{t("chat.editAndResend")}</TooltipContent>
                                        </Tooltip>
                                    </div>
                                )}
                                {/* Like, Dislike, Copy — below assistant reply */}
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
                                            <TooltipContent>{copiedMessageId === message.id ? t("chat.copied") : t("chat.copyReply")}</TooltipContent>
                                        </Tooltip>
                                        {sessionId && onFeedbackUpdated && UUID_RE.test(message.id) && !message.status ? (
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
                                                                        toast({ title: t("chat.ratingSendError"), description: e?.message, variant: "destructive" })
                                                                    }
                                                                }}
                                                            >
                                                                <ThumbsUp className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{message.feedback === "like" ? t("chat.removeHelpful") : t("chat.helpful")}</TooltipContent>
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
                                                                            toast({ title: t("chat.ratingRemoveError"), description: e?.message, variant: "destructive" })
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
                                                        <TooltipContent>{message.feedback === "dislike" ? t("chat.removeNotHelpful") : t("chat.notHelpful")}</TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                )}
                                {/* Hỏi nhanh: chỉ dưới câu trả lời mới nhất, ẩn khi đã chọn hoặc bấm Ẩn */}
                                {message.id === quickFeedbackId && (
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" data-testid="quick-feedback">
                                        <span>{t("chat.helpfulPrompt")}</span>
                                        {quickDislikeFor !== message.id ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:bg-muted hover:text-foreground"
                                                    onClick={() => void sendQuickFeedback(message.id, "like")}
                                                    aria-label={t("chat.helpful")}
                                                >
                                                    <ThumbsUp className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:bg-muted hover:text-foreground"
                                                    onClick={() => setQuickDislikeFor(message.id)}
                                                    aria-label={t("chat.notHelpful")}
                                                >
                                                    <ThumbsDown className="h-3.5 w-3.5" />
                                                </button>
                                            </>
                                        ) : (
                                            QUICK_DISLIKE_REASONS.map((r) => (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    className="rounded-full border border-border px-2.5 py-0.5 hover:bg-muted hover:text-foreground"
                                                    onClick={() => {
                                                        if (r.id === "other") {
                                                            setQuickDislikeFor(null)
                                                            setDislikeDialog({ messageId: message.id })
                                                            setDislikeReason("other")
                                                            setDislikeComment("")
                                                            return
                                                        }
                                                        void sendQuickFeedback(message.id, "dislike", t(r.labelKey))
                                                    }}
                                                >
                                                    {t(r.labelKey)}
                                                </button>
                                            ))
                                        )}
                                        <button
                                            type="button"
                                            className="ml-0.5 rounded p-0.5 hover:bg-muted hover:text-foreground"
                                            onClick={() => {
                                                setQuickDislikeFor(null)
                                                setQuickDismissed((prev) => new Set(prev).add(message.id))
                                            }}
                                            aria-label={t("chat.helpfulDismiss")}
                                            title={t("chat.helpfulDismiss")}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                                {message.id === quickThanksFor && (
                                    <p className="mt-1 text-xs text-muted-foreground">{t("chat.helpfulThanks")}</p>
                                )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className={`rounded-lg p-3 max-w-[88%] ${theme ? theme.bg : "bg-gray-100 dark:bg-gray-800"}`}>
                                <div className="flex items-center gap-2">
                                    {EmbedIconComp ? (
                                        <div className={`flex items-center justify-center w-8 h-8 rounded ${theme ? theme.bg : "bg-muted"}`}>
                                            <EmbedIconComp className={`h-4 w-4 ${theme ? theme.text : "text-muted-foreground"}`} />
                                        </div>
                                    ) : (
                                        <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${theme ? theme.border : "border-primary"}`}></div>
                                    )}
                                    <span className={`${compactMessageText ? "text-xs" : "text-sm"} ${theme ? theme.text : "text-gray-600 dark:text-gray-400"}`}>
                                        {loadingMessage ?? statusText ?? waitHint ?? t("chat.responding").replace("{name}", assistantName)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </TooltipProvider>

            {/* Error dialog when user clicks Dislike */}
            <Dialog
                open={!!dislikeDialog}
                onOpenChange={(open) => {
                    if (!open) setDislikeDialog(null)
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("chat.shareFeedback")}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground mb-3">
                        {t("chat.chooseReasonHint")}
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
                                {t(r.labelKey)}
                            </Button>
                        ))}
                    </div>
                    <Textarea
                        placeholder={t("chat.detailPlaceholder")}
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
                            {t("common.cancel")}
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!sessionId || !dislikeDialog || !onFeedbackUpdated) return
                                setDislikeSubmitting(true)
                                try {
                                    const reasonLabel = DISLIKE_REASONS.find((r) => r.id === dislikeReason)
                                    const reasonText = reasonLabel ? t(reasonLabel.labelKey) : ""
                                    const comment = [reasonText, dislikeComment.trim()].filter(Boolean).join("\n\n")
                                    await setMessageFeedback(sessionId, dislikeDialog.messageId, "dislike", comment || undefined)
                                    onFeedbackUpdated(dislikeDialog.messageId, "dislike")
                                    setDislikeDialog(null)
                                    toast({ title: t("chat.feedbackSent") })
                                } catch (e: any) {
                                    toast({ title: t("chat.feedbackSendError"), description: e?.message, variant: "destructive" })
                                } finally {
                                    setDislikeSubmitting(false)
                                }
                            }}
                            disabled={dislikeSubmitting}
                        >
                            {dislikeSubmitting ? t("chat.sending") : t("chat.sendFeedback")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
