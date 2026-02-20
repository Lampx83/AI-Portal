"use client"

import { useCallback, useEffect, useState } from "react"
import { Save, Plus, Trash2, FileText, BookOpen } from "lucide-react"
import {
  getWelcomePageConfig,
  patchWelcomePageConfig,
  getGuidePageConfig,
  patchGuidePageConfig,
  getSettingsBranding,
  type WelcomePageConfig,
  type GuidePageConfig,
} from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/contexts/language-context"

function CardEditor({
  cards,
  onChange,
  disabled,
  t,
}: {
  cards: { title: string; description: string }[]
  onChange: (cards: { title: string; description: string }[]) => void
  disabled?: boolean
  t: (key: string) => string
}) {
  const update = (index: number, field: "title" | "description", value: string) => {
    const next = [...cards]
    if (!next[index]) next[index] = { title: "", description: "" }
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }
  const add = () => onChange([...cards, { title: "", description: "" }])
  const remove = (index: number) => onChange(cards.filter((_, i) => i !== index))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t("admin.pages.cardsLabel")}</Label>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" />
          {t("admin.pages.addCard")}
        </Button>
      </div>
      <div className="space-y-3">
        {cards.map((card, index) => (
          <Card key={index}>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
              <span className="text-sm font-medium">{t("admin.pages.cardNumber").replace("{n}", String(index + 1))}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                disabled={disabled}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4 space-y-2">
              <div>
                <Label className="text-xs">{t("admin.pages.cardTitleLabel")}</Label>
                <Input
                  value={card.title}
                  onChange={(e) => update(index, "title", e.target.value)}
                  placeholder={t("admin.pages.cardTitlePlaceholder")}
                  disabled={disabled}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t("admin.pages.cardDescriptionLabel")}</Label>
                <Input
                  value={card.description}
                  onChange={(e) => update(index, "description", e.target.value)}
                  placeholder={t("admin.pages.cardDescriptionPlaceholder")}
                  disabled={disabled}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function PagesTab() {
  const { t } = useLanguage()
  const [welcome, setWelcome] = useState<WelcomePageConfig>({ title: "", subtitle: "", cards: [] })
  const [guide, setGuide] = useState<GuidePageConfig>({ title: "", subtitle: "", cards: [] })
  const [branding, setBranding] = useState<{ systemName: string; systemSubtitle?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [welcomeSaving, setWelcomeSaving] = useState(false)
  const [welcomeError, setWelcomeError] = useState<string | null>(null)
  const [guideSaving, setGuideSaving] = useState(false)
  const [guideError, setGuideError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getWelcomePageConfig(), getGuidePageConfig(), getSettingsBranding()])
      .then(([w, g, b]) => {
        setWelcome({
          title: typeof w.title === "string" ? w.title : "",
          subtitle: typeof w.subtitle === "string" ? w.subtitle : "",
          cards: Array.isArray(w.cards) ? w.cards : [],
        })
        setGuide({
          title: typeof g.title === "string" ? g.title : "",
          subtitle: typeof g.subtitle === "string" ? g.subtitle : "",
          cards: Array.isArray(g.cards) ? g.cards : [],
        })
        setBranding(b ? { systemName: b.systemName ?? "", systemSubtitle: b.systemSubtitle } : null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveWelcome = () => {
    setWelcomeError(null)
    setWelcomeSaving(true)
    patchWelcomePageConfig(welcome)
      .then(() => setWelcomeError(null))
      .catch((e: unknown) => setWelcomeError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setWelcomeSaving(false))
  }

  const saveGuide = () => {
    setGuideError(null)
    setGuideSaving(true)
    patchGuidePageConfig(guide)
      .then(() => setGuideError(null))
      .catch((e: unknown) => setGuideError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setGuideSaving(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t("admin.pages.description")}
      </p>
      <Tabs defaultValue="welcome" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="welcome" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            /welcome
          </TabsTrigger>
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            /guide
          </TabsTrigger>
        </TabsList>
        <TabsContent value="welcome" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.pages.welcomeTitle")}</CardTitle>
              <CardDescription>{t("admin.pages.welcomeDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="welcome-title">{t("admin.pages.titleLabel")}</Label>
                <Input
                  id="welcome-title"
                  value={welcome.title ?? ""}
                  onChange={(e) => setWelcome((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={branding?.systemName || t("admin.pages.titlePlaceholder")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="welcome-subtitle">{t("admin.pages.subtitleLabel")}</Label>
                <Input
                  id="welcome-subtitle"
                  value={welcome.subtitle ?? ""}
                  onChange={(e) => setWelcome((prev) => ({ ...prev, subtitle: e.target.value }))}
                  placeholder={branding?.systemSubtitle ?? t("admin.pages.subtitlePlaceholder")}
                  className="mt-1"
                />
              </div>
              <CardEditor
                cards={welcome.cards ?? []}
                onChange={(cards) => setWelcome((prev) => ({ ...prev, cards }))}
                disabled={welcomeSaving}
                t={t}
              />
              {welcomeError && (
                <p className="text-sm text-destructive">{welcomeError}</p>
              )}
              <Button onClick={saveWelcome} disabled={welcomeSaving}>
                <Save className="h-4 w-4 mr-2" />
                {welcomeSaving ? t("common.saving") : t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="guide" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.pages.guideTitle")}</CardTitle>
              <CardDescription>{t("admin.pages.guideDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="guide-title">{t("admin.pages.titleLabel")}</Label>
                <Input
                  id="guide-title"
                  value={guide.title ?? ""}
                  onChange={(e) => setGuide((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={branding?.systemName || t("admin.pages.titlePlaceholder")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="guide-subtitle">{t("admin.pages.subtitleLabel")}</Label>
                <Input
                  id="guide-subtitle"
                  value={guide.subtitle ?? ""}
                  onChange={(e) => setGuide((prev) => ({ ...prev, subtitle: e.target.value }))}
                  placeholder={branding?.systemSubtitle ?? t("admin.pages.subtitlePlaceholder")}
                  className="mt-1"
                />
              </div>
              <CardEditor
                cards={guide.cards ?? []}
                onChange={(cards) => setGuide((prev) => ({ ...prev, cards }))}
                disabled={guideSaving}
                t={t}
              />
              {guideError && (
                <p className="text-sm text-destructive">{guideError}</p>
              )}
              <Button onClick={saveGuide} disabled={guideSaving}>
                <Save className="h-4 w-4 mr-2" />
                {guideSaving ? t("common.saving") : t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
