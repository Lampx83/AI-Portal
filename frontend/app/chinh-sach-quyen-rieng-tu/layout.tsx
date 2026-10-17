import type React from "react"
import type { Metadata } from "next"
import { absoluteUrl, getOgImages, getOgLocale, getSiteIdentity } from "@/lib/seo"
import { PRIVACY_POLICY_PATH } from "@/lib/research-terms"

// Metadata render phía server, trước khi LanguageProvider mount → tiêu đề song ngữ trung lập (như app/login/layout.tsx).
const PAGE_NAME = "Chính sách quyền riêng tư / Privacy policy"

export async function generateMetadata(): Promise<Metadata> {
  const { title: system } = await getSiteIdentity()
  const canonical = absoluteUrl(PRIVACY_POLICY_PATH)
  const images = getOgImages()
  return {
    title: PAGE_NAME,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "article",
      siteName: system,
      locale: getOgLocale(),
      title: `${PAGE_NAME} - ${system}`,
      ...(canonical ? { url: canonical } : {}),
      ...(images.length ? { images } : {}),
    },
  }
}

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children
}
