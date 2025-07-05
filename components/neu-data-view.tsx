"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Download,
  Database,
  TrendingUp,
  Users,
  Plane,
  Building2,
  Factory,
  Wheat,
  DollarSign,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"
import { useState } from "react"
import { ChatInterface } from "./chat-interface"
import type { Research } from "@/app/page"

const datasets = [
  {
    title: "Chỉ số Chứng khoán & Giá Vàng",
    description: "Dữ liệu lịch sử về VN-Index, HNX-Index và giá vàng SJC theo thời gian.",
    icon: TrendingUp,
    hasVisualization: true,
    sampleData: {
      vnIndex: [
        { date: "2024-01", vnIndex: 1180, hnxIndex: 230, goldPrice: 75.2 },
        { date: "2024-02", vnIndex: 1205, hnxIndex: 235, goldPrice: 76.8 },
        { date: "2024-03", vnIndex: 1190, hnxIndex: 228, goldPrice: 78.1 },
        { date: "2024-04", vnIndex: 1220, hnxIndex: 240, goldPrice: 79.5 },
        { date: "2024-05", vnIndex: 1235, hnxIndex: 245, goldPrice: 77.9 },
        { date: "2024-06", vnIndex: 1210, hnxIndex: 238, goldPrice: 80.2 },
        { date: "2024-07", vnIndex: 1245, hnxIndex: 250, goldPrice: 82.1 },
        { date: "2024-08", vnIndex: 1260, hnxIndex: 255, goldPrice: 81.5 },
        { date: "2024-09", vnIndex: 1275, hnxIndex: 260, goldPrice: 83.7 },
        { date: "2024-10", vnIndex: 1290, hnxIndex: 265, goldPrice: 85.2 },
        { date: "2024-11", vnIndex: 1305, hnxIndex: 270, goldPrice: 84.8 },
        { date: "2024-12", vnIndex: 1320, hnxIndex: 275, goldPrice: 86.5 },
      ],
    },
  },
  {
    title: "Thương mại",
    description: "Dữ liệu thống kê v�� hoạt động thương mại, bán lẻ và dịch vụ.",
    icon: Building2,
    hasVisualization: false,
  },
  {
    title: "Du lịch",
    description: "Số liệu về lượng khách du lịch, doanh thu và cơ sở lưu trú.",
    icon: Plane,
    hasVisualization: false,
  },
  {
    title: "Dân số và Lao động",
    description: "Thống kê về dân số, cơ cấu lao động, việc làm và thất nghiệp.",
    icon: Users,
    hasVisualization: false,
  },
  {
    title: "Xuất nhập khẩu (XNK)",
    description: "Dữ liệu chi tiết về kim ngạch xuất nhập khẩu theo mặt hàng và thị trường.",
    icon: Database,
    hasVisualization: false,
  },
  {
    title: "Doanh nghiệp",
    description: "Thông tin về số lượng doanh nghiệp thành lập mới, tạm ngừng và giải thể.",
    icon: Building2,
    hasVisualization: false,
  },
  {
    title: "Chỉ số giá (CPI)",
    description: "Chỉ số giá tiêu dùng, chỉ số giá vàng và đô la Mỹ qua các thời kỳ.",
    icon: DollarSign,
    hasVisualization: false,
  },
  {
    title: "Tài khoản quốc gia",
    description: "Các chỉ tiêu kinh tế tổng hợp như GDP, GNI, tích lũy tài sản.",
    icon: TrendingUp,
    hasVisualization: false,
  },
  {
    title: "Nông, lâm nghiệp & thủy sản",
    description: "Số liệu về sản xuất, diện tích, năng suất các ngành nông, lâm, ngư nghiệp.",
    icon: Wheat,
    hasVisualization: false,
  },
  {
    title: "Công nghiệp",
    description: "Chỉ số sản xuất công nghiệp, sản phẩm chủ yếu, lao động ngành công nghiệp.",
    icon: Factory,
    hasVisualization: false,
  },
]

interface NeuDataViewProps {
  researchContext: Research | null
}

export function NeuDataView({ researchContext }: NeuDataViewProps) {
  const [showVisualization, setShowVisualization] = useState<string | null>(null)
  const [isNeuDataViewCollapsed, setIsNeuDataViewCollapsed] = useState(false) // New state

  const toggleNeuDataViewCollapse = () => {
    setIsNeuDataViewCollapsed((prev) => !prev)
  }

  const handleChatStart = () => {
    setIsNeuDataViewCollapsed(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Data View Section - Collapsible */}
      <div
        className={`flex-shrink-0 overflow-hidden transition-all duration-300 border-b dark:border-gray-800 ${
          isNeuDataViewCollapsed ? "max-h-16" : "max-h-none"
        }`}
      >
        {/* Collapsed Header */}
        {isNeuDataViewCollapsed && (
          <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Kho Dữ liệu NEU ({datasets.length})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleNeuDataViewCollapse}
              className="text-gray-700 dark:text-gray-300"
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Mở rộng
            </Button>
          </div>
        )}

        {/* Full Data View */}
        {!isNeuDataViewCollapsed && (
          <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto border-b dark:border-gray-800">
            <div className="max-w-6xl mx-auto">
              <div className="mb-8 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kho Dữ liệu NEU</h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Khám phá và sử dụng các bộ dữ liệu nghiên cứu do Đại học Kinh tế Quốc dân cung cấp.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleNeuDataViewCollapse}
                  className="text-gray-700 dark:text-gray-300 bg-transparent"
                >
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Thu gọn
                </Button>
              </div>

              {/* Visualization Modal */}
              {showVisualization && (
                <Card className="mb-6">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Trực quan hóa: Chỉ số Chứng khoán & Giá Vàng</CardTitle>
                      <Button variant="ghost" onClick={() => setShowVisualization(null)}>
                        ✕
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Stock Indices Chart */}
                      <div>
                        <h3 className="text-md font-semibold mb-3">Chỉ số Chứng khoán (VN-Index & HNX-Index)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={datasets[0].sampleData?.vnIndex}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="vnIndex" stroke="#2563eb" strokeWidth={2} name="VN-Index" />
                            <Line
                              type="monotone"
                              dataKey="hnxIndex"
                              stroke="#dc2626"
                              strokeWidth={2}
                              name="HNX-Index"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Gold Price Chart */}
                      <div>
                        <h3 className="text-md font-semibold mb-3">Giá Vàng SJC (triệu đồng/lượng)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={datasets[0].sampleData?.vnIndex}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="goldPrice" fill="#f59e0b" name="Giá Vàng SJC" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Accordion type="single" collapsible className="w-full">
                {datasets.map((dataset) => (
                  <AccordionItem value={dataset.title} key={dataset.title}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3 text-base font-medium">
                        <dataset.icon className="w-5 h-5 text-neu-blue" />
                        <span>{dataset.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pl-10">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{dataset.description}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="bg-transparent">
                          <Download className="w-3.5 h-3.5 mr-2" />
                          Tải xuống
                        </Button>
                        {dataset.hasVisualization && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            onClick={() => setShowVisualization(dataset.title)}
                          >
                            <TrendingUp className="w-3.5 h-3.5 mr-2" />
                            Xem biểu đồ
                          </Button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ChatInterface
          assistantName="Dữ liệu NEU"
          researchContext={researchContext}
          onChatStart={handleChatStart}
        />
      </div>
    </div>
  )
}
