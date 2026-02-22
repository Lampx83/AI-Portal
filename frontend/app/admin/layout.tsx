"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLanguage()
  const [adminCheckDone, setAdminCheckDone] = useState(false)
  const [isAdminFromApi, setIsAdminFromApi] = useState<boolean | null>(null)
  const sessionRefetchDone = useRef(false)
  // Only treat as admin when API admin-check returns is_admin: true (do not trust session so SSO/normal user cannot access admin)
  const isAdmin = adminCheckDone && isAdminFromApi === true

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/admin")}`)
      return
    }
    if (!session?.user) return
    fetch("/api/auth/admin-check", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { is_admin: false }))
      .then(async (data) => {
        setAdminCheckDone(true)
        const apiSaysAdmin = !!data?.is_admin
        setIsAdminFromApi(apiSaysAdmin)
        if (apiSaysAdmin && !sessionRefetchDone.current && updateSession) {
          sessionRefetchDone.current = true
          await updateSession()
        }
      })
      .catch(() => {
        setAdminCheckDone(true)
        setIsAdminFromApi(false)
      })
  }, [status, session?.user, updateSession])

  useEffect(() => {
    if (status === "loading" || !adminCheckDone) return
    if (status === "unauthenticated") return
    if (!isAdmin) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/admin")}&error=unauthorized`)
    }
  }, [status, adminCheckDone, isAdmin, router, pathname])

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
