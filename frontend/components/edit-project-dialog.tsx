"use client"

import { useState, useEffect, useMemo, type DragEvent } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Trash2, ChevronDown } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ProjectLifecyclePanel } from "@/components/project-lifecycle-panel"
import { ProjectMembersPanel, type MemberDraft } from "@/components/project-members-panel"
import { ProjectFilesPanel } from "@/components/project-files-panel"
import { ProjectActivityPanel } from "@/components/project-activity-panel"
import { useTeamText } from "@/lib/team-text"
import { normalizeLifecycle, lifecycleEquals, type ProjectLifecycle } from "@/lib/project-lifecycle"
import { PROJECT_ICON_LIST, getProjectIcon, type ProjectIconName } from "@/lib/project-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import type { Project } from "@/types"
import { patchProject, deleteProject, getProjects } from "@/lib/api/projects"

interface EditProjectDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  project: Project | null
  onDelete?: (project: Project) => void
  onSuccess?: () => void
  /** Tab mở khi hộp thoại bật lên (mặc định: thông tin dự án) */
  initialTab?: DialogTab
}

type DialogTab = "info" | "lifecycle" | "members" | "files" | "activity"
const TAB_VALUES: DialogTab[] = ["info", "lifecycle", "members", "files", "activity"]

export function EditProjectDialog({ isOpen, onOpenChange, project, onDelete, onSuccess, initialTab = "info" }: EditProjectDialogProps) {
  const { t } = useLanguage()
  const tt = useTeamText()
  const { data: session } = useSession()
  const currentEmail = String((session?.user as { email?: string | null } | undefined)?.email ?? "").toLowerCase()
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [live, setLive] = useState<Project | null>(null)
  const [activityVersion, setActivityVersion] = useState(0)
  const [members, setMembers] = useState<MemberDraft[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [icon, setIcon] = useState<ProjectIconName>("FolderKanban")
  const [lifecycle, setLifecycle] = useState<ProjectLifecycle>(() => normalizeLifecycle(null))
  const [tab, setTab] = useState<DialogTab>("info")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (project && isOpen) {
      setTitle(project.name ?? "")
      setDescription(project.description ?? "")
      setLive(project)
      setMembers(
        project.members && project.members.length > 0
          ? project.members.map((m) => ({ email: m.email, role: m.role, display_name: m.display_name, has_account: m.has_account }))
          : (project.team_members ?? []).map((e) => ({ email: e.toLowerCase(), role: "viewer" as const }))
      )
      setTags(project.tags ?? [])
      setIcon((project.icon?.trim() || "FolderKanban") as ProjectIconName)
      setLifecycle(normalizeLifecycle(project.lifecycle))
    }
  }, [project, isOpen])

  useEffect(() => {
    if (isOpen) setTab(initialTab)
  }, [isOpen, initialTab])

  const cur = live ?? project
  const myRole = cur?.my_role ?? (cur?.is_shared ? "viewer" : "owner")
  const isOwner = myRole === "owner"
  const canEditContent = myRole === "owner" || myRole === "editor"
  const lifecycleReadOnly = !canEditContent
  const assignees = useMemo(() => {
    const list: { email: string; label: string }[] = []
    const ownerEmail = (cur?.owner_email ?? (isOwner ? currentEmail : "")) || ""
    if (ownerEmail) list.push({ email: ownerEmail.toLowerCase(), label: cur?.owner_display_name || ownerEmail })
    for (const m of members) list.push({ email: m.email, label: m.display_name || m.email })
    return list
  }, [cur, members, isOwner, currentEmail])

  /** Tải lại dự án sau khi tải/đổi tên/xoá tệp để danh sách hiển thị tên gốc, thư mục, người tải. */
  const reloadProject = async () => {
    if (!project) return
    try {
      const list = await getProjects()
      const fresh = list.find((p) => String(p.id) === String(project.id))
      if (fresh) setLive({ ...project, ...fresh } as Project)
      setActivityVersion((v) => v + 1)
    } catch {
      /* giữ nguyên dữ liệu hiện có */
    }
  }
  const lifecycleDirty = useMemo(
    () => !lifecycleReadOnly && !!project && !lifecycleEquals(project.lifecycle, lifecycle),
    [project, lifecycle, lifecycleReadOnly]
  )

  const addTag = () => {
    const t = newTag.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
      setNewTag("")
    }
  }

  const removeTag = (t: string) => {
    setTags(tags.filter((x) => x !== t))
  }

  const handleSave = async () => {
    const nameTrim = title.trim()
    if (!nameTrim) {
      toast({ title: t("common.error"), description: t("projectEdit.nameRequired"), variant: "destructive" })
      return
    }
    if (!project || project.id == null) return
    const projectId = String(project.id)
    setSaving(true)
    try {
      if (isOwner) {
        await patchProject(projectId, {
          name: nameTrim,
          description: description.trim() || null,
          members: members.map((m) => ({ email: m.email, role: m.role })),
          tags,
          icon,
          ...(lifecycleDirty ? { lifecycle } : {}),
        })
      } else if (lifecycleDirty) {
        await patchProject(projectId, { lifecycle })
      }
      toast({ title: t("projectEdit.saved") })
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error)?.message ?? t("common.saveFailed"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  /** Mở công cụ của một giai đoạn: lưu vòng đời nếu có thay đổi rồi chuyển sang /tools/<alias>. */
  const handleOpenTool = async (alias: string) => {
    if (!project || project.id == null) return
    if (lifecycleDirty) {
      setSaving(true)
      try {
        await patchProject(String(project.id), { lifecycle })
        toast({ title: t("lifecycle.savedBeforeOpen") })
        onSuccess?.()
      } catch (e) {
        toast({ title: t("common.error"), description: (e as Error)?.message ?? t("common.saveFailed"), variant: "destructive" })
        setSaving(false)
        return
      }
      setSaving(false)
    }
    onOpenChange(false)
    router.push(`/tools/${encodeURIComponent(alias)}`)
  }

  const handleDeleteClick = () => setDeleteConfirmOpen(true)

  const handleDeleteConfirm = async () => {
    if (!project || typeof project.id !== "string") return
    setDeleteConfirmOpen(false)
    setDeleting(true)
    try {
      await deleteProject(project.id)
      onDelete?.(project)
      onOpenChange(false)
      onSuccess?.()
      toast({ title: t("projectEdit.projectDeleted") })
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error)?.message ?? t("common.deleteFailed"), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  if (!project) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[880px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{t("projectEdit.title")}</DialogTitle>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab((TAB_VALUES as string[]).includes(v) ? (v as DialogTab) : "info")}
          className="flex min-h-0 flex-1 flex-col"
        >
        <TabsList className="mx-6 shrink-0">
          <TabsTrigger value="info" className="normal-case" data-testid="edit-project-tab-info">{t("lifecycle.infoTab")}</TabsTrigger>
          <TabsTrigger value="lifecycle" className="normal-case" data-testid="edit-project-tab-lifecycle">{t("lifecycle.tab")}</TabsTrigger>
          <TabsTrigger value="members" className="normal-case" data-testid="edit-project-tab-members">{tt("tab.members")}</TabsTrigger>
          <TabsTrigger value="files" className="normal-case" data-testid="edit-project-tab-files">{tt("tab.files")}</TabsTrigger>
          <TabsTrigger value="activity" className="normal-case" data-testid="edit-project-tab-activity">{tt("tab.activity")}</TabsTrigger>
        </TabsList>
        {!isOwner && (
          <p className="mx-6 mt-2 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            {myRole === "editor" ? tt("readOnly.editor") : tt("readOnly.viewer")}
          </p>
        )}
        <TabsContent value="lifecycle" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ProjectLifecyclePanel
            value={lifecycle}
            onChange={setLifecycle}
            readOnly={lifecycleReadOnly}
            onOpenTool={handleOpenTool}
            assignees={assignees}
            currentEmail={currentEmail}
          />
        </TabsContent>
        <TabsContent value="members" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ProjectMembersPanel
            ownerLabel={cur?.owner_display_name || cur?.owner_email || (isOwner ? currentEmail : "—") || "—"}
            ownerEmail={cur?.owner_email ?? (isOwner ? currentEmail : null)}
            members={members}
            onChange={setMembers}
            canManage={isOwner}
          />
        </TabsContent>
        <TabsContent value="files" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {cur && <ProjectFilesPanel project={{ ...cur, my_role: myRole }} canUpload={canEditContent} currentEmail={currentEmail} onChanged={reloadProject} />}
        </TabsContent>
        <TabsContent value="activity" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {cur && <ProjectActivityPanel projectId={String(cur.id)} members={cur.members ?? []} ownerEmail={cur.owner_email ?? (isOwner ? currentEmail : null)} ownerName={cur.owner_display_name} version={activityVersion} />}
        </TabsContent>
        <TabsContent value="info" className="mt-0 min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 py-4 px-6">
          <div className="grid gap-2">
            <Label htmlFor="edit-title">{t("projectEdit.projectNameLabel")}</Label>
            <Input
              id="edit-title"
              value={title}
              disabled={!isOwner}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("projectEdit.projectNamePlaceholder")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">{t("projectEdit.descriptionLabel")}</Label>
            <Textarea
              id="edit-description"
              value={description}
              disabled={!isOwner}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projectEdit.descriptionPlaceholder")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("projectEdit.tagLabel")}</Label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 min-h-10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-sm shrink-0"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-0.5"
                    onClick={() => removeTag(tag)}
                    aria-label={t("projectEdit.removeAria").replace("{name}", tag)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder={tags.length === 0 ? t("projectEdit.addTagPlaceholderEmpty") : t("projectEdit.addTagPlaceholder")}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                className="flex-1 min-w-[120px] border-0 p-0 h-8 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm" className="shrink-0 h-8">
                {t("projectEdit.addTagButton")}
              </Button>
            </div>
          </div>
          <div className="grid gap-2 w-fit">
            <Label>{t("projectEdit.projectIconLabel")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-w-[140px] justify-start gap-2 h-10 px-3"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                    {(() => {
                      const IconComp = getProjectIcon(icon)
                      return <IconComp className="w-4 h-4 text-primary" />
                    })()}
                  </div>
                  <span className="text-sm text-muted-foreground">{t("projectEdit.selectIcon")}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <div className="max-h-[300px] overflow-y-auto p-2">
                  <div className="grid grid-cols-8 gap-1">
                    {PROJECT_ICON_LIST.map((name) => {
                      const IconComp = getProjectIcon(name)
                      const sel = icon === name
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setIcon(name)}
                          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${sel ? "border-2 border-primary bg-primary/10 text-primary" : "border border-transparent hover:bg-muted"}`}
                          title={name}
                        >
                          <IconComp className="w-4 h-4" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        </TabsContent>
        </Tabs>
        <DialogFooter className="flex justify-between sm:flex-row flex-col gap-2 px-6 py-4 border-t shrink-0">
          {isOwner ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={deleting}
              className="flex items-center gap-2 order-2 sm:order-1"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? t("projectEdit.deletingProject") : t("projectEdit.deleteProject")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 order-1 sm:order-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !canEditContent} className={canEditContent ? "" : "hidden"}>
              {saving ? t("common.saving") : t("projectEdit.updateProject")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("projectEdit.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectEdit.deleteConfirmDescription").replace("{name}", project?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleDeleteConfirm}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
