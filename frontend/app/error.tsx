"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

/** Bắt lỗi client (vd. NextAuth "Connection closed" khi session fetch bị đóng kết nối) và hiển thị giao diện phục hồi. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Error boundary]", error?.message, error)
  }, [error])

  const isConnectionClosed =
    error?.message?.includes("Connection closed") ||
    error?.message?.toLowerCase().includes("connection closed") ||
    error?.message?.includes("CLIENT_FETCH_ERROR")

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {isConnectionClosed
            ? "Kết nối bị gián đoạn"
            : "Đã xảy ra lỗi"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isConnectionClosed
            ? "Phiên đăng nhập hoặc kết nối tới máy chủ bị ngắt. Vui lòng tải lại trang để thử lại."
            : "Một lỗi không mong muốn đã xảy ra. Bạn có thể thử tải lại trang."}
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <Button
            onClick={() => reset()}
            variant="default"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="gap-2"
          >
            Tải lại trang
          </Button>
        </div>
      </div>
    </div>
  )
}
