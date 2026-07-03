import type React from "react"
import type { Metadata } from "next"
import { getSystemTitle, getAppUrl } from "@/lib/server-branding"

/** Lấy tên app theo alias từ backend (tool global không cần đăng nhập). Lỗi thì trả rỗng. */
async function getToolName(alias: string): Promise<string> {
  try {
    const base = (process.env.BACKEND_URL || "http://backend:3001").replace(/\/+$/, "")
    const res = await fetch(`${base}/api/tools/${encodeURIComponent(alias)}`, { next: { revalidate: 300 } })
    if (!res.ok) return ""
    const data = (await res.json()) as { name?: string }
    return typeof data?.name === "string" ? data.name.trim() : ""
  } catch {
    return ""
  }
}

// Tiêu đề tab đổi theo app đang mở: "‹Tên app› - ‹Hệ thống…›".
// Dùng metadata của Next (thay vì document.title client) để không bị App Router ghi đè.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ alias: string }>
}): Promise<Metadata> {
  const { alias } = await params
  const system = await getSystemTitle()
  const name = await getToolName(alias)
  const appUrl = getAppUrl()
  const title = name ? `${name} - ${system}` : system
  const description = name
    ? `${name} – công cụ trong Hệ thống AI hỗ trợ tuyển sinh Đại học Kinh tế Quốc dân (NEU).`
    : undefined
  const canonical = appUrl ? `${appUrl}/tools/${alias}` : undefined
  const ogImage = appUrl ? `${appUrl}/android-chrome-512x512.png` : undefined
  return {
    title,
    ...(description ? { description } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      title,
      ...(description ? { description } : {}),
      ...(canonical ? { url: canonical } : {}),
      ...(ogImage ? { images: [{ url: ogImage, width: 512, height: 512, alt: title }] } : {}),
    },
  }
}

export default function ToolAliasLayout({ children }: { children: React.ReactNode }) {
  return children
}
