"use client"

import { useEffect } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useBranding } from "@/contexts/branding-context"

const DEFAULT_TITLE = "AI Portal"
const DEFAULT_DESCRIPTION = "AI Portal: quản lý dự án, trợ lý ảo, tìm kiếm tài liệu và cộng tác."
const DEFAULT_KEYWORDS = "AI, AI Portal, trợ lý ảo, quản lý dự án, tìm kiếm tài liệu"
const DEFAULT_AUTHOR = "AI Portal"

/** Cập nhật document.title và meta tags. Title = tên hệ thống (branding), description = tiêu đề phụ (systemSubtitle) nếu có. */
export function SiteDocumentHead() {
  const { locale, siteStrings } = useLanguage()
  const { branding, loaded: brandingLoaded } = useBranding()
  const hasBrandingTitle = brandingLoaded && Boolean(branding.systemName?.trim())
  const fallbackTitle = siteStrings["app.title"] ?? DEFAULT_TITLE
  const systemTitle =
    hasBrandingTitle
      ? branding.systemName.trim()
      : fallbackTitle
  const systemDescription =
    brandingLoaded && branding.systemSubtitle?.trim()
      ? branding.systemSubtitle.trim()
      : (siteStrings["app.description"] ?? DEFAULT_DESCRIPTION)

  useEffect(() => {
    const title = systemTitle
    const description = systemDescription
    const keywords = siteStrings["app.keywords"] ?? DEFAULT_KEYWORDS
    const author = siteStrings["app.author"] ?? DEFAULT_AUTHOR

    // Nếu vòng render hiện tại chỉ có fallback (chưa có branding thật), không ghi đè title đã có.
    // Điều này ngăn title bị "đổi ngược" về AI Portal sau hydration hoặc khi API tạm fail.
    const wouldOverwriteWithFallback =
      !hasBrandingTitle &&
      typeof document !== "undefined" &&
      document.title &&
      document.title !== title &&
      (title === DEFAULT_TITLE || title === fallbackTitle)
    const effectiveTitle = wouldOverwriteWithFallback ? document.title : title
    if (!wouldOverwriteWithFallback) {
      document.title = title
    }

    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute("content", description)
    const metaKw = document.querySelector('meta[name="keywords"]')
    if (metaKw) metaKw.setAttribute("content", keywords)
    const metaAuthor = document.querySelector('meta[name="author"]')
    if (metaAuthor) metaAuthor.setAttribute("content", author)
    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute("content", effectiveTitle)
    const ogDesc = document.querySelector('meta[property="og:description"]')
    if (ogDesc) ogDesc.setAttribute("content", description)
    const twTitle = document.querySelector('meta[name="twitter:title"]')
    if (twTitle) twTitle.setAttribute("content", effectiveTitle)
    const twDesc = document.querySelector('meta[name="twitter:description"]')
    if (twDesc) twDesc.setAttribute("content", description)
  }, [locale, siteStrings, systemTitle, systemDescription, hasBrandingTitle, fallbackTitle])

  return null
}
