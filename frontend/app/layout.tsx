"use client"

import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionWrapper } from "@/app/(providers)/session-provider"
import { LanguageProvider } from "@/contexts/language-context"

const inter = Inter({ subsets: ["latin"] })

const THEME_STORAGE_KEY = "neu-ui-theme"

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Hệ thống AI hỗ trợ nghiên cứu khoa học</title>
        <meta name="description" content="Hệ thống AI hỗ trợ nghiên cứu khoa học: quản lý dự án, trợ lý ảo, tìm kiếm tài liệu và cộng tác nghiên cứu." />
        <meta name="keywords" content="AI, nghiên cứu khoa học, trợ lý ảo, quản lý dự án nghiên cứu, tìm kiếm tài liệu" />
        <meta name="author" content="Hệ thống AI hỗ trợ nghiên cứu khoa học" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Hệ thống AI hỗ trợ nghiên cứu khoa học" />
        <meta property="og:description" content="Hệ thống AI hỗ trợ nghiên cứu khoa học: quản lý dự án, trợ lý ảo, tìm kiếm tài liệu và cộng tác nghiên cứu." />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Hệ thống AI hỗ trợ nghiên cứu khoa học" />
        <meta name="twitter:description" content="Hệ thống AI hỗ trợ nghiên cứu khoa học: quản lý dự án, trợ lý ảo, tìm kiếm tài liệu và cộng tác nghiên cứu." />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <SessionWrapper>
          <LanguageProvider>
            <ThemeProvider storageKey={THEME_STORAGE_KEY}>
              {children}
            </ThemeProvider>
          </LanguageProvider>
        </SessionWrapper>
      </body>
    </html>
  )
}
