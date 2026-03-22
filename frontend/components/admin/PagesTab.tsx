"use client"

import { useCallback, useEffect, useState } from "react"
import { Save, Plus, Trash2, FileText, BookOpen, GripVertical } from "lucide-react"
import {
  getWelcomePageConfig,
  patchWelcomePageConfig,
  getGuidePageConfig,
  patchGuidePageConfig,
  getSettingsBranding,
  getAgents,
  getTools,
  type AgentRow,
  type ToolRow,
  type WelcomePageConfig,
  type GuidePageConfig,
} from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/contexts/language-context"
import { IconPicker } from "./IconPicker"
import type { IconName } from "@/lib/assistants"

function CardEditor({
  cards,
  onChange,
  disabled,
  t,
  allowIcon = false,
  defaultIcons = [],
  assistants = [],
  tools = [],
}: {
  cards: { title: string; description: string; icon?: string; targetType?: "assistant" | "tool"; targetAlias?: string }[]
  onChange: (cards: { title: string; description: string; icon?: string; targetType?: "assistant" | "tool"; targetAlias?: string }[]) => void
  disabled?: boolean
  t: (key: string) => string
  allowIcon?: boolean
  defaultIcons?: IconName[]
  assistants?: AgentRow[]
  tools?: ToolRow[]
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const update = (
    index: number,
    field: "title" | "description" | "icon" | "targetType" | "targetAlias",
    value: string
  ) => {
    const next = [...cards]
    if (!next[index]) next[index] = { title: "", description: "", icon: undefined, targetType: undefined, targetAlias: undefined }
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }
  const add = () => onChange([...cards, { title: "", description: "", icon: undefined, targetType: undefined, targetAlias: undefined }])
  const remove = (index: number) => onChange(cards.filter((_, i) => i !== index))
  const moveCard = (from: number, to: number) => {
    if (from === to) return
    const next = [...cards]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }
  const resetDrag = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t("admin.pages.cardsLabel")}</Label>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" />
          {t("admin.pages.addCard")}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {cards.map((card, index) => (
          <Card
            key={index}
            className={overIndex === index && dragIndex !== index ? "ring-1 ring-primary/40 border-primary/40" : undefined}
            onDragOver={(e) => {
              e.preventDefault()
              if (dragIndex === null || dragIndex === index) return
              setOverIndex(index)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragIndex === null) return
              moveCard(dragIndex, index)
              resetDrag()
            }}
          >
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  setDragIndex(index)
                  e.dataTransfer.effectAllowed = "move"
                  e.dataTransfer.setData("text/plain", String(index))
                }}
                onDragEnd={resetDrag}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                title="Kéo để sắp xếp"
                aria-label="Kéo để sắp xếp"
              >
                <GripVertical className="h-4 w-4" />
              </button>
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
              <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-3 items-start">
                {allowIcon ? (
                  <div className="space-y-1.5 md:order-1">
                    <Label className="text-xs">Icon</Label>
                    <IconPicker
                      value={(card.icon || defaultIcons[index % Math.max(defaultIcons.length, 1)] || "Bot") as IconName}
                      onChange={(icon) => update(index, "icon", icon)}
                      moreLabel={t("admin.icons.more")}
                      lessLabel={t("admin.icons.less")}
                    />
                  </div>
                ) : null}
                <div className={allowIcon ? "md:order-2" : undefined}>
                  <Label className="text-xs">{t("admin.pages.cardTitleLabel")}</Label>
                  <Input
                    value={card.title}
                    onChange={(e) => update(index, "title", e.target.value)}
                    placeholder={t("admin.pages.cardTitlePlaceholder")}
                    disabled={disabled}
                    className="mt-1"
                  />
                </div>
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
              <div className="space-y-2 rounded-md border border-border/60 p-2.5 bg-muted/20">
                <Label className="text-xs">Hành động khi bấm thẻ</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Loại liên kết</Label>
                    <Select
                      value={card.targetType || "none"}
                      onValueChange={(v) => {
                        if (v === "none") {
                          const next = [...cards]
                          if (!next[index]) return
                          next[index] = { ...next[index], targetType: undefined, targetAlias: undefined }
                          onChange(next)
                          return
                        }
                        update(index, "targetType", v)
                        if (card.targetAlias) return
                        const firstAlias =
                          v === "assistant"
                            ? assistants.find((a) => a.is_active)?.alias ?? assistants[0]?.alias
                            : tools.find((x) => x.is_active)?.alias ?? tools[0]?.alias
                        if (firstAlias) update(index, "targetAlias", firstAlias)
                      }}
                    >
                      <SelectTrigger className="h-8 mt-1">
                        <SelectValue placeholder="Không liên kết" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không liên kết</SelectItem>
                        <SelectItem value="assistant">Trợ lý</SelectItem>
                        <SelectItem value="tool">Công cụ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Đích đến</Label>
                    <Select
                      value={card.targetAlias || "none"}
                      onValueChange={(v) => {
                        if (v === "none") update(index, "targetAlias", "")
                        else update(index, "targetAlias", v)
                      }}
                      disabled={!card.targetType}
                    >
                      <SelectTrigger className="h-8 mt-1">
                        <SelectValue placeholder="Chọn đích đến" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không chọn</SelectItem>
                        {(card.targetType === "assistant" ? assistants : tools).map((item) => (
                          <SelectItem key={item.id} value={item.alias}>
                            {(item.name && item.name.trim()) || item.alias}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
  const welcomeDefaultIconOrder: IconName[] = ["MessageSquare", "FolderOpen", "FileText", "Sparkles"]
  const [welcome, setWelcome] = useState<WelcomePageConfig>({ title: "", subtitle: "", cards: [] })
  const [guide, setGuide] = useState<GuidePageConfig>({ title: "", subtitle: "", cards: [] })
  const [branding, setBranding] = useState<{ systemName: string; systemSubtitle?: string } | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [tools, setTools] = useState<ToolRow[]>([])
  const [loading, setLoading] = useState(true)
  const [welcomeSaving, setWelcomeSaving] = useState(false)
  const [welcomeError, setWelcomeError] = useState<string | null>(null)
  const [guideSaving, setGuideSaving] = useState(false)
  const [guideError, setGuideError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getWelcomePageConfig(), getGuidePageConfig(), getSettingsBranding(), getAgents(), getTools()])
      .then(([w, g, b, agentData, toolData]) => {
        setWelcome({
          title: typeof w.title === "string" ? w.title : "",
          subtitle: typeof w.subtitle === "string" ? w.subtitle : "",
          cards: Array.isArray(w.cards)
            ? w.cards.map((c) => ({
                title: typeof c?.title === "string" ? c.title : "",
                description: typeof c?.description === "string" ? c.description : "",
                icon: typeof c?.icon === "string" && c.icon.trim() ? c.icon.trim() : undefined,
                targetType: c?.targetType === "assistant" || c?.targetType === "tool" ? c.targetType : undefined,
                targetAlias: typeof c?.targetAlias === "string" && c.targetAlias.trim() ? c.targetAlias.trim() : undefined,
              }))
            : [],
        })
        setGuide({
          title: typeof g.title === "string" ? g.title : "",
          subtitle: typeof g.subtitle === "string" ? g.subtitle : "",
          cards: Array.isArray(g.cards)
            ? g.cards.map((c) => ({
                title: typeof c?.title === "string" ? c.title : "",
                description: typeof c?.description === "string" ? c.description : "",
                icon: typeof c?.icon === "string" && c.icon.trim() ? c.icon.trim() : undefined,
                targetType: c?.targetType === "assistant" || c?.targetType === "tool" ? c.targetType : undefined,
                targetAlias: typeof c?.targetAlias === "string" && c.targetAlias.trim() ? c.targetAlias.trim() : undefined,
              }))
            : [],
        })
        setBranding(b ? { systemName: b.systemName ?? "", systemSubtitle: b.systemSubtitle } : null)
        setAgents((agentData?.agents ?? []).filter((a) => a.is_active !== false))
        setTools((toolData?.tools ?? []).filter((x) => x.is_active !== false))
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
                allowIcon
                defaultIcons={welcomeDefaultIconOrder}
                assistants={agents}
                tools={tools}
              />
              {welcomeError && (
                <p className="text-sm text-destructive">{welcomeError}</p>
              )}
              <div className="flex justify-center">
                <Button onClick={saveWelcome} disabled={welcomeSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {welcomeSaving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
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
              <div className="flex justify-center">
                <Button onClick={saveGuide} disabled={guideSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {guideSaving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
