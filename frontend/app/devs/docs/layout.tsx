"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_CONFIG } from "@/lib/config"

export default function DevsDocsLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null)

  const isAdminFromSession = (session?.user as { is_admin?: boolean } | undefined)?.is_admin === true

  useEffect(() => {
    if (status === "loading" || !session?.user) return
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/devs/docs")}`)
      return
    }
    if (isAdminFromSession) {
      setIsAllowed(true)
      return
    }
    const apiBase = API_CONFIG.baseUrl || ""
    fetch(apiBase ? `${apiBase}/api/auth/admin-check` : "/api/auth/admin-check", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setIsAllowed(!!data?.is_admin))
      .catch(() => setIsAllowed(false))
  }, [status, session, isAdminFromSession, router, pathname])

  useEffect(() => {
    if (isAllowed === false) {
      router.replace("/?error=unauthorized")
    }
  }, [isAllowed, router])

  if (status === "loading" || isAllowed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Đang kiểm tra quyền truy cập...</p>
      </div>
    )
  }

  if (!isAllowed) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Về trang chủ
          </Link>
        </Button>
      </div>
      <main>{children}</main>
    </div>
  )
}
