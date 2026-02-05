"use client"

import Image from "next/image"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { User, BookCopy, Bell, Settings, HelpCircle, LogOut, Shield, MessageSquare, FileText } from "lucide-react"
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
import { SystemSettingsView } from "@/components/system-settings-view"
import { HelpGuideView } from "@/components/help-guide-view"
import { API_CONFIG } from "@/lib/config"
import { getDailyUsage } from "@/lib/chat"
import { useActiveResearch } from "@/contexts/active-research-context"

export function Header() {
    const router = useRouter()
    const { data: session } = useSession()
    const { activeResearch, setActiveResearch } = useActiveResearch()
    const [isAdminFromApi, setIsAdminFromApi] = useState<boolean | null>(null)

    // Dialog state
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
    const [isPublicationsDialogOpen, setIsPublicationsDialogOpen] = useState(false)
    const [isNotificationsDialogOpen, setIsNotificationsDialogOpen] = useState(false)
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
    const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)

    // Admin: lấy is_admin từ session hoặc gọi API /api/auth/admin-check (backend trả về theo DB)
    const isAdminFromSession = (session?.user as { is_admin?: boolean } | undefined)?.is_admin === true
    useEffect(() => {
        if (!session?.user) {
            setIsAdminFromApi(null)
            return
        }
        // Gọi cùng origin (proxy sang backend trong dev) để gửi cookie session
        fetch("/api/auth/admin-check", { credentials: "include" })
            .then((res) => res.json())
            .then((data) => setIsAdminFromApi(!!data?.is_admin))
            .catch(() => setIsAdminFromApi(false))
    }, [session?.user])
    const isAdmin = isAdminFromSession || isAdminFromApi === true

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
    if (activeResearch != null) setActiveResearch(null)
    router.push("/welcome")
  }
    return (
        <header className="bg-neu-blue text-white shadow-md z-10">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-4 cursor-pointer hover:opacity-90 transition-opacity" onClick={goHome} title="Về trang chủ">
                        <Image src="/neu-logo.svg" alt="Logo NEU" width={40} height={40} />
                        <div className="flex flex-col leading-tight">
                            <h1 className="text-xl font-bold tracking-tight">Research</h1>
                            <p className="hidden sm:block text-xs text-yellow-200">⚠️ Hệ thống đang trong quá trình hoàn thiện</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {session?.user && quota != null && (
                            <div
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 text-xs"
                                title={`Tin nhắn đã chat hôm nay: ${quota.used}/${quota.limit}. Tin nhắn còn lại: ${quota.remaining}`}
                            >
                                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>{quota.used}/{quota.limit}</span>
                            </div>
                        )}
                        <ThemeToggle />
                        <DropdownMenu>
                            {session?.user ? (
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
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="relative h-10 w-10 rounded-full hover:bg-white/10"
                                    onClick={() => router.push("/login")}
                                >
                                    <User className="h-8 w-8" />
                                </Button>
                            )}

                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        {session?.user ? (
                                            <>
                                                <p className="text-sm font-medium leading-none">{session.user.name}</p>
                                                <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                                            </>
                                        ) : (
                                            <p className="text-sm">Chưa đăng nhập</p>
                                        )}
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)}>
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Hồ sơ</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsPublicationsDialogOpen(true)}>
                                    <BookCopy className="mr-2 h-4 w-4" />
                                    <span>Công bố của tôi</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsNotificationsDialogOpen(true)}>
                                    <Bell className="mr-2 h-4 w-4" />
                                    <span>Thông báo</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsSettingsDialogOpen(true)}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Cài đặt</span>
                                </DropdownMenuItem>
                                {isAdmin && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => { window.location.href = `${API_CONFIG.baseUrl}/api/admin/enter`; }}
                                        >
                                            <Shield className="mr-2 h-4 w-4 text-blue-600" />
                                            <span className="font-semibold text-blue-600">Trang quản trị</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => router.push("/devs/docs")}
                                        >
                                            <FileText className="mr-2 h-4 w-4 text-blue-600" />
                                            <span className="font-semibold text-blue-600">Tài liệu nhà phát triển</span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIsHelpDialogOpen(true)}>
                                    <HelpCircle className="mr-2 h-4 w-4" />
                                    <span>Trợ giúp</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Đăng xuất</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden justify-start">
                    <DialogTitle className="sr-only">Hồ sơ</DialogTitle>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        <ProfileSettingsView onSaveSuccess={() => setIsProfileDialogOpen(false)} />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isPublicationsDialogOpen} onOpenChange={setIsPublicationsDialogOpen}>
                <DialogContent className="sm:max-w-6xl max-h-[90dvh] h-[80vh] flex flex-col overflow-hidden">
                    <DialogTitle className="sr-only">Công bố của tôi</DialogTitle>
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
                        <PublicationsView />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isNotificationsDialogOpen} onOpenChange={setIsNotificationsDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogTitle className="sr-only">Thông báo</DialogTitle>
                    <div className="py-4">
                        <p className="text-gray-500 dark:text-gray-400">Chức năng thông báo đang được phát triển.</p>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90dvh] h-[80vh] flex flex-col overflow-hidden">
                    <DialogTitle className="sr-only">Cài đặt</DialogTitle>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        <SystemSettingsView />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90dvh] h-[80vh] flex flex-col overflow-hidden">
                    <DialogTitle className="sr-only">Trợ giúp</DialogTitle>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                        <HelpGuideView />
                    </div>
                </DialogContent>
            </Dialog>
        </header>
    )
}
