import type React from "react"
import type { Metadata } from "next"
import { absoluteUrl, clampDescription, getOgImages, getOgLocale, getSiteIdentity } from "@/lib/seo"

// Trang chủ. Mô tả lấy từ branding của chính deployment: cùng một image chạy cho Tuyển sinh, Research
// và Apps, nên câu mô tả tuyển sinh viết cứng ở đây trước kia bị Research phục vụ luôn.
//
// Trang này CỐ Ý để static: nó gánh phần lớn lưu lượng. Vì (dashboard)/layout.tsx là client component có
// useSearchParams(), mọi thứ dưới Suspense boundary của nó không vào được HTML tĩnh — nên structured data
// của danh mục app đặt ở /store (render động) thay vì nhân bản ở đây rồi crawler cũng không đọc được.
export async function generateMetadata(): Promise<Metadata> {
  const { title: system, description } = await getSiteIdentity()
  const canonical = absoluteUrl("/welcome")
  const desc = clampDescription(description)
  const images = getOgImages()
  return {
    title: "Trang chủ",
    description: desc,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: system,
      locale: getOgLocale(),
      title: `Trang chủ - ${system}`,
      description: desc,
      ...(canonical ? { url: canonical } : {}),
      ...(images.length ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `Trang chủ - ${system}`,
      description: desc,
      ...(images.length ? { images } : {}),
    },
  }
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
