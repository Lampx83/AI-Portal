"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BookOpen, LogIn, Rocket, AlertCircle, UserRound, MessageCircleQuestion, ArrowRight } from "lucide-react"
import { useSession, signIn } from "next-auth/react"
import { useBranding } from "@/contexts/branding-context"
import { useLanguage } from "@/contexts/language-context"
import { getWelcomePageConfig, type WelcomePageConfig } from "@/lib/api/pages"
import { getIconComponent, type IconName } from "@/lib/assistants"
import { API_CONFIG } from "@/lib/config"
import { InAppBrowserNotice } from "@/components/in-app-browser-notice"

const WELCOME_DEFAULT_ICON_NAMES: IconName[] = ["MessageSquare", "FolderOpen", "FileText", "Sparkles"]

/** Câu hỏi mẫu mặc định khi chưa cấu hình app_settings.central_sample_prompts (giống trang Trợ lý chính). */
const DEFAULT_SAMPLE_PROMPT_KEYS = [
  "assistant.centralSample1",
  "assistant.centralSample2",
  "assistant.centralSample3",
  "assistant.centralSample4",
] as const
const WELCOME_SAMPLE_COUNT = 4

const primaryButtonClass =
  "justify-center w-full max-w-xs sm:max-w-none sm:min-w-[200px] bg-brand hover:bg-brand/90 text-white shadow-lg hover:shadow-xl transition-all duration-200"

/** Tách useSearchParams + Suspense để tránh hydration mismatch với shell SSR. */
function WelcomeQueryErrorAlert() {
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const errorCode = searchParams?.get("error") ?? null
  const errorMessage = errorCode
    ? errorCode === "unauthorized"
      ? t("login.error.unauthorized")
      : t("login.error.default")
    : null
  if (!errorMessage) return null
  return (
    <Alert variant="destructive" className="mb-6 text-left">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{t("common.error") || "Lỗi"}</AlertTitle>
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  )
}

