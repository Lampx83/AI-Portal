import type { MetadataRoute } from "next"
import { getAppUrl } from "@/lib/server-branding"

// Robots cho app tuyển sinh. Lưu ý: crawler đọc robots.txt ở gốc domain
// (https://ai.neu.edu.vn/robots.txt) — file này phục vụ ở /tuyen-sinh/robots.txt,
// chủ yếu để tham chiếu sitemap và cho property URL-prefix trong Search Console.
export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl()
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  const p = (s: string) => `${basePath}${s}`
  return {
    rules: [
      {
        userAgent: "*",
        allow: [p("/"), p("/welcome"), p("/tools")],
        disallow: [
          p("/admin"),
          p("/api/"),
          p("/login"),
          p("/setup"),
          p("/profile"),
          p("/embed/"),
          p("/assistant-embed/"),
        ],
      },
    ],
    ...(appUrl ? { sitemap: `${appUrl}/sitemap.xml` } : {}),
  }
}
