"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useBranding } from "@/contexts/branding-context"
import { API_CONFIG } from "@/lib/config"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { t, siteStrings } = useLanguage()
  const { branding, loaded: brandingLoaded } = useBranding()
  const [adminCheckDone, setAdminCheckDone] = useState(false)
  const [isAdminFromApi, setIsAdminFromApi] = useState<boolean | null>(null)
  const sessionRefetchDone = useRef(false)
  // Only treat as admin when API admin-check returns is_admin: true (do not trust session so SSO/normal user cannot access admin)
  const isAdmin = adminCheckDone && isAdminFromApi === true

  const basePath = (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "") || ""
  const p = pathname || "/admin"
  const callbackPath = basePath + (p.startsWith("/") ? p : "/" + p)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      // URL tuyệt đối để tránh basePath bị thêm lần nữa → /tuyen-sinh/tuyen-sinh/login
      if (basePath && typeof window !== "undefined") {
        window.location.href = `${window.location.origin}${basePath}/login?callbackUrl=${encodeURIComponent(callbackPath)}`
        return
      }
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
      return
    }
    if (!session?.user) return
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    const run = async (retry = 0) => {
      try {
        const apiBase = API_CONFIG.baseUrl || ""
        const res = await fetch(apiBase ? `${apiBase}/api/auth/admin-check` : "/api/auth/admin-check", {
          credentials: "include",
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const data = res.ok ? await res.json() : { is_admin: false }
        if (cancelled) return
        const apiSaysAdmin = !!data?.is_admin
        if (apiSaysAdmin) {
          setAdminCheckDone(true)
          setIsAdminFromApi(true)
          if (!sessionRefetchDone.current && updateSession) {
            sessionRefetchDone.current = true
            await updateSession()
          }
          return
        }
        if (retry < 1) {
          await new Promise((r) => setTimeout(r, 1500))
          if (cancelled) return
          return run(retry + 1)
        }
        setAdminCheckDone(true)
        setIsAdminFromApi(false)
      } catch {
        clearTimeout(timeoutId)
        if (!cancelled) {
          setAdminCheckDone(true)
          setIsAdminFromApi(false)
        }
      }
    }
    run()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [status, session?.user, updateSession])

  useEffect(() => {
    if (status === "loading" || !adminCheckDone) return
    if (status === "unauthenticated") return
    if (!isAdmin) {
      if (basePath && typeof window !== "undefined") {
        window.location.href = `${window.location.origin}${basePath}/login?callbackUrl=${encodeURIComponent(callbackPath)}&error=unauthorized`
        return
      }
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackPath)}&error=unauthorized`)
    }
  }, [status, adminCheckDone, isAdmin, router, callbackPath, basePath])

  // Title tab trình duyệt: "Quản trị - Tên hệ thống" / "Admin - System name" ...
  useEffect(() => {
    if (!isAdmin) return
    const systemName =
      brandingLoaded && branding.systemName?.trim()
        ? branding.systemName.trim()
        : (siteStrings["app.title"] ?? "AI Portal")
    const prefix = t("nav.adminTabPrefix")
    document.title = prefix + " - " + systemName
  }, [isAdmin, brandingLoaded, branding.systemName, siteStrings, t])

  if (status === "loading" || !adminCheckDone) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <p className="text-muted-foreground">{t("admin.layout.checkingAccess")}</p>
      </div>
    )
  }

  if (!session || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <main className="w-full p-4 sm:p-6">{children}</main>
    </div>
  )
}
