"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const isAdmin = (session?.user as { is_admin?: boolean } | undefined)?.is_admin === true

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/admin")}`)
      return
    }
    if (!isAdmin) {
      router.replace("/?error=unauthorized")
    }
  }, [status, isAdmin, router, pathname])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <p className="text-muted-foreground">Đang kiểm tra quyền truy cập...</p>
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
