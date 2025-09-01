"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { KeyRound } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "next-auth/react"
import { signIn, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

export default function LoginPage() {
    const [email, setEmail] = useState("user@example.com")
    const [password, setPassword] = useState("password123")
    const { toast } = useToast()
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()

    // Lấy đích đến ưu tiên từ ?next=..., mặc định vào assistants/main
    const nextUrl = searchParams.get("next") || "/assistants/main"

    // 1) Nếu đã có session mà vẫn ở /login -> đẩy sang trợ lý main (hoặc nextUrl)
    useEffect(() => {
        if (status === "authenticated") {
            router.replace(nextUrl)
        }
    }, [status, nextUrl, router])

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-neu-blue"></div>
            </div>
        )
    }

    if (session) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-neu-blue"></div>
            </div>
        )
    }


    // 2) Sau khi đăng nhập thành công -> vào assistants/main (hoặc nextUrl)
    const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        const result = await signIn("credentials", {
            redirect: false,
            email,
            password,
            // Không redirect ngay ở đây; đợi useEffect thấy session rồi router.replace(nextUrl).
        })
        if (result?.error) {
            toast({
                title: "Đăng nhập thất bại",
                description: "Email hoặc mật khẩu không đúng.",
                variant: "destructive",
            })
        } else {
            // Có thể chủ động điều hướng luôn (không cần đợi useEffect):
            router.replace(nextUrl)
        }
    }

    const handleMicrosoftSignIn = () => {
        // Đẩy user quay về đích mong muốn sau SSO
        signIn("azure-ad", { callbackUrl: nextUrl })
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-col items-center space-y-2">
                    <Image src="/neu-logo.svg" alt="Logo Đại học Kinh tế Quốc dân" width={64} height={64} />
                    <CardTitle className="text-2xl font-bold">Đăng nhập</CardTitle>
                    <CardDescription className="text-center">
                        Hệ thống hỗ trợ nghiên cứu
                        <p className="mt-2 text-sm text-orange-600 dark:text-orange-400 font-medium">
                            ⚠️ Hệ thống đang trong giai đoạn thử nghiệm
                        </p>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Mật khẩu</Label>
                                {/* <Link href="#" className="text-sm underline text-neu-blue hover:text-neu-blue/80">
                                    Quên mật khẩu?
                                </Link> */}
                            </div>
                            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
                        <KeyRound className="h-5 w-5" />
                        Đăng nhập bằng tài khoản Microsoft
                    </Button>
                </CardContent>
                {/* <CardFooter className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Chưa có tài khoản?{" "}
                    <Link href="#" className="underline text-neu-blue hover:text-neu-blue/80">
                        Đăng ký
                    </Link>
                </CardFooter> */}
            </Card>
        </div>
    )
}
