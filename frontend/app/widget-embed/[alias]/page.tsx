"use client"

import { useCallback, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { FloatingChatWidget } from "@/components/floating-chat-widget"

export default function WidgetEmbedPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const alias = (Array.isArray(params?.alias) ? params?.alias[0] : params?.alias) ?? "central"

  // Giao diện sáng/tối theo trang cha (chế độ nhúng truyền ?theme=)
  const theme = searchParams?.get("theme")
  useEffect(() => {
    if (theme !== "dark" && theme !== "light") return
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
  }, [theme])

  const onLayoutChange = useCallback((state: { open: boolean; expanded: boolean }) => {
    try {
      window.parent?.postMessage({ type: "portal-floating-widget", ...state }, "*")
    } catch {
      /* ignore */
    }
  }, [])

  return <FloatingChatWidget alias={alias} allowExpandToFullPage onLayoutChange={onLayoutChange} />
}
