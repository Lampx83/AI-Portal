"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BookCopy, Search, Calendar, Users, ExternalLink, Plus, Grid3X3, List, RefreshCw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText } from "lucide-react"
import { Label } from "@/components/ui/label"

interface Publication {
  id: number
  title: string
  authors: string[]
  journal: string
  year: number
  type: "journal" | "conference" | "book" | "thesis"
  status: "published" | "accepted" | "submitted" | "draft"
  doi?: string
  abstract: string
}

export function PublicationsView() {
  const [publications] = useState<Publication[]>([
    {
      id: 1,
      title: "Tác động của chính sách tiền tệ đến lạm phát tại Việt Nam giai đoạn 2010-2020",
      authors: ["Nguyễn Văn A", "Trần Thị B"],
      journal: "Tạp chí Kinh tế & Phát triển",
      year: 2023,
      type: "journal",
      status: "published",
      doi: "10.1234/jed.2023.001",
      abstract: "Nghiên cứu phân tích tác động của các công cụ chính sách tiền tệ...",
    },
    {
      id: 2,
      title: "Phân tích hiệu quả đầu tư FDI trong ngành công nghiệp chế biến",
      authors: ["Nguyễn Văn A", "Lê Văn C", "Phạm Thị D"],
      journal: "Hội thảo Kinh tế Quốc gia 2023",
      year: 2023,
      type: "conference",
      status: "published",
      abstract: "Bài báo đánh giá hiệu quả của đầu tư trực tiếp nước ngoài...",
    },
    {
      id: 3,
      title: "Mô hình dự báo tăng trưởng kinh tế sử dụng machine learning",
      authors: ["Nguyễn Văn A"],
      journal: "Journal of Economic Forecasting",
      year: 2024,
      type: "journal",
      status: "accepted",
      abstract: "Nghiên cứu áp dụng các thuật toán machine learning để dự báo...",
    },
    {
      id: 4,
      title: "Luận văn thạc sĩ: Nghiên cứu về tác động của lạm phát đến tăng trưởng kinh tế",
      authors: ["Nguyễn Văn A"],
      journal: "Đại học Kinh tế Quốc dân",
      year: 2022,
      type: "thesis",
      status: "published",
      abstract: "Luận văn nghiên cứu mối quan hệ giữa lạm phát và tăng trưởng...",
    },
    {
      id: 5,
      title: "Nghiên cứu về tác động của COVID-19 đến thị trường chứng khoán Việt Nam",
      authors: ["Nguyễn Văn A", "Hoàng Thị E"],
      journal: "Tạp chí Tài chính",
      year: 2021,
      type: "journal",
      status: "published",
      abstract: "Phân tích tác động của đại dịch COVID-19 đến các chỉ số chứng khoán...",
    },
    {
      id: 6,
      title: "Đánh giá hiệu quả chính sách hỗ trợ doanh nghiệp nhỏ và vừa",
      authors: ["Nguyễn Văn A", "Trần Văn F"],
      journal: "Hội thảo Kinh tế Quốc tế 2022",
      year: 2022,
      type: "conference",
      status: "published",
      abstract: "Nghiên cứu đánh giá hiệu quả các chính sách hỗ trợ SME...",
    },
  ])

  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const filteredPublications = publications.filter((pub) => {
    const matchesSearch =
      pub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pub.authors.some((author) => author.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = filterType === "all" || pub.type === filterType
    const matchesStatus = filterStatus === "all" || pub.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  const handleEditPublication = (publication: Publication) => {
    setEditingPublication(publication)
    setIsEditDialogOpen(true)
  }

  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      setUploadedFiles(Array.from(files))
    }
  }

  const handleSavePublication = () => {
    // Logic to save publication changes
    setIsEditDialogOpen(false)
    setEditingPublication(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      case "accepted":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      case "submitted":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "published":
        return "Đã xuất bản"
      case "accepted":
        return "Đã chấp nhận"
      case "submitted":
        return "Đã nộp"
      case "draft":
        return "Bản thảo"
      default:
        return status
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case "journal":
        return "Tạp chí"
      case "conference":
        return "Hội thảo"
      case "book":
        return "Sách"
      case "thesis":
        return "Luận văn"
      default:
        return type
    }
  }

  const renderCardView = () => (
    <div className="space-y-4">
      {filteredPublications.map((publication) => (
        <Card
          key={publication.id}
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => handleEditPublication(publication)}
        >
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <CardTitle className="text-lg leading-tight mb-2">{publication.title}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{publication.authors.join(", ")}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{publication.year}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Badge className={getStatusColor(publication.status)}>{getStatusText(publication.status)}</Badge>
                <Badge variant="outline">{getTypeText(publication.type)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-sm text-gray-700 dark:text-gray-300">{publication.journal}</p>
                {publication.doi && <p className="text-xs text-gray-500 dark:text-gray-400">DOI: {publication.doi}</p>}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{publication.abstract}</p>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Xem chi tiết
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const renderListView = () => (
    <div className="space-y-2">
      {filteredPublications.map((publication) => (
        <div
          key={publication.id}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
          onClick={() => handleEditPublication(publication)}
        >
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{publication.title}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{publication.authors.join(", ")}</span>
              <span>•</span>
              <span>{publication.journal}</span>
              <span>•</span>
              <span>{publication.year}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Badge className={getStatusColor(publication.status)} variant="secondary">
              {getStatusText(publication.status)}
            </Badge>
            <Badge variant="outline">{getTypeText(publication.type)}</Badge>
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )

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
            <Button variant="outline" className="bg-transparent">
              <RefreshCw className="w-4 h-4 mr-2" />
              Đồng bộ từ hệ thống
            </Button>
            <Button className="bg-neu-blue hover:bg-neu-blue/90">
              <Plus className="w-4 h-4 mr-2" />
              Thêm công bố
            </Button>
          </div>
        </div>

        {/* Filters and View Toggle */}
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
          <Select value={filterType} onValueChange={setFilterType}>
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
          <Select value={filterStatus} onValueChange={setFilterStatus}>
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
            onValueChange={(value) => value && setViewMode(value as "card" | "list")}
          >
            <ToggleGroupItem value="card" aria-label="Card view">
              <Grid3X3 className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Publications */}
        {viewMode === "card" ? renderCardView() : renderListView()}

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

        {/* Edit Publication Dialog */}
        {editingPublication && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
                  <Input id="edit-title" defaultValue={editingPublication.title} placeholder="Tiêu đề công bố..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-authors">Tác giả</Label>
                  <Input
                    id="edit-authors"
                    defaultValue={editingPublication.authors.join(", ")}
                    placeholder="Tên các tác giả, cách nhau bằng dấu phẩy..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-journal">Tạp chí/Hội thảo</Label>
                  <Input
                    id="edit-journal"
                    defaultValue={editingPublication.journal}
                    placeholder="Tên tạp chí hoặc hội thảo..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-year">Năm</Label>
                    <Input id="edit-year" type="number" defaultValue={editingPublication.year} placeholder="2024" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-doi">DOI (tùy chọn)</Label>
                    <Input
                      id="edit-doi"
                      defaultValue={editingPublication.doi || ""}
                      placeholder="10.1234/example.2024.001"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-abstract">Tóm tắt</Label>
                  <Textarea
                    id="edit-abstract"
                    defaultValue={editingPublication.abstract}
                    placeholder="Tóm tắt nội dung công bố..."
                    rows={4}
                  />
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
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.doc"
                        multiple
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                    </label>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-2">File đã tải lên:</p>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <FileText className="w-4 h-4" />
                          <span>{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleSavePublication} className="bg-neu-blue hover:bg-neu-blue/90">
                  Lưu thay đổi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
