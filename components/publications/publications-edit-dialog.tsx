"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText } from "lucide-react"
import type { Publication } from "./publications-view"

type Props = {
    open: boolean
    onOpenChange: (v: boolean) => void
    publication: Publication | null
    uploadedFiles: File[]
    onUploadFiles: (files: FileList | null) => void
    onCancel: () => void
    onSave: () => void
}

export function PublicationsEditDialog({
    open,
    onOpenChange,
    publication,
    uploadedFiles,
    onUploadFiles,
    onCancel,
    onSave,
}: Props) {
    if (!publication) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Chỉnh sửa công bố</DialogTitle>
                    <DialogDescription>
                        Cập nhật thông tin và tải lên file công bố để AI cá nhân hóa gợi ý
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-title">Tiêu đề</Label>
                        <Input id="edit-title" defaultValue={publication.title} placeholder="Tiêu đề công bố..." />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="edit-authors">Tác giả</Label>
                        <Input id="edit-authors" defaultValue={publication.authors.join(", ")} placeholder="Tên các tác giả, cách nhau bằng dấu phẩy..." />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="edit-journal">Tạp chí/Hội thảo</Label>
                        <Input id="edit-journal" defaultValue={publication.journal} placeholder="Tên tạp chí hoặc hội thảo..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-year">Năm</Label>
                            <Input id="edit-year" type="number" defaultValue={publication.year} placeholder="2024" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-doi">DOI (tùy chọn)</Label>
                            <Input id="edit-doi" defaultValue={publication.doi || ""} placeholder="10.1234/example.2024.001" />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="edit-abstract">Tóm tắt</Label>
                        <Textarea id="edit-abstract" defaultValue={publication.abstract} placeholder="Tóm tắt nội dung công bố..." rows={4} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Tải lên file công bố</Label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-semibold">Nhấp để tải lên</span> hoặc kéo thả
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">PDF, DOCX (tối đa 10MB)</p>
                                </div>
                                <input type="file" className="hidden" accept=".pdf,.docx,.doc" multiple onChange={(e) => onUploadFiles(e.target.files)} />
                            </label>
                        </div>

                        {uploadedFiles.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-medium mb-2">File đã tải lên:</p>
                                {uploadedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <FileText className="w-4 h-4" />
                                        <span>{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Hủy</Button>
                    <Button onClick={onSave} className="bg-neu-blue hover:bg-neu-blue/90">Lưu thay đổi</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
