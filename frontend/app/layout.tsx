"use client"

import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionWrapper } from "@/app/(providers)/session-provider"
import { LanguageProvider } from "@/contexts/language-context"
import { BrandingProvider } from "@/contexts/branding-context"
import { SiteDocumentHead } from "@/components/site-document-head"
import { SpeedInsights } from "@vercel/speed-insights/next"

// Chỉ hiển thị Speed Insights khi chạy trên Vercel (tránh 404 /_vercel/speed-insights/script.js khi deploy server khác)
const useSpeedInsights = process.env.NEXT_PUBLIC_VERCEL === "1"

const inter = Inter({ subsets: ["latin"] })

const THEME_STORAGE_KEY = "neu-ui-theme"
const BRAND_COLOR_STORAGE_KEY = "portal_theme_color"

const noFlashScript = `
(function() {
  try {
    var key = '${THEME_STORAGE_KEY}';
    var stored = localStorage.getItem(key);
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var theme = stored || 'system';
    var clazz = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : (mq.matches ? 'dark' : 'light');
    var root = document.documentElement;
    root.classList.remove('light','dark');
    root.classList.add(clazz);
  } catch (e) {}
})();
`

const brandColorScript = `
(function() {
  try {
    var c = localStorage.getItem('${BRAND_COLOR_STORAGE_KEY}');
    if (c && /^#[0-9A-Fa-f]{6}$/.test(c)) {
      document.documentElement.style.setProperty('--brand', c);
    }
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>AI Portal</title>
        <meta name="description" content="AI Portal – Nền tảng giao diện và điều phối AI." />
        <meta name="keywords" content="AI, AI Portal, trợ lý ảo, quản lý dự án, tìm kiếm tài liệu" />
        <meta name="author" content="AI Portal" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="AI Portal" />
        <meta property="og:description" content="AI Portal – Nền tảng giao diện và điều phối AI." />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI Portal" />
        <meta name="twitter:description" content="AI Portal – Nền tảng giao diện và điều phối AI." />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        <script dangerouslySetInnerHTML={{ __html: brandColorScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <SessionWrapper>
          <LanguageProvider>
            <BrandingProvider>
              <SiteDocumentHead />
              <ThemeProvider storageKey={THEME_STORAGE_KEY}>
                {children}
                {useSpeedInsights && <SpeedInsights />}
              </ThemeProvider>
            </BrandingProvider>
          </LanguageProvider>
        </SessionWrapper>
      </body>
    </html>
  )
}
