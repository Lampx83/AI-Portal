"use client"

import { useState, type DragEvent } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileIcon, X, LogIn, ChevronDown } from "lucide-react"
import { PROJECT_ICON_LIST, getProjectIcon, type ProjectIconName } from "@/lib/project-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { useSession } from "next-auth/react"
import { postProject, patchProject, uploadProjectFiles } from "@/lib/api/projects"
import type { Project } from "@/types"

interface AddProjectDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** Gọi sau khi tạo xong; truyền project vừa tạo để layout set activeProject */
  onSuccess?: (project?: Project) => void
}

export function AddProjectDialog({ isOpen, onOpenChange, onSuccess }: AddProjectDialogProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const router = useRouter()
  const { data: session } = useSession()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [icon, setIcon] = useState<ProjectIconName>("FolderKanban")
  const [saving, setSaving] = useState(false)
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(false)

  const handleFileChange = (newFiles: FileList | null) => {
    if (newFiles) {
      setFiles((prevFiles) => [...prevFiles, ...Array.from(newFiles)])
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileChange(e.dataTransfer.files)
  }

  const removeFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
  }

  const addTeamMember = () => {
    if (newMemberEmail.trim() && !teamMembers.includes(newMemberEmail.trim())) {
      setTeamMembers([...teamMembers, newMemberEmail.trim()])
      setNewMemberEmail("")
    }
  }

  const removeTeamMember = (email: string) => {
    setTeamMembers(teamMembers.filter((member) => member !== email))
  }

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

  const handleOpenChange = (open: boolean) => {
    if (!open) setShowGuestLoginPrompt(false)
    onOpenChange(open)
  }

  const handleSubmit = async () => {
    const nameTrim = title.trim()
    if (!nameTrim) {
      toast({ title: t("common.error"), description: t("projectEdit.nameRequired"), variant: "destructive" })
      return
    }
    if (!session?.user) {
      setShowGuestLoginPrompt(true)
      return
    }
    setSaving(true)
    try {
      const project = await postProject({
        name: nameTrim,
        description: description.trim() || null,
        team_members: teamMembers,
        file_keys: [],
        tags: tags.length ? tags : undefined,
        icon: icon !== "FolderKanban" ? icon : undefined,
      })
      let keys: string[] = []
      if (files.length > 0 && project.id) {
        keys = await uploadProjectFiles(files, project.id)
        await patchProject(project.id, { file_keys: keys })
      }
      toast({ title: t("projectAdd.projectCreated") })
      onOpenChange(false)
      setTitle("")
      setDescription("")
      setFiles([])
      setTeamMembers([])
      setTags([])
      setIcon("FolderKanban")
      onSuccess?.({ id: project.id, name: project.name, description: project.description, team_members: project.team_members, file_keys: project.file_keys, tags: project.tags, icon: project.icon, created_at: project.created_at, updated_at: project.updated_at })
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error)?.message ?? t("projectAdd.createFailed"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tạo dự án mới</DialogTitle>
          <DialogDescription>
            Cung cấp thông tin và dữ liệu để khởi tạo một dự án mới
          </DialogDescription>
        </DialogHeader>
        {showGuestLoginPrompt && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex flex-col gap-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Không tạo được dự án, vì bạn chưa đăng nhập.
            </p>
            <Button
              type="button"
              onClick={() => {
                handleOpenChange(false)
                router.push("/login")
              }}
              className="w-fit"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {t("header.login")}
            </Button>
          </div>
        )}
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t("projectEdit.projectNameLabel")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("projectAdd.titlePlaceholder")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">{t("projectEdit.descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projectAdd.descriptionPlaceholder")}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("projectEdit.tagLabel")}</Label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 min-h-10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              {tags.map((t) => (
                <div
                  key={t}
                  className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-sm shrink-0"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-0.5"
                    onClick={() => removeTag(t)}
                    aria-label={t("projectEdit.removeAria").replace("{name}", t)}
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
          <div className="grid gap-2">
            <Label>{t("projectEdit.teamMembersLabel")}</Label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 min-h-10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              {teamMembers.map((member, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-sm shrink-0"
                >
                  <span>{member}</span>
                  <button
                    type="button"
                    className="hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-full p-0.5"
                    onClick={() => removeTeamMember(member)}
                    aria-label={t("projectEdit.removeAria").replace("{name}", member)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Input
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder={teamMembers.length === 0 ? t("projectEdit.addMemberPlaceholderEmpty") : t("projectEdit.addMemberPlaceholder")}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTeamMember())}
                className="flex-1 min-w-[140px] border-0 p-0 h-8 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button type="button" onClick={addTeamMember} variant="outline" size="sm" className="shrink-0 h-8">
                {t("projectEdit.addMemberButton")}
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("projectAdd.dataAttachmentsLabel")}</Label>
            <div
              className={`flex flex-col items-center justify-center w-full py-3 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Upload className="w-8 h-8 mb-1.5 text-gray-400" />
              <p className="mb-0.5 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">{t("projectEdit.clickToUpload")}</span> {t("projectEdit.dragOrDrop")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("projectEdit.fileTypesHint")}</p>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                multiple
                onChange={(e) => handleFileChange(e.target.files)}
              />
            </div>
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-sm">{t("projectAdd.uploadedFilesLabel")}</h4>
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                    <div className="flex items-center gap-2 text-sm">
                      <FileIcon className="w-4 h-4" />
                      <span>{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? t("projectAdd.creating") : t("projectAdd.createProject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
