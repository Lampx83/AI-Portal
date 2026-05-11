"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { API_CONFIG } from "@/lib/config"
import { getOrCreateGuestDeviceId } from "@/lib/guest-device-id"

const baseUrl = `${API_CONFIG.baseUrl.replace(/\/+$/, "")}/api/track/pageview`

const SKIP_PREFIXES = ["/admin", "/login", "/setup", "/error", "/api/", "/_next/"]

function shouldSkip(path: string): boolean {
  if (!path) return true
  return SKIP_PREFIXES.some((p) => path.startsWith(p))
}

export function PageviewTracker() {
  const pathname = usePathname() || "/"
  const lastSentRef = useRef<string>("")

  useEffect(() => {
    if (shouldSkip(pathname)) return
    // Tránh gửi 2 lần cùng path (StrictMode dev double-mount)
    if (lastSentRef.current === pathname) return
    lastSentRef.current = pathname

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (typeof window !== "undefined") {
      headers["X-Guest-Device-Id"] = getOrCreateGuestDeviceId()
    }
    const referrer = typeof document !== "undefined" ? document.referrer || "" : ""

    fetch(baseUrl, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ path: pathname, referrer }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
