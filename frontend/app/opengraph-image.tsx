import { ImageResponse } from "next/og"
import { getOrganization, getSiteIdentity } from "@/lib/seo"

// Ảnh preview khi chia sẻ link (Facebook, Zalo, X, Slack…). Trước đây dùng android-chrome-512x512.png:
// icon vuông 512 đi kèm card "summary_large_image" nên bị cắt/hiện lệch. 1200×630 là tỉ lệ chuẩn.
// File convention: Next tự gắn og:image + twitter:image cho mọi route bên dưới.
export const runtime = "nodejs"
export const revalidate = 3600
export const alt = "Open Graph image"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpengraphImage() {
  const { title, description } = await getSiteIdentity()
  const org = getOrganization()
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0b3b6f 0%, #10508f 55%, #1668b8 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, opacity: 0.85, letterSpacing: 1 }}>
          {org.alternateName ? `${org.alternateName} · ${org.name}` : org.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: title.length > 40 ? 64 : 82, fontWeight: 700, lineHeight: 1.12 }}>
            {title}
          </div>
          {description ? (
            <div style={{ display: "flex", marginTop: 28, fontSize: 34, lineHeight: 1.35, opacity: 0.9 }}>
              {description.length > 140 ? `${description.slice(0, 139)}…` : description}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", width: 90, height: 7, background: "#ffffff", opacity: 0.9 }} />
        </div>
      </div>
    ),
    size
  )
}
