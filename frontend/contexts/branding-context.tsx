"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getBranding, type Branding } from "@/lib/api/branding"

type BrandingContextValue = { branding: Branding; loaded: boolean }

const BrandingContext = createContext<BrandingContextValue | null>(null)

const DEFAULT_BRAND_HEX = "#0061bb"

/** Chuyển hex (#rrggbb) sang HSL dạng "h s% l%" cho CSS variable --primary. */
function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  const hDeg = Math.round(h * 360)
  const sPct = Math.round(s * 100)
  const lPct = Math.round(l * 100)
  return `${hDeg} ${sPct}% ${lPct}%`
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(null)

  const load = () => {
    getBranding()
      .then((b) => setBranding(b))
      .catch(() => setBranding({ systemName: "", projectsEnabled: true }))
  }
  useEffect(() => {
    load()
    const onUpdate = () => load()
    window.addEventListener("branding-updated", onUpdate)
    return () => window.removeEventListener("branding-updated", onUpdate)
  }, [])

  useEffect(() => {
    const color = (branding ?? undefined)?.themeColor ?? DEFAULT_BRAND_HEX
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--brand", color)
      const primaryHSL = hexToHSL(color)
      document.documentElement.style.setProperty("--primary", primaryHSL)
      document.documentElement.style.setProperty("--primary-foreground", "0 0% 98%")
      try {
        if (typeof localStorage !== "undefined" && /^#[0-9A-Fa-f]{6}$/.test(color)) {
          localStorage.setItem("portal_theme_color", color)
        }
      } catch (_) {}
    }
  }, [branding])

  const value: BrandingContextValue = {
    branding: branding ?? { systemName: "", projectsEnabled: true },
    loaded: branding !== null,
  }

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext)
  return ctx ?? { branding: { systemName: "", projectsEnabled: true }, loaded: false }
}
