"use client"
import { useState, KeyboardEvent, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Edit, History, MessageSquare, MoreHorizontal, Trash2, Bot, Trash } from "lucide-react"
import { deleteChatSession, updateChatSessionTitle } from "@/lib/chat"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"

export type ChatHistoryItem = { id: string; title: string; assistant_alias?: string }

type Props = {
    initialItems: ChatHistoryItem[]
    /** Query param key for chat id, default 'sid' */
    paramKey?: string
    /** push or replace history; default replace */
    navMode?: "push" | "replace"
    /** Total message count across all sessions */
    totalMessages?: number
    /** Callback after delete to reload list */
    onDeleteSuccess?: () => void
    /** On select conversation (optional override for setParam) */
    onPickSession?: (item: ChatHistoryItem) => void
    /** Loading state from parent */
    loading?: boolean
    /** Error message from parent */
    errorMessage?: string
}

export default function ChatHistorySection({
    initialItems,
    paramKey = "sid",
    navMode = "replace",
    totalMessages,
    onDeleteSuccess,
    onPickSession,
    loading = false,
    errorMessage,
}: Props) {
    const { t } = useLanguage()
    const [items, setItems] = useState<ChatHistoryItem[]>(initialItems)
    const [showAll, setShowAll] = useState(false)
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
    const [listExpanded, setListExpanded] = useState(true)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)
    const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
    const [renameTitle, setRenameTitle] = useState("")
    const [renaming, setRenaming] = useState(false)
    const { toast } = useToast()

    const visible = showAll ? items : items.slice(0, 3)

    const assistantLabel = (alias: string) => (alias === "central" || alias === "main" ? t("chat.assistantCentral") : alias)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        setItems(initialItems)
    }, [initialItems])

    const setParam = (key: string, value: string) => {
        const sp = new URLSearchParams(searchParams?.toString())
        sp.set(key, value)
        const url = `${pathname}?${sp.toString()}`
        navMode === "push" ? router.push(url, { scroll: false }) : router.replace(url, { scroll: false })
    }

    const handlePick = (id: string) => setParam(paramKey, id)
    const handlePickItem = (chat: ChatHistoryItem) => {
        if (onPickSession) {
            onPickSession(chat)
            return
        }
        handlePick(chat.id)
    }
    const handleKeyPick = (e: KeyboardEvent<HTMLDivElement>, chat: ChatHistoryItem) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handlePickItem(chat)
        }
    }

    const handleDelete = async (id: string) => {
        if (deletingIds.has(id)) return
        setDeleteConfirmId(null)
        setDeletingIds((prev) => new Set(prev).add(id))
        try {
            await deleteChatSession(id)
            setItems((prev) => prev.filter((i) => i.id !== id))
            const currentSid = searchParams?.get(paramKey)
            if (currentSid === id) {
                const sp = new URLSearchParams(searchParams?.toString())
                sp.delete(paramKey)
                const url = sp.toString() ? `${pathname}?${sp.toString()}` : pathname
                router.replace(url, { scroll: false })
            }
            toast({
                title: t("common.deleted"),
                description: t("chat.sessionDeleted"),
            })
            onDeleteSuccess?.()
        } catch (error: any) {
            toast({
                title: t("common.error"),
                description: error.message || t("chat.cannotDeleteSession"),
                variant: "destructive",
            })
        } finally {
            setDeletingIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        }
    }

    const handleDeleteAll = async () => {
        if (items.length === 0) return
        setDeletingAll(true)
        setDeleteAllConfirmOpen(false)
        const ids = [...items.map((i) => i.id)]
        const results = await Promise.allSettled(ids.map((id) => deleteChatSession(id)))
        const failed = results.filter((r) => r.status === "rejected").length
        setItems([])
        const currentSid = searchParams?.get(paramKey)
        if (currentSid && ids.includes(currentSid)) {
            const sp = new URLSearchParams(searchParams?.toString())
            sp.delete(paramKey)
            const url = sp.toString() ? `${pathname}?${sp.toString()}` : pathname
            router.replace(url, { scroll: false })
        }
        if (failed === 0) {
            toast({ title: t("common.deleted"), description: t("chat.deleteAllHistorySuccess") })
        } else {
            toast({
                title: t("common.error"),
                description: t("chat.deleteAllHistoryPartial").replace("{n}", String(failed)),
                variant: "destructive",
            })
        }
        onDeleteSuccess?.()
        setDeletingAll(false)
    }

    const handleRenameSubmit = async () => {
        if (!renameSessionId || !renameTitle.trim()) return
        setRenaming(true)
        try {
            await updateChatSessionTitle(renameSessionId, renameTitle.trim())
            setItems((prev) =>
                prev.map((i) => (i.id === renameSessionId ? { ...i, title: renameTitle.trim() } : i))
            )
            toast({ title: t("common.renamed"), description: t("chat.renameUpdated") })
            onDeleteSuccess?.()
            setRenameSessionId(null)
            setRenameTitle("")
        } catch (error: any) {
            toast({
                title: t("common.error"),
                description: error.message || t("chat.cannotRenameSession"),
                variant: "destructive",
            })
        } finally {
            setRenaming(false)
        }
    }

    return (
        <div className="px-2">
            <div className="bg-gradient-to-br from-gray-100 via-slate-100 to-gray-200 dark:from-gray-800/50 dark:via-slate-800/50 dark:to-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm">
                <div
                    className="flex justify-between items-center mb-3 cursor-pointer select-none"
                    onClick={() => setListExpanded((v) => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setListExpanded((v) => !v) } }}
                    title={listExpanded ? t("chat.collapseList") : t("chat.expandList")}
                    aria-expanded={listExpanded}
                >
                    <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
                        <History className="w-4 h-4 mr-2" />
                        {t("chat.historyTitle")}
                    </h3>
                    {items.length > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10"
                            title={t("chat.deleteAllHistory")}
                            aria-label={t("chat.deleteAllHistory")}
                            onClick={(e) => {
                                e.stopPropagation()
                                setDeleteAllConfirmOpen(true)
                            }}
                            disabled={deletingAll}
                        >
                            <Trash className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {listExpanded && (
                <ul className="space-y-1">
                    {visible.map((chat) => (
                        <li key={chat.id} className="group relative">
                            <div className="flex items-center">
                                {/* Click to select chat: update ?sid=<id> */}
                                <Button
                                    asChild
                                    variant="ghost"
                                    className="flex-1 justify-start text-sm font-normal min-h-9 py-1.5 truncate hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 rounded-lg pr-8"
                                >
                                    <div
                                        className="flex flex-col items-start w-full min-w-0 text-left"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handlePickItem(chat)}
                                        onKeyDown={(e) => handleKeyPick(e, chat)}
                                        aria-label={`${t("chat.openConversation")}: ${chat.title}`}
                                    >
                                        <span className="flex items-center w-full min-w-0">
                                            <MessageSquare className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                            <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{chat.title}</span>
                                        </span>
                                        <span className="flex items-center gap-1 mt-0.5 ml-6 text-[10px] text-muted-foreground truncate w-full max-w-[calc(100%-1.5rem)]" title={`${t("chat.assistantLabel")}: ${assistantLabel(chat.assistant_alias ?? "central")}`}>
                                            <Bot className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                            <span className="truncate">{t("chat.assistantLabel")}: {assistantLabel(chat.assistant_alias ?? "central")}</span>
                                        </span>
                                    </div>
                                </Button>

                                {/* Context menu (rename / share / delete) */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 -ml-7 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/80 dark:hover:bg-gray-600/80 rounded flex-shrink-0"
                                            aria-label={t("chat.options")}
                                        >
                                            <MoreHorizontal className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onSelect={() => {
                                                setRenameSessionId(chat.id)
                                                setRenameTitle(chat.title)
                                            }}
                                        >
                                            <Edit className="mr-2 h-4 w-4" /> {t("chat.renameConversation")}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onSelect={(e) => {
                                                e.preventDefault()
                                                setDeleteConfirmId(chat.id)
                                            }}
                                            className="text-red-600 dark:text-red-400"
                                            disabled={deletingIds.has(chat.id)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            {deletingIds.has(chat.id) ? t("chat.deleting") : t("chat.delete")}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </li>
                    ))}
                </ul>
                )}

                {listExpanded && items.length > 3 && (
                    <Button
                        variant="ghost"
                        className="w-full justify-center text-sm text-gray-500 dark:text-gray-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200"
                        onClick={() => setShowAll((v) => !v)}
                    >
                        {t("chat.seeMore")}
                    </Button>
                )}
            </div>

            {/* Confirm delete session */}
            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("chat.deleteConversation")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("chat.deleteConfirmDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                        >
                            {t("chat.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteAllConfirmOpen} onOpenChange={setDeleteAllConfirmOpen}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("chat.deleteAllHistory")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("chat.deleteAllHistoryConfirm")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                            onClick={handleDeleteAll}
                        >
                            {deletingAll ? t("chat.deleting") : t("chat.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rename session modal */}
            <Dialog open={!!renameSessionId} onOpenChange={(open) => !open && setRenameSessionId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("chat.renameConversation")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input
                            placeholder={t("chat.newTitlePlaceholder")}
                            value={renameTitle}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameSessionId(null)}>
                            {t("common.cancel")}
                        </Button>
                        <Button onClick={handleRenameSubmit} disabled={!renameTitle.trim() || renaming}>
                            {renaming ? t("common.saving") : t("common.save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
