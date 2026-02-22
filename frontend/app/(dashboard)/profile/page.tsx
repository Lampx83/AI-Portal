"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { ProfileSettingsView } from "@/components/profile-settings-view"
import { useLanguage } from "@/contexts/language-context"

export default function ProfilePage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/profile")
    }
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t("profile.loading")}</p>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-6">
      <ProfileSettingsView />
    </div>
  )
}
