"use client"

import { useState } from "react"
import { BookCopy, Search, Plus, Grid3X3, List, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { PublicationsList } from "./publications-list"
import { PublicationsEditDialog } from "./publications-edit-dialog"

export interface Publication {
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
        { id: 1, title: "Tác động của chính sách tiền tệ đến lạm phát tại Việt Nam giai đoạn 2010-2020", authors: ["Nguyễn Văn A", "Trần Thị B"], journal: "Tạp chí Kinh tế & Phát triển", year: 2023, type: "journal", status: "published", doi: "10.1234/jed.2023.001", abstract: "Nghiên cứu phân tích tác động của các công cụ chính sách tiền tệ..." },
        { id: 2, title: "Phân tích hiệu quả đầu tư FDI trong ngành công nghiệp chế biến", authors: ["Nguyễn Văn A", "Lê Văn C", "Phạm Thị D"], journal: "Hội thảo Kinh tế Quốc gia 2023", year: 2023, type: "conference", status: "published", abstract: "Bài báo đánh giá hiệu quả của đầu tư trực tiếp nước ngoài..." },
        { id: 3, title: "Mô hình dự báo tăng trưởng kinh tế sử dụng machine learning", authors: ["Nguyễn Văn A"], journal: "Journal of Economic Forecasting", year: 2024, type: "journal", status: "accepted", abstract: "Nghiên cứu áp dụng các thuật toán machine learning để dự báo..." },
        { id: 4, title: "Luận văn thạc sĩ: Nghiên cứu về tác động của lạm phát đến tăng trưởng kinh tế", authors: ["Nguyễn Văn A"], journal: "Đại học Kinh tế Quốc dân", year: 2022, type: "thesis", status: "published", abstract: "Luận văn nghiên cứu mối quan hệ giữa lạm phát và tăng trưởng..." },
        { id: 5, title: "Nghiên cứu về tác động của COVID-19 đến thị trường chứng khoán Việt Nam", authors: ["Nguyễn Văn A", "Hoàng Thị E"], journal: "Tạp chí Tài chính", year: 2021, type: "journal", status: "published", abstract: "Phân tích tác động của đại dịch COVID-19 đến các chỉ số chứng khoán..." },
        { id: 6, title: "Đánh giá hiệu quả chính sách hỗ trợ doanh nghiệp nhỏ và vừa", authors: ["Nguyễn Văn A", "Trần Văn F"], journal: "Hội thảo Kinh tế Quốc tế 2022", year: 2022, type: "conference", status: "published", abstract: "Nghiên cứu đánh giá hiệu quả các chính sách hỗ trợ SME..." },
    ])

    const [searchTerm, setSearchTerm] = useState("")
    const [filterType, setFilterType] = useState<"all" | Publication["type"]>("all")
    const [filterStatus, setFilterStatus] = useState<"all" | Publication["status"]>("all")
    const [viewMode, setViewMode] = useState<"card" | "list">("card")

    const [editingPublication, setEditingPublication] = useState<Publication | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

    const filteredPublications = publications.filter((pub) => {
        const q = searchTerm.toLowerCase()
        const matchesSearch =
            pub.title.toLowerCase().includes(q) ||
            pub.authors.some((a) => a.toLowerCase().includes(q))
        const matchesType = filterType === "all" || pub.type === filterType
        const matchesStatus = filterStatus === "all" || pub.status === filterStatus
        return matchesSearch && matchesType && matchesStatus
    })

    const handleEditPublication = (p: Publication) => {
        setEditingPublication(p)
        setIsEditDialogOpen(true)
    }

    const handleFileUpload = (files: FileList | null) => {
        if (files) setUploadedFiles(Array.from(files))
    }

    const handleSavePublication = () => {
        // TODO: lưu thay đổi
        setIsEditDialogOpen(false)
        setEditingPublication(null)
        setUploadedFiles([])
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
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

                {/* Filters */}
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

                    <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
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

                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
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

                {/* List/Grid */}
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

                {/* Dialog */}
                <PublicationsEditDialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    publication={editingPublication}
                    uploadedFiles={uploadedFiles}
                    onUploadFiles={handleFileUpload}
                    onCancel={() => {
                        setIsEditDialogOpen(false)
                        setEditingPublication(null)
                        setUploadedFiles([])
                    }}
                    onSave={handleSavePublication}
                />
            </div>
        </div>
    )
}
