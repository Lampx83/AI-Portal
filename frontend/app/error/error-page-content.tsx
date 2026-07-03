"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function ErrorPageContent({ reason }: { reason?: string | null }) {
  // reason không dùng nữa: mọi lỗi kết nối đều hiển thị chung một thông báo "quá tải".
  void reason

  // Nút tải lại đưa người dùng về trang gốc của hệ thống (vd. /tuyen-sinh).
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  const goHome = () => {
    window.location.href = basePath ? `${basePath}/` : "/"
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900">
        <CardContent className="flex flex-col items-center gap-5 py-8 text-center">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-4">
            <p className="text-lg font-semibold text-amber-800 dark:text-amber-300 leading-relaxed">
              Hệ thống đang quá tải, vui lòng quay trở lại sau
            </p>
          </div>

          <Button onClick={goHome} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tải lại
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
