"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useTools } from "@/hooks/use-tools"
import { useTheme } from "@/components/theme-provider"

export default function AppPage() {
  const params = useParams()
  const aliasRaw = typeof params?.alias === "string" ? params.alias : (params?.alias as string[])?.[0] ?? ""
  const alias = aliasRaw.trim().toLowerCase()
  const { tools, loading } = useTools()
  const { theme } = useTheme()
  const [resolved, setResolved] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  const tool = tools.find((t) => (t.alias ?? "").trim().toLowerCase() === alias)
  const basePath = (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "").replace(/\/+$/, "") || ""
  const embedPath = tool ? (basePath ? `${basePath}/embed/${tool.alias}` : `/embed/${tool.alias}`) : null

  useEffect(() => {
    if (loading) return
    setResolved(true)
  }, [loading])

  // Resolved theme (light/dark) to pass to embedded app so it follows Portal theme
  useEffect(() => {
    if (typeof window === "undefined") return
    const root = document.documentElement
    const apply = () => setResolvedTheme(root.classList.contains("dark") ? "dark" : "light")
    apply()
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      mq.addEventListener("change", apply)
      return () => mq.removeEventListener("change", apply)
    }
  }, [theme])

  if (!resolved || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground text-sm">
        Đang tải…
      </div>
    )
  }

  if (!alias) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Thiếu tên ứng dụng.
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Không tìm thấy ứng dụng với alias: <b>{aliasRaw || alias}</b>
      </div>
    )
  }

  const embedSrc = embedPath ? `${embedPath}?theme=${resolvedTheme}` : ""
  if (embedSrc) {
    return (
      <iframe
        src={embedSrc}
        className="w-full h-full min-h-[calc(100vh-8rem)] border-0"
        title={tool.name ?? alias}
      />
    )
  }

  return (
    <div className="p-6 text-sm text-muted-foreground">
      Ứng dụng &quot;{tool.name ?? alias}&quot; chưa có giao diện nhúng.
    </div>
  )
}
