"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

function getErrorPath(): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/^\/+|\/+$/g, "") || ""
  return basePath ? `/${basePath}/error` : "/error"
}

function getErrorUrl(reason?: "database"): string {
  if (typeof window === "undefined") return getErrorPath()
  const base = `${window.location.origin}${getErrorPath()}`
  return reason === "database" ? `${base}?reason=database` : base
}

export function BackendCheck({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const checked = useRef(false)

  useEffect(() => {
    const path = pathname ?? ""
    const errorPath = getErrorPath()
    const isErrorPage = path === errorPath || path.endsWith("/error")
    if (isErrorPage || checked.current) return
    checked.current = true

    const base = typeof window !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH
      ? `${window.location.origin}/${(process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/^\/+|\/+$/g, "")}`
      : typeof window !== "undefined"
        ? window.location.origin
        : ""
    const url = base ? `${base}/api/setup/status` : "/api/setup/status"

    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 3000)

    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        clearTimeout(id)
        if (res.status === 502 || res.status === 504 || res.status === 500) {
          window.location.href = getErrorUrl()
          return
        }
        if (res.status === 503) {
          window.location.href = getErrorUrl("database")
          return
        }
      })
      .catch(() => {
        clearTimeout(id)
        window.location.href = getErrorUrl()
      })
  }, [pathname])

  return <>{children}</>
}
