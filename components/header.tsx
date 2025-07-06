"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, BookCopy, Bell, Settings, HelpCircle, LogOut } from "lucide-react"
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



interface HeaderProps {
    onOpenProfile: () => void
    onOpenPublications: () => void
    onOpenNotifications: () => void
    onOpenSettings: () => void
    onOpenHelp: () => void
    onLogout: () => void
}

export function Header({
    onOpenProfile,
    onOpenPublications,
    onOpenNotifications,
    onOpenSettings,
    onOpenHelp,
    onLogout,
}: HeaderProps) {
    const router = useRouter()
    const { data: session } = useSession()

    return (
        <header className="bg-neu-blue text-white shadow-md z-10">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-4">
                        <Image src="/neu-logo.svg" alt="Logo Đại học Kinh tế Quốc dân" width={40} height={40} />
                        <h1 className="text-xl font-bold tracking-tight">Neu Research2</h1>
                    </div>
                    <div className="flex items-center space-x-2">
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
                                <DropdownMenuItem onClick={onOpenProfile}>
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Hồ sơ</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onOpenPublications}>
                                    <BookCopy className="mr-2 h-4 w-4" />
                                    <span>Công bố của tôi</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onOpenNotifications}>
                                    <Bell className="mr-2 h-4 w-4" />
                                    <span>Thông báo</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onOpenSettings}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Cài đặt</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={onOpenHelp}>
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
        </header>
    )
}
