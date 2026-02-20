"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { MessageSquare, Search, Calendar, Trash2, ExternalLink } from "lucide-react"
import { fetchChatSessions, deleteChatSession, type ChatSessionDTO } from "@/lib/chat"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import type { Project } from "@/types"

interface ProjectChatHistoryDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  project: Project | null
}

export function ProjectChatHistoryDialog({ isOpen, onOpenChange, project }: ProjectChatHistoryDialogProps) {
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState("")
  const [items, setItems] = useState<ChatSessionDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  function assistantDisplayName(alias: string | null | undefined): string {
    if (alias === "central" || alias === "main") return t("chat.assistantCentral")
    return alias || "—"
  }

  useEffect(() => {
    if (!isOpen || !project?.id) {
      setItems([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchChatSessions({
      projectId: String(project.id),
      limit: 100,
      offset: 0,
    })
      .then((res) => {
        if (!cancelled) setItems(res.data ?? [])
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          toast({ title: t("projectChat.loadHistoryError"), variant: "destructive" })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, project?.id, toast, t])

  const filteredItems = items.filter(
    (s) =>
      (s.title ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      assistantDisplayName(s.assistant_alias).toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleOpenSession = (sessionId: string, assistantAlias: string | null | undefined) => {
    onOpenChange(false)
    const rid = project?.id != null ? String(project.id) : ""
    const alias = assistantAlias === "central" || assistantAlias === "main" ? "central" : (assistantAlias || "central")
    const params = new URLSearchParams()
    params.set("sid", sessionId)
    if (rid) params.set("rid", rid)
    router.push(`/assistants/${alias}?${params.toString()}`)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    setDeleting(true)
    try {
      await deleteChatSession(deleteConfirmId)
      setItems((prev) => prev.filter((s) => s.id !== deleteConfirmId))
      toast({ title: t("projectChat.toastDeleted") })
      setDeleteConfirmId(null)
    } catch (e: any) {
      toast({ title: t("projectChat.deleteError"), description: e?.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const getAssistantBadgeClass = (alias: string | null | undefined): string => {
    if (alias === "central" || alias === "main") return "bg-primary/10 text-primary"
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
  }

  if (!project) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              {t("projectChat.historyTitle").replace("{name}", project.name ?? "")}
            </DialogTitle>
            <DialogDescription>{t("projectChat.description")}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 py-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t("projectChat.searchPlaceholder")}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              {t("projectChat.conversationsCount").replace("{count}", String(filteredItems.length))}
            </Badge>
          </div>

          <ScrollArea className="flex-1 pr-4">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">{t("projectChat.loading")}</div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((s) => (
                  <div
                    key={s.id}
                    className="group p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {s.title || t("chat.conversation")}
                          </h3>
                          <Badge className={`text-xs ${getAssistantBadgeClass(s.assistant_alias)}`}>
                            {assistantDisplayName(s.assistant_alias)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(s.created_at).toLocaleDateString("vi-VN")}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{t("projectChat.messagesCount").replace("{count}", String(s.message_count ?? 0))}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t("chat.openConversation")}
                          onClick={() => handleOpenSession(s.id, s.assistant_alias)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setDeleteConfirmId(s.id)}
                          title={t("chat.deleteConversation")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredItems.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {t("projectChat.noConversationsFound")}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchTerm ? t("projectChat.tryDifferentSearch") : t("projectChat.noConversations")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat.deleteConversationConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("chat.deleteConfirmPermanent")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? t("chat.deleting") : t("chat.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
