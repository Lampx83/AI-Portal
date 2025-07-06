"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutGrid, List, Search, ArrowUp, ArrowDown, Users, ChevronUp, ChevronDown } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChatInterface } from "./chat-interface"
import type { Research } from "@/app/page"

const expertsData = [
  {
    name: "GS.TS. Trần Thọ Đạt",
    title: "Chuyên gia Kinh tế Vĩ mô",
    department: "Khoa Kinh tế học",
    tags: ["Chính sách tiền tệ", "Lạm phát", "Tăng trưởng kinh tế"],
  },
  {
    name: "GS. TS Tô Trung Thành",
    title: "Chuyên gia Kinh tế Quốc tế",
    department: "Khoa Kinh tế học ",
    tags: ["Thương mại quốc tế", "FDI", "Hội nhập kinh tế"],
  },
  {
    name: "TS. Nguyễn Bích Ngọc",
    title: "Chuyên gia Marketing Số",
    department: "Khoa Marketing",
    tags: ["Digital Marketing", "Hành vi người dùng", "E-commerce"],
  },
  {
    name: "GS.TS. Hoàng Văn Cường",
    title: "Chuyên gia Bất động sản",
    department: "Khoa Bất động sản và Kinh tế tài nguyên",
    tags: ["Thị trường BĐS", "Quy hoạch đô thị", "Đầu tư"],
  },
  {
    name: "GS. TS Phạm Hồng Chương",
    title: "Chuyên gia Kinh tế Đầu tư",
    department: "Khoa Đầu tư",
    tags: ["Đầu tư công", "Quản lý dự án", "Chính sách phát triển"],
  },
  {
    name: "PGS.TS. Bùi Huy Nhượng",
    title: "Chuyên gia Quản trị Chuỗi cung ứng",
    department: "Khoa Quản trị Kinh doanh",
    tags: ["Logistics", "Quản lý sản xuất", "Tối ưu hóa"],
  },
  {
    name: "TS. Đào Thanh Tùng",
    title: "Chuyên gia Tài chính Doanh nghiệp",
    department: "Khoa Tài chính",
    tags: ["Thị trường vốn", "Định giá doanh nghiệp", "M&A"],
  },
  {
    name: "TS. Nguyễn Thị Thoa",
    title: "Chuyên gia Kinh tế Phát triển",
    department: "Khoa Kinh tế Phát triển",
    tags: ["Xóa đói giảm nghèo", "Phát triển nông thôn", "Bền vững"],
  },
  {
    name: "PGS.TS. Trần Thị Vân Hoa",
    title: "Chuyên gia Kế toán - Kiểm toán",
    department: "Khoa Kế toán",
    tags: ["Kiểm toán nội bộ", "Kế toán tài chính", "Thuế"],
  },
  {
    name: "TS. Phan Thị Thu Hiền",
    title: "Chuyên gia Kinh tế Môi trường",
    department: "Khoa Kinh tế và Quản lý Môi trường",
    tags: ["Kinh tế xanh", "Biến đổi khí hậu", "Năng lượng tái tạo"],
  },
  {
    name: "TS. Lê Trung Thành",
    title: "Chuyên gia Kinh tế Lao động",
    department: "Khoa Kinh tế Lao động và Dân số",
    tags: ["Thị trường lao động", "Việc làm", "Chính sách xã hội"],
  },
]

type SortConfig = { key: keyof (typeof expertsData)[0]; direction: "ascending" | "descending" } | null

interface ExpertViewProps {
  researchContext: Research | null
}

