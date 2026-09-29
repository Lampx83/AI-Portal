import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { RootBody } from "@/app/root-body"
import { getAppUrl } from "@/lib/server-branding"
import {
  clampDescription,
  getHtmlLang,
  getOgLocale,
  getOrganization,
  getOgImages,
  getSiteIdentity,
  getSiteKeywords,
  jsonLdScript,
} from "@/lib/seo"

const inter = Inter({ subsets: ["latin", "vietnamese"] })

// Google Analytics 4 (GA4). ID lấy từ NEXT_PUBLIC_GA_MEASUREMENT_ID (mặc định set ở next.config).
// Chỉ nhúng tag khi ID hợp lệ dạng "G-XXXXXXX"; để rỗng là tắt hẳn.
const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim()
const GA_ENABLED = /^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)
const gaInitScript = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
`

const THEME_STORAGE_KEY = "neu-ui-theme"
const BRAND_COLOR_STORAGE_KEY = "portal_theme_color"

const noFlashScript = `
(function() {
  try {
    var key = '${THEME_STORAGE_KEY}';
    var stored = localStorage.getItem(key);
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var theme = stored || 'system';
    var clazz = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : (mq.matches ? 'dark' : 'light');
    var root = document.documentElement;
    root.classList.remove('light','dark');
    root.classList.add(clazz);
  } catch (e) {}
})();
`

const brandColorScript = `
(function() {
  try {
    var c = localStorage.getItem('${BRAND_COLOR_STORAGE_KEY}');
    if (c && /^#[0-9A-Fa-f]{6}$/.test(c)) {
      document.documentElement.style.setProperty('--brand', c);
    }
  } catch (e) {}
})();
`

const safePerformanceMeasureScript = `
(function() {
  try {
    if (typeof window === 'undefined' || !window.performance || typeof window.performance.measure !== 'function') return;
    var originalMeasure = window.performance.measure.bind(window.performance);
    window.performance.measure = function() {
      try {
        return originalMeasure.apply(null, arguments);
      } catch (error) {
        var message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
        if (
          error instanceof TypeError &&
          message.indexOf("Failed to execute 'measure' on 'Performance'") !== -1 &&
          message.indexOf('negative time stamp') !== -1
        ) {
          // Ignore known browser/runtime timing bug to avoid crashing the app.
          return undefined;
        }
        throw error;
      }
    };
  } catch (_e) {}
})();
`

export async function generateMetadata(): Promise<Metadata> {
  const { title, description, appUrl } = await getSiteIdentity()
  const keywords = getSiteKeywords()
  const images = getOgImages()
  return {
    // Every nested page sets its own title; this template keeps the system name as the suffix.
    title: { default: title, template: `%s - ${title}` },
    description: clampDescription(description),
    applicationName: title,
    ...(keywords.length ? { keywords } : {}),
    ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
    ...(appUrl ? { alternates: { canonical: `${appUrl}/welcome` } } : {}),
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    openGraph: {
      type: "website",
      siteName: title,
      locale: getOgLocale(),
      title,
      description: clampDescription(description),
      ...(appUrl ? { url: appUrl } : {}),
      ...(images.length ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: clampDescription(description),
      ...(images.length ? { images } : {}),
    },
  }
}

const structuredData = async () => {
  const appUrl = getAppUrl()
  const { title: systemName } = await getSiteIdentity()
  const org = getOrganization()
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        ...(appUrl ? { "@id": `${appUrl}/#website`, url: appUrl } : {}),
        name: systemName,
        inLanguage: getHtmlLang(),
        ...(appUrl ? { publisher: { "@id": `${appUrl}/#organization` } } : {}),
      },
      {
        "@type": "Organization",
        ...(appUrl ? { "@id": `${appUrl}/#organization` } : {}),
        name: org.name,
        ...(org.alternateName ? { alternateName: org.alternateName } : {}),
        url: org.url,
        ...(appUrl ? { logo: `${appUrl}/android-chrome-512x512.png` } : {}),
      },
    ],
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  const asset = (p: string) => (basePath ? `${basePath}${p.startsWith("/") ? p : "/" + p}` : p.startsWith("/") ? p : "/" + p)
  const jsonLd = jsonLdScript(await structuredData())
  return (
    <html lang={getHtmlLang()} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <link rel="icon" href={asset("/favicon.ico")} sizes="any" />
        <link rel="icon" type="image/svg+xml" href={asset("/favicon.svg")} />
        <link rel="apple-touch-icon" href={asset("/apple-touch-icon.png")} />
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        <script dangerouslySetInnerHTML={{ __html: brandColorScript }} />
        <script dangerouslySetInnerHTML={{ __html: safePerformanceMeasureScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        {GA_ENABLED && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
            <script dangerouslySetInnerHTML={{ __html: gaInitScript }} />
          </>
        )}
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <RootBody>{children}</RootBody>
      </body>
    </html>
  )
}
