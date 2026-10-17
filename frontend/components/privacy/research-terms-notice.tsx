"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { useStableSession } from "@/lib/use-stable-session"
import { GUEST_USER_ID } from "@/lib/chat"
import { useLanguage } from "@/contexts/language-context"
import { RESEARCH_NOTICE_STORAGE_KEY, RESEARCH_SECTION_PATH } from "@/lib/research-terms"

function hasSeenNotice(): boolean {
  try {
    return localStorage.getItem(RESEARCH_NOTICE_STORAGE_KEY) !== null
  } catch {
    // Không đọc được localStorage: không làm phiền người dùng.
    return true
  }
}

function markNoticeSeen() {
  try {
    localStorage.setItem(RESEARCH_NOTICE_STORAGE_KEY, new Date().toISOString())
  } catch {
    /* ignore */
  }
}

/**
 * Thông báo nhỏ, hiện một lần cho người dùng đã đăng nhập (không phải khách):
 * đã bổ sung mục "Sử dụng dữ liệu cho mục đích nghiên cứu..." vào Chính sách quyền riêng tư.
 * Chỉ lưu cờ trong localStorage, không ghi gì lên máy chủ.
 */
export function ResearchTermsNotice() {
  const { data: session, status } = useStableSession()
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const signedIn = status === "authenticated" && !!userId && userId !== GUEST_USER_ID

  useEffect(() => {
    setVisible(signedIn && !hasSeenNotice())
  }, [signedIn])

  if (!visible) return null

  const close = () => {
    markNoticeSeen()
    setVisible(false)
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
    >
      <p className="flex-1 leading-relaxed">
        {t("privacy.notice.before")}{" "}
        <em className="font-medium text-gray-900 dark:text-white">{t("privacy.research.heading")}</em>{" "}
        {t("privacy.notice.after")}{" "}
        <Link href={RESEARCH_SECTION_PATH} onClick={close} className="font-medium text-brand underline-offset-2 hover:underline">
          {t("privacy.notice.viewDetails")}
        </Link>
      </p>
      <button
        type="button"
        onClick={close}
        aria-label={t("privacy.notice.dismiss")}
        className="-mr-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
