"use client"

import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionWrapper } from "@/app/(providers)/session-provider"

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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <SessionWrapper>
          <ThemeProvider storageKey={THEME_STORAGE_KEY}>
            {children}
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  )
}
