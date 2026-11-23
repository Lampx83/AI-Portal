import type { MetadataRoute } from "next"
import { absoluteUrl, getPublicTools } from "@/lib/seo"
import { getAppUrl } from "@/lib/server-branding"

export const revalidate = 3600 // làm mới sitemap mỗi giờ

// Cố ý KHÔNG đặt lastModified: trước đây luôn là "bây giờ" nên Google nhận <lastmod> sai sự thật ở mọi
// lần tải và học cách bỏ qua trường này. Không có ngày thật thì bỏ hẳn — đúng khuyến nghị của Google.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!getAppUrl()) return []
  const tools = await getPublicTools()
  return [
    { url: absoluteUrl("/welcome"), changeFrequency: "weekly", priority: 1 },
    // /store là trang danh mục app — /tools chỉ redirect về đây nên không đưa /tools vào sitemap.
    { url: absoluteUrl("/store"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/guide"), changeFrequency: "monthly", priority: 0.5 },
    ...tools.map((tool) => ({
      url: absoluteUrl(`/tools/${tool.alias}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]
}
