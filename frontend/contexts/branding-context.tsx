"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getBranding, type Branding } from "@/lib/api/branding"

type BrandingContextValue = { branding: Branding; loaded: boolean }

const BrandingContext = createContext<BrandingContextValue | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(null)

  useEffect(() => {
    getBranding()
      .then((b) => setBranding(b))
      .catch(() => setBranding({ systemName: "" }))
  }, [])

  const value: BrandingContextValue = {
    branding: branding ?? { systemName: "" },
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
  return ctx ?? { branding: { systemName: "" }, loaded: false }
}
