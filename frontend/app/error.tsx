"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

/** Bắt lỗi client (vd. NextAuth "Connection closed" khi session fetch bị đóng kết nối) và hiển thị giao diện phục hồi. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()

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
            ? t("errorBoundary.connectionTitle")
            : t("errorBoundary.genericTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isConnectionClosed
            ? t("errorBoundary.connectionMessage")
            : t("errorBoundary.genericMessage")}
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <Button
            onClick={() => reset()}
            variant="default"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t("errorBoundary.retry")}
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="gap-2"
          >
            {t("errorBoundary.reload")}
          </Button>
        </div>
      </div>
    </div>
  )
}
