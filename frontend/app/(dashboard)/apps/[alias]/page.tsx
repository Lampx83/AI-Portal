"use client"

import { useParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTools } from "@/hooks/use-tools"
import { useTheme } from "@/components/theme-provider"
import { useLanguage } from "@/contexts/language-context"

/** Get basePath at runtime from pathname (e.g. /tuyen-sinh/apps/datium → /tuyen-sinh) when build does not set NEXT_PUBLIC_BASE_PATH. */
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
  /** Resolved theme for iframe: only set after first client run so iframe gets correct theme (avoids F5 always showing light). */
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | null>(null)
  const [runtimeBasePath, setRuntimeBasePath] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const THEME_STORAGE_KEY = "neu-ui-theme"
  function resolveTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light"
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored === "dark" || stored === "light") return stored
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  const tool = tools.find((t) => (t.alias ?? "").trim().toLowerCase() === alias)
  const { locale: portalLocale } = useLanguage()
  const toolLocale = (tool?.config_json as { locale?: string } | undefined)?.locale?.trim()
  const effectiveLocale = toolLocale || portalLocale || "en"
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

  // Resolved theme: run once on mount so iframe gets correct theme before first paint (avoids F5 → light)
  useEffect(() => {
    setResolvedTheme(resolveTheme())
  }, [])
  // Keep in sync when Portal theme or system preference changes
  useEffect(() => {
    if (resolvedTheme === null) return
    const root = document.documentElement
    const apply = () => setResolvedTheme(resolveTheme())
    apply()
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      mq.addEventListener("change", apply)
      return () => mq.removeEventListener("change", apply)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) apply()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [theme, resolvedTheme])

  const sendThemeToIframe = useCallback(() => {
    if (!resolvedTheme || !iframeRef.current?.contentWindow) return
    try {
      iframeRef.current.contentWindow.postMessage(
        { type: "portal-theme", theme: resolvedTheme },
        "*"
      )
    } catch {
      /* ignore */
    }
  }, [resolvedTheme])
  useEffect(() => {
    sendThemeToIframe()
  }, [sendThemeToIframe])

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

  // Wait for resolved theme so iframe gets correct theme (avoids F5 always showing light)
  if (embedPath && resolvedTheme === null) {
    return (
      <div className="flex w-full min-h-[calc(100vh-8rem)] items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  const embedSrc = embedPath && resolvedTheme ? `${embedPath}?theme=${resolvedTheme}&locale=${encodeURIComponent(effectiveLocale)}` : ""

  if (embedPath && resolvedTheme && embedSrc) {
    return (
      <iframe
        ref={iframeRef}
        src={embedSrc}
        className="w-full h-full min-h-[calc(100vh-8rem)] border-0"
        title={tool.name ?? alias}
        onLoad={sendThemeToIframe}
      />
    )
  }

  return (
    <div className="p-6 text-sm text-muted-foreground">
      Application &quot;{tool?.name ?? alias}&quot; has no embed UI.
    </div>
  )
}
