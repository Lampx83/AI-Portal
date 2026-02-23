"use client"

import { useParams, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useTools } from "@/hooks/use-tools"
import { useTheme } from "@/components/theme-provider"

/** Get basePath at runtime from pathname (e.g. /admission/apps/datium → /admission) when build does not set NEXT_PUBLIC_BASE_PATH. */
function getRuntimeBasePath(pathname: string): string {
  if (!pathname || typeof pathname !== "string") return ""
  const match = pathname.match(/^(.+)\/apps\/[^/]+$/)
  return match ? match[1].replace(/\/+$/, "") : ""
}

export default function AppPage() {
  const params = useParams()
  const pathname = usePathname()
  const aliasRaw = typeof params?.alias === "string" ? params.alias : (params?.alias as string[])?.[0] ?? ""
  const alias = aliasRaw.trim().toLowerCase()
  const { tools, loading } = useTools()
  const { theme } = useTheme()
  const [resolved, setResolved] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")
  const [runtimeBasePath, setRuntimeBasePath] = useState<string | null>(null)

  const tool = tools.find((t) => (t.alias ?? "").trim().toLowerCase() === alias)
  const envBasePath = (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "").replace(/\/+$/, "") || ""
  const basePath = envBasePath || (runtimeBasePath ?? "")
  const basePathKnown = !!envBasePath || runtimeBasePath !== null
  const embedPath = tool && basePathKnown ? (basePath ? `${basePath}/embed/${tool.alias}` : `/embed/${tool.alias}`) : null

  useEffect(() => {
    if (typeof window === "undefined") return
    const inferred = getRuntimeBasePath(window.location.pathname)
    setRuntimeBasePath(inferred)
  }, [pathname])

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
        Loading…
      </div>
    )
  }

  if (!alias) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Application name is missing.
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Application not found for alias: <b>{aliasRaw || alias}</b>
      </div>
    )
  }

  if (tool && !basePathKnown) {
    return (
      <div className="flex w-full min-h-[calc(100vh-8rem)] items-center justify-center text-muted-foreground">
        Loading…
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
      Application &quot;{tool?.name ?? alias}&quot; has no embed UI.
    </div>
  )
}
