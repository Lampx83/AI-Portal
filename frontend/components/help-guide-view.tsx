"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle, BookOpen, FolderOpen, FileText, MessageCircle, Sparkles } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { getGuidePageConfig } from "@/lib/api/pages"

const CARD_ICONS = [BookOpen, FolderOpen, FileText, MessageCircle, Sparkles] as const

export function HelpGuideView() {
  const [pageConfig, setPageConfig] = useState<{ title: string; subtitle: string; cards: { title: string; description: string }[] } | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    getGuidePageConfig().then(setPageConfig).catch(() => setPageConfig({ title: "", subtitle: "", cards: [] }))
  }, [])

  const title = pageConfig?.title != null && pageConfig.title !== "" ? pageConfig.title : t("guide.title")
  const subtitle = pageConfig?.subtitle != null && pageConfig.subtitle !== "" ? pageConfig.subtitle : t("guide.subtitle")
  const cards = pageConfig?.cards ?? []

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HelpCircle className="w-6 h-6" />
            {title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card, index) => {
            const Icon = CARD_ICONS[index % CARD_ICONS.length]
            return (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="w-5 h-5 shrink-0" />
                    {card.title || "\u00A0"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{card.description || "\u00A0"}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
