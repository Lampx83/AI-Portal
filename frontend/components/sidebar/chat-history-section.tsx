"use client"
import { useState, KeyboardEvent, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Edit, History, MessageSquare, MoreHorizontal, Share, Trash2, ChevronDown } from "lucide-react"
import { deleteChatSession } from "@/lib/chat"
import { useToast } from "@/hooks/use-toast"

export type ChatHistoryItem = { id: string; title: string }

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
    const { toast } = useToast()

    const visible = showAll ? items : items.slice(0, 3)

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
        if (deletingIds.has(id)) return // Đang xóa rồi thì không xóa lại
        
        setDeletingIds((prev) => new Set(prev).add(id))
        try {
            await deleteChatSession(id)
            setItems((prev) => prev.filter((i) => i.id !== id))
            // Nếu đang xem session này thì redirect về trang chủ
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
            console.error("Failed to delete session:", error)
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

    const handleClear = async () => {
        if (items.length === 0) return
        if (!confirm(`Bạn có chắc chắn muốn xóa tất cả ${items.length} phiên chat?`)) {
            return
        }

        try {
            // Xóa tất cả sessions
            const deletePromises = items.map((item) => deleteChatSession(item.id))
            await Promise.all(deletePromises)
            
            setItems([])
            // Xóa sid khỏi URL nếu đang xem một session nào đó
            const currentSid = searchParams?.get(paramKey)
            if (currentSid && items.some((i) => i.id === currentSid)) {
                const sp = new URLSearchParams(searchParams?.toString())
                sp.delete(paramKey)
                const url = sp.toString() ? `${pathname}?${sp.toString()}` : pathname
                router.replace(url, { scroll: false })
            }
            toast({
                title: "Đã xóa",
                description: "Tất cả phiên chat đã được xóa thành công",
            })
            onDeleteSuccess?.()
        } catch (error: any) {
            console.error("Failed to clear sessions:", error)
            toast({
                title: "Lỗi",
                description: error.message || "Không thể xóa tất cả phiên chat",
                variant: "destructive",
            })
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
                        onClick={handleClear}
                        title="Xóa toàn bộ lịch sử"
                        disabled={items.length === 0 || loading}
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
                                    className="flex-1 justify-start text-sm font-normal h-9 truncate hover:bg-white/60 dark:hover:bg-gray-600/60 transition-all duration-200 rounded-lg pr-8"
                                >
                                    <div
                                        className="flex items-center w-full"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handlePick(chat.id)}
                                        onKeyDown={(e) => handleKeyPick(e, chat.id)}
                                        aria-label={`Mở hội thoại: ${chat.title}`}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                        <span className="text-gray-700 dark:text-gray-300 truncate">{chat.title}</span>
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
                                        <DropdownMenuItem>
                                            <Edit className="mr-2 h-4 w-4" /> Đổi tên
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <Share className="mr-2 h-4 w-4" /> Chia sẻ
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => handleDelete(chat.id)}
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
        </div>
    )
}
