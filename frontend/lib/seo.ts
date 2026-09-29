// lib/seo.ts — Server-only SEO helpers shared by the root layout, the page layouts, robots and sitemap.
// No window/client access: everything here runs during SSR / metadata generation.
//
// Two rules this file exists to enforce:
//  1. Nothing describing the site is hardcoded per deployment. The same image runs as Tuyển sinh,
//     Research and Apps, so copy comes from branding (Admin → Cài đặt) or env, never from a literal
//     baked into a route. A hardcoded admissions blurb would be served by the Research site too.
//  2. Every app describes itself once, in its manifest.json, and that text feeds the Store, the page
//     <meta description> and the structured data alike.

import { getAppUrl, getBrandingForMetadata, getDefaultDescription, getDefaultTitle } from "./server-branding"

/** Google truncates around 160 chars; keep descriptions under it and cut on a word boundary. */
const META_DESCRIPTION_MAX = 160

/** Trim to `max` chars without splitting a word, appending an ellipsis when anything was cut. */
export function clampDescription(text: string, max: number = META_DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\-–—]$/, "")}…`
}

/** BCP-47 language of the site content, e.g. "vi". Used for <html lang> and inLanguage. */
export function getHtmlLang(): string {
  return (process.env.PORTAL_SEO_LANG || "vi").trim() || "vi"
}

/** Open Graph locale, e.g. "vi_VN". */
export function getOgLocale(): string {
  const explicit = (process.env.PORTAL_SEO_LOCALE || "").trim()
  if (explicit) return explicit
  const lang = getHtmlLang()
  return lang === "vi" ? "vi_VN" : lang.replace("-", "_")
}

/** Publisher shown in Organization structured data. Overridable so non-NEU deployments stay correct. */
export function getOrganization(): { name: string; url: string; alternateName?: string } {
  const name = (process.env.PORTAL_ORG_NAME || "Đại học Kinh tế Quốc dân").trim()
  const url = (process.env.PORTAL_ORG_URL || "https://neu.edu.vn").trim()
  const alternateName = (process.env.PORTAL_ORG_SHORT_NAME || "NEU").trim() || undefined
  return { name, url, alternateName }
}

/**
 * Site-wide keywords. Empty by default: the tag carries no ranking weight, and the stale generic list
 * that used to be hardcoded here ("project management, document search") described none of the
 * deployments. Set PORTAL_SEO_KEYWORDS to opt back in.
 */
export function getSiteKeywords(): string[] {
  return (process.env.PORTAL_SEO_KEYWORDS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
}

export type SiteIdentity = { title: string; description: string; appUrl: string }

/** System name + tagline as configured for this deployment, falling back to env, then to a generic default. */
export async function getSiteIdentity(): Promise<SiteIdentity> {
  const { systemName, systemSubtitle } = await getBrandingForMetadata()
  return {
    title: systemName || getDefaultTitle(),
    description: systemSubtitle || getDefaultDescription(),
    appUrl: getAppUrl(),
  }
}

/** Absolute URL for a route path ("/store" → "https://host/basePath/store"). Empty when APP_URL is unset. */
export function absoluteUrl(routePath: string): string {
  const appUrl = getAppUrl()
  if (!appUrl) return ""
  return `${appUrl}${routePath.startsWith("/") ? routePath : `/${routePath}`}`
}

/**
 * The generated 1200×630 card from app/opengraph-image.tsx.
 *
 * Next injects that file-convention image automatically, but ONLY into routes that do not declare an
 * `openGraph` object of their own — declaring one replaces it wholesale. Every page here sets its own
 * title/description, so each must pass these images back explicitly or it ships no preview image at all.
 */
export function getOgImages(): { url: string; width: number; height: number; alt: string }[] {
  const url = absoluteUrl("/opengraph-image")
  if (!url) return []
  return [{ url, width: 1200, height: 630, alt: "Open Graph image" }]
}

export type PublicTool = {
  alias: string
  name: string
  description?: string
  keywords?: string[]
  version?: string
  developer?: string
  capabilities?: string[]
  category_name?: string | null
}

function backendBaseUrl(): string {
  // Same reasoning as server-branding: always the internal address. Calling the public hostname from
  // inside the container hangs on a TCP timeout (hairpin NAT) and stalls every SSR render.
  return (process.env.BACKEND_URL || "http://backend:3001").replace(/\/+$/, "")
}

/**
 * Apps visible to anonymous visitors (global tools; no session cookie is sent, so nothing user-installed
 * leaks in). Revalidated rather than no-store: this runs on crawler traffic and must not hit the DB per
 * request. Returns [] on any failure so a slow backend degrades the metadata instead of the page.
 */
export async function getPublicTools(): Promise<PublicTool[]> {
  try {
    const res = await fetch(`${backendBaseUrl()}/api/tools?full=1`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as PublicTool[]
    if (!Array.isArray(data)) return []
    return data.filter((t) => typeof t?.alias === "string" && t.alias.length > 0)
  } catch {
    return []
  }
}

/** One public app by alias, or null when it does not exist / the backend is unreachable. */
export async function getPublicTool(alias: string): Promise<PublicTool | null> {
  if (!alias || alias.includes("/") || alias.includes("..")) return null
  try {
    const res = await fetch(`${backendBaseUrl()}/api/tools/${encodeURIComponent(alias)}`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as PublicTool
    return typeof data?.alias === "string" ? data : null
  } catch {
    return null
  }
}

/** Serialize JSON-LD for a <script> tag, escaping "<" so the payload cannot terminate the element. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}
