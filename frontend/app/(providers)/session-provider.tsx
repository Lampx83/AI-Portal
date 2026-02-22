// app/(providers)/session-provider.tsx

"use client"

import { SessionProvider } from "next-auth/react"
import type { ReactNode } from "react"

const basePath = (typeof process.env.NEXT_PUBLIC_BASE_PATH === "string" ? process.env.NEXT_PUBLIC_BASE_PATH : "").replace(/\/+$/, "")
// Khi chạy dưới subpath (vd. /admission), NextAuth client phải gọi /admission/api/auth/session thay vì /api/auth/session
const nextAuthBasePath = basePath ? `${basePath}/api/auth` : undefined

export function SessionWrapper({ children }: { children: ReactNode }) {
    return <SessionProvider basePath={nextAuthBasePath}>{children}</SessionProvider>
}
