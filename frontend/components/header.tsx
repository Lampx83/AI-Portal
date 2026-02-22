"use client"

import Image from "next/image"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { User, BookCopy, Bell, Settings, HelpCircle, LogOut, Shield, MessageSquare, FileText, LogIn, MessageSquarePlus, Info } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ProfileSettingsView } from "@/components/profile-settings-view"
import { PublicationsView } from "@/components/publications/publications-view"
import { NotificationsView } from "@/components/notifications-view"
import { SystemSettingsView } from "@/components/system-settings-view"
import { HelpGuideView } from "@/components/help-guide-view"
import { FeedbackDialog } from "@/components/feedback-dialog"
import { AboutDialog } from "@/components/about-dialog"
import { API_CONFIG } from "@/lib/config"
import { getDailyUsage } from "@/lib/chat"

/** Tạm thời ẩn "Công bố của tôi" trong menu người dùng. Đổi thành false để hiện lại. */
const SHOW_PUBLICATIONS_MENU = false
import { useActiveProject } from "@/contexts/active-project-context"
import { useLanguage } from "@/contexts/language-context"
import { useBranding } from "@/contexts/branding-context"
import { usePathname } from "next/navigation"

export function Header() {
    const router = useRouter()
    const { data: session } = useSession()
    const { activeProject, setActiveProject } = useActiveProject()
    const { t } = useLanguage()
    const { branding, loaded: brandingLoaded } = useBranding()
    const appShortName = t("app.shortName")
    const nameFromBranding = branding.systemName?.trim()
    const displayName = nameFromBranding || (appShortName && appShortName !== "app.shortName" ? appShortName : "AI Portal")
    const [isAdminFromApi, setIsAdminFromApi] = useState<boolean | null>(null)

    // Dialog state
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
    const [isPublicationsDialogOpen, setIsPublicationsDialogOpen] = useState(false)
    const [isNotificationsDialogOpen, setIsNotificationsDialogOpen] = useState(false)
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
    const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
    const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false)
    const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false)
    const pathname = usePathname()
    const currentAssistantAlias = pathname?.match(/^\/assistants\/([^/?]+)/)?.[1] ?? null

    // Admin: only show Admin link when API admin-check returns is_admin: true
    useEffect(() => {
        if (!session?.user) {
            setIsAdminFromApi(null)
            return
        }
        // Call same origin (proxy to backend in dev) to send session cookie; với basePath gọi đúng /admission/api/auth/admin-check
        const apiBase = API_CONFIG.baseUrl || ""
        fetch(apiBase ? `${apiBase}/api/auth/admin-check` : "/api/auth/admin-check", { credentials: "include" })
            .then((res) => res.json())
            .then((data) => setIsAdminFromApi(!!data?.is_admin))
            .catch(() => setIsAdminFromApi(false))
    }, [session?.user])
    // Only show Admin/Dev link when API confirms (avoid normal users seeing link)
    const canShowAdminLink = isAdminFromApi === true

    const [quota, setQuota] = useState<{ limit: number; used: number; remaining: number } | null>(null)
    const refreshQuota = useCallback(() => {
        const email = session?.user?.email
        if (!email) {
            setQuota(null)
            return
        }
        getDailyUsage(email)
            .then((d) => setQuota({ limit: d.limit, used: d.used, remaining: d.remaining }))
            .catch(() => setQuota(null))
    }, [session?.user?.email])
    useEffect(() => {
        refreshQuota()
    }, [refreshQuota])
    useEffect(() => {
        const handler = () => refreshQuota()
        window.addEventListener("refresh-quota", handler)
        return () => window.removeEventListener("refresh-quota", handler)
    }, [refreshQuota])

  const goHome = () => {
    if (activeProject != null) setActiveProject(null)
    router.push("/welcome")
  }
    return (
        <header className="bg-brand text-white shadow-md z-10">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-4 cursor-pointer hover:opacity-90 transition-opacity" onClick={goHome} title={t("nav.home")}>
                        {!brandingLoaded ? (
                          <div className="w-10 h-10 flex-shrink-0" aria-hidden />
                        ) : branding.logoDataUrl ? (
                          <Image src={branding.logoDataUrl} alt="" width={40} height={40} className="object-contain" unoptimized />
                        ) : (
                          <Image src="/neu-logo.svg" alt="Logo" width={40} height={40} />
                        )}
                        <div className="flex flex-col leading-tight min-w-0">
                            <h1 className="text-xl font-bold tracking-tight">{brandingLoaded ? displayName : "\u00A0"}</h1>
                            {brandingLoaded && branding.systemSubtitle ? (
                                <p className="hidden sm:block text-xs text-yellow-200">{branding.systemSubtitle}</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {session?.user && quota != null && (
                            <div
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 text-xs"
                                title={t("header.quotaTitle").replace("{used}", String(quota.used)).replace("{limit}", String(quota.limit)).replace("{remaining}", String(quota.remaining))}
                            >
                                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>{quota.used}/{quota.limit}</span>
                            </div>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full hover:bg-white/10"
                            onClick={() => setIsAboutDialogOpen(true)}
                            title={t("header.about")}
                            aria-label={t("header.about")}
                        >
                            <Info className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full hover:bg-white/10"
                            onClick={() => setIsHelpDialogOpen(true)}
                            title={t("header.help")}
                            aria-label={t("header.help")}
                        >
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                        {session?.user && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full hover:bg-white/10"
                                onClick={() => setIsFeedbackDialogOpen(true)}
                                title={t("header.feedback")}
                                aria-label={t("header.feedback")}
                            >
                                <MessageSquarePlus className="h-5 w-5" />
                            </Button>
                        )}
                        <ThemeToggle />
                        {session?.user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-white/10">
                                        {session.user.image ? (
                                            <Image
                                                src={session.user.image}
                                                alt="Avatar"
                                                width={35}
                                                height={35}
                                                className="rounded-full object-cover"
                                            />
                                        ) : (
                                            <User className="h-8 w-8" />
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{session.user.name || session.user.email || "User"}</p>
                                            {session.user.email && <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>}
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)}>
                                        <User className="mr-2 h-4 w-4" />
                                        <span>{t("header.profile")}</span>
                                    </DropdownMenuItem>
                                    {SHOW_PUBLICATIONS_MENU && (
                                        <DropdownMenuItem onClick={() => setIsPublicationsDialogOpen(true)}>
                                            <BookCopy className="mr-2 h-4 w-4" />
                                            <span>{t("header.publications")}</span>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => setIsNotificationsDialogOpen(true)}>
                                        <Bell className="mr-2 h-4 w-4" />
                                        <span>{t("header.notifications")}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsSettingsDialogOpen(true)}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>{t("header.settings")}</span>
                                    </DropdownMenuItem>
                                    {canShowAdminLink && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => { window.location.href = `${API_CONFIG.baseUrl}/api/admin/enter`; }}
                                            >
                                                <Shield className="mr-2 h-4 w-4 text-primary" />
                                                <span className="font-semibold text-primary">{t("header.adminPage")}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => router.push("/devs/docs")}
                                            >
                                                <FileText className="mr-2 h-4 w-4 text-primary" />
                                                <span className="font-semibold text-primary">{t("header.devDocs")}</span>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>{t("header.logout")}</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button
                                size="sm"
                                className="h-9 px-3 rounded-full bg-brand hover:bg-brand/90 text-white font-medium"
                                onClick={() => router.push("/login")}
                                title={t("header.login")}
                            >
                                <LogIn className="h-4 w-4 mr-1.5" />
                                {t("header.login")}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden justify-start">
                    <DialogTitle className="sr-only">{t("header.profile")}</DialogTitle>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        <ProfileSettingsView onSaveSuccess={() => setIsProfileDialogOpen(false)} />
                    </div>
                </DialogContent>
            </Dialog>

            {SHOW_PUBLICATIONS_MENU && (
                <Dialog open={isPublicationsDialogOpen} onOpenChange={setIsPublicationsDialogOpen}>
                    <DialogContent className="sm:max-w-6xl max-h-[90dvh] h-[80vh] flex flex-col overflow-hidden">
                        <DialogTitle className="sr-only">{t("header.publications")}</DialogTitle>
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
                            <PublicationsView />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            <Dialog open={isNotificationsDialogOpen} onOpenChange={setIsNotificationsDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogTitle className="sr-only">{t("header.notifications")}</DialogTitle>
                    <div className="flex-1 min-h-0 overflow-y-auto py-4">
                        <NotificationsView />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90dvh] h-[80vh] flex flex-col overflow-hidden">
                    <DialogTitle className="sr-only">{t("header.settings")}</DialogTitle>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        <SystemSettingsView />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90dvh] h-[80vh] flex flex-col overflow-hidden">
                    <DialogTitle className="sr-only">{t("header.help")}</DialogTitle>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        <HelpGuideView />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogTitle>{t("header.feedback")}</DialogTitle>
                    <div className="pt-2">
                        <FeedbackDialog currentAssistantAlias={currentAssistantAlias} />
                    </div>
                </DialogContent>
            </Dialog>

            <AboutDialog open={isAboutDialogOpen} onOpenChange={setIsAboutDialogOpen} />
        </header>
    )
}
