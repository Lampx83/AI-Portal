import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { RootBody } from "@/app/root-body"
import {
  getBrandingForMetadata,
  getDefaultTitle,
  getDefaultDescription,
} from "@/lib/server-branding"

const inter = Inter({ subsets: ["latin"] })

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

export async function generateMetadata(): Promise<Metadata> {
  const defaultTitle = getDefaultTitle()
  const defaultDescription = getDefaultDescription()
  const { systemName, systemSubtitle } = await getBrandingForMetadata()
  const title = systemName || defaultTitle
  const description = systemSubtitle || defaultDescription
  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="keywords" content="AI, AI Portal, virtual assistant, project management, document search" />
        <meta name="author" content="AI Portal" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        <script dangerouslySetInnerHTML={{ __html: brandColorScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <RootBody>{children}</RootBody>
      </body>
    </html>
  )
}
