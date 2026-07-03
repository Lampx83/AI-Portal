import type React from "react"
import type { Metadata } from "next"
import { getSystemTitle, getAppUrl } from "@/lib/server-branding"

// Trang chủ: "Trang chủ - ‹Hệ thống…›".
export async function generateMetadata(): Promise<Metadata> {
  const system = await getSystemTitle()
  const appUrl = getAppUrl()
  const title = `Trang chủ - ${system}`
  const description =
    "Cổng thông tin và công cụ AI hỗ trợ tuyển sinh đại học chính quy Đại học Kinh tế Quốc dân (NEU): tra cứu hồ sơ, quy đổi điểm, dự đoán điểm chuẩn, tra cứu chương trình đào tạo."
  const canonical = appUrl ? `${appUrl}/welcome` : undefined
  const ogImage = appUrl ? `${appUrl}/android-chrome-512x512.png` : undefined
  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      title,
      description,
      ...(canonical ? { url: canonical } : {}),
      ...(ogImage ? { images: [{ url: ogImage, width: 512, height: 512, alt: title }] } : {}),
    },
  }
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
