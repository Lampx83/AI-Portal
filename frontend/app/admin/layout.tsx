"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLanguage()
  const isAdminFromSession = (session?.user as { is_admin?: boolean } | undefined)?.is_admin === true
  const [adminCheckDone, setAdminCheckDone] = useState(false)
  const [isAdminFromApi, setIsAdminFromApi] = useState<boolean | null>(null)
  const isAdmin = isAdminFromSession || isAdminFromApi === true

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/admin")}`)
      return
    }
    if (isAdminFromSession) {
      setAdminCheckDone(true)
      return
    }
    if (!session?.user) return
    fetch("/api/auth/admin-check", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { is_admin: false }))
      .then((data) => {
        setAdminCheckDone(true)
        setIsAdminFromApi(!!data?.is_admin)
      })
      .catch(() => {
        setAdminCheckDone(true)
        setIsAdminFromApi(false)
      })
  }, [status, session?.user, isAdminFromSession])

  useEffect(() => {
    if (status === "loading" || !adminCheckDone) return
    if (status === "unauthenticated") return
    if (!isAdmin) {
      router.replace("/?error=unauthorized")
    }
  }, [status, adminCheckDone, isAdmin, router])

  if (status === "loading" || (!isAdmin && !adminCheckDone)) {
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
