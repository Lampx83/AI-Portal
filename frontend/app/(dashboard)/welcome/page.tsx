"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, FileText, FolderOpen, Sparkles, BookOpen, LogIn, Rocket } from "lucide-react"
import { useSession } from "next-auth/react"

const primaryButtonClass =
  "justify-center min-w-[200px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"

export default function WelcomePage() {
  const router = useRouter()
  const { data: session } = useSession()

  const handleStart = () => {
    router.push("/assistants/main")
  }

  const handleLogin = () => {
    router.push("/login")
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto min-h-0">
      <div className="mx-auto max-w-3xl w-full p-8 text-center">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/neu-logo.svg" alt="Logo Đại học Kinh tế Quốc dân" width={80} height={80} className="mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Hệ thống AI hỗ trợ nghiên cứu khoa học
          </h1>
          <p className="text-muted-foreground text-base">
            Nền tảng trí tuệ nhân tạo phục vụ hoạt động nghiên cứu tại Đại học Kinh tế Quốc dân
          </p>
        </div>

        <div className="hidden md:grid gap-6 md:grid-cols-2 mb-10">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Trợ lý AI</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Trao đổi ý tưởng, tìm tài liệu, hỗ trợ soạn bài và xử lý dữ liệu với AI.
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
                Tạo và quản lý đề tài nghiên cứu, mỗi project gắn một bài viết riêng.
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
                Chọn project từ sidebar, soạn bài và xuất Word, PDF.
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
                Chọn trợ lý khác trên sidebar để chuyển đổi theo nhu cầu.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {session?.user ? (
              <Button size="lg" className={primaryButtonClass} onClick={handleStart}>
                <Rocket className="h-4 w-4 mr-2" />
                Bắt đầu sử dụng
              </Button>
            ) : (
              <Button size="lg" className={primaryButtonClass} onClick={handleLogin}>
                <LogIn className="h-4 w-4 mr-2" />
                Đăng nhập
              </Button>
            )}
            <Button size="lg" variant="outline" className="min-w-[200px]" asChild>
              <Link href="/guide" className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Hướng dẫn sử dụng
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {session?.user
              ? "Bạn sẽ được chuyển đến Trợ lý nghiên cứu để bắt đầu trò chuyện và soạn bài."
              : "Đăng nhập để tạo nghiên cứu, lưu bài viết và xem lịch sử chat."}
          </p>
        </div>
      </div>
    </div>
  )
}
