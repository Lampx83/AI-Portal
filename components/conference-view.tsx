"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, MapPin, LayoutGrid, List, Search, ChevronUp, ChevronDown } from "lucide-react"
import { ChatInterface } from "./chat-interface"
import type { Research } from "@/app/page"

const publicationsData = [
  {
    title: "Hội thảo Khoa học Quốc gia (VBER)",
    type: "Hội thảo",
    date: "2025-10-15",
    location: "Hà Nội, Việt Nam",
    tags: ["Kinh tế", "Kinh doanh", "Quản trị"],
  },
  {
    title: "Tạp chí Kinh tế & Phát triển",
    type: "Tạp chí",
    deadline: "2025-09-30",
    scope: "Scopus, ACI",
    tags: ["Phát triển bền vững", "Kinh tế lượng", "Tài chính"],
  },
  {
    title: "International Conference on Business and Finance (ICBF)",
    type: "Hội thảo quốc tế",
    date: "2025-12-05",
    location: "Đà Nẵng, Việt Nam",
    tags: ["Finance", "Banking", "Investment"],
  },
  {
    title: "Journal of Asian Business and Economic Studies",
    type: "Tạp chí quốc tế",
    deadline: "2025-12-31",
    scope: "Scopus Q1",
    tags: ["Asian Economies", "Business Strategy", "Economic Policy"],
  },
  {
    title: "Ngày hội Khởi nghiệp Sinh viên NEU 2025",
    type: "Sự kiện",
    date: "2025-11-20",
    location: "Hà Nội, Việt Nam",
    tags: ["Khởi nghiệp", "Sinh viên", "Đổi mới sáng tạo"],
  },
  {
    title: "Diễn đàn Kinh tế Số Việt Nam",
    type: "Sự kiện",
    date: "2025-08-15",
    location: "TP. Hồ Chí Minh, Việt Nam",
    tags: ["Kinh tế số", "Chuyển đổi số", "Công nghệ"],
  },
  // New additions
  {
    title: "Quỹ Phát triển Khoa học và Công nghệ Quốc gia (NAFOSTED)",
    type: "Quỹ Tài trợ",
    deadline: "2025-08-31",
    scope: "Cấp Nhà nước",
    tags: ["Khoa học cơ bản", "Công nghệ", "Đổi mới sáng tạo"],
  },
  {
    title: "Hội thảo Quốc tế về Trí tuệ Nhân tạo (AI Vietnam)",
    type: "Hội thảo quốc tế",
    date: "2025-09-18",
    location: "TP. Hồ Chí Minh, Việt Nam",
    tags: ["AI", "Machine Learning", "Deep Learning", "Công nghệ"],
  },
  {
    title: "Tạp chí Nghiên cứu Kinh tế Việt Nam",
    type: "Tạp chí",
    deadline: "2025-11-15",
    scope: "ACI, ESCI",
    tags: ["Kinh tế Việt Nam", "Chính sách", "Phát triển"],
  },
  {
    title: "Quỹ Hỗ trợ Nghiên cứu Fulbright",
    type: "Quỹ Tài trợ",
    deadline: "2025-10-01",
    scope: "Quốc tế",
    tags: ["Nghiên cứu", "Học bổng", "Hợp tác quốc tế"],
  },
  {
    title: "International Conference on Sustainable Development (ICSD)",
    type: "Hội thảo quốc tế",
    date: "2025-11-08",
    location: "Bangkok, Thailand",
    tags: ["Sustainable Development", "Environment", "Climate Change"],
  },
  {
    title: "Tạp chí Quản trị Kinh doanh",
    type: "Tạp chí",
    deadline: "2025-12-20",
    scope: "ACI",
    tags: ["Quản trị", "Kinh doanh", "Chiến lược", "Marketing"],
  },
  {
    title: "Quỹ Nghiên cứu Vingroup (VinIF)",
    type: "Quỹ Tài trợ",
    deadline: "2025-09-15",
    scope: "Trong nước",
    tags: ["Công nghệ cao", "Y sinh", "Nông nghiệp thông minh"],
  },
  {
    title: "Hội nghị Khoa học Công nghệ Toàn quốc",
    type: "Hội thảo",
    date: "2025-10-25",
    location: "Đà Nẵng, Việt Nam",
    tags: ["Khoa học", "Công nghệ", "Đổi mới", "Ứng dụng"],
  },
  {
    title: "Journal of Financial Economics",
    type: "Tạp chí quốc tế",
    deadline: "2025-08-30",
    scope: "Scopus Q1, SSCI",
    tags: ["Financial Economics", "Banking", "Corporate Finance"],
  },
  {
    title: "Quỹ Hỗ trợ Nghiên cứu ASEAN",
    type: "Quỹ Tài trợ",
    deadline: "2025-11-30",
    scope: "Khu vực",
    tags: ["ASEAN", "Hợp tác khu vực", "Phát triển bền vững"],
  },
]

