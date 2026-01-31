"use client"

import { useState, type DragEvent } from "react"
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
import { Upload, FileIcon, X } from "lucide-react"

interface AddResearchDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function AddResearchDialog({ isOpen, onOpenChange }: AddResearchDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [newMemberEmail, setNewMemberEmail] = useState("")

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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tạo nghiên cứu mới</DialogTitle>
          <DialogDescription>
            Bắt đầu một dự án nghiên cứu mới bằng cách cung cấp thông tin và dữ liệu ban đầu.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Tên nghiên cứu</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Phân tích lạm phát Việt Nam giai đoạn 2020-2025"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn gọn về mục tiêu, phạm vi và phương pháp nghiên cứu..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Thành viên nhóm nghiên cứu</Label>
            <div className="flex gap-2">
              <Input
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="Nhập email thành viên (ví dụ: user@neu.edu.vn)"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTeamMember())}
              />
              <Button type="button" onClick={addTeamMember} variant="outline">
                Thêm
              </Button>
            </div>
            {teamMembers.length > 0 && (
              <div className="mt-2 space-y-2">
                <h4 className="font-medium text-sm">Thành viên đã thêm:</h4>
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
            <Label>Dữ liệu đính kèm</Label>
            <div
              className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Upload className="w-10 h-10 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Nhấp để tải lên</span> hoặc kéo thả
              </p>
              <p className="text-xs text-gray-500">PDF, DOCX, XLSX, CSV (tối đa 10MB)</p>
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
                <h4 className="font-medium text-sm">Các tệp đã tải lên:</h4>
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
        <DialogFooter>
          <Button type="submit" onClick={() => onOpenChange(false)}>
            Tạo nghiên cứu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
