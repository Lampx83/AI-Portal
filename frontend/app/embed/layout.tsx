"use client"

import "@/lib/crypto-polyfill"
import { useEffect } from "react"

// basePath cho embed: tránh khi vào /admission/embed/datium mà script request sai path → MIME type "text/html"
const BASE_PATH = (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "").replace(/\/+$/, "")

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
    // Giúp browser resolve đúng asset (/_next/...) khi trang ở /admission/embed/xxx
    if (BASE_PATH && typeof window !== "undefined") {
      const baseHref = `${window.location.origin}${BASE_PATH}/`
      let baseEl = document.querySelector("base")
      if (!baseEl) {
        baseEl = document.createElement("base")
        baseEl.setAttribute("href", baseHref)
        document.head.prepend(baseEl)
      } else {
        baseEl.setAttribute("href", baseHref)
      }
      return () => {
        html.style.height = ""
        body.style.height = ""
        body.style.margin = ""
        if (baseEl?.getAttribute("href") === baseHref) baseEl.remove()
      }
    }
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
