"use client"

import { useEffect, useState } from "react"
import { Bot, Save } from "lucide-react"
import { getCentralAgentConfig, patchCentralAgentConfig, type CentralLlmProvider } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"

const PLACEHOLDER_KEY = "••••••••••••"

export function CentralAgentTab() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [provider, setProvider] = useState<CentralLlmProvider>("skip")
  const [model, setModel] = useState("")
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [baseUrlInput, setBaseUrlInput] = useState("")
  const [hasStoredKey, setHasStoredKey] = useState(false)

  useEffect(() => {
    getCentralAgentConfig()
      .then((config) => {
        setProvider(config.provider)
        setModel(config.model ?? "")
        setBaseUrlInput(config.baseUrl ?? "")
        setHasStoredKey(!!config.apiKeyMasked)
        setApiKeyInput("")
      })
      .catch((e) => setError(e?.message ?? t("admin.central.loadError")))
      .finally(() => setLoading(false))
  }, [t])

  const handleSave = () => {
    setSaving(true)
    setError(null)
    setSaveMessage(null)
    const body: { provider?: CentralLlmProvider; model?: string; api_key?: string; base_url?: string } = {
      provider,
      model: model.trim() || undefined,
      base_url: provider === "openai_compatible" ? (baseUrlInput.trim() || undefined) : undefined,
    }
    if (apiKeyInput.trim() !== "" && apiKeyInput !== PLACEHOLDER_KEY) {
      body.api_key = apiKeyInput.trim()
    }
    patchCentralAgentConfig(body)
      .then((config) => {
        setProvider(config.provider)
        setModel(config.model ?? "")
        setBaseUrlInput(config.baseUrl ?? "")
        setHasStoredKey(!!config.apiKeyMasked)
        setApiKeyInput("")
        setSaveMessage(t("admin.central.saveSuccess"))
      })
      .catch((e) => setError(e?.message ?? t("admin.central.saveError")))
      .finally(() => setSaving(false))
  }

  const needsKey = provider !== "skip"
  const needsBaseUrl = provider === "openai_compatible"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {t("admin.central.loading")}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
        <Bot className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{t("admin.central.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("admin.central.subtitle")}</p>
      <p className="text-xs text-muted-foreground">
        Hiện chỉ hỗ trợ gọi API với <strong>OpenAI</strong> và <strong>OpenAI-compatible</strong>. Gemini/Anthropic có thể cấu hình và lưu, sẽ hỗ trợ sau.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t("admin.central.providerLabel")}</Label>
          <Select value={provider} onValueChange={(v: CentralLlmProvider) => setProvider(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">{t("admin.central.providerOpenAI")}</SelectItem>
              <SelectItem value="gemini">{t("admin.central.providerGemini")}</SelectItem>
              <SelectItem value="anthropic">{t("admin.central.providerAnthropic")}</SelectItem>
              <SelectItem value="openai_compatible">{t("admin.central.providerOpenAICompatible")}</SelectItem>
              <SelectItem value="skip">{t("admin.central.providerSkip")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {needsKey && (
          <>
            <div className="space-y-2">
              <Label>{t("admin.central.modelLabel")}</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t("admin.central.modelPlaceholder")}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.central.apiKeyLabel")}</Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder={hasStoredKey ? PLACEHOLDER_KEY : t("admin.central.apiKeyPlaceholder")}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="font-mono"
              />
              {hasStoredKey && (
                <p className="text-xs text-muted-foreground">{t("admin.central.apiKeyHint")}</p>
              )}
            </div>

            {needsBaseUrl && (
              <div className="space-y-2">
                <Label>{t("admin.central.baseUrlLabel")}</Label>
                <Input
                  type="url"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder={t("admin.central.baseUrlPlaceholder")}
                  className="font-mono"
                />
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">{error}</div>
      )}
      {saveMessage && (
        <div className="rounded-md bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-2 text-sm">
          {saveMessage}
        </div>
      )}

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  )
}
