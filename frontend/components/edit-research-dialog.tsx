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
import { Upload, FileIcon, X, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Research } from "@/types"
import {
  patchResearchProject,
  deleteResearchProject,
  uploadResearchProjectFiles,
  getResearchProjectFileUrl,
} from "@/lib/api/research-projects"

interface EditResearchDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  research: Research | null
  onDelete?: (research: Research) => void
  onSuccess?: () => void
}

export function EditResearchDialog({ isOpen, onOpenChange, research, onDelete, onSuccess }: EditResearchDialogProps) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [fileKeys, setFileKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (research && isOpen) {
      setTitle(research.name ?? "")
      setDescription(research.description ?? "")
      setTeamMembers(research.team_members ?? [])
      setFileKeys(research.file_keys ?? [])
      setPendingFiles([])
    }
  }, [research, isOpen])

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

  const handleSave = async () => {
    const nameTrim = title.trim()
    if (!nameTrim) {
      toast({ title: "Lỗi", description: "Tên nghiên cứu là bắt buộc", variant: "destructive" })
      return
    }
    if (!research || typeof research.id !== "string") return
    setSaving(true)
    try {
      let keys = [...fileKeys]
      if (pendingFiles.length > 0) {
        const uploaded = await uploadResearchProjectFiles(pendingFiles, research.id)
        keys = [...keys, ...uploaded]
      }
      await patchResearchProject(research.id, {
        name: nameTrim,
        description: description.trim() || null,
        team_members: teamMembers,
        file_keys: keys,
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
    if (!research || typeof research.id !== "string") return
    setDeleteConfirmOpen(false)
    setDeleting(true)
    try {
      await deleteResearchProject(research.id)
      onDelete?.(research)
      onOpenChange(false)
      onSuccess?.()
      toast({ title: "Đã xóa nghiên cứu" })
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message ?? "Không xóa được", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  if (!research) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Chỉnh sửa nghiên cứu</DialogTitle>
          <DialogDescription>Cập nhật thông tin, thành viên và dữ liệu cho dự án nghiên cứu của bạn.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 px-6 overflow-y-auto min-h-0 flex-1">
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Tên nghiên cứu</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên nghiên cứu"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Mô tả</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả nghiên cứu..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Thành viên nhóm nghiên cứu</Label>
            <div className="flex gap-2">
              <Input
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="Nhập email thành viên"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTeamMember())}
              />
              <Button type="button" onClick={addTeamMember} variant="outline">
                Thêm
              </Button>
            </div>
            {teamMembers.length > 0 && (
              <div className="mt-2 space-y-2">
                <h4 className="font-medium text-sm">Thành viên hiện tại:</h4>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{member}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-full"
                        onClick={() => removeTeamMember(member)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                      <a href={getResearchProjectFileUrl(key)} target="_blank" rel="noopener noreferrer" className="text-primary text-xs">
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
            {deleting ? "Đang xóa..." : "Xóa nghiên cứu"}
          </Button>
          <div className="flex gap-2 order-1 sm:order-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Cập nhật nghiên cứu"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Modal xác nhận xóa nghiên cứu */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nghiên cứu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa dự án nghiên cứu &quot;{research?.name}&quot;? Hành động không thể hoàn tác.
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
