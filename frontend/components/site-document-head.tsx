"use client"

import { useEffect } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useBranding } from "@/contexts/branding-context"

const DEFAULT_TITLE = "AI Portal"
const DEFAULT_DESCRIPTION = "AI Portal: quản lý dự án, trợ lý ảo, tìm kiếm tài liệu và cộng tác."
const DEFAULT_KEYWORDS = "AI, AI Portal, trợ lý ảo, quản lý dự án, tìm kiếm tài liệu"
const DEFAULT_AUTHOR = "AI Portal"

/** Cập nhật document.title và meta tags. Title = tên hệ thống (branding) nếu có, không thì app.title. */
export function SiteDocumentHead() {
  const { locale, siteStrings } = useLanguage()
  const { branding, loaded: brandingLoaded } = useBranding()
  const systemTitle =
    brandingLoaded && branding.systemName?.trim()
      ? branding.systemName.trim()
      : (siteStrings["app.title"] ?? DEFAULT_TITLE)

  useEffect(() => {
    const title = systemTitle
    const description = siteStrings["app.description"] ?? DEFAULT_DESCRIPTION
    const keywords = siteStrings["app.keywords"] ?? DEFAULT_KEYWORDS
    const author = siteStrings["app.author"] ?? DEFAULT_AUTHOR

    document.title = title

    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute("content", description)
    const metaKw = document.querySelector('meta[name="keywords"]')
    if (metaKw) metaKw.setAttribute("content", keywords)
    const metaAuthor = document.querySelector('meta[name="author"]')
    if (metaAuthor) metaAuthor.setAttribute("content", author)
    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute("content", title)
    const ogDesc = document.querySelector('meta[property="og:description"]')
    if (ogDesc) ogDesc.setAttribute("content", description)
    const twTitle = document.querySelector('meta[name="twitter:title"]')
    if (twTitle) twTitle.setAttribute("content", title)
    const twDesc = document.querySelector('meta[name="twitter:description"]')
    if (twDesc) twDesc.setAttribute("content", description)
  }, [locale, siteStrings, systemTitle])

  return null
}
