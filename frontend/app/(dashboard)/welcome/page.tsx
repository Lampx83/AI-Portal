"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { MessageSquare, FileText, FolderOpen, Sparkles, BookOpen, LogIn, Rocket, AlertCircle } from "lucide-react"
import { useSession } from "next-auth/react"
import { useBranding } from "@/contexts/branding-context"
import { useLanguage } from "@/contexts/language-context"
import { getWelcomePageConfig, type WelcomePageConfig } from "@/lib/api/pages"

const WELCOME_CARD_ICONS = [MessageSquare, FolderOpen, FileText, Sparkles] as const

const primaryButtonClass =
  "justify-center min-w-[200px] bg-brand hover:bg-brand/90 text-white shadow-lg hover:shadow-xl transition-all duration-200"

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Bạn không có quyền truy cập trang quản trị. Chỉ admin/developer mới vào được.",
  default: "Đã xảy ra lỗi. Vui lòng thử lại hoặc liên hệ quản trị viên.",
}

export default function WelcomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { branding, loaded: brandingLoaded } = useBranding()
  const { t } = useLanguage()
  const [config, setConfig] = useState<WelcomePageConfig | null>(null)
  const errorCode = searchParams?.get("error") ?? null
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.default) : null

  useEffect(() => {
    getWelcomePageConfig()
      .then((c) => setConfig({ ...c, cards: c.cards ?? [] }))
      .catch(() => setConfig({ title: "", subtitle: "", cards: [] }))
  }, [])

  const cardKeys = [
    "welcome.card1",
    "welcome.card2",
    "welcome.card3",
    "welcome.card4",
  ] as const

  const handleStart = () => {
    router.push("/assistants/central")
  }

  const handleLogin = () => {
    router.push("/login")
  }

  const configLoaded = config !== null
  const title = configLoaded && config!.title != null && config!.title !== "" ? config!.title : (brandingLoaded ? branding.systemName || "AI Portal" : "\u00A0")
  const subtitle = configLoaded && config!.subtitle != null && config!.subtitle !== "" ? config!.subtitle : (brandingLoaded && branding.systemSubtitle ? branding.systemSubtitle : t("welcome.subtitle"))
  const hasConfiguredCards = configLoaded && (config!.cards?.length ?? 0) > 0
  const rawCards: { title: string; description: string }[] = hasConfiguredCards
    ? (config!.cards ?? [])
    : configLoaded
      ? cardKeys.map((key) => ({ title: t(`${key}.title`), description: t(`${key}.description`) }))
      : []
  const cards = rawCards.map((c) => ({
    title: c && typeof c.title === "string" ? c.title : "",
    description: c && typeof c.description === "string" ? c.description : "",
  }))

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto min-h-0">
      <div className="mx-auto max-w-3xl w-full p-8 text-center">
        {errorMessage && (
          <Alert variant="destructive" className="mb-6 text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("common.error") || "Lỗi"}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        <div className="mb-8 flex flex-col items-center">
          {!brandingLoaded ? (
            <div className="w-20 h-20 mb-4 flex-shrink-0" aria-hidden />
          ) : branding.logoDataUrl ? (
            <Image src={branding.logoDataUrl} alt="" width={80} height={80} className="mb-4 object-contain" unoptimized />
          ) : (
            <Image src="/neu-logo.svg" alt="Logo" width={80} height={80} className="mb-4" />
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 min-h-[2.25rem] flex items-center justify-center">
            {title}
          </h1>
          <p className="text-muted-foreground text-base">
            {subtitle}
          </p>
        </div>

        {configLoaded && (
        <div className="hidden md:grid gap-6 md:grid-cols-2 mb-10">
          {cards.map((card, index) => {
            const Icon = WELCOME_CARD_ICONS[index % WELCOME_CARD_ICONS.length]
            return (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{card.title || "\u00A0"}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{card.description || "\u00A0"}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {session?.user ? (
              <Button size="lg" className={primaryButtonClass} onClick={handleStart}>
                <Rocket className="h-4 w-4 mr-2" />
                {t("welcome.startButton")}
              </Button>
            ) : (
              <Button size="lg" className={primaryButtonClass} onClick={handleLogin}>
                <LogIn className="h-4 w-4 mr-2" />
                {t("welcome.loginButton")}
              </Button>
            )}
            <Button size="lg" variant="outline" className="min-w-[200px]" asChild>
              <Link href="/guide" className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {t("welcome.guideButton")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}