interface ConferenceViewProps {
  researchContext: Research | null
}

export function ConferenceView({ researchContext }: ConferenceViewProps) {
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sortKey, setSortKey] = useState("date")
  const [isConferenceViewCollapsed, setIsConferenceViewCollapsed] = useState(false) // New state

  const filteredPublications = useMemo(() => {
    let sortablePubs = [...publicationsData]
    if (searchTerm) {
      sortablePubs = sortablePubs.filter((pub) => pub.title.toLowerCase().includes(searchTerm.toLowerCase()))
    }
    if (filterType !== "all") {
      sortablePubs = sortablePubs.filter((pub) => pub.type.includes(filterType))
    }
    sortablePubs.sort((a, b) => {
      const valA = a.date || a.deadline
      const valB = b.date || b.deadline
      if (sortKey === "title") {
        return a.title.localeCompare(b.title)
      }
      return new Date(valA).getTime() - new Date(valB).getTime()
    })
    return sortablePubs
  }, [searchTerm, filterType, sortKey])

  const toggleConferenceViewCollapse = () => {
    setIsConferenceViewCollapsed((prev) => !prev)
  }

  const handleChatStart = () => {
    setIsConferenceViewCollapsed(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Conference List Section - Collapsible */}
      <div
        className={`flex-shrink-0 overflow-hidden transition-all duration-300 border-b dark:border-gray-800 ${
          isConferenceViewCollapsed ? "max-h-16" : "max-h-none"
        }`}
      >
        {/* Collapsed Header */}
        {isConferenceViewCollapsed && (
          <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Hội thảo, Tạp chí & Sự kiện ({publicationsData.length})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleConferenceViewCollapse}
              className="text-gray-700 dark:text-gray-300"
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Mở rộng
            </Button>
          </div>
        )}

        {/* Full Conference List */}
        {!isConferenceViewCollapsed && (
          <div className="p-4 sm:p-6 lg:p-8 overflow-y-aut dark:border-gray-800 max-h-80vh]">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hội thảo, Tạp chí & Sự kiện</h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Gợi ý các diễn đàn, sự kiện uy tín để công bố nghiên cứu của bạn.
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
                    onClick={toggleConferenceViewCollapse}
                    className="text-gray-700 dark:text-gray-300 bg-transparent"
                  >
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Thu gọn
                  </Button>
                </div>
              </div>

              {viewMode === "list" && (
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                  <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="Tìm theo tên hội thảo, tạp chí..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex w-full sm:w-auto gap-4">
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Lọc theo loại" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="Hội thảo">Hội thảo</SelectItem>
                        <SelectItem value="Tạp chí">Tạp chí</SelectItem>
                        <SelectItem value="Sự kiện">Sự kiện</SelectItem>
                        <SelectItem value="Quỹ Tài trợ">Quỹ Tài trợ</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortKey} onValueChange={setSortKey}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Sắp xếp theo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Ngày/Hạn nộp</SelectItem>
                        <SelectItem value="title">Tên (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {viewMode === "card" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPublications.map((pub) => (
                    <Card key={pub.title} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge
                              variant={
                                pub.type.includes("Hội thảo")
                                  ? "default"
                                  : pub.type.includes("Sự kiện")
                                    ? "secondary"
                                    : pub.type.includes("Quỹ Tài trợ")
                                      ? "destructive"
                                      : "outline"
                              }
                            >
                              {pub.type}
                            </Badge>
                            <CardTitle className="mt-1.5 text-base font-semibold">{pub.title}</CardTitle>
                          </div>
                          {pub.scope && <Badge variant="destructive">{pub.scope}</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-4">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(pub.date || pub.deadline).toLocaleDateString("vi-VN")}</span>
                          </div>
                          {pub.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{pub.location}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          {pub.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg">
                  {filteredPublications.map((pub, index) => (
                    <div
                      key={pub.title}
                      className={`p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${index < filteredPublications.length - 1 ? "border-b" : ""}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <Badge
                            variant={
                              pub.type.includes("Hội thảo")
                                ? "default"
                                : pub.type.includes("Sự kiện")
                                  ? "secondary"
                                  : pub.type.includes("Quỹ Tài trợ")
                                    ? "destructive"
                                    : "outline"
                            }
                          >
                            {pub.type}
                          </Badge>
                          {pub.scope && <Badge variant="destructive">{pub.scope}</Badge>}
                        </div>
                        <h3 className="font-semibold text-lg">{pub.title}</h3>
                        <div className="flex items-center text-sm text-muted-foreground gap-6 mt-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(pub.date || pub.deadline).toLocaleDateString("vi-VN")}</span>
                          </div>
                          {pub.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              <span>{pub.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end sm:max-w-xs">
                        {pub.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ChatInterface
          assistantName="Hội thảo & Tạp chí"
          researchContext={researchContext}
          onChatStart={handleChatStart}
        />
      </div>
    </div>
  )
}
