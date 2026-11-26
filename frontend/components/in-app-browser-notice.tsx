"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ExternalLink } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

/** Trình duyệt tích hợp của ứng dụng (Facebook, Messenger, Instagram, Threads, Zalo, Line, TikTok). */
const IN_APP_UA = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Barcelona|Threads|Zalo|\bLine\/|TikTok|musical_ly|MicroMessenger/i

/**
 * Đăng nhập Microsoft thường hỏng khi mở trang trong trình duyệt tích hợp của ứng dụng
 * (cookie phiên đăng nhập bị mất khi chuyển sang trang Microsoft: «State cookie was missing»).
 * Hiện nhắc người dùng mở bằng Chrome/Safari. Chỉ hiện khi nhận diện được trình duyệt tích hợp.
 */
export function InAppBrowserNotice({ className }: { className?: string }) {
  const { t } = useLanguage()
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      setShow(IN_APP_UA.test(navigator.userAgent || ""))
    } catch {
      setShow(false)
    }
  }, [])
  if (!show) return null
  return (
    <Alert className={className}>
      <ExternalLink className="h-4 w-4" />
      <AlertTitle>{t("inAppBrowser.title")}</AlertTitle>
      <AlertDescription>{t("inAppBrowser.body")}</AlertDescription>
    </Alert>
  )
}
