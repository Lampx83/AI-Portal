"use client"

import { Suspense, useEffect, useState } from "react"
import Image from "next/image"
import { useSession, signIn, getProviders } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { KeyRound } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// ✅ Khai báo dynamic để tránh prerender error cho trang login
export const dynamic = "force-dynamic"

function LoginInner() {
    const [email, setEmail] = useState("user@example.com")
    const [password, setPassword] = useState("password123")
    const [nextUrl, setNextUrl] = useState("/welcome")
    const [hasAzureAD, setHasAzureAD] = useState(false)
    const { toast } = useToast()
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()

    // Check if Azure AD provider is available
    useEffect(() => {
        getProviders().then((providers) => {
            setHasAzureAD(!!providers?.["azure-ad"])
        })
    }, [])

    // Lấy đích đến: ưu tiên callbackUrl (middleware dùng khi redirect từ /admin), rồi next, mặc định welcome (trang chào mừng lần đầu)
    useEffect(() => {
        if (typeof window === "undefined") return
        
        const baseNext = searchParams.get("callbackUrl") || searchParams.get("next") || "/welcome"
        try {
            const url = new URL(baseNext, window.location.origin)
            if (!url.searchParams.has("sid")) {
                url.searchParams.set("sid", crypto.randomUUID())
            }
            setNextUrl(url.pathname + url.search)
        } catch (error) {
            // Fallback nếu URL không hợp lệ
            setNextUrl(baseNext.startsWith("/") ? baseNext : "/welcome")
        }
    }, [searchParams])

    useEffect(() => {
        if (status === "authenticated" && nextUrl) {
            router.replace(nextUrl)
        }
    }, [status, nextUrl, router])

    if (status === "loading" || session) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-neu-blue"></div>
            </div>
        )
    }

    const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        const result = await signIn("credentials", {
            redirect: false,
            email,
            password,
        })
        if (result?.error) {
            toast({
                title: "Đăng nhập thất bại",
                description: "Email hoặc mật khẩu không đúng.",
                variant: "destructive",
            })
        } else {
            router.replace(nextUrl)
        }
    }

    const handleMicrosoftSignIn = async () => {
        if (!hasAzureAD) {
            toast({
                title: "Azure AD không khả dụng",
                description: "Azure AD provider chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
                variant: "destructive",
            })
            return
        }
        // OAuth cần redirect sang Microsoft; redirect: false trả về url, ta chuyển hướng thủ công
        const result = await signIn("azure-ad", { callbackUrl: nextUrl, redirect: false })
        if (result?.url) {
            window.location.href = result.url
            return
        }
        if (result?.error) {
            toast({
                title: "Đăng nhập thất bại",
                description: result.error === "OAuthSignin"
                    ? "Lỗi cấu hình Azure AD. Vui lòng kiểm tra lại cấu hình."
                    : "Không thể đăng nhập bằng Azure AD.",
                variant: "destructive",
            })
        }
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
                            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Mật khẩu</Label>
                            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                        <Button type="submit" className="w-full bg-neu-blue hover:bg-neu-blue/90">
                            Đăng nhập
                        </Button>
                    </form>

                    {hasAzureAD && (
                        <>
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
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-neu-blue"></div>
                </div>
            }
        >
            <LoginInner />
        </Suspense>
    )
}
