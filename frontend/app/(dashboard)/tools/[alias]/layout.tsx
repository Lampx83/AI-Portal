import type React from "react"
import type { Metadata } from "next"
import {
  absoluteUrl,
  clampDescription,
  getOgImages,
  getOgLocale,
  getOrganization,
  getPublicTool,
  getSiteIdentity,
  jsonLdScript,
} from "@/lib/seo"

// Tiêu đề tab đổi theo app đang mở: "‹Tên app› - ‹Hệ thống…›" (hậu tố do title.template ở root layout).
// Dùng metadata của Next (thay vì document.title client) để không bị App Router ghi đè.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ alias: string }>
}): Promise<Metadata> {
  const { alias } = await params
  const [{ title: system }, tool] = await Promise.all([getSiteIdentity(), getPublicTool(alias)])
  // Alias không tồn tại: absolute để bỏ qua title.template của root, tránh lặp tên hệ thống hai lần.
  if (!tool) return { title: { absolute: system }, robots: { index: false, follow: true } }
  const canonical = absoluteUrl(`/tools/${alias}`)
  // Mô tả thật của app (manifest.json), thay cho câu mô tả chung chung viết cứng trước kia.
  const description = tool.description ? clampDescription(tool.description) : undefined
  const images = getOgImages()
  return {
    title: tool.name,
    ...(description ? { description } : {}),
    ...(tool.keywords?.length ? { keywords: tool.keywords } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: system,
      locale: getOgLocale(),
      title: `${tool.name} - ${system}`,
      ...(description ? { description } : {}),
      ...(canonical ? { url: canonical } : {}),
      ...(images.length ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${tool.name} - ${system}`,
      ...(description ? { description } : {}),
      ...(images.length ? { images } : {}),
    },
  }
}

/**
 * The app itself renders inside an iframe, so this URL's own document has nothing for a crawler to read.
 * Describe the app as SoftwareApplication instead, plus a breadcrumb back to the catalogue.
 */
async function toolStructuredData(alias: string) {
  const [{ title: system }, tool] = await Promise.all([getSiteIdentity(), getPublicTool(alias)])
  if (!tool) return null
  const canonical = absoluteUrl(`/tools/${alias}`)
  const org = getOrganization()
  const graph: Record<string, unknown>[] = [
    {
      "@type": "SoftwareApplication",
      ...(canonical ? { "@id": `${canonical}#app`, url: canonical } : {}),
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
      applicationCategory: "WebApplication",
      operatingSystem: "Any",
      ...(tool.version ? { softwareVersion: tool.version } : {}),
      ...(tool.keywords?.length ? { keywords: tool.keywords.join(", ") } : {}),
      ...(tool.capabilities?.length ? { featureList: tool.capabilities } : {}),
      isAccessibleForFree: true,
      // Free tools still need an offer for the price to be stated at all.
      offers: { "@type": "Offer", price: "0", priceCurrency: "VND" },
      publisher: { "@type": "Organization", name: tool.developer || org.name, url: org.url },
      ...(system ? { isPartOf: { "@type": "WebSite", name: system } } : {}),
    },
  ]
  const storeUrl = absoluteUrl("/store")
  const homeUrl = absoluteUrl("/welcome")
  if (canonical && storeUrl && homeUrl) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: system, item: homeUrl },
        { "@type": "ListItem", position: 2, name: "Kho ứng dụng", item: storeUrl },
        { "@type": "ListItem", position: 3, name: tool.name, item: canonical },
      ],
    })
  }
  return { "@context": "https://schema.org", "@graph": graph }
}

export default async function ToolAliasLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ alias: string }>
}) {
  const { alias } = await params
  const data = await toolStructuredData(alias)
  return (
    <>
      {data && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />}
      {children}
    </>
  )
}
