import type { MetadataRoute } from "next"
import { absoluteUrl, getPublicTools } from "@/lib/seo"
import { getAppUrl } from "@/lib/server-branding"

export const revalidate = 3600 // làm mới sitemap mỗi giờ

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!getAppUrl()) return []
  const now = new Date()
  const tools = await getPublicTools()
  return [
    { url: absoluteUrl("/welcome"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    // /store là trang danh mục app — /tools chỉ redirect về đây nên không đưa /tools vào sitemap.
    { url: absoluteUrl("/store"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/guide"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...tools.map((tool) => ({
      url: absoluteUrl(`/tools/${tool.alias}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]
}
