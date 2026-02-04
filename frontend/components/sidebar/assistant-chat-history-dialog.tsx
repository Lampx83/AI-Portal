"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"
import type { ChatHistoryItem } from "@/components/sidebar/chat-history-section"

type Props = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  assistantAlias: string
  assistantName: string
  items: ChatHistoryItem[]
  onSelectSession: (sessionId: string) => void
}

export function AssistantChatHistoryDialog({
  isOpen,
  onOpenChange,
  assistantAlias,
  assistantName,
  items,
  onSelectSession,
}: Props) {
  const filtered = items.filter(
    (i) => (i.assistant_alias ?? "main") === assistantAlias
  )

  const handlePick = (id: string) => {
    onSelectSession(id)
    onOpenChange(false)
  }

  return (
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
                <li key={chat.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-normal text-sm h-auto py-2"
                    onClick={() => handlePick(chat.id)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
