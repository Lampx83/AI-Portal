"use client"

import { useEffect, useState } from "react"
import { Bot, Save } from "lucide-react"
import { getCentralAgentConfig, patchCentralAgentConfig, getOllamaModels, type CentralLlmProvider } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/contexts/language-context"

const PLACEHOLDER_KEY = "••••••••••••"
const OLLAMA_DEFAULT_URL = "https://research.neu.edu.vn/ollama"
const OLLAMA_MODEL_PLACEHOLDER = "qwen3:8b, qwen3:32b"

type CentralAgentConfigProps = {
  embedded?: boolean
}

export function CentralAgentConfig({ embedded }: CentralAgentConfigProps) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [provider, setProvider] = useState<CentralLlmProvider>("skip")
  const [model, setModel] = useState("")
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [baseUrlInput, setBaseUrlInput] = useState("")
  const [systemPromptInput, setSystemPromptInput] = useState("")
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [ollamaFetchedModels, setOllamaFetchedModels] = useState<string[]>([])
  const [selectedOllamaModels, setSelectedOllamaModels] = useState<string[]>([])
  const [fetchModelsLoading, setFetchModelsLoading] = useState(false)

  useEffect(() => {
    getCentralAgentConfig()
      .then((config) => {
        setProvider(config.provider)
        setModel(config.model ?? "")
        setBaseUrlInput(config.baseUrl ?? "")
        setSystemPromptInput(config.systemPrompt ?? "")
        setHasStoredKey(!!config.apiKeyMasked)
        setApiKeyInput("")
        if (config.ollamaModels?.length) {
          setSelectedOllamaModels(config.ollamaModels)
        } else if (config.model?.trim()) {
          setSelectedOllamaModels([config.model.trim()])
        } else {
          setSelectedOllamaModels([])
        }
      })
      .catch((e) => setError(e?.message ?? t("admin.central.loadError")))
      .finally(() => setLoading(false))
  }, [t])

  const handleSave = () => {
    setSaving(true)
    setError(null)
    setSaveMessage(null)
    const body: {
      provider?: CentralLlmProvider
      model?: string
      api_key?: string
      base_url?: string
      system_prompt?: string
      models?: string[]
    } = {
      provider,
      model:
        provider === "ollama"
          ? (selectedOllamaModels[0]?.trim() || model.trim() || undefined)
          : (model.trim() || undefined),
      base_url: provider === "openai_compatible" || provider === "ollama" ? (baseUrlInput.trim() || undefined) : undefined,
      system_prompt: systemPromptInput.trim() || undefined,
    }
    if (provider === "ollama" && selectedOllamaModels.length > 0) {
      body.models = selectedOllamaModels.map((m) => m.trim()).filter(Boolean)
    }
    if (apiKeyInput.trim() !== "" && apiKeyInput !== PLACEHOLDER_KEY) {
      body.api_key = apiKeyInput.trim()
    }
    patchCentralAgentConfig(body)
      .then((config) => {
        setProvider(config.provider)
        setModel(config.model ?? "")
        setBaseUrlInput(config.baseUrl ?? "")
        setSystemPromptInput(config.systemPrompt ?? "")
        setHasStoredKey(!!config.apiKeyMasked)
        setApiKeyInput("")
        if (config.ollamaModels?.length) setSelectedOllamaModels(config.ollamaModels)
        setSaveMessage(t("admin.central.saveSuccess"))
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("central-agent-config-saved", String(Date.now()))
          } catch {}
          window.dispatchEvent(new CustomEvent("central-agent-config-saved"))
        }
      })
      .catch((e) => setError(e?.message ?? t("admin.central.saveError")))
      .finally(() => setSaving(false))
  }

  const handleFetchOllamaModels = () => {
    const url = baseUrlInput.trim().replace(/\/+$/, "")
    if (!url) {
      setError("Vui lòng nhập Base URL Ollama trước.")
      return
    }
    setFetchModelsLoading(true)
    setError(null)
    getOllamaModels(url)
      .then(({ models }) => {
        setOllamaFetchedModels(models)
        if (models.length === 0) setSelectedOllamaModels([])
      })
      .catch((e) => {
        setError(e?.message ?? "Không thể lấy danh sách mô hình từ Ollama.")
        setOllamaFetchedModels([])
      })
      .finally(() => setFetchModelsLoading(false))
  }

  const toggleOllamaModel = (name: string) => {
    setSelectedOllamaModels((prev) => (prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]))
  }

  const needsKey = provider !== "skip" && provider !== "ollama"
  const needsBaseUrl = provider === "openai_compatible" || provider === "ollama"
  const ollamaPlaceholderUrl = provider === "ollama" ? OLLAMA_DEFAULT_URL : undefined
  const ollamaModelPlaceholder = provider === "ollama" ? OLLAMA_MODEL_PLACEHOLDER : undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {t("admin.central.loading")}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-xl">
      {!embedded && (
        <>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Bot className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t("admin.central.title")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t("admin.central.subtitle")}</p>
          <p className="text-xs text-muted-foreground">
            Hỗ trợ: <strong>OpenAI</strong>, <strong>Ollama</strong> (self-hosted, ví dụ research.neu.edu.vn/ollama), <strong>OpenAI-compatible</strong>. Khuyến nghị Ollama: qwen3:8b hoặc qwen3:32b.
          </p>
        </>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t("admin.central.providerLabel")}</Label>
          <Select value={provider} onValueChange={(v: CentralLlmProvider) => setProvider(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">{t("admin.central.providerOpenAI")}</SelectItem>
              <SelectItem value="ollama">{t("admin.central.providerOllama")}</SelectItem>
              <SelectItem value="openai_compatible">{t("admin.central.providerOpenAICompatible")}</SelectItem>
              <SelectItem value="gemini">{t("admin.central.providerGemini")}</SelectItem>
              <SelectItem value="anthropic">{t("admin.central.providerAnthropic")}</SelectItem>
              <SelectItem value="skip">{t("admin.central.providerSkip")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(needsKey || needsBaseUrl) && (
          <>
            {provider !== "ollama" && (
              <div className="space-y-2">
                <Label>{t("admin.central.modelLabel")}</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t("admin.central.modelPlaceholder")}
                  className="font-mono"
                />
              </div>
            )}

            {needsKey && (
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
            )}

            {needsBaseUrl && (
              <div className="space-y-2">
                <Label>{t("admin.central.baseUrlLabel")}</Label>
                <Input
                  type="url"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder={ollamaPlaceholderUrl ?? t("admin.central.baseUrlPlaceholder")}
                  className="font-mono"
                />
                {provider === "ollama" && (
                  <>
                    <p className="text-xs text-muted-foreground">Ví dụ: https://research.neu.edu.vn/ollama (không cần API key)</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFetchOllamaModels}
                      disabled={fetchModelsLoading || !baseUrlInput.trim()}
                    >
                      {fetchModelsLoading ? "Đang tải..." : "Lấy danh sách mô hình"}
                    </Button>
                  </>
                )}
              </div>
            )}

            {provider === "ollama" && (
              <div className="space-y-2">
                <Label>Mô hình (có thể chọn nhiều, mô hình đầu tiên là mô hình chính)</Label>
                <Input
                  value={selectedOllamaModels[0] ?? model}
                  onChange={(e) => {
                    const v = e.target.value
                    setModel(v)
                    if (v.trim())
                      setSelectedOllamaModels((prev) =>
                        prev[0] === v.trim() ? prev : [v.trim(), ...prev.filter((m) => m !== v.trim())]
                      )
                    else setSelectedOllamaModels([])
                  }}
                  placeholder={OLLAMA_MODEL_PLACEHOLDER}
                  className="font-mono"
                />
                {ollamaFetchedModels.length > 0 && (
                  <div className="rounded border p-3 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-xs text-muted-foreground">Chọn từ danh sách:</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {ollamaFetchedModels.map((name) => (
                        <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={selectedOllamaModels.includes(name)}
                            onChange={() => toggleOllamaModel(name)}
                          />
                          <span className="font-mono">{name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <Label>{t("admin.central.systemPromptLabel")}</Label>
          <Textarea
            value={systemPromptInput}
            onChange={(e) => setSystemPromptInput(e.target.value)}
            placeholder={t("admin.central.systemPromptPlaceholder")}
            className="min-h-[140px] font-mono text-sm"
          />
        </div>
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
