"use client"

import { useState, useEffect } from "react"
import { ExternalLink } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { getGuidePageConfig } from "@/lib/api/pages"
import { getIconComponent, type IconName } from "@/lib/assistants"

const CARD_ICON_FALLBACKS: IconName[] = ["BookOpen", "FolderOpen", "FileText", "MessageCircle", "Sparkles"]
const AI_PORTAL_URL = "https://ai-portal-nine.vercel.app/"
const GUIDE_PAGE_CACHE_KEY = "guide-page-config-v1"

type GuideCard = { title: string; description: string; icon?: string }
type GuidePageState = {
  title: string
  subtitle: string
  cards: GuideCard[]
}

function normalizeGuideDescription(input: unknown): string {
  if (typeof input !== "string") return ""
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
}

export function HelpGuideView() {
  const [pageConfig, setPageConfig] = useState<GuidePageState | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    try {
      const cached = localStorage.getItem(GUIDE_PAGE_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as GuidePageState
        if (parsed && Array.isArray(parsed.cards)) {
          setPageConfig(parsed)
        }
      }
    } catch {
      // ignore cache read errors
    }

    getGuidePageConfig()
      .then((data) => {
        const normalized: GuidePageState = {
          title: typeof data.title === "string" ? data.title : "",
          subtitle: typeof data.subtitle === "string" ? data.subtitle : "",
          cards: Array.isArray(data.cards) ? data.cards : [],
        }
        setPageConfig(normalized)
        try {
          localStorage.setItem(GUIDE_PAGE_CACHE_KEY, JSON.stringify(normalized))
        } catch {
          // ignore cache write errors
        }
      })
      .catch(() => {
        setPageConfig((prev) => prev ?? { title: "", subtitle: "", cards: [] })
      })
  }, [])

  const title = pageConfig?.title != null && pageConfig.title !== "" ? pageConfig.title : t("guide.title")
  const subtitle = pageConfig?.subtitle != null && pageConfig.subtitle !== "" ? pageConfig.subtitle : t("guide.subtitle")
  const cards = pageConfig?.cards ?? []

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        </div>

        <div className="space-y-4">
          {cards.map((card, index) => {
            const fallbackIconName = CARD_ICON_FALLBACKS[index % CARD_ICON_FALLBACKS.length]
            const iconName = (typeof card.icon === "string" && card.icon.trim() ? card.icon.trim() : fallbackIconName) as IconName
            const Icon = getIconComponent(iconName)
            const descriptionText = normalizeGuideDescription(card.description)
            return (
              <section key={index} className="px-1 py-2">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0 text-primary" />
                  <span>{card.title || "\u00A0"}</span>
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground whitespace-pre-line">
                  {descriptionText || "\u00A0"}
                </p>
              </section>
            )
          })}
        </div>

        {/* Giới thiệu AI Portal & phiên bản — đặt ở cuối hướng dẫn */}
        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t("about.version")}: <strong className="text-foreground">{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}</strong>
            </p>
            {process.env.NEXT_PUBLIC_BUILD_TIME && (
              <p>
                {t("about.buildTime")}: <strong className="text-foreground">{process.env.NEXT_PUBLIC_BUILD_TIME}</strong>
              </p>
            )}
            <p className="pt-2">
              {t("about.builtWith")}{" "}
              <a
                href={AI_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                AI Portal
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              — {t("about.builtWithDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
