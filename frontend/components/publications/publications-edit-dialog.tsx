"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  uploadPublicationFiles,
  getPublicationFileUrl,
  type Publication,
  type PublicationType,
  type PublicationStatus,
} from "@/lib/api/publications"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  publication: Publication | null
  isAddMode: boolean
  onCancel: () => void
  onSave: (payload: {
    title: string
    authors: string[]
    journal: string
    year: number | null
    type: PublicationType
    status: PublicationStatus
    doi: string
    abstract: string
    file_keys: string[]
  }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function PublicationsEditDialog({
  open,
  onOpenChange,
  publication,
  isAddMode,
  onCancel,
  onSave,
  onDelete,
}: Props) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(publication?.title ?? "")
  const [authorsStr, setAuthorsStr] = useState(publication?.authors?.join(", ") ?? "")
  const [journal, setJournal] = useState(publication?.journal ?? "")
  const [year, setYear] = useState(publication?.year ?? "")
  const [type, setType] = useState<PublicationType>(publication?.type ?? "journal")
  const [status, setStatus] = useState<PublicationStatus>(publication?.status ?? "draft")
  const [doi, setDoi] = useState(publication?.doi ?? "")
  const [abstract, setAbstract] = useState(publication?.abstract ?? "")
  const [fileKeys, setFileKeys] = useState<string[]>(publication?.file_keys ?? [])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(publication?.title ?? "")
      setAuthorsStr(publication?.authors?.join(", ") ?? "")
      setJournal(publication?.journal ?? "")
      setYear(publication?.year ? String(publication.year) : "")
      setType(publication?.type ?? "journal")
      setStatus(publication?.status ?? "draft")
      setDoi(publication?.doi ?? "")
      setAbstract(publication?.abstract ?? "")
      setFileKeys(publication?.file_keys ?? [])
      setPendingFiles([])
    }
  }, [open, publication])

  const resetForm = () => {
    setTitle(publication?.title ?? "")
    setAuthorsStr(publication?.authors?.join(", ") ?? "")
    setJournal(publication?.journal ?? "")
    setYear(publication?.year ?? "")
    setType(publication?.type ?? "journal")
    setStatus(publication?.status ?? "draft")
    setDoi(publication?.doi ?? "")
    setAbstract(publication?.abstract ?? "")
    setFileKeys(publication?.file_keys ?? [])
    setPendingFiles([])
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm()
    onOpenChange(v)
  }

  const handleDelete = async () => {
    if (!publication?.id) return
    if (!confirm("Bạn có chắc muốn xóa công bố này?")) return
    setDeleting(true)
    try {
      await onDelete(publication.id)
      handleOpenChange(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    const titleTrim = title.trim()
    if (!titleTrim) {
      toast({ title: "Lỗi", description: "Tiêu đề là bắt buộc", variant: "destructive" })
      return
    }
    const authors = authorsStr.split(",").map((s) => s.trim()).filter(Boolean)
    const yearNum = year ? parseInt(year, 10) : NaN
    setSaving(true)
    try {
      let keys = [...fileKeys]
      if (pendingFiles.length > 0) {
        const uploaded = await uploadPublicationFiles(pendingFiles)
        keys = [...keys, ...uploaded]
      }
      await onSave({
        title: titleTrim,
        authors,
        journal: journal.trim(),
        year: (yearNum !== undefined && !isNaN(yearNum)) ? yearNum : null,
        type,
        status,
        doi: doi.trim(),
        abstract: abstract.trim(),
        file_keys: keys,
      })
      handleOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.length) setPendingFiles((prev) => [...prev, ...Array.from(files)])
    e.target.value = ""
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const removeSavedFile = (index: number) => {
    setFileKeys((prev) => prev.filter((_, i) => i !== index))
  }

  const displayTitle = isAddMode ? "Thêm công bố" : "Chỉnh sửa công bố"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          <DialogDescription>
            {isAddMode ? "Thêm thông tin và tải lên file công bố." : "Cập nhật thông tin và tải lên file công bố để AI cá nhân hóa gợi ý."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Tiêu đề</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề công bố..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-authors">Tác giả</Label>
            <Input
              id="edit-authors"
              value={authorsStr}
              onChange={(e) => setAuthorsStr(e.target.value)}
              placeholder="Tên các tác giả, cách nhau bằng dấu phẩy..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-journal">Tạp chí/Hội thảo</Label>
            <Input
              id="edit-journal"
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              placeholder="Tên tạp chí hoặc hội thảo..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-year">Năm</Label>
              <Input
                id="edit-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-doi">DOI (tùy chọn)</Label>
              <Input
                id="edit-doi"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.1234/example.2024.001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Loại</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as PublicationType)}
              >
                <option value="journal">Tạp chí</option>
                <option value="conference">Hội thảo</option>
                <option value="book">Sách</option>
                <option value="thesis">Luận văn</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Trạng thái</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as PublicationStatus)}
              >
                <option value="published">Đã xuất bản</option>
                <option value="accepted">Đã chấp nhận</option>
                <option value="submitted">Đã nộp</option>
                <option value="draft">Bản thảo</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-abstract">Tóm tắt</Label>
            <Textarea
              id="edit-abstract"
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Tóm tắt nội dung công bố..."
              rows={4}
            />
          </div>

          <div className="grid gap-2">
            <Label>Tải lên file công bố</Label>
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="pub-file-input"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Nhấp để tải lên</span> hoặc kéo thả
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF, DOCX (tối đa 10MB)</p>
                </div>
                <input
                  ref={fileInputRef}
                  id="pub-file-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc"
                  multiple
                  onChange={handleFileSelect}
                />
              </label>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Chọn file
            </Button>

            {(pendingFiles.length > 0 || fileKeys.length > 0) && (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium">File đã tải / sẽ lưu:</p>
                {pendingFiles.map((file, idx) => (
                  <div key={`p-${idx}`} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-xs text-amber-600">(sẽ tải lên khi lưu)</span>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePendingFile(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {fileKeys.map((key, idx) => (
                  <div key={`k-${idx}`} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1">{key.split("/").pop() ?? key}</span>
                    <a href={getPublicationFileUrl(key)} target="_blank" rel="noopener noreferrer" className="text-primary text-xs">
                      Tải xuống
                    </a>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeSavedFile(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {!isAddMode && publication?.id && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="w-4 h-4 mr-2" />
                {deleting ? "Đang xóa..." : "Xóa công bố"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Hủy
            </Button>
            <Button type="button" className="bg-brand hover:bg-brand/90" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
