import type { MetadataRoute } from "next"
import { getAppUrl } from "@/lib/server-branding"

// Robots cho app. Lưu ý: crawler chỉ đọc robots.txt ở GỐC domain (https://ai.neu.edu.vn/robots.txt).
// File này phục vụ ở <basePath>/robots.txt nên chỉ có tác dụng tham chiếu sitemap và cho property
// URL-prefix trong Search Console — gateway vẫn phải phục vụ một robots.txt ở gốc domain.
export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl()
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  const p = (s: string) => `${basePath}${s}`
  return {
    rules: [
      {
        userAgent: "*",
        allow: [p("/"), p("/welcome"), p("/store"), p("/guide"), p("/tools/")],
        disallow: [
          p("/admin"),
          p("/api/"),
          p("/login"),
          p("/setup"),
          p("/profile"),
          p("/error"),
          // Embed target của iframe: nội dung trùng với /tools/<alias>, không nên index riêng.
          p("/embed/"),
          p("/assistant-embed/"),
          // Tài liệu nội bộ cho dev.
          p("/dev/"),
          p("/devs/"),
          p("/dev-guide"),
        ],
      },
    ],
    ...(appUrl ? { sitemap: `${appUrl}/sitemap.xml` } : {}),
  }
}
