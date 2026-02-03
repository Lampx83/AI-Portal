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
import { Edit, History, MessageSquare, MoreHorizontal, Trash2, ChevronDown, Bot } from "lucide-react"
import { deleteChatSession, updateChatSessionTitle } from "@/lib/chat"
import { useToast } from "@/hooks/use-toast"

export type ChatHistoryItem = { id: string; title: string; assistant_alias?: string }

type Props = {
    initialItems: ChatHistoryItem[]
    /** Tên khóa query param lưu chat id, mặc định 'sid' */
    paramKey?: string
    /** push hay replace history; mặc định replace để không dài lịch sử */
    navMode?: "push" | "replace"
    /** Tổng số lượng tin nhắn trong tất cả các phiên chat */
    totalMessages?: number
    /** Callback khi xóa thành công để reload danh sách */
    onDeleteSuccess?: () => void
    /** Loading state từ parent */
    loading?: boolean
    /** Error message từ parent */
    errorMessage?: string
}

export default function ChatHistorySection({
    initialItems,
    paramKey = "sid",
    navMode = "replace",
    totalMessages,
    onDeleteSuccess,
    loading = false,
    errorMessage,
}: Props) {
    const [items, setItems] = useState<ChatHistoryItem[]>(initialItems)
    const [showAll, setShowAll] = useState(false)
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false)
    const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
    const [renameTitle, setRenameTitle] = useState("")
    const [renaming, setRenaming] = useState(false)
    const [clearingAll, setClearingAll] = useState(false)
    const { toast } = useToast()

    const visible = showAll ? items : items.slice(0, 3)

    const assistantLabel = (alias: string) => (alias === "main" ? "Trợ lý chính" : alias)

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
    const handleKeyPick = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handlePick(id)
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
                title: "Đã xóa",
                description: "Phiên chat đã được xóa thành công",
            })
            onDeleteSuccess?.()
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể xóa phiên chat",
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

    const handleClearAll = async () => {
        if (items.length === 0) return
        setClearAllConfirmOpen(false)
        setClearingAll(true)
        try {
            const results = await Promise.allSettled(items.map((item) => deleteChatSession(item.id)))
            const failed = results.filter((r) => r.status === "rejected").length
            const succeeded = results.filter((r) => r.status === "fulfilled").length
            setItems([])
            const currentSid = searchParams?.get(paramKey)
            if (currentSid && items.some((i) => i.id === currentSid)) {
                const sp = new URLSearchParams(searchParams?.toString())
                sp.delete(paramKey)
                const url = sp.toString() ? `${pathname}?${sp.toString()}` : pathname
                router.replace(url, { scroll: false })
            }
            if (failed > 0) {
                toast({
                    title: "Xóa một phần",
                    description: `Đã xóa ${succeeded} phiên. ${failed} phiên thất bại.`,
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "Đã xóa",
                    description: "Tất cả phiên chat đã được xóa thành công",
                })
            }
            onDeleteSuccess?.()
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể xóa tất cả phiên chat",
                variant: "destructive",
            })
        } finally {
            setClearingAll(false)
        }
    }

    const handleRenameSubmit = async () => {
        if (!renameSessionId || !renameTitle.trim()) return
        setRenaming(true)
        try {
            await updateChatSessionTitle(renameSessionId, renameTitle.trim())
            setItems((prev) =>
                prev.map((i) => (i.id === renameSessionId ? { ...i, title: renameTitle.trim() } : i))
            )
            toast({ title: "Đã đổi tên", description: "Tiêu đề phiên chat đã được cập nhật." })
            onDeleteSuccess?.()
            setRenameSessionId(null)
            setRenameTitle("")
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể đổi tên phiên chat",
                variant: "destructive",
            })
        } finally {
            setRenaming(false)
        }
    }

    return (
        <div className="px-2">
            <div className="bg-gradient-to-br from-gray-100 via-slate-100 to-gray-200 dark:from-gray-800/50 dark:via-slate-800/50 dark:to-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center">
                        <History className="w-4 h-4 mr-2" />
                        Lịch sử chat
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 rounded-lg"
                        onClick={() => setClearAllConfirmOpen(true)}
                        title="Xóa toàn bộ lịch sử"
                        disabled={items.length === 0 || loading || clearingAll}
                    >
                        <Trash2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </Button>
                </div>

                <ul className="space-y-1">
                    {visible.map((chat) => (
                        <li key={chat.id} className="group relative">
                            <div className="flex items-center">
                                {/* Vùng click chọn chat: cập nhật ?sid=<id> */}
                                <Button
                                    asChild
                                    variant="ghost"
                                    className="flex-1 justify-start text-sm font-normal min-h-9 py-1.5 truncate hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 rounded-lg pr-8"
                                >
                                    <div
                                        className="flex flex-col items-start w-full min-w-0 text-left"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handlePick(chat.id)}
                                        onKeyDown={(e) => handleKeyPick(e, chat.id)}
                                        aria-label={`Mở hội thoại: ${chat.title}`}
                                    >
                                        <span className="flex items-center w-full min-w-0">
                                            <MessageSquare className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                            <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{chat.title}</span>
                                        </span>
                                        <span className="flex items-center gap-1 mt-0.5 ml-6 text-[10px] text-muted-foreground truncate w-full max-w-[calc(100%-1.5rem)]" title={`Agent: ${assistantLabel(chat.assistant_alias ?? "main")}`}>
                                            <Bot className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                            <span className="truncate">Agent: {assistantLabel(chat.assistant_alias ?? "main")}</span>
                                        </span>
                                    </div>
                                </Button>

                                {/* Menu phụ (đổi tên / chia sẻ / xóa) */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 -ml-7 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white/80 dark:hover:bg-gray-600/80 rounded flex-shrink-0"
                                            aria-label="Tùy chọn"
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
                                            <Edit className="mr-2 h-4 w-4" /> Đổi tên
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
                                            {deletingIds.has(chat.id) ? "Đang xóa..." : "Xóa"}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </li>
                    ))}
                </ul>

                {items.length > 3 && (
                    <Button
                        variant="ghost"
                        className="w-full justify-center text-sm text-gray-500 dark:text-gray-400 mt-2 hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200"
                        onClick={() => setShowAll((v) => !v)}
                    >
                        <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showAll ? "rotate-180" : ""}`} />
                        Xem thêm
                    </Button>
                )}
            </div>

            {/* Modal xác nhận xóa một phiên */}
            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa cuộc trò chuyện</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Hành động không thể hoàn tác.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                        >
                            Xóa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal xác nhận xóa toàn bộ lịch sử */}
            <AlertDialog open={clearAllConfirmOpen} onOpenChange={setClearAllConfirmOpen}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa toàn bộ lịch sử chat</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn có chắc chắn muốn xóa tất cả {items.length} phiên chat? Hành động không thể hoàn tác.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                            onClick={handleClearAll}
                        >
                            {clearingAll ? "Đang xóa..." : "Xóa tất cả"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal đổi tên phiên chat */}
            <Dialog open={!!renameSessionId} onOpenChange={(open) => !open && setRenameSessionId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Đổi tên cuộc trò chuyện</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input
                            placeholder="Tiêu đề mới"
                            value={renameTitle}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameSessionId(null)}>
                            Hủy
                        </Button>
                        <Button onClick={handleRenameSubmit} disabled={!renameTitle.trim() || renaming}>
                            {renaming ? "Đang lưu..." : "Lưu"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
