import type { MetadataRoute } from "next"
import { getAppUrl } from "@/lib/server-branding"

export const revalidate = 3600 // làm mới sitemap mỗi giờ

/** Lấy alias các app công khai (tool global, không cần đăng nhập). */
async function getPublicToolAliases(): Promise<string[]> {
  try {
    const backend = process.env.BACKEND_URL || "http://backend:3001"
    const res = await fetch(`${backend}/api/tools`, { cache: "no-store" })
    if (!res.ok) return []
    const data = (await res.json()) as Array<{ alias?: string }>
    if (!Array.isArray(data)) return []
    return data.map((t) => t?.alias).filter((a): a is string => typeof a === "string" && a.length > 0)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getAppUrl()
  if (!appUrl) return []
  const now = new Date()
  const aliases = await getPublicToolAliases()
  return [
    { url: `${appUrl}/welcome`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...aliases.map((alias) => ({
      url: `${appUrl}/tools/${alias}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]
}
