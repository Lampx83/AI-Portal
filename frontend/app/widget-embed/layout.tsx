"use client"

import "@/lib/crypto-polyfill"
import { useEffect } from "react"

/**
 * Nút chat nổi (FloatingChatWidget) chạy trong một iframe trong suốt do trang /embed/<công cụ> chèn vào
 * khi mở trực tiếp (không qua AI Portal), để chế độ nhúng cũng có trợ lý giống khi chạy trong Portal.
 */
export default function WidgetEmbedLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = { h: html.style.height, bh: body.style.height, bg: body.style.background, hbg: html.style.background, m: body.style.margin }
    html.style.height = "100%"
    html.style.background = "transparent"
    body.style.height = "100%"
    body.style.margin = "0"
    body.style.background = "transparent"
    return () => {
      html.style.height = prev.h
      html.style.background = prev.hbg
      body.style.height = prev.bh
      body.style.margin = prev.m
      body.style.background = prev.bg
    }
  }, [])
  return <div className="fixed inset-0 overflow-hidden pointer-events-none [&>*]:pointer-events-auto">{children}</div>
}
