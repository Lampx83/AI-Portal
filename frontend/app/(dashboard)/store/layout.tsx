import type React from "react"
import type { Metadata } from "next"
import {
  absoluteUrl,
  clampDescription,
  getOgImages,
  getOgLocale,
  getPublicTools,
  getSiteIdentity,
  jsonLdScript,
} from "@/lib/seo"

const PAGE_NAME = "Kho ứng dụng"

/**
 * Rendered per request rather than prerendered. The (dashboard) layout is a client component that calls
 * useSearchParams(), so on a statically prerendered route everything below its Suspense boundary — this
 * layout's structured data included — is deferred to the client and never reaches the served HTML.
 * The catalogue graph below is the whole point of this page for a crawler, so it has to be in the HTML.
 * /welcome is deliberately left static: it carries the bulk of the traffic and the same trade is not worth it there.
 */
export const dynamic = "force-dynamic"

/**
 * The app catalogue. /tools redirects here and the sitemap points at it, but the route had no metadata
 * of its own, so it inherited the site title and shipped no description at all.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [{ title: system }, tools] = await Promise.all([getSiteIdentity(), getPublicTools()])
  const canonical = absoluteUrl("/store")
  const names = tools
    .map((t) => t.name)
    .filter(Boolean)
    .slice(0, 8)
    .join(", ")
  const description = clampDescription(
    names
      ? `Kho ứng dụng AI của ${system}: ${names}.`
      : `Kho ứng dụng AI của ${system}.`
  )
  const images = getOgImages()
  return {
    title: PAGE_NAME,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
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

/** The catalogue as data, since the page that renders it is client-side only. */
async function storeStructuredData() {
  const [{ title: system }, tools] = await Promise.all([getSiteIdentity(), getPublicTools()])
  const canonical = absoluteUrl("/store")
  const homeUrl = absoluteUrl("/welcome")
  const graph: Record<string, unknown>[] = [
    {
      "@type": "CollectionPage",
      ...(canonical ? { "@id": `${canonical}#webpage`, url: canonical } : {}),
      name: `${PAGE_NAME} - ${system}`,
      ...(tools.length
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: tools.length,
              itemListElement: tools.map((tool, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "SoftwareApplication",
                  name: tool.name,
                  ...(tool.description ? { description: tool.description } : {}),
                  applicationCategory: "WebApplication",
                  operatingSystem: "Any",
                  isAccessibleForFree: true,
                  url: absoluteUrl(`/tools/${tool.alias}`) || undefined,
                },
              })),
            },
          }
        : {}),
    },
  ]
  if (canonical && homeUrl) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: system, item: homeUrl },
        { "@type": "ListItem", position: 2, name: PAGE_NAME, item: canonical },
      ],
    })
  }
  return { "@context": "https://schema.org", "@graph": graph }
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = jsonLdScript(await storeStructuredData())
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {children}
    </>
  )
}
