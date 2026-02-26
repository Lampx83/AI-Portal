"use client"

import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionWrapper } from "@/app/(providers)/session-provider"
import { LanguageProvider } from "@/contexts/language-context"
import { BrandingProvider } from "@/contexts/branding-context"
import { SiteDocumentHead } from "@/components/site-document-head"
import { Toaster } from "@/components/ui/toaster"
import { SpeedInsights } from "@vercel/speed-insights/next"

const THEME_STORAGE_KEY = "neu-ui-theme"
const useSpeedInsights = process.env.NEXT_PUBLIC_VERCEL === "1"

export function RootBody({ children }: { children: React.ReactNode }) {
  return (
    <SessionWrapper>
      <LanguageProvider>
        <BrandingProvider>
          <SiteDocumentHead />
          <ThemeProvider storageKey={THEME_STORAGE_KEY}>
            {children}
            <Toaster />
            {useSpeedInsights && <SpeedInsights />}
          </ThemeProvider>
        </BrandingProvider>
      </LanguageProvider>
    </SessionWrapper>
  )
}
