"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Settings, Palette, Bell, Shield, Database, Zap } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { getProfile, patchProfile, type UserSettings } from "@/lib/api/users"

const defaultSettings: UserSettings = {
  language: "vi",
  notifications: { email: false, push: false, projectUpdates: false, publications: false },
  privacy: { profileVisible: false, projectsVisible: false, publicationsVisible: false },
  ai: { personalization: true, autoSuggestions: true, externalSearch: false, responseLength: 2, creativity: 3 },
  data: { autoBackup: false, syncEnabled: false, cacheSize: 1 },
}

function mergeSettings(a: UserSettings, b: Partial<UserSettings> | undefined): UserSettings {
  if (!b) return a
  return {
    language: b.language ?? a.language,
    notifications: { ...a.notifications, ...b.notifications },
    privacy: { ...a.privacy, ...b.privacy },
    ai: { ...a.ai, ...b.ai },
    data: { ...a.data, ...b.data },
  }
}

export function SystemSettingsView() {
  const { theme, setTheme } = useTheme()
  const { t } = useLanguage()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileEmail, setProfileEmail] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getProfile()
      .then((res) => {
        if (cancelled) return
        setProfileEmail(res.profile.email ?? null)
        setSettings(mergeSettings(defaultSettings, res.settings))
      })
      .catch(() => {
        if (!cancelled) setProfileEmail(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const updateSetting = (category: keyof UserSettings | "", key: string, value: unknown) => {
    setSettings((prev) => {
      const next = { ...prev }
      if (category === "" || category === "language") {
        if (key === "language") next.language = value as string
        return next
      }
      const cat = next[category] as Record<string, unknown>
      if (cat && typeof cat === "object") {
        (next[category] as Record<string, unknown>) = { ...cat, [key]: value }
      }
      return next
    })
    if (category === "" && key === "theme") setTheme(value as "light" | "dark" | "system")
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await patchProfile({ settings })
      toast({ title: t("settings.saved") })
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message ?? "Không lưu được", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
        <p className="text-muted-foreground text-center py-8">Đang tải cài đặt...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            {t("settings.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t("settings.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                {t("settings.appearance")}
              </CardTitle>
              <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("settings.language")}: cấu hình tại Admin → Settings (ngôn ngữ hệ thống áp dụng cho toàn bộ trang).
              </p>
              <div className="space-y-2">
                <Label>{t("settings.theme")}</Label>
                <Select value={theme} onValueChange={(v) => updateSetting("", "theme", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t("settings.themeLight")}</SelectItem>
                    <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
                    <SelectItem value="system">{t("settings.themeSystem")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {t("settings.notifications")}
              </CardTitle>
              <CardDescription>{t("settings.notificationsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileEmail && (
                <p className="text-sm text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                  {t("settings.notificationsEmailTo")} <strong className="text-foreground">{profileEmail}</strong>
                </p>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notifications">{t("settings.notificationsEmail")}</Label>
                <Switch
                  id="email-notifications"
                  checked={settings.notifications.email}
                  onCheckedChange={(checked) => updateSetting("notifications", "email", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="push-notifications">{t("settings.notificationsPush")}</Label>
                <Switch
                  id="push-notifications"
                  checked={settings.notifications.push}
                  onCheckedChange={(checked) => updateSetting("notifications", "push", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="project-updates">{t("settings.notificationsProjects")}</Label>
                <Switch
                  id="project-updates"
                  checked={settings.notifications.projectUpdates}
                  onCheckedChange={(checked) => updateSetting("notifications", "projectUpdates", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="publication-notifications">{t("settings.notificationsPublications")}</Label>
                <Switch
                  id="publication-notifications"
                  checked={settings.notifications.publications}
                  onCheckedChange={(checked) => updateSetting("notifications", "publications", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t("settings.privacy")}
              </CardTitle>
              <CardDescription>{t("settings.privacyDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-visible">{t("settings.privacyProfile")}</Label>
                <Switch
                  id="profile-visible"
                  checked={settings.privacy.profileVisible}
                  onCheckedChange={(checked) => updateSetting("privacy", "profileVisible", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="projects-visible">{t("settings.privacyProjects")}</Label>
                <Switch
                  id="projects-visible"
                  checked={settings.privacy.projectsVisible}
                  onCheckedChange={(checked) => updateSetting("privacy", "projectsVisible", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="publications-visible">{t("settings.privacyPublications")}</Label>
                <Switch
                  id="publications-visible"
                  checked={settings.privacy.publicationsVisible}
                  onCheckedChange={(checked) => updateSetting("privacy", "publicationsVisible", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                {t("settings.ai")}
              </CardTitle>
              <CardDescription>{t("settings.aiDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="personalization">{t("settings.aiPersonalization")}</Label>
                <Switch
                  id="personalization"
                  checked={settings.ai.personalization}
                  onCheckedChange={(checked) => updateSetting("ai", "personalization", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-suggestions">{t("settings.aiAutoSuggestions")}</Label>
                <Switch
                  id="auto-suggestions"
                  checked={settings.ai.autoSuggestions}
                  onCheckedChange={(checked) => updateSetting("ai", "autoSuggestions", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="external-search">{t("settings.aiExternalSearch")}</Label>
                <Switch
                  id="external-search"
                  checked={settings.ai.externalSearch}
                  onCheckedChange={(checked) => updateSetting("ai", "externalSearch", checked)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("settings.aiResponseLength")}:{" "}
                  {settings.ai.responseLength === 1
                    ? t("settings.aiResponseShort")
                    : settings.ai.responseLength === 2
                      ? t("settings.aiResponseMedium")
                      : t("settings.aiResponseLong")}
                </Label>
                <Slider
                  value={[settings.ai.responseLength]}
                  onValueChange={(value) => updateSetting("ai", "responseLength", value[0] ?? 2)}
                  max={3}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.aiCreativity")}: {settings.ai.creativity}/5</Label>
                <Slider
                  value={[settings.ai.creativity]}
                  onValueChange={(value) => updateSetting("ai", "creativity", value[0] ?? 3)}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                {t("settings.data")}
              </CardTitle>
              <CardDescription>{t("settings.dataDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-backup">{t("settings.dataAutoBackup")}</Label>
                <Switch
                  id="auto-backup"
                  checked={settings.data.autoBackup}
                  onCheckedChange={(checked) => updateSetting("data", "autoBackup", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sync-enabled">{t("settings.dataSync")}</Label>
                <Switch
                  id="sync-enabled"
                  checked={settings.data.syncEnabled}
                  onCheckedChange={(checked) => updateSetting("data", "syncEnabled", checked)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.dataCacheSize")}: {settings.data.cacheSize} GB</Label>
                <Slider
                  value={[settings.data.cacheSize]}
                  onValueChange={(value) => updateSetting("data", "cacheSize", value[0] ?? 1)}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">{t("settings.dataClearCache")}</Button>
                <Button variant="outline" size="sm">{t("settings.dataExport")}</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-6">
          <Button className="bg-neu-blue hover:bg-neu-blue/90" onClick={handleSave} disabled={saving}>
            {saving ? t("settings.saving") : t("settings.save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
