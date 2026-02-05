"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, FileText, FolderOpen, Sparkles } from "lucide-react"

export default function WelcomePage() {
  const router = useRouter()

  const handleStart = () => {
    router.push("/assistants/main")
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto min-h-0">
      <div className="mx-auto max-w-3xl w-full p-8 text-center">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/neu-logo.svg" alt="Logo Đại học Kinh tế Quốc dân" width={80} height={80} className="mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">
            Chào mừng bạn đến với
            <br />
            Hệ thống AI hỗ trợ nghiên cứu khoa học
          </h1>
          <p className="text-muted-foreground text-base">
            Nền tảng hỗ trợ các hoạt động nghiên cứu khoa học
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 mb-10">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Trợ lý AI</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Trò chuyện với Trợ lý nghiên cứu để trao đổi ý tưởng, tìm tài liệu, hỗ trợ soạn bài và xử lý dữ liệu nghiên cứu.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Nghiên cứu (Project)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Tạo và quản lý các đề tài nghiên cứu. Mỗi project gắn với một bài viết riêng, dễ dàng tổ chức theo từng nghiên cứu.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Soạn bài viết</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Trong Trợ lý nghiên cứu, chọn project từ sidebar rồi soạn bài viết. Nội dung được lưu theo từng nghiên cứu và có thể xuất Word, PDF.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Trợ lý chuyên biệt</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Ngoài Trợ lý nghiên cứu, hệ thống có các trợ lý khác. Bấm biểu tượng trợ lý trên sidebar để chuyển đổi.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button size="lg" className="min-w-[200px]" onClick={handleStart}>
            Bắt đầu sử dụng
          </Button>
          <p className="text-sm text-muted-foreground">
            Bạn sẽ được chuyển đến Trợ lý nghiên cứu để bắt đầu trò chuyện và soạn bài.
          </p>
        </div>
      </div>
    </div>
  )
}