export function ExpertView({ researchContext }: ExpertViewProps) {
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [isExpertListCollapsed, setIsExpertListCollapsed] = useState(false)
  const [hasStartedChat, setHasStartedChat] = useState(false)
  const [currentPage, setCurrentPage] = useState(1) // New state for pagination
  const expertsPerPage = 6 // New constant for experts per page

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    expertsData.forEach((expert) => expert.tags.forEach((tag) => tags.add(tag)))
    return Array.from(tags)
  }, [])

  const filteredExperts = useMemo(() => {
    let sortableExperts = [...expertsData]
    if (searchTerm) {
      sortableExperts = sortableExperts.filter(
        (expert) =>
          expert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expert.title.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }
    if (selectedTags.length > 0) {
      sortableExperts = sortableExperts.filter((expert) => selectedTags.every((tag) => expert.tags.includes(tag)))
    }
    if (sortConfig !== null) {
      sortableExperts.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1
        }
        return 0
      })
    }
    return sortableExperts
  }, [searchTerm, selectedTags, sortConfig])

  // Pagination logic
  const indexOfLastExpert = currentPage * expertsPerPage
  const indexOfFirstExpert = indexOfLastExpert - expertsPerPage
  const currentExperts = filteredExperts.slice(indexOfFirstExpert, indexOfLastExpert)
  const totalPages = Math.ceil(filteredExperts.length / expertsPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  const requestSort = (key: keyof (typeof expertsData)[0]) => {
    let direction: "ascending" | "descending" = "ascending"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending"
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null
    return sortConfig.direction === "ascending" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  const toggleExpertListCollapse = () => {
    setIsExpertListCollapsed((prev) => !prev)
  }

  const handleChatStart = () => {
    if (!hasStartedChat) {
      setHasStartedChat(true)
      setIsExpertListCollapsed(true)
    }
  }

  const tagColors = [
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  ]

  return (
    <div className="flex flex-col h-full dark:bg-blue-950/10">
      {/* Expert List Section - Collapsible */}
      <div
        className={`flex-shrink-0 overflow-hidden transition-all duration-300 border-b dark:border-gray-800 ${isExpertListCollapsed ? "max-h-16" : "max-h-[70vh]"
          }`}
      >
        {/* Collapsed Header */}
        {isExpertListCollapsed && (
          <div className="flex justify-between items-center p-4 dark:bg-blue-950/50">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Danh sách Nhà nghiên cứu ({expertsData.length})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpertListCollapse}
              className="text-blue-700 dark:text-blue-300"
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Mở rộng
            </Button>
          </div>
        )}

        {/* Full Expert List */}
        {!isExpertListCollapsed && (
          <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-blue-800 dark:text-blue-200">Danh sách Nhà nghiên cứu</h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Tìm kiếm và kết nối với các chuyên gia hàng đầu tại NEU.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === "card" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("card")}
                  >
                    <LayoutGrid className="h-5 w-5" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleExpertListCollapse}
                    className="text-blue-700 dark:text-blue-300 bg-transparent"
                  >
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Thu gọn
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                <div className="relative w-full sm:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-400" />
                  <Input
                    placeholder="Tìm theo tên, chức danh..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                      Lọc theo lĩnh vực
                      {selectedTags.length > 0 && (
                        <span className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                          {selectedTags.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Lĩnh vực quan tâm</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {allTags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={(checked) => {
                          setSelectedTags((prev) => (checked ? [...prev, tag] : prev.filter((t) => t !== tag)))
                        }}
                      >
                        {tag}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {viewMode === "card" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {currentExperts.map((expert) => (
                    <Card
                      key={expert.name}
                      className="hover:shadow-lg transition-shadow bg-blue-50/60 dark:bg-blue-900/60"
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-base font-semibold">{expert.name}</CardTitle>
                        <CardDescription className="text-sm">{expert.department}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          {expert.tags.map((tag, index) => (
                            <Badge key={tag} className={`text-xs ${tagColors[index % tagColors.length]}`}>
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-blue-50/60 dark:bg-blue-900/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort("name")}>
                            Nhà nghiên cứu
                            {getSortIcon("name")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" onClick={() => requestSort("department")}>
                            Khoa/Viện
                            {getSortIcon("department")}
                          </Button>
                        </TableHead>
                        <TableHead>Lĩnh vực chuyên môn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentExperts.map((expert) => (
                        <TableRow key={expert.name}>
                          <TableCell className="font-medium">{expert.name}</TableCell>
                          <TableCell>{expert.department}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {expert.tags.map((tag, index) => (
                                <Badge key={tag} className={`text-xs ${tagColors[index % tagColors.length]}`}>
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Trước
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => paginate(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Sau
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat Interface Section */}
      <div className="flex-1 min-h-0">
        <ChatInterface assistantName="Nhà nghiên cứu" researchContext={researchContext} onChatStart={handleChatStart} />
      </div>
    </div>
  )
}
