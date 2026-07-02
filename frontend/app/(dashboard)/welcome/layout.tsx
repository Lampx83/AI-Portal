import type React from "react"
import type { Metadata } from "next"
import { getSystemTitle } from "@/lib/server-branding"

// Trang chủ: "Trang chủ - ‹Hệ thống…›".
export async function generateMetadata(): Promise<Metadata> {
  const system = await getSystemTitle()
  return { title: `Trang chủ - ${system}` }
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
