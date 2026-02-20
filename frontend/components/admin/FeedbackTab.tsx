"use client"

import { useEffect, useState } from "react"
import { MessageSquarePlus, ThumbsDown, Pencil, Check, X, Clock, Trash2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  getAdminFeedback,
  patchAdminFeedback,
  getAdminMessageFeedback,
  patchAdminMessageFeedback,
  deleteAdminMessageFeedback,
  getAgents,
  type AdminUserFeedback,
  type AdminMessageFeedback,
  type AgentRow,
} from "@/lib/api/admin"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"

function formatDate(s: string) {
  return new Date(s).toLocaleString("vi-VN")
}

export function FeedbackTab() {
  const { t } = useLanguage()
  return (
    <Tabs defaultValue="system" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="system" className="gap-1.5">
          <MessageSquarePlus className="h-4 w-4" />
          {t("admin.feedback.tabSystem")}
        </TabsTrigger>
        <TabsTrigger value="message" className="gap-1.5">
          <ThumbsDown className="h-4 w-4" />
          {t("admin.feedback.tabMessage")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="system" className="mt-0">
        <SystemFeedbackSubTab />
      </TabsContent>
      <TabsContent value="message" className="mt-0">
        <MessageFeedbackSubTab />
      </TabsContent>
    </Tabs>
  )
}

function SystemFeedbackSubTab() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AdminUserFeedback[]>([])
  const [page, setPage] = useState({ limit: 50, offset: 0, total: 0 })
  const [resolvedFilter, setResolvedFilter] = useState<"all" | "true" | "false">("all")
  const [editModal, setEditModal] = useState<AdminUserFeedback | null>(null)
  const [noteValue, setNoteValue] = useState("")
  const [resolvedValue, setResolvedValue] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    getAdminFeedback({
      limit: page.limit,
      offset: page.offset,
      resolved: resolvedFilter === "all" ? undefined : (resolvedFilter as "true" | "false"),
    })
      .then((res) => {
        setData(res.data)
        setPage((p) => ({ ...p, total: res.page.total }))
      })
      .catch((e) => setError((e as Error)?.message || t("admin.feedback.loadError")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [page.offset, resolvedFilter])

  const handleResolvedFilterChange = (v: "all" | "true" | "false") => {
    setResolvedFilter(v)
    setPage((p) => ({ ...p, offset: 0 }))
  }

  const openEdit = (fb: AdminUserFeedback) => {
    setEditModal(fb)
    setNoteValue(fb.admin_note ?? "")
    setResolvedValue(!!fb.resolved)
  }

  const saveEdit = async () => {
    if (!editModal) return
    setSaving(true)
    try {
      await patchAdminFeedback(editModal.id, {
        admin_note: noteValue.trim() || null,
        resolved: resolvedValue,
      })
      toast({ title: t("admin.feedback.saved") })
      setEditModal(null)
      load()
    } catch (e) {
      toast({ title: (e as Error)?.message || t("common.error"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleResolved = async (fb: AdminUserFeedback) => {
    try {
      await patchAdminFeedback(fb.id, { resolved: !fb.resolved })
      toast({ title: fb.resolved ? t("admin.feedback.unmarkResolved") : t("admin.feedback.markResolved") })
      load()
    } catch (e) {
      toast({ title: (e as Error)?.message || t("common.error"), variant: "destructive" })
    }
  }

  if (loading && data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center">{t("admin.feedback.loading")}</p>
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Label>{t("admin.feedback.filterByStatus")}</Label>
        <Select value={resolvedFilter} onValueChange={handleResolvedFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.feedback.all")}</SelectItem>
            <SelectItem value="false">{t("admin.feedback.unresolved")}</SelectItem>
            <SelectItem value="true">{t("admin.feedback.resolved")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-md overflow-auto max-h-[520px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.feedback.time")}</TableHead>
              <TableHead>{t("admin.feedback.sender")}</TableHead>
              <TableHead>{t("admin.feedback.assistant")}</TableHead>
              <TableHead>{t("admin.feedback.content")}</TableHead>
              <TableHead>{t("admin.feedback.note")}</TableHead>
              <TableHead className="w-[100px]">{t("admin.feedback.status")}</TableHead>
              <TableHead className="w-[120px]">{t("admin.feedback.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t("admin.feedback.noFeedback")}
                </TableCell>
              </TableRow>
            ) : (
              data.map((fb) => (
                <TableRow key={fb.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(fb.created_at)}</TableCell>
                  <TableCell>
                    <span title={fb.user_id}>{fb.user_email}</span>
                    {fb.user_display_name && (
                      <span className="text-muted-foreground ml-1">({fb.user_display_name})</span>
                    )}
                  </TableCell>
                  <TableCell>{fb.assistant_alias ?? t("admin.feedback.assistantDefault")}</TableCell>
                  <TableCell className="max-w-[280px] truncate" title={fb.content}>
                    {fb.content}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={fb.admin_note ?? ""}>
                    {fb.admin_note ?? "—"}
                  </TableCell>
                  <TableCell>
                    {fb.resolved ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 gap-1 whitespace-nowrap">
                        <Check className="h-3 w-3" />
                        {t("admin.feedback.resolved")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {t("admin.feedback.unresolved")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(fb)} title={t("admin.feedback.titleNoteAndMark")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleResolved(fb)}
                        title={fb.resolved ? t("admin.feedback.unmarkResolved") : t("admin.feedback.markResolved")}
                      >
                        {fb.resolved ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {page.total > page.limit && (
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>
            {page.offset + 1}–{Math.min(page.offset + page.limit, page.total)} / {page.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page.offset === 0}
              onClick={() => setPage((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
            >
              {t("admin.feedback.buttonPrev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page.offset + page.limit >= page.total}
              onClick={() => setPage((p) => ({ ...p, offset: p.offset + p.limit }))}
            >
              {t("admin.feedback.buttonNext")}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editModal} onOpenChange={(o) => !o && setEditModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.feedback.titleNoteAndMark")}</DialogTitle>
          </DialogHeader>
          {editModal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("admin.feedback.contentLabel")}</p>
                <p className="text-sm bg-muted/50 rounded p-2">{editModal.content}</p>
              </div>
              <div>
                <Label htmlFor="admin-note">{t("admin.feedback.adminNoteLabel")}</Label>
                <Textarea
                  id="admin-note"
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder={t("admin.feedback.adminNotePlaceholder")}
                  className="mt-1.5 min-h-[80px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="resolved-check"
                  checked={resolvedValue}
                  onChange={(e) => setResolvedValue(e.target.checked)}
                />
                <Label htmlFor="resolved-check">{t("admin.feedback.resolvedLabel")}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MessageFeedbackSubTab() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AdminMessageFeedback[]>([])
  const [page, setPage] = useState({ limit: 30, offset: 0, total: 0 })
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [assistantFilter, setAssistantFilter] = useState<string>("all")
  const [resolvedFilter, setResolvedFilter] = useState<"all" | "true" | "false">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<AdminMessageFeedback | null>(null)
  const [noteValue, setNoteValue] = useState("")
  const [resolvedValue, setResolvedValue] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    getAdminMessageFeedback({
      limit: page.limit,
      offset: page.offset,
      assistant_alias: assistantFilter === "all" ? undefined : assistantFilter,
      resolved: resolvedFilter === "all" ? undefined : (resolvedFilter as "true" | "false"),
    })
      .then((res) => {
        setData(res.data)
        setPage((p) => ({ ...p, total: res.page.total }))
      })
      .catch((e) => setError((e as Error)?.message || t("admin.feedback.loadError")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    getAgents()
      .then((r) => setAgents(r.agents.filter((a) => a.is_active)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [page.offset, assistantFilter, resolvedFilter])

  const handleAssistantFilterChange = (v: string) => {
    setAssistantFilter(v)
    setPage((p) => ({ ...p, offset: 0 }))
  }

  const handleResolvedFilterChange = (v: "all" | "true" | "false") => {
    setResolvedFilter(v)
    setPage((p) => ({ ...p, offset: 0 }))
  }

  const openEdit = (item: AdminMessageFeedback) => {
    setEditModal(item)
    setNoteValue(item.admin_note ?? "")
    setResolvedValue(!!item.resolved)
  }

  const saveEdit = async () => {
    if (!editModal) return
    setSaving(true)
    try {
      await patchAdminMessageFeedback(editModal.message_id, editModal.user_id, {
        admin_note: noteValue.trim() || null,
        resolved: resolvedValue,
      })
      toast({ title: t("admin.feedback.saved") })
      setEditModal(null)
      load()
    } catch (e) {
      toast({ title: (e as Error)?.message || t("common.error"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleResolved = async (item: AdminMessageFeedback) => {
    try {
      await patchAdminMessageFeedback(item.message_id, item.user_id, { resolved: !item.resolved })
      toast({ title: item.resolved ? t("admin.feedback.unmarkResolved") : t("admin.feedback.markResolved") })
      load()
    } catch (e) {
      toast({ title: (e as Error)?.message || t("common.error"), variant: "destructive" })
    }
  }

  const handleDelete = async (item: AdminMessageFeedback) => {
    if (!confirm(t("admin.feedback.deleteConfirm"))) return
    try {
      await deleteAdminMessageFeedback(item.message_id, item.user_id)
      toast({ title: t("admin.feedback.deleted") })
      setEditModal(null)
      load()
    } catch (e) {
      toast({ title: (e as Error)?.message || t("common.error"), variant: "destructive" })
    }
  }

  if (loading && data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center">{t("admin.feedback.loading")}</p>
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Label>{t("admin.feedback.filterByAssistant")}</Label>
        <Select value={assistantFilter} onValueChange={handleAssistantFilterChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.feedback.all")}</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.alias}>
                {a.alias}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label>{t("admin.feedback.status")}</Label>
        <Select value={resolvedFilter} onValueChange={handleResolvedFilterChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.feedback.all")}</SelectItem>
            <SelectItem value="false">{t("admin.feedback.unresolved")}</SelectItem>
            <SelectItem value="true">{t("admin.feedback.resolved")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4">
        {data.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">{t("admin.feedback.noMessageFeedback")}</p>
        ) : (
          data.map((item) => {
            const isExpanded = expandedId === `${item.message_id}-${item.user_id}`
            const cardKey = `${item.message_id}-${item.user_id}`
            return (
              <Card key={cardKey} className="overflow-hidden">
                <CardHeader className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.assistant_alias}</Badge>
                      {item.resolved ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 gap-1 whitespace-nowrap">
                          <Check className="h-3 w-3" />
                          {t("admin.feedback.resolved")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          {t("admin.feedback.unresolved")}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatDate(item.created_at)} — {item.user_email}
                        {item.user_display_name && ` (${item.user_display_name})`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("admin.feedback.session")} {item.session_title ?? item.session_id}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} title={t("admin.feedback.titleNoteAndMark")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleResolved(item)}
                        title={item.resolved ? t("admin.feedback.unmarkResolved") : t("admin.feedback.markResolved")}
                      >
                        {item.resolved ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        title={t("admin.feedback.delete")}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : cardKey)}
                      >
                        {isExpanded ? t("admin.feedback.collapse") : t("admin.feedback.expand")}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-medium mt-2">{t("admin.feedback.userCommentLabel")}</p>
                  <p className="text-sm bg-red-50 dark:bg-red-950/30 rounded p-2 border border-red-200 dark:border-red-900">
                    {item.comment}
                  </p>
                  {item.admin_note && (
                    <p className="text-sm mt-2">
                      <span className="font-medium text-muted-foreground">{t("admin.feedback.noteLabel")} </span>
                      {item.admin_note}
                    </p>
                  )}
                </CardHeader>
                {isExpanded && (
                  <CardContent className="border-t pt-3 space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">{t("admin.feedback.dislikedMessageLabel")}</p>
                      <div className="text-sm bg-amber-50 dark:bg-amber-950/30 rounded p-3 border border-amber-200 dark:border-amber-900 max-h-[200px] overflow-y-auto">
                        {item.disliked_message.content ?? t("admin.feedback.emptyContent")}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(item.disliked_message.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">{t("admin.feedback.fullConversationLabel")}</p>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {item.session_messages.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded p-2 text-sm ${
                              m.role === "user"
                                ? "bg-slate-100 dark:bg-slate-800 ml-4"
                                : m.role === "assistant"
                                  ? "bg-primary/10 mr-4"
                                  : "bg-muted/50"
                            } ${m.id === item.disliked_message_id ? "ring-2 ring-amber-500" : ""}`}
                          >
                            <span className="text-xs font-medium text-muted-foreground">{m.role}:</span>
                            <div className="mt-1 whitespace-pre-wrap break-words">
                              {(m.content ?? t("admin.feedback.emptyContent")).slice(0, 500)}
                              {(m.content ?? "").length > 500 && "…"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{formatDate(m.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>
      {page.total > page.limit && (
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>
            {page.offset + 1}–{Math.min(page.offset + page.limit, page.total)} / {page.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page.offset === 0}
              onClick={() => setPage((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
            >
              {t("admin.feedback.buttonPrev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page.offset + page.limit >= page.total}
              onClick={() => setPage((p) => ({ ...p, offset: p.offset + p.limit }))}
            >
              {t("admin.feedback.buttonNext")}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editModal} onOpenChange={(o) => !o && setEditModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.feedback.titleNoteAndMark")}</DialogTitle>
          </DialogHeader>
          {editModal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("admin.feedback.userCommentLabel")}</p>
                <p className="text-sm bg-red-50 dark:bg-red-950/30 rounded p-2">{editModal.comment}</p>
              </div>
              <div>
                <Label htmlFor="msg-admin-note">{t("admin.feedback.adminNoteLabel")}</Label>
                <Textarea
                  id="msg-admin-note"
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder={t("admin.feedback.adminNotePlaceholder")}
                  className="mt-1.5 min-h-[80px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="msg-resolved-check"
                  checked={resolvedValue}
                  onChange={(e) => setResolvedValue(e.target.checked)}
                />
                <Label htmlFor="msg-resolved-check">{t("admin.feedback.resolvedLabel")}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            {editModal && (
              <Button
                variant="destructive"
                onClick={() => handleDelete(editModal)}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("admin.feedback.delete")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditModal(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
