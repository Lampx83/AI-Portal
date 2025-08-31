"use client"

import type React from "react"

import { Inter } from "next/font/google"
import { useEffect } from "react"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionWrapper } from "@/app/(providers)/session-provider" // đường dẫn tuỳ vào vị trí file
import { researchAssistants } from "@/data/research-assistants"

const inter = Inter({ subsets: ["latin"] })




export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
