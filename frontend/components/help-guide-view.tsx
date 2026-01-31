"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { HelpCircle, Search, BookOpen, Video, MessageCircle, ExternalLink } from "lucide-react"

export function HelpGuideView() {
  const [searchTerm, setSearchTerm] = useState("")

  const helpCategories = [
    {
      title: "Bắt đầu sử dụng",
      icon: BookOpen,
      items: [
        {
          question: "Làm thế nào để tạo nghiên cứu mới?",
          answer:
            "Nhấp vào nút '+' trong sidebar, điền thông tin nghiên cứu, thêm thành viên và tải lên dữ liệu ban đầu.",
          tags: ["nghiên cứu", "tạo mới"],
        },
        {
          question: "Cách mời thành viên vào nhóm nghiên cứu?",
          answer:
            "Trong dialog tạo/chỉnh sửa nghiên cứu, nhập email thành viên và nhấp 'Thêm'. Họ sẽ nhận được lời mời qua email.",
          tags: ["thành viên", "mời"],
        },
        {
          question: "Làm sao để chuyển đổi giữa các trợ lý?",
          answer:
            "Sử dụng sidebar bên trái để chọn trợ lý chuyên môn, hoặc nhấp 'Xem thêm' để xem tất cả trợ lý có sẵn.",
          tags: ["trợ lý", "chuyển đổi"],
        },
      ],
    },
    {
      title: "Sử dụng trợ lý AI",
      icon: MessageCircle,
      items: [
        {
          question: "Trợ lý AI có thể giúp gì?",
          answer:
            "Mỗi trợ lý chuyên về một lĩnh vực: tìm chuyên gia, phân tích dữ liệu, kiểm tra đạo văn, dịch thuật, v.v.",
          tags: ["AI", "trợ lý", "chức năng"],
        },
        {
          question: "Làm thế nào để AI hiểu rõ nghiên cứu của tôi?",
          answer:
            "Cập nhật hồ sơ cá nhân, khai báo định hướng nghiên cứu, và thêm các công bố đã có để AI cá nhân hóa gợi ý.",
          tags: ["cá nhân hóa", "hồ sơ"],
        },
        {
          question: "Cách xem lại lịch sử chat với trợ lý?",
          answer:
            "Nhấp vào menu 3 chấm bên cạnh tên nghiên cứu và chọn 'Xem chat' để xem tất cả cuộc trò chuyện liên quan.",
          tags: ["lịch sử", "chat"],
        },
      ],
    },
    {
      title: "Quản lý dữ liệu",
      icon: Video,
      items: [
        {
          question: "Định dạng file nào được hỗ trợ?",
          answer: "Hệ thống hỗ trợ PDF, DOCX, XLSX, CSV với kích thước tối đa 10MB mỗi file.",
          tags: ["file", "định dạng"],
        },
        {
          question: "Dữ liệu của tôi có được bảo mật không?",
          answer: "Tất cả dữ liệu được mã hóa và lưu trữ an toàn. Bạn có thể kiểm soát quyền riêng tư trong Cài đặt.",
          tags: ["bảo mật", "riêng tư"],
        },
        {
          question: "Cách sao lưu và xuất dữ liệu?",
          answer: "Vào Cài đặt > Dữ liệu để bật sao lưu tự động hoặc xuất dữ liệu thủ công.",
          tags: ["sao lưu", "xuất dữ liệu"],
        },
      ],
    },
  ]

  const allItems = helpCategories.flatMap((category) =>
    category.items.map((item) => ({ ...item, category: category.title })),
  )

  const filteredItems = searchTerm
    ? allItems.filter(
        (item) =>
          item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    : []

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HelpCircle className="w-6 h-6" />
            Hướng dẫn sử dụng
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tìm hiểu cách sử dụng NEU Research hiệu quả</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm kiếm câu hỏi, hướng dẫn..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Search Results */}
        {searchTerm && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Kết quả tìm kiếm ({filteredItems.length})</h2>
            <div className="space-y-4">
              {filteredItems.map((item, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.question}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredItems.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">Không tìm thấy kết quả phù hợp</p>
              )}
            </div>
          </div>
        )}

        {/* Categories */}
        {!searchTerm && (
          <div className="space-y-6">
            {helpCategories.map((category, categoryIndex) => (
              <Card key={categoryIndex}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <category.icon className="w-5 h-5" />
                    {category.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible>
                    {category.items.map((item, itemIndex) => (
                      <AccordionItem key={itemIndex} value={`item-${categoryIndex}-${itemIndex}`}>
                        <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            <p className="text-sm text-gray-600 dark:text-gray-400">{item.answer}</p>
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Links */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Liên kết hữu ích</CardTitle>
            <CardDescription>Tài nguyên bổ sung và hỗ trợ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="outline" className="justify-start h-auto p-4 bg-transparent">
                <div className="flex items-center gap-3">
                  <Video className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Video hướng dẫn</div>
                    <div className="text-xs text-gray-500">Xem video demo chi tiết</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 ml-auto" />
              </Button>
              <Button variant="outline" className="justify-start h-auto p-4 bg-transparent">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Hỗ trợ trực tuyến</div>
                    <div className="text-xs text-gray-500">Chat với đội ngũ hỗ trợ</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 ml-auto" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
