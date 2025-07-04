"use client"

import { useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SendHorizonal, Search, BookCopy, Database, ShieldCheck } from "lucide-react"
import type { Research } from "@/app/page"
import { useChat } from "ai/react"
import { Loader2 } from "lucide-react"

interface Message {
  id: number
  role: "user" | "assistant"
  content: string
}

interface ChatInterfaceProps {
  assistantName?: string
  researchContext?: Research | null
  isMainChat?: boolean
}

const promptSuggestions = [
  {
    icon: Search,
    text: "Tìm chuyên gia về kinh tế lượng và chính sách công.",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    icon: BookCopy,
    text: "Liệt kê các hội thảo quốc tế về tài chính sắp diễn ra.",
    gradient: "from-purple-500 to-pink-600",
  },
  {
    icon: Database,
    text: "Cung cấp bộ dữ liệu về GDP và lạm phát của Việt Nam 5 năm gần đây.",
    gradient: "from-green-500 to-emerald-600",
  },
  {
    icon: ShieldCheck,
    text: "Tôi cần kiểm tra đạo văn cho một bài báo, tôi nên bắt đầu từ đâu?",
    gradient: "from-orange-500 to-red-600",
  },
]

export function ChatInterface({ assistantName, researchContext, isMainChat = false }: ChatInterfaceProps) {
  const getInitialMessage = () => {
    if (researchContext) {
      return `Đang làm việc trong nghiên cứu "${researchContext.name}". ${
        assistantName ? `Trợ lý ${assistantName} sẵn sàng hỗ trợ.` : "Tôi có thể giúp gì cho bạn?"
      }`
    }
    if (assistantName) {
      return `Trợ lý ${assistantName} sẵn sàng hỗ trợ. Tôi có thể giúp gì cho bạn?`
    }
    return "Tôi là trợ lý AI chính của Neu Research. Tôi có thể giúp bạn điều phối công việc hoặc bạn có thể chọn một trợ lý chuyên môn để bắt đầu."
  }

  const { messages, input, setInput, handleInputChange, handleSubmit, isLoading, setMessages } = useChat()

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only set initial message if there are no messages yet
    if (messages.length === 0) {
      setMessages([{ id: String(Date.now()), role: "assistant", content: getInitialMessage() }])
    }
  }, [assistantName, researchContext, setMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handlePromptClick = (prompt: string) => {
    setInput(prompt)
  }

  const getAssistantDescription = (name?: string) => {
    switch (name) {
      case "Chuyên gia":
        return "Kết nối với các chuyên gia hàng đầu tại NEU"
      case "Hội thảo & Tạp chí":
        return "Tìm kiếm cơ hội công bố nghiên cứu"
      case "Dữ liệu NEU":
        return "Truy cập kho dữ liệu nghiên cứu của NEU"
      case "Soạn thảo & Trích dẫn":
        return "Hỗ trợ viết và trích dẫn học thuật"
      case "Thống kê & Phân tích":
        return "Phân tích dữ liệu và thống kê nâng cao"
      case "Kiểm tra Đạo văn":
        return "Kiểm tra tính nguyên bản của nghiên cứu"
      case "Xin tài trợ & Quỹ":
        return "Hỗ trợ xin tài trợ nghiên cứu"
      case "Dịch thuật Học thuật":
        return "Dịch thuật chuyên ngành chính xác"
      default:
        return "Trợ lý chuyên môn của NEU Research"
    }
  }

  const getAssistantCapabilities = (name?: string) => {
    switch (name) {
      case "Chuyên gia":
        return "Tìm kiếm chuyên gia theo lĩnh vực, xem hồ sơ nghiên cứu, và kết nối trực tiếp với các giảng viên, nghiên cứu viên hàng đầu tại NEU."
      case "Hội thảo & Tạp chí":
        return "Khám phá các hội thảo khoa học, tạp chí uy tín phù hợp với nghiên cứu của bạn. Nhận thông báo về deadline và yêu cầu nộp bài."
      case "Dữ liệu NEU":
        return "Truy cập các bộ dữ liệu kinh tế, thống kê chính thức từ NEU. Tải xuống, phân tích và sử dụng trong nghiên cứu của bạn."
      case "Soạn thảo & Trích dẫn":
        return "Hỗ trợ viết bài báo khoa học, kiểm tra ngữ pháp, định dạng trích dẫn theo chuẩn APA, MLA, Chicago và các chuẩn quốc tế khác."
      case "Thống kê & Phân tích":
        return "Thực hiện phân tích thống kê, tạo biểu đồ, chạy mô hình kinh tế lượng và giải thích kết quả một cách dễ hiểu."
      case "Kiểm tra Đạo văn":
        return "Quét và kiểm tra tính nguyên bản của nghiên cứu, so sánh với cơ sở dữ liệu học thuật, đưa ra báo cáo chi tiết về độ tương đồng."
      case "Xin tài trợ & Quỹ":
        return "Tìm kiếm các quỹ tài trợ phù hợp, hướng dẫn viết đề xuất nghiên cứu và chuẩn bị hồ sơ xin tài trợ chuyên nghiệp."
      case "Dịch thuật Học thuật":
        return "Dịch thuật chính xác các tài liệu học thuật, bài báo khoa học giữa tiếng Việt và tiếng Anh với thuật ngữ chuyên ngành."
      default:
        return "Khám phá các tính năng chuyên môn để hỗ trợ nghiên cứu của bạn một cách hiệu quả nhất."
    }
  }

  const getAssistantPrompts = (name?: string): string[] => {
    switch (name) {
      case "Chuyên gia":
        return [
          "Tìm chuyên gia về kinh tế vĩ mô tại NEU",
          "Liệt kê các giảng viên chuyên về tài chính ngân hàng",
          "Ai là chuyên gia về thương mại quốc tế?",
          "Tìm nghiên cứu viên về kinh tế lượng",
        ]
      case "Hội thảo & Tạp chí":
        return [
          "Các hội thảo kinh tế sắp diễn ra trong năm 2024",
          "Tạp chí Scopus Q1 về kinh tế và tài chính",
          "Deadline nộp bài cho các hội thảo quốc tế",
          "Tạp chí phù hợp để công bố nghiên cứu về marketing",
        ]
      case "Dữ liệu NEU":
        return [
          "Dữ liệu GDP Việt Nam 5 năm gần đây",
          "Thống kê xuất nhập khẩu theo ngành",
          "Chỉ số giá tiêu dùng CPI qua các năm",
          "Dữ liệu về doanh nghiệp và lao động",
        ]
      case "Soạn thảo & Trích dẫn":
        return [
          "Hướng dẫn trích dẫn theo chuẩn APA",
          "Kiểm tra ngữ pháp bài báo khoa học",
          "Cấu trúc một bài báo nghiên cứu chuẩn",
          "Cách viết abstract hiệu quả",
        ]
      case "Thống kê & Phân tích":
        return [
          "Phân tích hồi quy tuyến tính với dữ liệu kinh tế",
          "Tạo biểu đồ từ dữ liệu Excel",
          "Kiểm định tính dừng của chuỗi thời gian",
          "Phân tích tương quan giữa các biến",
        ]
      case "Kiểm tra Đạo văn":
        return [
          "Kiểm tra đạo văn cho bài báo của tôi",
          "So sánh với cơ sở dữ liệu học thuật",
          "Hướng dẫn tránh đạo văn khi viết",
          "Báo cáo chi tiết về độ tương đồng",
        ]
      case "Xin tài trợ & Quỹ":
        return [
          "Các quỹ tài trợ nghiên cứu trong nước",
          "Hướng dẫn viết đề xuất nghiên cứu",
          "Quỹ quốc tế cho nghiên cứu kinh tế",
          "Chuẩn bị hồ sơ xin tài trợ NAFOSTED",
        ]
      case "Dịch thuật Học thuật":
        return [
          "Dịch abstract từ tiếng Việt sang tiếng Anh",
          "Thuật ngữ kinh tế chuyên ngành",
          "Dịch bài báo khoa học chính xác",
          "Kiểm tra chất lượng bản dịch",
        ]
      default:
        return [
          "Tôi cần hỗ trợ gì từ trợ lý này?",
          "Hướng dẫn sử dụng tính năng",
          "Ví dụ về cách sử dụng",
          "Câu hỏi thường gặp",
        ]
    }
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-white via-gray-50 to-blue-50 dark:from-gray-900 dark:via-gray-950 dark:to-blue-950">
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center py-8">
            {isMainChat ? (
              <>
                <div className="flex justify-center mb-6">
                  <img src="/neu-logo.svg" alt="NEU Logo" className="w-16 h-16" />
                </div>
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">NEU Research Assistant</h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    Hệ thống trợ lý nghiên cứu AI của Đại học Kinh tế Quốc dân
                  </p>
                </div>
                <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                  Khám phá sức mạnh của AI trong nghiên cứu học thuật. Tìm kiếm chuyên gia, phân tích dữ liệu, và nhận
                  hỗ trợ toàn diện cho các dự án nghiên cứu của bạn.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg mb-8">
                  {getAssistantCapabilities(assistantName)}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  {getAssistantPrompts(assistantName).map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-auto text-left justify-start bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-200 p-4 rounded-xl shadow-sm hover:shadow-md"
                      onClick={() => handlePromptClick(prompt)}
                    >
                      <span className="text-sm font-normal text-gray-700 dark:text-gray-300 leading-relaxed">
                        {prompt}
                      </span>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* The following block has been removed:
          {messages.length > 0
            ? messages.map((m) => (
                <div key={m.id} className={`flex items-start gap-4 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && (
                    <div className="w-10 h-10 rounded-full bg-neu-blue flex-shrink-0 flex items-center justify-center">
                      <Image src="/neu-logo.svg" alt="NEU Logo" width={24} height={24} />
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-lg max-w-lg whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  </div>
                  {m.role === "user" && (
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </div>
                  )}
                </div>
              ))
            : !isMainChat && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg mb-8">
                    {getAssistantCapabilities(assistantName)}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                    {getAssistantPrompts(assistantName).map((prompt, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="h-auto text-left justify-start bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-200 p-4 rounded-xl shadow-sm hover:shadow-md"
                        onClick={() => handlePromptClick(prompt)}
                      >
                        <span className="text-sm font-normal text-gray-700 dark:text-gray-300 leading-relaxed">
                          {prompt}
                        </span>
                      </Button>
                    ))}
                  </div>
                </>
              )}
          */}

          {/* The following block has been removed:
          {isLoading && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-neu-blue flex-shrink-0 flex items-center justify-center">
                <Image src="/neu-logo.svg" alt="NEU Logo" width={24} height={24} />
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            </div>
          )}
          */}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {isMainChat && messages.length <= 1 && (
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-5xl mx-auto w-full">
            {promptSuggestions.map((prompt, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto text-left justify-start bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-200 p-6 rounded-xl shadow-sm hover:shadow-md"
                onClick={() => handlePromptClick(prompt.text)}
              >
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-r ${prompt.gradient} flex items-center justify-center mr-4 shadow-sm`}
                >
                  <prompt.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-base font-normal text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-2">
                  {prompt.text}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3 max-w-4xl mx-auto">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Bắt đầu trò chuyện..."
              className="flex-1 bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm backdrop-blur-sm"
              disabled={isLoading}
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl px-6 w-[100px]"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
              <span className="sr-only">Gửi</span>
            </Button>
          </form>
        </div>
      </footer>
    </div>
  )
}