export default function WelcomePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { branding, loaded: brandingLoaded } = useBranding()
  const { t, locale } = useLanguage()
  const [config, setConfig] = useState<WelcomePageConfig | null>(null)
  /** Chỉ sau mount client mới nhánh theo session — tránh SSR không cookie vs client có cookie. */
  const [authUiReady, setAuthUiReady] = useState(false)
  useEffect(() => {
    setAuthUiReady(true)
  }, [])

  /** Khách chưa đăng nhập: nếu quản trị bật tài khoản Khách thì cho dùng thử ngay từ trang chào. */
  const [guestEnabled, setGuestEnabled] = useState(false)
  useEffect(() => {
    const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
    fetch(base ? `${base}/api/setup/status` : "/api/setup/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { needsSetup?: boolean; guest_login_enabled?: boolean }) => {
        if (d.needsSetup === false && d.guest_login_enabled === true) setGuestEnabled(true)
      })
      .catch(() => {})
  }, [])
  const handleTryAsGuest = async () => {
    const basePath = (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "") || ""
    const target = `${basePath}/assistants/central`
    const result = await signIn("guest", { callbackUrl: target, redirect: false })
    if (result?.url) window.location.href = result.url
  }

  /** Câu hỏi mẫu cho Trợ lý chính (app_settings.central_sample_prompts) — chọn ngẫu nhiên sau khi dựng trang để tránh lệch SSR. */
  const [samplePrompts, setSamplePrompts] = useState<string[]>([])
  useEffect(() => {
    if (!brandingLoaded) return
    const source = branding.centralSamplePrompts?.length
      ? branding.centralSamplePrompts
      : DEFAULT_SAMPLE_PROMPT_KEYS.map((k) => t(k))
    const copy = source.map((x) => x.trim()).filter(Boolean)
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    setSamplePrompts(copy.slice(0, WELCOME_SAMPLE_COUNT))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandingLoaded, branding.centralSamplePrompts, locale])
  const [askingPrompt, setAskingPrompt] = useState<string | null>(null)
  /** Bấm câu hỏi mẫu: mở Trợ lý chính với câu hỏi điền sẵn (không tự gửi). Khách chưa đăng nhập → đăng nhập Khách nếu được bật. */
  const handleSamplePrompt = async (prompt: string) => {
    const path = `/assistants/central?q=${encodeURIComponent(prompt)}`
    if (session?.user) {
      router.push(path)
      return
    }
    if (guestEnabled) {
      setAskingPrompt(prompt)
      const basePath = (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "") || ""
      try {
        const result = await signIn("guest", { callbackUrl: `${basePath}${path}`, redirect: false })
        if (result?.url) {
          window.location.href = result.url
          return
        }
      } catch {
        /* rơi xuống trang đăng nhập */
      }
      setAskingPrompt(null)
    }
    router.push(`/login?callbackUrl=${encodeURIComponent(path)}`)
  }

  useEffect(() => {
    getWelcomePageConfig(String(locale))
      .then((c) => setConfig({ ...c, cards: c.cards ?? [] }))
      .catch(() => setConfig({ title: "", subtitle: "", cards: [] }))
  }, [locale])

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
  const showWelcomeStartButton = branding.hideWelcomeStartButton !== true
  const showLoginButton = branding.hideLoginButtonOnHeader !== true
  const hasConfiguredCards = configLoaded && (config!.cards?.length ?? 0) > 0
  const rawCards: { title: string; description: string; icon?: string; targetType?: "assistant" | "tool"; targetAlias?: string }[] = hasConfiguredCards
    ? (config!.cards ?? [])
    : configLoaded
      ? cardKeys.map((key) => ({ title: t(`${key}.title`), description: t(`${key}.description`), icon: undefined, targetType: undefined, targetAlias: undefined }))
      : []
  const cards = rawCards.map((c) => ({
    title: c && typeof c.title === "string" ? c.title : "",
    description: c && typeof c.description === "string" ? c.description : "",
    icon: c && typeof c.icon === "string" ? c.icon : undefined,
    targetType: c && (c.targetType === "assistant" || c.targetType === "tool") ? c.targetType : undefined,
    targetAlias: c && typeof c.targetAlias === "string" ? c.targetAlias.trim() : "",
  }))

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto overflow-x-hidden min-h-0 min-w-0 w-full">
      <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8 sm:px-8 text-center">
        <Suspense fallback={<div className="mb-6 min-h-[4.5rem]" aria-hidden />}>
          <WelcomeQueryErrorAlert />
        </Suspense>
        <InAppBrowserNotice className="mb-6 text-left" />
        <div className="mb-8 flex flex-col items-center">
          {!brandingLoaded ? (
            <div className="w-20 h-20 mb-4 flex-shrink-0" aria-hidden />
          ) : branding.logoDataUrl ? (
            <Image src={branding.logoDataUrl} alt="" width={80} height={80} className="mb-4 object-contain" unoptimized />
          ) : (
            <Image src="/NEU.svg" alt="Logo" width={80} height={80} className="mb-4" />
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
            const fallbackIcon = WELCOME_DEFAULT_ICON_NAMES[index % WELCOME_DEFAULT_ICON_NAMES.length]
            const iconName = (card.icon && card.icon.trim()) || fallbackIcon
            const Icon = getIconComponent(iconName)
            const targetPath =
              card.targetType === "assistant" && card.targetAlias
                ? `/assistants/${card.targetAlias}`
                : card.targetType === "tool" && card.targetAlias
                  ? `/tools/${card.targetAlias}`
                  : null
            return (
              <Card
                key={index}
                role={targetPath ? "button" : undefined}
                tabIndex={targetPath ? 0 : undefined}
                onClick={targetPath ? () => router.push(targetPath) : undefined}
                onKeyDown={
                  targetPath
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          router.push(targetPath)
                        }
                      }
                    : undefined
                }
                className={targetPath ? "cursor-pointer hover:border-primary/40 hover:shadow-sm transition" : undefined}
              >
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

        {authUiReady && samplePrompts.length > 0 && (session?.user || guestEnabled || showLoginButton) && (
          <section className="mb-8 text-left" aria-labelledby="welcome-sample-title" data-testid="welcome-sample-prompts">
            <h2 id="welcome-sample-title" className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
              <MessageCircleQuestion className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("welcome.sampleTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {samplePrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void handleSamplePrompt(p)}
                  disabled={askingPrompt !== null}
                  className="group flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm text-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1 leading-snug">{p}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {session?.user ? t("welcome.sampleHintLoggedIn") : guestEnabled ? t("welcome.sampleHintGuest") : t("welcome.sampleHintLogin")}
            </p>
          </section>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {!authUiReady ? (
              <div
                className="h-11 w-full max-w-xs sm:max-w-none sm:min-w-[200px] rounded-md bg-muted/50 animate-pulse"
                aria-hidden
              />
            ) : session?.user ? (
              showWelcomeStartButton ? (
                <Button size="lg" className={primaryButtonClass} onClick={handleStart}>
                  <Rocket className="h-4 w-4 mr-2" />
                  {t("welcome.startButton")}
                </Button>
              ) : null
            ) : showLoginButton ? (
              <Button size="lg" className={primaryButtonClass} onClick={handleLogin}>
                <LogIn className="h-4 w-4 mr-2" />
                {t("welcome.loginButton")}
              </Button>
            ) : (
              <p className="w-full max-w-xs sm:min-w-[200px] text-sm text-muted-foreground text-center px-2 py-2 mx-auto">
                {t("welcome.useSidebarToStart")}
              </p>
            )}
            {authUiReady && !session?.user && guestEnabled && (
              <Button size="lg" variant="outline" className="w-full max-w-xs sm:max-w-none sm:min-w-[200px]" onClick={handleTryAsGuest}>
                <UserRound className="h-4 w-4" />
                {t("welcome.tryAsGuest")}
              </Button>
            )}
            <Button size="lg" variant="outline" className="w-full max-w-xs sm:max-w-none sm:min-w-[200px]" asChild>
              <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/huong-dan.html`} target="_blank" rel="noopener noreferrer">
                <BookOpen className="h-4 w-4" />
                {t("welcome.guideButton")}
              </a>
            </Button>
          </div>
          {authUiReady && !session?.user && guestEnabled && (
            <p className="text-xs text-muted-foreground max-w-md">{t("welcome.tryAsGuestHint")}</p>
          )}
        </div>
      </div>
    </div>
  )
}