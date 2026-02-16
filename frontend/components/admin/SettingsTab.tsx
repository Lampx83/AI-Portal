"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Settings, Lock, Type, Save, RotateCcw, Download, Upload, Archive } from "lucide-react"
import { getAdminConfig, resetDatabase, getLocalePackageTemplate, postLocalePackage, getAppSettings, patchAppSettings, getBackupBlob, type ConfigSection } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getLocaleLabel } from "@/lib/i18n"
import { API_CONFIG } from "@/lib/config"
import { useLanguage } from "@/contexts/language-context"

export function SettingsTab() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<ConfigSection[]>([])
  const [resetConfirm, setResetConfirm] = useState("")
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [localePackageLocale, setLocalePackageLocale] = useState("")
  const [localePackageUploading, setLocalePackageUploading] = useState(false)
  const [localePackageError, setLocalePackageError] = useState<string | null>(null)
  const [localePackageSuccess, setLocalePackageSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [defaultLocale, setDefaultLocale] = useState<string>("en")
  const [availableLocales, setAvailableLocales] = useState<string[]>(["en", "vi", "zh", "ja", "fr"])
  const [savingLocale, setSavingLocale] = useState(false)
  const [localeSaveError, setLocaleSaveError] = useState<string | null>(null)
  const [localeSaveSuccess, setLocaleSaveSuccess] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)

  const fetchAvailableLocales = useCallback(() => {
    const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
    return fetch(`${base}/api/site-strings/available-locales`, { credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((data: { locales?: string[]; defaultLocale?: string }) => {
        if (data?.locales?.length) setAvailableLocales(data.locales)
        if (data?.defaultLocale) setDefaultLocale(data.defaultLocale)
      })
  }, [])

  useEffect(() => {
    fetchAvailableLocales()
  }, [fetchAvailableLocales])

  useEffect(() => {
    Promise.all([getAdminConfig(), getAppSettings()])
      .then(([configRes, appSettings]) => {
        setSections(configRes.sections ?? [])
        if (appSettings?.default_locale) setDefaultLocale(appSettings.default_locale)
      })
      .catch((e) => setError(e?.message ?? t("admin.settings.loadError")))
      .finally(() => setLoading(false))
  }, [])

  const handleDownloadTemplate = () => {
    getLocalePackageTemplate()
      .then((payload) => {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "locale-template.json"
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch((e) => setLocalePackageError((e as Error)?.message ?? "Failed to download template"))
  }

  const handleUploadLocalePackage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const locale = localePackageLocale.trim().toLowerCase()
    if (!locale || locale.length < 2 || locale.length > 20 || !/^[a-z0-9]+$/.test(locale)) {
      setLocalePackageError("Locale must be 2–20 lowercase letters/numbers (e.g. fr, de)")
      return
    }
    setLocalePackageUploading(true)
    setLocalePackageError(null)
    setLocalePackageSuccess(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result)) as { locale?: string; name?: string; strings?: Record<string, string> }
        const strings = json?.strings ?? json
        if (typeof strings !== "object" || strings === null) {
          setLocalePackageError(t("admin.settings.localePackageErrorFile"))
          setLocalePackageUploading(false)
          return
        }
        postLocalePackage({ locale, name: json.name, strings: strings as Record<string, string> })
          .then((res) => {
            setLocalePackageSuccess(t("admin.settings.localePackageSuccess").replace("{count}", String(res.inserted)).replace("{locale}", res.locale))
            fetchAvailableLocales()
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("site-strings-updated"))
          })
          .catch((err) => setLocalePackageError((err as Error)?.message ?? t("admin.settings.localePackageErrorUpload")))
          .finally(() => setLocalePackageUploading(false))
      } catch {
        setLocalePackageError(t("admin.settings.localePackageErrorInvalid"))
        setLocalePackageUploading(false)
      }
    }
    reader.readAsText(file)
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 text-slate-500">
        {t("admin.settings.loading")}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-red-700 dark:text-red-300">
        {error}
      </div>
    )
  }

  const handleSaveDefaultLocale = () => {
    setSavingLocale(true)
    setLocaleSaveError(null)
    setLocaleSaveSuccess(false)
    patchAppSettings({ default_locale: defaultLocale })
      .then((res) => {
        setDefaultLocale(res.default_locale)
        setLocaleSaveSuccess(true)
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("site-strings-updated"))
      })
      .catch((e: Error & { body?: { errorCode?: string } }) => {
        const msg = e?.body?.errorCode ? t(`admin.settings.error.${e.body.errorCode}`) : ((e as Error)?.message ?? t("common.saveError"))
        setLocaleSaveError(msg)
      })
      .finally(() => setSavingLocale(false))
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-2 w-full max-w-6xl">
      {/* Language */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Type className="h-4 w-4 shrink-0" />
            {t("admin.settings.languageTitle")}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {t("admin.settings.languageDesc")}
          </p>
        </div>
        <div className="p-4 space-y-4 flex-1">
          {localeSaveError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {localeSaveError}
            </div>
          )}
          {localeSaveSuccess && (
            <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
              {t("admin.settings.defaultLocaleSaved")}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <Label className="text-xs text-slate-500">{t("admin.settings.defaultLocale")}</Label>
              <Select value={defaultLocale} onValueChange={(v) => { setDefaultLocale(v); setLocaleSaveSuccess(false) }}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLocales.map((loc) => (
                    <SelectItem key={loc} value={loc}>{getLocaleLabel(loc)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveDefaultLocale} disabled={savingLocale} className="gap-2 shrink-0">
              <Save className="h-4 w-4" />
              {savingLocale ? t("common.saving") : t("common.save")}
            </Button>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("admin.settings.localePackage")}</p>
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 shrink-0">
                <Download className="h-4 w-4" />
                {t("admin.settings.downloadTemplate")}
              </Button>
              <div className="flex flex-wrap items-end gap-2 min-w-0">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">{t("admin.settings.localeCodePlaceholder")}</Label>
                  <Input
                    value={localePackageLocale}
                    onChange={(e) => { setLocalePackageLocale(e.target.value); setLocalePackageError(null) }}
                    placeholder="fr, de"
                    className="w-20 sm:w-24 font-mono text-sm"
                    disabled={localePackageUploading}
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleUploadLocalePackage}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={localePackageUploading}
                  className="gap-1.5 shrink-0"
                >
                  <Upload className="h-4 w-4" />
                  {localePackageUploading ? t("admin.settings.uploading") : t("admin.settings.uploadPackage")}
                </Button>
              </div>
            </div>
            {localePackageError && (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {localePackageError}
              </div>
            )}
            {localePackageSuccess && (
              <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                {localePackageSuccess}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backup */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Archive className="h-4 w-4 shrink-0" />
            {t("admin.settings.backupTitle")}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {t("admin.settings.backupDesc")}
          </p>
        </div>
        <div className="p-4">
          {backupError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 mb-3">
              {backupError}
            </div>
          )}
          <Button
            variant="outline"
            className="gap-2"
            disabled={backupLoading}
            onClick={() => {
              setBackupLoading(true)
              setBackupError(null)
              getBackupBlob()
                .then((blob) => {
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `aiportal-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.zip`
                  a.click()
                  URL.revokeObjectURL(url)
                })
                .catch((e: Error & { body?: { error?: string } }) => {
                  setBackupError(e?.body?.error ?? (e as Error)?.message ?? t("admin.settings.backupError"))
                })
                .finally(() => setBackupLoading(false))
            }}
          >
            <Download className="h-4 w-4" />
            {backupLoading ? t("admin.settings.backupCreating") : t("admin.settings.backupButton")}
          </Button>
        </div>
      </div>

      {/* Env (read-only) */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200 flex flex-col min-h-0">
        <div className="flex items-start gap-2">
          <Lock className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium">{t("admin.settings.envConfigTitle")}</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              {t("admin.settings.envConfigDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Reset app */}
      <div className="rounded-lg border border-red-200 dark:border-red-900 overflow-hidden bg-red-50/50 dark:bg-red-950/20 lg:col-span-2">
        <div className="bg-red-100/80 dark:bg-red-900/30 px-4 py-3 border-b border-red-200 dark:border-red-800">
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 shrink-0" />
            {t("admin.settings.resetTitle")}
          </h3>
          <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
            {t("admin.settings.resetDesc")}
          </p>
        </div>
        <div className="p-4 space-y-3 flex flex-wrap sm:flex-nowrap items-end gap-3">
          {resetError && (
            <div className="w-full rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {resetError}
            </div>
          )}
          <div className="space-y-1 min-w-0 flex-1 sm:max-w-[220px]">
            <Label className="text-xs text-slate-600 dark:text-slate-400">
              {t("admin.settings.resetConfirmLabel")}
            </Label>
            <Input
              value={resetConfirm}
              onChange={(e) => { setResetConfirm(e.target.value); setResetError(null) }}
              placeholder="RESET"
              className="font-mono text-sm border-red-200 dark:border-red-800 w-full"
              disabled={resetting}
            />
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              if (resetConfirm.trim() !== "RESET") {
                setResetError(t("admin.settings.resetConfirmError"))
                return
              }
              if (typeof window !== "undefined" && !window.confirm(t("admin.settings.resetConfirmDialog"))) return
              setResetting(true)
              setResetError(null)
              resetDatabase("RESET")
                .then((res: { messageKey?: string }) => {
                  if (typeof window !== "undefined") {
                    window.alert(res?.messageKey ? t(res.messageKey) : t("admin.settings.resetDone"))
                    window.location.reload()
                  }
                })
                .catch((e: Error & { body?: { errorCode?: string } }) => {
                  const msg = e?.body?.errorCode ? t(`admin.settings.error.${e.body.errorCode}`) : (e?.message ?? t("common.error"))
                  setResetError(msg)
                })
                .finally(() => setResetting(false))
            }}
            disabled={resetting || resetConfirm.trim() !== "RESET"}
            className="gap-2 shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            {resetting ? t("admin.settings.resetting") : t("admin.settings.resetDatabase")}
          </Button>
        </div>
      </div>

      {/* Config sections (env) */}
      {sections.map((section) => (
        <div
          key={section.titleKey}
          className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-0"
        >
          <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Settings className="h-4 w-4 shrink-0" />
              {t(section.titleKey)}
            </h3>
            {section.descriptionKey && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{t(section.descriptionKey)}</p>
            )}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 overflow-auto min-h-0">
            {section.items.map((item) => (
              <div
                key={item.key}
                className="px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <code className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded break-all">
                      {item.keyLabel ? t(item.keyLabel) : item.key}
                    </code>
                    {item.secret && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t("admin.settings.secretValue")}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{t(item.descriptionKey)}</p>
                </div>
                <div className="w-full sm:w-48 lg:w-56 shrink-0">
                  <input
                    type="text"
                    value={item.valueKey ? t(item.valueKey) : item.value}
                    readOnly
                    disabled
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 text-xs font-mono cursor-not-allowed truncate"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
