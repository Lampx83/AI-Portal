"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, FileText, FolderOpen, Sparkles, BookOpen, LogIn, Rocket } from "lucide-react"
import { useSession } from "next-auth/react"
import { useBranding } from "@/contexts/branding-context"
import { useLanguage } from "@/contexts/language-context"

const primaryButtonClass =
  "justify-center min-w-[200px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"

export default function WelcomePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { branding, loaded: brandingLoaded } = useBranding()
  const { t } = useLanguage()

  const handleStart = () => {
    router.push("/assistants/central")
  }

  const handleLogin = () => {
    router.push("/login")
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto min-h-0">
      <div className="mx-auto max-w-3xl w-full p-8 text-center">
        <div className="mb-8 flex flex-col items-center">
          {!brandingLoaded ? (
            <div className="w-20 h-20 mb-4 flex-shrink-0" aria-hidden />
          ) : branding.logoDataUrl ? (
            <Image src={branding.logoDataUrl} alt="" width={80} height={80} className="mb-4 object-contain" unoptimized />
          ) : (
            <Image src="/neu-logo.svg" alt="Logo" width={80} height={80} className="mb-4" />
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 min-h-[2.25rem] flex items-center justify-center">
            {brandingLoaded ? (branding.systemName || "AI Portal") : "\u00A0"}
          </h1>
          <p className="text-muted-foreground text-base">
            {t("welcome.subtitle")}
          </p>
        </div>

        <div className="hidden md:grid gap-6 md:grid-cols-2 mb-10">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("welcome.card1.title")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t("welcome.card1.description")}
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("welcome.card2.title")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t("welcome.card2.description")}
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("welcome.card3.title")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t("welcome.card3.description")}
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("welcome.card4.title")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t("welcome.card4.description")}
              </CardDescription>
            </CardContent>
          </Card>
        </div>

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
          <p className="text-sm text-muted-foreground">
            {session?.user ? t("welcome.hintLoggedIn") : t("welcome.hintLoggedOut")}
          </p>
        </div>
      </div>
    </div>
  )
}
