"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { useSession, signIn, getProviders } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { KeyRound } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useBranding } from "@/contexts/branding-context"

// ✅ Declare dynamic to avoid prerender error for login page
export const dynamic = "force-dynamic"

function LoginInner() {
    const [email, setEmail] = useState("user@example.com")
    const [password, setPassword] = useState("password123")
    const [nextUrl, setNextUrl] = useState("/welcome")
    const [hasAzureAD, setHasAzureAD] = useState(false)
    const [hasGoogle, setHasGoogle] = useState(false)
    const [loadingTimedOut, setLoadingTimedOut] = useState(false)
    const { toast } = useToast()
    const { data: session, status } = useSession()
    const { branding, loaded: brandingLoaded } = useBranding()
    const router = useRouter()
    const searchParams = useSearchParams()

    // Avoid infinite loading when /api/auth/session does not respond (e.g. Docker/proxy)
    useEffect(() => {
        if (status !== "loading") {
            setLoadingTimedOut(false)
            return
        }
        const t = setTimeout(() => setLoadingTimedOut(true), 6000)
        return () => clearTimeout(t)
    }, [status])

    // Check which SSO providers are configured — refetch when unauthenticated so after configuring SSO and logging out button still shows
    const fetchProviders = useCallback(() => {
        getProviders().then((providers) => {
            setHasAzureAD(!!providers?.["azure-ad"])
            setHasGoogle(!!providers?.["google"])
        })
    }, [])
    useEffect(() => {
        fetchProviders()
    }, [fetchProviders])
    useEffect(() => {
        if (status === "unauthenticated") fetchProviders()
    }, [status, fetchProviders])

    // Show error from URL when NextAuth redirects to /login?error=... (e.g. after failed SSO callback, or unauthorized from /admin)
    useEffect(() => {
        const err = searchParams.get("error")
        if (!err) return
        if (err !== "unauthorized" && status === "loading") return
        const messages: Record<string, string> = {
            unauthorized: "Bạn không có quyền truy cập trang quản trị. Chỉ admin/developer mới vào được.",
            Callback: "Đăng nhập SSO không hoàn tất. Kiểm tra email từ tài khoản Microsoft có được cấp cho ứng dụng không.",
            OAuthCallback: "Lỗi xử lý callback từ nhà cung cấp đăng nhập.",
            OAuthSignin: "Lỗi cấu hình SSO. Quản trị viên vui lòng kiểm tra Client ID / Secret / Tenant.",
            OAuthAccountNotLinked: "Email này đã đăng ký bằng cách đăng nhập khác. Dùng đúng cách đăng nhập hoặc liên kết tài khoản.",
            Default: "Đăng nhập thất bại. Thử lại hoặc dùng email/mật khẩu.",
        }
        toast({
            title: "Đăng nhập thất bại",
            description: messages[err] || messages.Default,
            variant: "destructive",
        })
        router.replace("/login", { scroll: false })
    }, [searchParams.get("error"), status, toast, router])

    // Get destination: prefer callbackUrl (middleware uses when redirecting from /admin), then next, default welcome (first-time welcome page)
    // Khi chạy dưới basePath (vd. /admission), đảm bảo nextUrl có prefix để redirect sau login đúng (vd. /admission/admin)
    useEffect(() => {
        if (typeof window === "undefined") return
        const basePath = (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "") || ""
        let baseNext = searchParams.get("callbackUrl") || searchParams.get("next") || "/welcome"
        if (basePath && !baseNext.startsWith(basePath)) {
            baseNext = basePath + (baseNext.startsWith("/") ? baseNext : "/" + baseNext)
        }
        try {
            const url = new URL(baseNext, window.location.origin)
            if (!url.searchParams.has("sid")) {
                url.searchParams.set("sid", crypto.randomUUID())
            }
            setNextUrl(url.pathname + url.search)
        } catch (error) {
            setNextUrl(baseNext.startsWith("/") ? baseNext : "/welcome")
        }
    }, [searchParams])

    useEffect(() => {
        if (status === "authenticated" && nextUrl) {
            router.replace(nextUrl)
        }
    }, [status, nextUrl, router])

    // Khi redirect từ /admin với error=unauthorized thì hiển thị form ngay (không chờ session), tránh kẹt loading khi /api/auth/session chậm
    const hasErrorInUrl = !!searchParams?.get("error")
    const showLoading = status === "loading" && !loadingTimedOut && !hasErrorInUrl
    if ((showLoading || (session && !hasErrorInUrl)) && !loadingTimedOut) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-brand"></div>
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
            // Full page navigation để cookie session chắc chắn được gửi khi request /admin (tránh middleware nhận thiếu cookie)
            window.location.href = nextUrl
        }
    }

    const handleGoogleSignIn = async () => {
        if (!hasGoogle) {
            toast({
                title: "Google không khả dụng",
                description: "Google provider chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
                variant: "destructive",
            })
            return
        }
        const result = await signIn("google", { callbackUrl: nextUrl, redirect: false })
        if (result?.url) {
            window.location.href = result.url
            return
        }
        if (result?.error) {
            toast({
                title: "Đăng nhập thất bại",
                description: result.error === "OAuthSignin"
                    ? "Lỗi cấu hình Google. Vui lòng kiểm tra lại cấu hình."
                    : "Không thể đăng nhập bằng Google.",
                variant: "destructive",
            })
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

    const hasSSO = hasGoogle || hasAzureAD

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-col items-center space-y-2">
                    {!brandingLoaded ? (
                      <div className="w-16 h-16 flex-shrink-0" aria-hidden />
                    ) : branding.logoDataUrl ? (
                      <Image src={branding.logoDataUrl} alt="" width={64} height={64} className="object-contain" unoptimized />
                    ) : (
                      <Image src="/neu-logo.svg" alt="Logo" width={64} height={64} />
                    )}
                    <CardTitle className="text-2xl font-bold">Đăng nhập</CardTitle>
                    <CardDescription className="text-center">
                        {brandingLoaded ? (branding.systemName || "AI Portal") : "\u00A0"}
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
                        <Button type="submit" className="w-full bg-brand hover:bg-brand/90">
                            Đăng nhập
                        </Button>
                    </form>

                    {hasSSO && (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Hoặc</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                {hasGoogle && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full border border-slate-300 dark:border-slate-600 flex items-center justify-center gap-2"
                                        onClick={handleGoogleSignIn}
                                    >
                                        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Đăng nhập bằng Google
                                    </Button>
                                )}
                                {hasAzureAD && (
                                    <Button
                                        type="button"
                                        className="w-full bg-gray-700 hover:bg-gray-800 text-white flex items-center justify-center gap-2"
                                        onClick={handleMicrosoftSignIn}
                                    >
                                        <KeyRound className="h-5 w-5" />
                                        Đăng nhập bằng Microsoft
                                    </Button>
                                )}
                            </div>
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
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-brand"></div>
                </div>
            }
        >
            <LoginInner />
        </Suspense>
    )
}
