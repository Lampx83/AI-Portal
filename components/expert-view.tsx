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
import { LayoutGrid, List, Search, ArrowUp, ArrowDown } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChatInterface } from "./chat-interface"
import type { Research } from "@/app/page"

const expertsData = [
  {
    name: "GS.TS. Trần Thọ Đạt",
    title: "Chuyên gia Kinh tế Vĩ mô",
    tags: ["Chính sách tiền tệ", "Lạm phát", "Tăng trưởng kinh tế"],
  },
  {
    name: "GS. TS Tô Trung Thành",
    title: "Chuyên gia Kinh tế Quốc tế",
    tags: ["Thương mại quốc tế", "FDI", "Hội nhập kinh tế"],
  },
  {
    name: "TS. Nguyễn Bích Ngọc",
    title: "Chuyên gia Marketing Số",
    tags: ["Digital Marketing", "Hành vi người dùng", "E-commerce"],
  },
  {
    name: "GS.TS. Hoàng Văn Cường",
    title: "Chuyên gia Bất động sản",
    tags: ["Thị trường BĐS", "Quy hoạch đô thị", "Đầu tư"],
  },
  {
    name: "GS. TS Phạm Hồng Chương",
    title: "Chuyên gia Kinh tế Đầu tư",
    tags: ["Đầu tư công", "Quản lý dự án", "Chính sách phát triển"],
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-4 sm:p-6 lg:p-8 overflow-y-auto border-b dark:border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Danh sách Chuyên gia</h1>
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
            </div>
          </div>

          {viewMode === "list" && (
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
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
          )}

          {viewMode === "card" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExperts.map((expert) => (
                <Card key={expert.name} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base font-semibold">{expert.name}</CardTitle>
                    <CardDescription className="text-sm">{expert.title}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {expert.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" onClick={() => requestSort("name")}>
                        Chuyên gia
                        {getSortIcon("name")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => requestSort("title")}>
                        Chức danh
                        {getSortIcon("title")}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExperts.map((expert) => (
                    <TableRow key={expert.name}>
                      <TableCell className="font-medium">{expert.name}</TableCell>
                      <TableCell>{expert.title}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ChatInterface assistantName="Chuyên gia" researchContext={researchContext} />
      </div>
    </div>
  )
}
