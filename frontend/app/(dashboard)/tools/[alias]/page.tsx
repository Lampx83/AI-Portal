"use client"

import { useParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useTools } from "@/hooks/use-tools"
import { useTheme } from "@/components/theme-provider"
import { useLanguage } from "@/contexts/language-context"
import { API_CONFIG } from "@/lib/config"
import { FloatingChatWidget } from "@/components/floating-chat-widget"

/** Get basePath at runtime from pathname (e.g. /base-path/tools/datium → /base-path) when build does not set NEXT_PUBLIC_BASE_PATH. */
function getRuntimeBasePath(pathname: string): string {
  if (!pathname || typeof pathname !== "string") return ""
  const match = pathname.match(/^(.+)\/tools\/[^/]+$/)
  return match ? match[1].replace(/\/+$/, "") : ""
}

/** Loading block: spinner + text, luôn hiển thị giữa main để người dùng thấy đang tải. */
function ToolLoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-10 w-10 animate-spin text-slate-500 dark:text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">{label}</span>
        </div>
      </div>
    </div>
  )
}

export default function ToolPage() {
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
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const recordedOpenRef = useRef(false)
  const iframeLoadTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const iframeShownAtRef = useRef<number>(0)
  const { data: session } = useSession()

  const MIN_LOADING_MS = 400

  const tool = tools.find((t) => (t.alias ?? "").trim().toLowerCase() === alias)

  // Reset iframe loaded state and timer when switching to another tool
  useEffect(() => {
    setIframeLoaded(false)
    iframeShownAtRef.current = 0
  }, [alias])

  // Ghi nhận một lần mở app cho thống kê (Admin Overview)
  useEffect(() => {
    if (!tool?.alias || recordedOpenRef.current) return
    recordedOpenRef.current = true
    const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
    const url = `${base}/api/tools/${encodeURIComponent(tool.alias)}/opened`
    fetch(url, { method: "POST", credentials: "include" }).catch(() => {})
  }, [tool?.alias])

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

  const { locale: portalLocale, t } = useLanguage()
  const effectiveLocale = portalLocale || "en"
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

  /** Gửi user Portal vào iframe (Surveylab, v.v.) khi embed không nhận được cookie → tránh hiển thị "Tài khoản khách". */
  const sendPortalUserToIframe = useCallback(() => {
    if (!session?.user || !iframeRef.current?.contentWindow) return
    const u = session.user as { id?: string; email?: string | null; name?: string | null }
    if (!u?.id) return
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "PORTAL_USER",
          user: {
            id: u.id,
            email: u.email ?? "",
            name: u.name ?? u.email ?? "",
          },
        },
        "*"
      )
    } catch {
      /* ignore */
    }
  }, [session?.user])

  useEffect(() => {
    sendThemeToIframe()
  }, [sendThemeToIframe])

  useEffect(() => {
    sendPortalUserToIframe()
  }, [sendPortalUserToIframe])

  useEffect(() => {
    return () => {
      iframeLoadTimeoutsRef.current.forEach(clearTimeout)
      iframeLoadTimeoutsRef.current = []
    }
  }, [])

  // Ứng dụng nhúng (vd Surveylab) có thể gửi SURVEYLAB_NEED_PORTAL_USER để xin user — trả lời ngay
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== "SURVEYLAB_NEED_PORTAL_USER") return
      sendPortalUserToIframe()
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [sendPortalUserToIframe])

  if (!resolved || loading) {
    return <ToolLoadingBlock label={t("common.loading")} />
  }

  if (!alias) {
    return (
      <div className="flex h-full min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex-1 min-w-0 overflow-auto p-6 text-sm text-muted-foreground">
          Application name is missing.
        </div>
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="flex h-full min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex-1 min-w-0 overflow-auto p-6 text-sm text-muted-foreground">
          Application not found for alias: <b>{aliasRaw || alias}</b>
        </div>
      </div>
    )
  }

  if (tool && !basePathKnown) {
    return <ToolLoadingBlock label={t("common.loading")} />
  }

  // Wait for resolved theme so iframe gets correct theme (avoids F5 always showing light)
  if (embedPath && resolvedTheme === null) {
    return <ToolLoadingBlock label={t("common.loading")} />
  }

  const embedSrc = embedPath && resolvedTheme ? `${embedPath}?theme=${resolvedTheme}&locale=${encodeURIComponent(effectiveLocale)}` : ""
  const toolConfig = (tool?.config_json ?? {}) as { floatingAssistantEnabled?: boolean; floatingAssistantAlias?: string }
  const floatingAssistantEnabled = toolConfig.floatingAssistantEnabled === true
  const floatingAssistantAlias =
    typeof toolConfig.floatingAssistantAlias === "string" ? toolConfig.floatingAssistantAlias.trim() : ""

  if (embedPath && resolvedTheme && embedSrc) {
    const handleIframeLoad = () => {
      sendThemeToIframe()
      sendPortalUserToIframe()
      iframeLoadTimeoutsRef.current.forEach(clearTimeout)
      iframeLoadTimeoutsRef.current = []
      const t1 = setTimeout(sendPortalUserToIframe, 200)
      const t2 = setTimeout(sendPortalUserToIframe, 800)
      iframeLoadTimeoutsRef.current = [t1, t2]
      const elapsed = Date.now() - iframeShownAtRef.current
      const remain = Math.max(0, MIN_LOADING_MS - elapsed)
      if (remain > 0) {
        setTimeout(() => setIframeLoaded(true), remain)
      } else {
        setIframeLoaded(true)
      }
    }
    return (
      <div className="flex h-full min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div
          className="flex-1 min-h-0 flex flex-col w-full overflow-hidden relative"
          ref={(el) => {
            if (el && !iframeShownAtRef.current) iframeShownAtRef.current = Date.now()
          }}
        >
          <iframe
            ref={iframeRef}
            src={embedSrc}
            className="w-full flex-1 min-h-0 border-0"
            title={tool.name ?? alias}
            onLoad={handleIframeLoad}
          />
          {!iframeLoaded && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-slate-50/95 dark:bg-gray-950/95 z-10"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <svg
                  className="h-10 w-10 animate-spin text-slate-500 dark:text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium">{t("common.loading")}</span>
              </div>
            </div>
          )}
        </div>
        {floatingAssistantEnabled && floatingAssistantAlias && (
          <FloatingChatWidget alias={floatingAssistantAlias} allowExpandToFullPage />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="flex-1 min-w-0 overflow-auto p-6 text-sm text-muted-foreground">
        Application &quot;{tool?.name ?? alias}&quot; has no embed UI.
      </div>
    </div>
  )
}
