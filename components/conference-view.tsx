"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, MapPin, LayoutGrid, List, Search, ChevronUp, ChevronDown } from "lucide-react"
import { ChatInterface } from "./chat-interface"
import type { Research } from "@/app/page"
import { ChatSuggestions } from "./chat-suggestions"



interface ConferenceViewProps {
  researchContext: Research | null
}

export function ConferenceView({ researchContext }: ConferenceViewProps) {
  const [publicationsData, setPublicationsData] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sortKey, setSortKey] = useState("date")
  const [isConferenceViewCollapsed, setIsConferenceViewCollapsed] = useState(false) // New state
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPublications = async () => {
      try {
        setIsLoading(true) // 👈 Bắt đầu loading
        const response = await fetch("https://api.rpa4edu.shop/api_journal.php")
        const data = await response.json()
        setPublicationsData(data.slice(0, 10))
      } catch (error) {
        console.error("Lỗi khi fetch API:", error)
      } finally {
        setIsLoading(false) // 👈 Kết thúc loading
      }
    }

    fetchPublications()
  }, [])


  const normalizedPublications = useMemo(() => {
    return publicationsData.map((j: any) => ({
      title: j.title,
      type: "Tạp chí", // cố định hoặc lấy từ j.type nếu phân biệt được
      date: j.created_time || "2025-01-01", // dùng created_time làm ngày (có thể đổi)
      location: j.country ? `${j.country}, ${j.region}` : "Không rõ",
      tags: j.categories?.split(";").map((tag: string) => tag.trim()) || [],
    }))
  }, [publicationsData])

  const filteredPublications = useMemo(() => {
    let sortablePubs = [...normalizedPublications]
    if (searchTerm) {
      sortablePubs = sortablePubs.filter((pub) =>
        pub.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    if (filterType !== "all") {
      sortablePubs = sortablePubs.filter((pub) => pub.type.includes(filterType))
    }
    sortablePubs.sort((a, b) => {
      const valA = a.date
      const valB = b.date
      if (sortKey === "title") {
        return a.title.localeCompare(b.title)
      }
      return new Date(valA).getTime() - new Date(valB).getTime()
    })
    return sortablePubs
  }, [searchTerm, filterType, sortKey, normalizedPublications])

  const toggleConferenceViewCollapse = () => {
    setIsConferenceViewCollapsed((prev) => !prev)
  }

  const handleChatStart = () => {
    setIsConferenceViewCollapsed(true)
  }

  return (
    <div className="flex flex-col h-full ">
      {/* Conference List Section - Collapsible */}
      <div
        className={`flex-1 overflow-hidden transition-all duration-300  ${isConferenceViewCollapsed ? "max-h-16" : "max-h-none"
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
          <div className="h-full p-4 sm:p-6 lg:p-8 dark:border-gray-800">
            <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

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

              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
                </div>
              ) : (
                viewMode === "card" ? (
                  <div className="flex-1 overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-y-auto pr-2">
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
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {isConferenceViewCollapsed && (
        <div className=" flex-1 p-4 border-b dark:border-gray-800 ">
          <ChatSuggestions
            suggestions={[
              "Tìm kiếm các bài báo mới nhất về AI trong y tế.",
              "Tóm tắt nghiên cứu về biến đổi khí hậu của giáo sư Nguyễn Văn A.",
              "Phân tích xu hướng công nghệ blockchain trong 5 năm tới.",
              "Đề xuất các chuyên gia về kinh tế số tại trường.",
              "Giải thích về thuật toán học sâu Convolutional Neural Networks (CNN).",
              "So sánh các phương pháp nghiên cứu định tính và định lượng.",
            ]}
            onSuggestionClick={(sugg) => {
              const input = document.querySelector<HTMLInputElement>('input[placeholder^="Nhập tin nhắn"]')
              if (input) input.value = sugg
            }}
            assistantName="Hội thảo & Tạp chí"
          />
        </div>
      )}

      <ChatInterface
        assistantName="Hội thảo & Tạp chí"
        researchContext={researchContext}
        onChatStart={handleChatStart}
      />
    </div >
  )
}
