import type { MetadataRoute } from "next"
import { getSiteIdentity } from "@/lib/seo"

export const revalidate = 3600

/**
 * Replaces the static public/site.webmanifest, which shipped an empty `name`/`short_name` and icon
 * paths without the deployment's basePath — so under /tuyen-sinh the icons 404'd and the install
 * prompt had no title. Generating it lets both follow the configured branding.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { title, description } = await getSiteIdentity()
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  const asset = (p: string) => `${basePath}${p}`
  return {
    name: title,
    // Home-screen labels are clipped around 12 chars; keep the short name from being truncated mid-word.
    short_name: title.length <= 12 ? title : title.slice(0, 12).trimEnd(),
    description,
    start_url: `${basePath || ""}/welcome`,
    scope: `${basePath || ""}/`,
    display: "standalone",
    theme_color: "#ffffff",
    background_color: "#ffffff",
    icons: [
      { src: asset("/android-chrome-192x192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: asset("/android-chrome-512x512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: asset("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" },
    ],
  }
}
