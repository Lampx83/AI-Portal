"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { MessageSquare, Trash2 } from "lucide-react"
import { deleteChatSession } from "@/lib/chat"
import { useToast } from "@/hooks/use-toast"
import type { ChatHistoryItem } from "@/components/sidebar/chat-history-section"

type Props = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  assistantAlias: string
  assistantName: string
  items: ChatHistoryItem[]
  onSelectSession: (sessionId: string) => void
  /** Gọi sau khi xóa thành công để parent reload danh sách */
  onDeleteSuccess?: () => void
}

export function AssistantChatHistoryDialog({
  isOpen,
  onOpenChange,
  assistantAlias,
  assistantName,
  items,
  onSelectSession,
  onDeleteSuccess,
}: Props) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const filtered = items.filter(
    (i) => (i.assistant_alias ?? "main") === assistantAlias
  )

  const handlePick = (id: string) => {
    onSelectSession(id)
    onOpenChange(false)
  }

  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return
    setDeleteConfirmId(null)
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await deleteChatSession(id)
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Lịch sử trò chuyện — {assistantName}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-2 px-2 min-h-0">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Chưa có cuộc trò chuyện nào với trợ lý này.
              </p>
            ) : (
              <ul className="space-y-1 py-2">
                {filtered.map((chat) => (
                  <li key={chat.id} className="group flex items-center gap-1 rounded-lg hover:bg-muted/50">
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start font-normal text-sm h-auto py-2 min-w-0"
                      onClick={() => handlePick(chat.id)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{chat.title}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmId(chat.id)
                      }}
                      title="Xóa cuộc trò chuyện"
                      disabled={deletingIds.has(chat.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa cuộc trò chuyện?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Toàn bộ tin nhắn trong phiên chat sẽ bị xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
