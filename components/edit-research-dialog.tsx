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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileIcon, X, Trash2 } from "lucide-react"
import type { Research } from "@/app/page"

interface EditResearchDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  research: Research | null
  onDelete?: (research: Research) => void
}

export function EditResearchDialog({ isOpen, onOpenChange, research, onDelete }: EditResearchDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [newMemberEmail, setNewMemberEmail] = useState("")

  useEffect(() => {
    if (research) {
      setTitle(research.name)
      setDescription("Mô tả nghiên cứu sẽ được tải từ database...")
      setTeamMembers(["member1@neu.edu.vn", "member2@neu.edu.vn"]) // Mock data
      setFiles([]) // Reset files
    }
  }, [research])

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

  const handleDelete = () => {
    if (research && onDelete) {
      onDelete(research)
      onOpenChange(false)
    }
  }

  if (!research) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa nghiên cứu</DialogTitle>
          <DialogDescription>Cập nhật thông tin, thành viên và dữ liệu cho dự án nghiên cứu của bạn.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
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
            <Label>Thêm dữ liệu mới</Label>
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
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-sm">Tệp mới được thêm:</h4>
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
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
        <DialogFooter className="flex justify-between">
          <Button type="button" variant="destructive" onClick={handleDelete} className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Xóa nghiên cứu
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" onClick={() => onOpenChange(false)}>
              Lưu thay đổi
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
