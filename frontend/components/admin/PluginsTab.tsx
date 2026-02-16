"use client"

import { useEffect, useState } from "react"
import { Puzzle, Save, Database } from "lucide-react"
import { getAppSettings, patchAppSettings } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"

export function PluginsTab() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [pluginQdrantEnabled, setPluginQdrantEnabled] = useState(false)
  const [qdrantUrl, setQdrantUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getAppSettings()
      .then((s) => {
        setPluginQdrantEnabled(!!s?.plugin_qdrant_enabled)
        setQdrantUrl(s?.qdrant_url ?? "")
      })
      .catch(() => setError(t("admin.settings.loadError")))
      .finally(() => setLoading(false))
  }, [t])

  const handleSaveQdrant = () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    patchAppSettings({ plugin_qdrant_enabled: pluginQdrantEnabled, qdrant_url: qdrantUrl.trim() })
      .then(() => {
        setSuccess(true)
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("plugin-qdrant-updated"))
      })
      .catch((e) => setError((e as Error)?.message ?? t("common.saveError")))
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {t("admin.settings.loading")}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Puzzle className="h-5 w-5" />
          {t("admin.plugins.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("admin.plugins.subtitle")}
        </p>
      </div>

      {/* Plugin: Qdrant */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <CardTitle className="text-base">{t("admin.plugins.qdrant.name")}</CardTitle>
          </div>
          <CardDescription>{t("admin.plugins.qdrant.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
              {t("admin.plugins.qdrant.saved")}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="plugin-qdrant"
                checked={pluginQdrantEnabled}
                onCheckedChange={(v) => { setPluginQdrantEnabled(v); setSuccess(false) }}
              />
              <Label htmlFor="plugin-qdrant" className="text-sm cursor-pointer">
                {t("admin.plugins.qdrant.enable")}
              </Label>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs text-muted-foreground">{t("admin.plugins.qdrant.urlLabel")}</Label>
              <Input
                value={qdrantUrl}
                onChange={(e) => { setQdrantUrl(e.target.value); setSuccess(false) }}
                placeholder={t("admin.settings.qdrantUrlPlaceholder")}
                className="font-mono text-sm"
                disabled={saving}
              />
            </div>
            <Button onClick={handleSaveQdrant} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("admin.plugins.qdrant.hint")}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
