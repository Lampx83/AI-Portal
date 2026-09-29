import type React from "react"
import type { Metadata } from "next"
import { absoluteUrl, clampDescription, getOgImages, getOgLocale, getSiteIdentity } from "@/lib/seo"

const PAGE_NAME = "Hướng dẫn sử dụng"

export async function generateMetadata(): Promise<Metadata> {
  const { title: system } = await getSiteIdentity()
  const canonical = absoluteUrl("/guide")
  const description = clampDescription(`Hướng dẫn sử dụng ${system}: cách dùng trợ lý AI, kho ứng dụng và các tính năng chính.`)
  const images = getOgImages()
  return {
    title: PAGE_NAME,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "article",
      siteName: system,
      locale: getOgLocale(),
      title: `${PAGE_NAME} - ${system}`,
      description,
      ...(canonical ? { url: canonical } : {}),
      ...(images.length ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${PAGE_NAME} - ${system}`,
      description,
      ...(images.length ? { images } : {}),
    },
  }
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children
}
