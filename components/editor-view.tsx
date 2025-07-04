"use client"

import { useRef, useCallback } from "react"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  FileCheck,
  Book,
  BarChart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Research } from "@/app/page"

interface EditorViewProps {
  researchContext: Research | null
}

const sampleContent = `
<h1>Phân tích Tác động của Chính sách Tiền tệ đến Lạm phát tại Việt Nam</h1>
<p><b>Giới thiệu</b></p>
<p>Lạm phát luôn là một trong những vấn đề kinh tế vĩ mô được quan tâm hàng đầu tại Việt Nam. Chính sách tiền tệ, do Ngân hàng Nhà nước Việt Nam (NHNN) điều hành, là công cụ quan trọng để kiểm soát lạm phát và ổn định kinh tế. Bài viết này tập trung phân tích sâu hơn về các cơ chế truyền dẫn và hiệu quả của chính sách tiền tệ trong việc kiềm chế lạm phát giai đoạn 2020-2025.</p>
<p><i>Mục tiêu nghiên cứu:</i></p>
<ul>
  <li>Đánh giá hiệu quả của các công cụ chính sách tiền tệ.</li>
  <li>Phân tích các kênh truyền dẫn tác động đến lạm phát.</li>
  <li>Đề xuất các giải pháp chính sách phù hợp.</li>
</ul>
<p>Chúng tôi sử dụng mô hình VAR (Vector Autoregression) để phân tích dữ liệu chuỗi thời gian hàng quý. Kết quả cho thấy lãi suất điều hành có tác động đáng kể đến lạm phát, nhưng có độ trễ nhất định.</p>
<blockquote>"Ổn định kinh tế vĩ mô, kiểm soát lạm phát là nhiệm vụ trọng tâm hàng đầu."</blockquote>
<p>Để biết thêm chi tiết, xem mã nguồn phân tích tại đây:</p>
<pre><code>
# Mã phân tích mô hình VAR
import pandas as pd
import statsmodels.api as sm
from statsmodels.tsa.api import VAR

# ... (code continues)
</code></pre>
`

export function EditorView({ researchContext }: EditorViewProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  const applyFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }, [])

  const formatBlock = useCallback(
    (tag: string) => {
      applyFormat("formatBlock", `<${tag}>`)
    },
    [applyFormat],
  )

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-950">
      <div className="flex-1 flex flex-col p-4 sm:p-6">
        <Card className="flex-1 flex flex-col w-full max-w-4xl mx-auto">
          <div className="p-2 border-b dark:border-gray-800 flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => applyFormat("bold")}>
              <Bold className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => applyFormat("italic")}>
              <Italic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => applyFormat("underline")}>
              <Underline className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => applyFormat("strikethrough")}>
              <Strikethrough className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="icon" onClick={() => formatBlock("h1")}>
              <Heading1 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => formatBlock("h2")}>
              <Heading2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => formatBlock("h3")}>
              <Heading3 className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="icon" onClick={() => applyFormat("insertUnorderedList")}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => applyFormat("insertOrderedList")}>
              <ListOrdered className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => formatBlock("blockquote")}>
              <Quote className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => formatBlock("pre")}>
              <Code className="w-4 h-4" />
            </Button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="flex-1 p-6 overflow-y-auto prose dark:prose-invert max-w-none focus:outline-none"
            dangerouslySetInnerHTML={{ __html: sampleContent }}
          />
        </Card>
      </div>
      <aside className="w-80 border-l dark:border-gray-800 p-4 sm:p-6 hidden lg:block">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trợ lý Soạn thảo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-green-500" /> Gợi ý
              </h4>
              <ul className="list-disc list-inside text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <li>Thuật ngữ "NHNN" nên được viết đầy đủ lần đầu.</li>
                <li>Xem xét thêm phần phụ lục dữ liệu.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Book className="w-4 h-4 text-blue-500" /> Trích dẫn
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tìm thấy 5 trích dẫn có thể liên quan.{" "}
                <Button variant="link" className="p-0 h-auto">
                  Xem
                </Button>
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <BarChart className="w-4 h-4 text-orange-500" /> Thống kê
              </h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <li>Số từ: 152</li>
                <li>Thời gian đọc: ~1 phút</li>
                <li>Độ khó đọc: Trung bình</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
