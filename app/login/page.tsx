"use client"

import type React from "react"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChromeIcon } from "lucide-react" // Using ChromeIcon as a placeholder for Microsoft icon
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "next-auth/react"
import { signIn, signOut } from "next-auth/react"



export default function LoginPage() {
    const [email, setEmail] = useState("user@example.com")
    const [password, setPassword] = useState("password123")
    const { toast } = useToast()
    const { data: session, status } = useSession()

    // Nếu đang đăng nhập
    if (status === "loading") {
        return <div className="text-center mt-20">Đang tải phiên làm việc...</div>
    }

    if (session) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="flex flex-col items-center space-y-2">
                        <CardTitle className="text-2xl font-bold">Xin chào</CardTitle>
                        <CardDescription className="text-center">
                            Bạn đang đăng nhập với tài khoản:
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center">
                        {session.user?.image && (
                            <div className="flex justify-center">
                                <Image
                                    src={session.user.image}
                                    alt="Avatar người dùng"
                                    width={64}
                                    height={64}
                                    className="rounded-full"
                                />
                            </div>
                        )}
                        <p className="text-lg font-medium">{session.user?.name}</p>
                        <p className="text-sm text-gray-500">{session.user?.email}</p>
                        <Button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="w-full bg-red-500 hover:bg-red-600"
                        >
                            Đăng xuất
                        </Button>
                    </CardContent>

                </Card>
            </div>
        )
    }

    const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await signIn("credentials", {
            redirect: false, // Prevent redirect on error
            email,
            password,
        });

        if (result?.error) {
            toast({
                title: "Đăng nhập thất bại",
                description: "Email hoặc mật khẩu không đúng.",
                variant: "destructive",
            });
        } else {
            // Redirect to dashboard or home page on success
            window.location.href = "/"; // Hoặc sử dụng useRouter để điều hướng trong Next.js
        }
    };

    const handleMicrosoftSignIn = () => {
        signIn("azure-ad", { callbackUrl: "/" })

    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-col items-center space-y-2">
                    <Image src="/neu-logo.svg" alt="Logo Đại học Kinh tế Quốc dân" width={64} height={64} />
                    <CardTitle className="text-2xl font-bold">Đăng nhập</CardTitle>
                    <CardDescription className="text-center">
                        Chào mừng trở lại! Vui lòng nhập thông tin đăng nhập của bạn hoặc sử dụng SSO.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Mật khẩu</Label>
                                <Link href="#" className="text-sm underline text-neu-blue hover:text-neu-blue/80">
                                    Quên mật khẩu?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <Button type="submit" className="w-full bg-neu-blue hover:bg-neu-blue/90">
                            Đăng nhập
                        </Button>
                    </form>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Hoặc</span>
                        </div>
                    </div>
                    <Button
                        type="button"
                        className="w-full bg-gray-700 hover:bg-gray-800 text-white flex items-center justify-center gap-2"
                        onClick={handleMicrosoftSignIn}
                    >
                        <ChromeIcon className="h-5 w-5" /> {/* Placeholder icon for Microsoft */}
                        Đăng nhập với Microsoft Azure AD
                    </Button>
                </CardContent>
                <CardFooter className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Chưa có tài khoản?{" "}
                    <Link href="#" className="underline text-neu-blue hover:text-neu-blue/80">
                        Đăng ký
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
