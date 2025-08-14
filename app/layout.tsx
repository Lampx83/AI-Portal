"use client"

import type React from "react"

import { Inter } from "next/font/google"
import { useEffect } from "react"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionWrapper } from "@/app/(providers)/session-provider" // đường dẫn tuỳ vào vị trí file
import { useAssistantsStore } from "@/lib/assistants-store"
import { researchAssistants } from "@/components/sidebar"

const inter = Inter({ subsets: ["latin"] })




export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const setAssistants = useAssistantsStore((s) => s.setAssistants)
  useEffect(() => {
    setAssistants(researchAssistants)
  }, [setAssistants])
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionWrapper>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  )
}
