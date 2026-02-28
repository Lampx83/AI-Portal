"use client"

import { useEffect } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useBranding } from "@/contexts/branding-context"

const DEFAULT_TITLE = "AI Portal"
const DEFAULT_DESCRIPTION = "AI Portal: quản lý dự án, trợ lý ảo, tìm kiếm tài liệu và cộng tác."
const DEFAULT_KEYWORDS = "AI, AI Portal, trợ lý ảo, quản lý dự án, tìm kiếm tài liệu"
const DEFAULT_AUTHOR = "AI Portal"

const LOADING_TITLES = ["loading", "loading…", "đang tải", "đang tải…"]

function isStableTitle(s: string): boolean {
  const lower = s.trim().toLowerCase()
  if (!lower) return false
  return !LOADING_TITLES.some((t) => lower === t || lower.startsWith(t + " "))
}

/** Cập nhật document.title và meta tags. Title = tên hệ thống (branding), description = tiêu đề phụ (systemSubtitle) nếu có. Chỉ cập nhật title khi có giá trị chắc chắn, tránh ghi đè title SSR với "AI Portal" hoặc "Loading" khi đang load. */
export function SiteDocumentHead() {
  const { locale, siteStrings } = useLanguage()
  const { branding, loaded: brandingLoaded } = useBranding()

  const stableTitle =
    brandingLoaded && branding.systemName?.trim()
      ? branding.systemName.trim()
      : typeof siteStrings["app.title"] === "string" && siteStrings["app.title"].trim()
        ? siteStrings["app.title"].trim()
        : null

  const systemTitle = stableTitle ?? DEFAULT_TITLE
  const systemDescription =
    brandingLoaded && branding.systemSubtitle?.trim()
      ? branding.systemSubtitle.trim()
      : (siteStrings["app.description"] ?? DEFAULT_DESCRIPTION)

  useEffect(() => {
    const description = systemDescription
    const keywords = siteStrings["app.keywords"] ?? DEFAULT_KEYWORDS
    const author = siteStrings["app.author"] ?? DEFAULT_AUTHOR

    // Chỉ cập nhật title khi có giá trị chắc chắn (từ branding hoặc siteStrings). Khi chưa load xong, giữ nguyên title từ SSR để tránh flash "Loading" / "AI Portal".
    if (stableTitle != null && isStableTitle(stableTitle)) {
      document.title = stableTitle
    }

    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute("content", description)
    const metaKw = document.querySelector('meta[name="keywords"]')
    if (metaKw) metaKw.setAttribute("content", keywords)
    const metaAuthor = document.querySelector('meta[name="author"]')
    if (metaAuthor) metaAuthor.setAttribute("content", author)
    const metaTitle = stableTitle ?? systemTitle
    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute("content", metaTitle)
    const ogDesc = document.querySelector('meta[property="og:description"]')
    if (ogDesc) ogDesc.setAttribute("content", description)
    const twTitle = document.querySelector('meta[name="twitter:title"]')
    if (twTitle) twTitle.setAttribute("content", metaTitle)
    const twDesc = document.querySelector('meta[name="twitter:description"]')
    if (twDesc) twDesc.setAttribute("content", description)
  }, [locale, siteStrings, stableTitle, systemDescription])

  return null
}
