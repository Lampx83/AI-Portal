"use client"

import { useState, useEffect } from "react"
import { BookCopy, Search, Plus, Grid3X3, List, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/hooks/use-toast"

import { PublicationsList } from "./publications-list"
import { PublicationsEditDialog } from "./publications-edit-dialog"
import {
  getPublications,
  postPublication,
  patchPublication,
  deletePublication,
  type Publication,
  type PublicationType,
  type PublicationStatus,
} from "@/lib/api/publications"

export type { Publication }

export function PublicationsView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [publications, setPublications] = useState<Publication[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<"all" | PublicationType>("all")
  const [filterStatus, setFilterStatus] = useState<"all" | PublicationStatus>("all")
  const [viewMode, setViewMode] = useState<"card" | "list">("card")

  const [editingPublication, setEditingPublication] = useState<Publication | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddMode, setIsAddMode] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const list = await getPublications()
      setPublications(list)
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message ?? "Không tải được danh sách công bố", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredPublications = publications.filter((pub) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      pub.title.toLowerCase().includes(q) ||
      pub.authors.some((a) => a.toLowerCase().includes(q))
    const matchesType = filterType === "all" || pub.type === filterType
    const matchesStatus = filterStatus === "all" || pub.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  const handleSyncFromSystem = () => {
    toast({ title: "Đang phát triển", description: "Tính năng đồng bộ từ hệ thống đang được phát triển." })
  }

  const handleAddPublication = () => {
    setIsAddMode(true)
    setEditingPublication(null)
    setIsEditDialogOpen(true)
  }

  const handleEditPublication = (p: Publication) => {
    setIsAddMode(false)
    setEditingPublication(p)
    setIsEditDialogOpen(true)
  }

  const handleSavePublication = async (payload: {
    title: string
    authors: string[]
    journal: string
    year: number | null
    type: PublicationType
    status: PublicationStatus
    doi: string
    abstract: string
    file_keys: string[]
  }) => {
    try {
      if (isAddMode) {
        await postPublication({
          title: payload.title,
          authors: payload.authors,
          journal: payload.journal || null,
          year: payload.year ?? null,
          type: payload.type,
          status: payload.status,
          doi: payload.doi || null,
          abstract: payload.abstract || null,
          file_keys: payload.file_keys,
        })
        toast({ title: "Đã thêm công bố" })
      } else if (editingPublication) {
        await patchPublication(editingPublication.id, {
          title: payload.title,
          authors: payload.authors,
          journal: payload.journal || null,
          year: payload.year || null,
          type: payload.type,
          status: payload.status,
          doi: payload.doi || null,
          abstract: payload.abstract || null,
          file_keys: payload.file_keys,
        })
        toast({ title: "Đã lưu thay đổi" })
      }
      setIsEditDialogOpen(false)
      setEditingPublication(null)
      setIsAddMode(false)
      load()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message ?? "Không lưu được", variant: "destructive" })
      throw e
    }
  }

  const handleDeletePublication = async (id: string) => {
    try {
      await deletePublication(id)
      toast({ title: "Đã xóa công bố" })
      setIsEditDialogOpen(false)
      setEditingPublication(null)
      load()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message ?? "Không xóa được", variant: "destructive" })
    }
  }

  const handleCancelDialog = () => {
    setIsEditDialogOpen(false)
    setEditingPublication(null)
    setIsAddMode(false)
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
        <p className="text-muted-foreground text-center py-8">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BookCopy className="w-6 h-6" />
              Công bố của tôi
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Quản lý danh sách công trình nghiên cứu để AI cá nhân hóa gợi ý
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-transparent" onClick={handleSyncFromSystem}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Đồng bộ từ hệ thống
            </Button>
            <Button className="bg-neu-blue hover:bg-neu-blue/90" onClick={handleAddPublication}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm công bố
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tiêu đề, tác giả..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | PublicationType)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Loại công bố" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              <SelectItem value="journal">Tạp chí</SelectItem>
              <SelectItem value="conference">Hội thảo</SelectItem>
              <SelectItem value="book">Sách</SelectItem>
              <SelectItem value="thesis">Luận văn</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | PublicationStatus)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="published">Đã xuất bản</SelectItem>
              <SelectItem value="accepted">Đã chấp nhận</SelectItem>
              <SelectItem value="submitted">Đã nộp</SelectItem>
              <SelectItem value="draft">Bản thảo</SelectItem>
            </SelectContent>
          </Select>

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as "card" | "list")}
          >
            <ToggleGroupItem value="card" aria-label="Card view">
              <Grid3X3 className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <PublicationsList
          items={filteredPublications}
          viewMode={viewMode}
          onItemClick={handleEditPublication}
        />

        {filteredPublications.length === 0 && (
          <div className="text-center py-12">
            <BookCopy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Không tìm thấy công bố</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || filterType !== "all" || filterStatus !== "all"
                ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
                : "Chưa có công bố nào được thêm"}
            </p>
          </div>
        )}

        <PublicationsEditDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => !open && handleCancelDialog()}
          publication={editingPublication}
          isAddMode={isAddMode}
          onCancel={handleCancelDialog}
          onSave={handleSavePublication}
          onDelete={handleDeletePublication}
        />
      </div>
    </div>
  )
}
