"use client"

import "@/lib/crypto-polyfill"
import { useEffect } from "react"

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.height = "100%"
    body.style.height = "100%"
    body.style.margin = "0"
    return () => {
      html.style.height = ""
      body.style.height = ""
      body.style.margin = ""
    }
  }, [])

  return (
    <div className="fixed inset-0 w-full h-full bg-background flex flex-col min-h-0 overflow-hidden">
      {children}
    </div>
  )
}
