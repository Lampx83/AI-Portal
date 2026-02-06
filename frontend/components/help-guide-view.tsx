"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { HelpCircle, Search, BookOpen, MessageCircle, FileText, FolderOpen, Sparkles, Save, List } from "lucide-react"

export function HelpGuideView() {
  const [searchTerm, setSearchTerm] = useState("")

  const helpCategories = [
    {
      title: "Bắt đầu",
      icon: BookOpen,
      items: [
        {
          question: "Trang Chào mừng dùng để làm gì?",
          answer:
            "Trang Chào mừng là điểm bắt đầu. Bạn có thể bấm \"Bắt đầu sử dụng\" để vào Trợ lý nghiên cứu và soạn bài, hoặc bấm \"Hướng dẫn sử dụng\" để xem hướng dẫn chi tiết.",
          tags: ["welcome", "bắt đầu"],
        },
        {
          question: "Làm thế nào để vào màn hình soạn bài?",
          answer:
            "Từ trang Chào mừng bấm \"Bắt đầu sử dụng\", hoặc từ sidebar bấm \"Trợ lý nghiên cứu\" (main). Bạn sẽ thấy vùng soạn thảo ở giữa và có thể gõ hoặc bấm vào vùng trắng để bắt đầu soạn.",
          tags: ["soạn bài", "trợ lý nghiên cứu"],
        },
        {
          question: "Sidebar có những phần nào?",
          answer:
            "Sidebar gồm: (1) Nghiên cứu của tôi — danh sách dự án nghiên cứu; (2) Trợ lý và công cụ — chọn trợ lý AI; (3) Lịch sử chat — các phiên trò chuyện. Bấm vào tiêu đề từng phần (hoặc nút mũi tên) để thu gọn/mở rộng.",
          tags: ["sidebar", "dự án", "trợ lý", "lịch sử"],
        },
      ],
    },
    {
      title: "Dự án nghiên cứu (Project)",
      icon: FolderOpen,
      items: [
        {
          question: "Làm thế nào để tạo dự án mới?",
          answer:
            "Trong sidebar, bấm nút \"+\" hoặc \"Thêm dự án\" trong phần \"Nghiên cứu của tôi\". Điền tên và mô tả (nếu có) rồi lưu. Sau khi tạo, URL sẽ có tham số rid (id dự án) và bạn có thể lưu bài viết vào dự án đó.",
          tags: ["dự án", "tạo mới"],
        },
        {
          question: "Tại sao bấm Lưu lại báo \"Cần tạo hoặc chọn dự án\"?",
          answer:
            "Bài viết chỉ lưu được khi đã gắn với một dự án. Nếu bạn chưa chọn dự án (hoặc vào thẳng Trợ lý nghiên cứu chưa có rid), hãy bấm \"Tạo dự án mới\" trong hộp thoại hoặc chọn một dự án từ sidebar. Sau khi có dự án, bấm Lưu lại sẽ lưu bài vào dự án đó.",
          tags: ["lưu", "dự án", "project"],
        },
        {
          question: "Làm sao chỉnh sửa tên/mô tả dự án?",
          answer:
            "Khi đang mở một dự án (có tên hiển thị trên thanh tiêu đề phía trên editor), bấm icon bút chì (Edit) cạnh tên dự án để mở hộp thoại chỉnh sửa dự án. Bạn cũng có thể bấm menu 3 chấm bên cạnh dự án trong sidebar và chọn chỉnh sửa.",
          tags: ["chỉnh sửa", "dự án", "edit"],
        },
      ],
    },
    {
      title: "Soạn bài và lưu",
      icon: FileText,
      items: [
        {
          question: "Làm sao bắt đầu soạn bài?",
          answer:
            "Vào Trợ lý nghiên cứu, bấm vào vùng trắng lớn phía dưới (hoặc bất kỳ đâu trong khung soạn thảo). Con trỏ sẽ xuất hiện và bạn có thể gõ. Khi editor trống, bạn cũng có thể chọn mẫu nhanh: \"Tạo bài viết nghiên cứu\", \"Đề cương\", \"Báo cáo tiến độ\" hoặc \"Thêm\" để chọn thêm mẫu.",
          tags: ["soạn thảo", "mẫu", "template"],
        },
        {
          question: "Bài viết có tự lưu không?",
          answer:
            "Nội dung đang soạn được lưu tạm trên trình duyệt. Để lưu vào hệ thống (theo dự án), bạn cần bấm nút \"Lưu\" trên thanh menu (khi đã chọn hoặc tạo dự án). Hệ thống cũng có thể tự đồng bộ theo chu kỳ khi đã có dự án.",
          tags: ["lưu", "auto-save"],
        },
        {
          question: "Xuất bài ra Word, PDF như thế nào?",
          answer:
            "Trên thanh công cụ soạn thảo, mở menu \"Xuất\" (icon mũi tên xuống). Chọn Word (.docx), PDF, HTML, LaTeX hoặc Markdown. File sẽ được tải về máy.",
          tags: ["xuất", "Word", "PDF"],
        },
      ],
    },
    {
      title: "Trợ lý AI và chat",
      icon: MessageCircle,
      items: [
        {
          question: "Trợ lý nghiên cứu và chat floating là gì?",
          answer:
            "Trợ lý nghiên cứu là màn hình chính để soạn bài (editor) và có khung chat nổi (floating) để trò chuyện với AI. Bạn vừa soạn vừa có thể hỏi AI qua khung chat. Các trợ lý khác (ví dụ Trợ lý Dữ liệu) có giao diện riêng, chọn từ sidebar.",
          tags: ["chat", "floating", "AI"],
        },
        {
          question: "Làm sao xem lại lịch sử chat?",
          answer:
            "Trong sidebar, mở phần \"Lịch sử chat\". Danh sách các phiên trò chuyện sẽ hiển thị; bấm vào một phiên để mở lại. Với từng dự án, bạn có thể bấm menu 3 chấm cạnh tên dự án và chọn \"Xem chat\" để xem chat liên quan dự án đó.",
          tags: ["lịch sử", "chat"],
        },
        {
          question: "Chuyển đổi giữa các trợ lý như thế nào?",
          answer:
            "Trong phần \"Trợ lý và công cụ\" trên sidebar, bấm vào tên trợ lý (Trợ lý nghiên cứu, Trợ lý Dữ liệu, v.v.) để chuyển. Bấm \"Xem thêm\" để mở danh sách đầy đủ các trợ lý có sẵn.",
          tags: ["trợ lý", "chuyển đổi"],
        },
      ],
    },
    {
      title: "Mẹo và phím tắt",
      icon: Sparkles,
      items: [
        {
          question: "Có phím tắt nào khi soạn bài?",
          answer:
            "Ctrl/Cmd + S để lưu; Ctrl/Cmd + Z/Y để hoàn tác/làm lại; Ctrl/Cmd + B/I/U cho in đậm, in nghiêng, gạch chân. Bạn có thể dùng thanh công cụ định dạng phía trên editor cho font chữ, cỡ chữ, bảng, ảnh, trích dẫn, công thức.",
          tags: ["phím tắt", "định dạng"],
        },
        {
          question: "Trích dẫn và tài liệu tham khảo?",
          answer:
            "Trên thanh công cụ, mở menu \"Trích dẫn\" để quản lý tài liệu tham khảo (thêm, sửa, xóa) và chèn trích dẫn vào bài (APA, IEEE). Có thể xuất danh sách tài liệu tham khảo ra BibTeX, EndNote, RefMan, RefWorks.",
          tags: ["trích dẫn", "tài liệu tham khảo"],
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Hệ thống AI hỗ trợ nghiên cứu khoa học — cách dùng Trợ lý nghiên cứu, dự án, soạn bài và lưu
          </p>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm câu hỏi, hướng dẫn..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {searchTerm && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Kết quả tìm kiếm ({filteredItems.length})</h2>
            <div className="space-y-4">
              {filteredItems.map((item, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.question}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
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
                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredItems.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Không tìm thấy kết quả phù hợp</p>
              )}
            </div>
          </div>
        )}

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
                            <p className="text-sm text-muted-foreground">{item.answer}</p>
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

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              Đi nhanh
            </CardTitle>
            <CardDescription>Một số đường dẫn thường dùng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/welcome">
                  <div className="flex items-center gap-3 text-left">
                    <BookOpen className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-medium">Trang Chào mừng</div>
                      <div className="text-xs text-muted-foreground">Quay lại điểm bắt đầu</div>
                    </div>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/assistants/main">
                  <div className="flex items-center gap-3 text-left">
                    <FileText className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-medium">Trợ lý nghiên cứu</div>
                      <div className="text-xs text-muted-foreground">Soạn bài và chat với AI</div>
                    </div>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
