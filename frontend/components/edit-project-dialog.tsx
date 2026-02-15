"use client"

import { useState, useEffect, type DragEvent } from "react"
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
import { Upload, FileIcon, X, Trash2, ChevronDown } from "lucide-react"
import { PROJECT_ICON_LIST, getProjectIcon, type ProjectIconName } from "@/lib/project-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import type { Project } from "@/types"
import {
  patchProject,
  deleteProject,
  uploadProjectFiles,
  getProjectFileUrl,
} from "@/lib/api/projects"

interface EditProjectDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  project: Project | null
  onDelete?: (project: Project) => void
  onSuccess?: () => void
}

export function EditProjectDialog({ isOpen, onOpenChange, project, onDelete, onSuccess }: EditProjectDialogProps) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [icon, setIcon] = useState<ProjectIconName>("FolderKanban")
  const [fileKeys, setFileKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (project && isOpen) {
      setTitle(project.name ?? "")
      setDescription(project.description ?? "")
      setTeamMembers(project.team_members ?? [])
      setTags(project.tags ?? [])
      setIcon((project.icon?.trim() || "FolderKanban") as ProjectIconName)
      setFileKeys(project.file_keys ?? [])
      setPendingFiles([])
    }
  }, [project, isOpen])

  const handleFileChange = (newFiles: FileList | null) => {
    if (newFiles) {
      setPendingFiles((prev) => [...prev, ...Array.from(newFiles)])
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

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const removeFileKey = (index: number) => {
    setFileKeys((prev) => prev.filter((_, i) => i !== index))
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

  const handleSave = async () => {
    const nameTrim = title.trim()
    if (!nameTrim) {
      toast({ title: "Lỗi", description: "Tên dự án là bắt buộc", variant: "destructive" })
      return
    }
    if (!project || project.id == null) return
    const projectId = String(project.id)
    setSaving(true)
    try {
      let keys = [...fileKeys]
      if (pendingFiles.length > 0) {
        const uploaded = await uploadProjectFiles(pendingFiles, projectId)
        keys = [...keys, ...uploaded]
      }
      await patchProject(projectId, {
        name: nameTrim,
        description: description.trim() || null,
        team_members: teamMembers,
        file_keys: keys,
        tags,
        icon,
      })
      toast({ title: "Đã lưu thay đổi" })
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message ?? "Không lưu được", variant: "destructive" })
    } finally {
      setSaving(false)
    }
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
      toast({ title: "Đã xóa dự án" })
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message ?? "Không xóa được", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  if (!project) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Chỉnh sửa dự án</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4 px-6 overflow-y-auto min-h-0 flex-1">
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Tên dự án</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên dự án"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Mô tả</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả dự án..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Tag phân loại</Label>
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
                    aria-label={`Xóa ${t}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder={tags.length === 0 ? "Thêm tag (ví dụ: AI, thống kê) — Enter hoặc Thêm" : "Thêm tag..."}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                className="flex-1 min-w-[120px] border-0 p-0 h-8 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm" className="shrink-0 h-8">
                Thêm
              </Button>
            </div>
          </div>
          <div className="grid gap-2 w-fit">
            <Label>Icon dự án</Label>
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
                  <span className="text-sm text-muted-foreground">Chọn icon</span>
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
            <Label>Thành viên nhóm</Label>
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
                    aria-label={`Xóa ${member}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Input
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder={teamMembers.length === 0 ? "Email thành viên — Enter hoặc Thêm" : "Thêm email..."}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTeamMember())}
                className="flex-1 min-w-[140px] border-0 p-0 h-8 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button type="button" onClick={addTeamMember} variant="outline" size="sm" className="shrink-0 h-8">
                Thêm
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>File đính kèm</Label>
            <div
              className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("edit-file-upload")?.click()}
            >
              <Upload className="w-10 h-10 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Nhấp để tải lên</span> hoặc kéo thả
              </p>
              <p className="text-xs text-gray-500">PDF, DOCX, XLSX, CSV (tối đa 10MB)</p>
              <input
                id="edit-file-upload"
                type="file"
                className="hidden"
                multiple
                onChange={(e) => handleFileChange(e.target.files)}
              />
            </div>
            {(fileKeys.length > 0 || pendingFiles.length > 0) && (
              <div className="mt-4 space-y-2">
                {fileKeys.map((key, index) => (
                  <div key={`k-${index}`} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{key.split("/").pop() ?? key}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a href={getProjectFileUrl(key)} target="_blank" rel="noopener noreferrer" className="text-primary text-xs">
                        Tải xuống
                      </a>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFileKey(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingFiles.map((file, index) => (
                  <div key={`p-${index}`} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md text-sm">
                    <div className="flex items-center gap-2">
                      <FileIcon className="w-4 h-4" />
                      <span>{file.name}</span>
                      <span className="text-xs text-amber-600">(sẽ tải lên khi lưu)</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePendingFile(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:flex-row flex-col gap-2 px-6 py-4 border-t shrink-0">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteClick}
            disabled={deleting}
            className="flex items-center gap-2 order-2 sm:order-1"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Đang xóa..." : "Xóa dự án"}
          </Button>
          <div className="flex gap-2 order-1 sm:order-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Cập nhật dự án"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa dự án</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa dự án &quot;{project?.name}&quot;? Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleDeleteConfirm}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
