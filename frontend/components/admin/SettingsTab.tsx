"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Type, RotateCcw, Download, Upload, Archive, Building2, KeyRound, ImagePlus, EyeOff } from "lucide-react"
import {
  resetDatabase,
  getLocalePackageTemplate,
  postLocalePackage,
  getAppSettings,
  patchAppSettings,
  getBackupBlob,
  postRestoreBackup,
  getSettingsBranding,
  patchSettingsBranding,
  getSettingsSso,
  patchAdminConfig,
} from "@/lib/api/admin"
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
  const [resetConfirm, setResetConfirm] = useState("")
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [localePackageLocale, setLocalePackageLocale] = useState("")
  const [localePackageUploading, setLocalePackageUploading] = useState(false)
  const [localePackageError, setLocalePackageError] = useState<string | null>(null)
  const [localePackageSuccess, setLocalePackageSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [defaultLocale, setDefaultLocale] = useState<string>("en")
  const [availableLocales, setAvailableLocales] = useState<string[]>(["en", "vi", "zh", "ja", "fr"])
  const [savingLocale, setSavingLocale] = useState(false)
  const [localeSaveError, setLocaleSaveError] = useState<string | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [branding, setBranding] = useState<{
    systemName: string
    logoDataUrl?: string
    systemSubtitle?: string
    themeColor?: string
    databaseName: string
    hideNewChatOnAdmin?: boolean
    hideAppsAllOnAdmin?: boolean
    hideAssistantsAllOnAdmin?: boolean
    hideMenuProfile?: boolean
    hideMenuNotifications?: boolean
    hideMenuSettings?: boolean
    hideMenuAdmin?: boolean
    hideMenuDevDocs?: boolean
  } | null>(null)
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [brandingSaveError, setBrandingSaveError] = useState<string | null>(null)
  const [visibilitySaveError, setVisibilitySaveError] = useState<string | null>(null)
  const [sso, setSso] = useState<{
    google: { clientId: string; clientSecretSet: boolean; configured: boolean }
    azure: { clientId: string; tenantId: string; clientSecretSet: boolean; configured: boolean }
  } | null>(null)
  const [ssoProvider, setSsoProvider] = useState<"none" | "google" | "azure">("none")
  const [ssoGoogleClientId, setSsoGoogleClientId] = useState("")
  const [ssoGoogleClientSecret, setSsoGoogleClientSecret] = useState("")
  const [ssoAzureClientId, setSsoAzureClientId] = useState("")
  const [ssoAzureClientSecret, setSsoAzureClientSecret] = useState("")
  const [ssoAzureTenantId, setSsoAzureTenantId] = useState("")
  const [ssoSaving, setSsoSaving] = useState(false)
  const [ssoSaveError, setSsoSaveError] = useState<string | null>(null)

  const localeSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const brandingSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibilitySuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ssoSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipFirstBrandingSaveRef = useRef(true)
  const skipFirstSsoSaveRef = useRef(true)
  const justSavedBrandingRef = useRef(false)

  useEffect(() => () => {
    if (localeSuccessTimeoutRef.current) clearTimeout(localeSuccessTimeoutRef.current)
    if (brandingSuccessTimeoutRef.current) clearTimeout(brandingSuccessTimeoutRef.current)
    if (visibilitySuccessTimeoutRef.current) clearTimeout(visibilitySuccessTimeoutRef.current)
    if (ssoSuccessTimeoutRef.current) clearTimeout(ssoSuccessTimeoutRef.current)
  }, [])

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

  // Auto-save branding + visibility when user changes any field (debounced)
  useEffect(() => {
    if (!branding) return
    if (justSavedBrandingRef.current) {
      justSavedBrandingRef.current = false
      return
    }
    if (skipFirstBrandingSaveRef.current) {
      skipFirstBrandingSaveRef.current = false
      return
    }
    const systemName = branding.systemName.trim()
    if (!systemName) return
    const id = setTimeout(() => {
      setBrandingSaving(true)
      setBrandingSaveError(null)
      setVisibilitySaveError(null)
      patchSettingsBranding({
        system_name: systemName,
        logo_data_url: branding.logoDataUrl ?? "",
        system_subtitle: branding.systemSubtitle ?? "",
        theme_color: branding.themeColor ?? "",
        hide_new_chat_on_admin: branding.hideNewChatOnAdmin ?? false,
        hide_apps_all_on_admin: branding.hideAppsAllOnAdmin ?? false,
        hide_assistants_all_on_admin: branding.hideAssistantsAllOnAdmin ?? false,
        hide_menu_profile: branding.hideMenuProfile ?? false,
        hide_menu_notifications: branding.hideMenuNotifications ?? false,
        hide_menu_settings: branding.hideMenuSettings ?? false,
        hide_menu_admin: branding.hideMenuAdmin ?? false,
        hide_menu_dev_docs: branding.hideMenuDevDocs ?? false,
      })
        .then((res) => {
          justSavedBrandingRef.current = true
          setBranding((prev) =>
            prev
              ? {
                  ...prev,
                  systemName: res.systemName,
                  logoDataUrl: res.logoDataUrl,
                  systemSubtitle: res.systemSubtitle,
                  themeColor: res.themeColor,
                  hideNewChatOnAdmin: res.hideNewChatOnAdmin,
                  hideAppsAllOnAdmin: res.hideAppsAllOnAdmin,
                  hideAssistantsAllOnAdmin: res.hideAssistantsAllOnAdmin,
                  hideMenuProfile: res.hideMenuProfile,
                  hideMenuNotifications: res.hideMenuNotifications,
                  hideMenuSettings: res.hideMenuSettings,
                  hideMenuAdmin: res.hideMenuAdmin,
                  hideMenuDevDocs: res.hideMenuDevDocs,
                }
              : null
          )
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("branding-updated"))
        })
        .catch((e: Error & { message?: string }) => setBrandingSaveError((e as Error)?.message ?? t("common.saveError")))
        .finally(() => setBrandingSaving(false))
    }, 800)
    return () => clearTimeout(id)
  }, [branding, t])

  // Auto-save SSO when user changes provider or credentials (debounced)
  useEffect(() => {
    if (skipFirstSsoSaveRef.current) {
      skipFirstSsoSaveRef.current = false
      return
    }
    if (sso === null) return
    const id = setTimeout(() => {
      setSsoSaving(true)
      setSsoSaveError(null)
      const updates: Record<string, string> = {}
      if (ssoProvider === "google") {
        updates.GOOGLE_CLIENT_ID = ssoGoogleClientId.trim()
        if (ssoGoogleClientSecret.trim()) updates.GOOGLE_CLIENT_SECRET = ssoGoogleClientSecret.trim()
        updates.AZURE_AD_CLIENT_ID = ""
        updates.AZURE_AD_CLIENT_SECRET = ""
        updates.AZURE_AD_TENANT_ID = ""
      } else if (ssoProvider === "azure") {
        updates.AZURE_AD_CLIENT_ID = ssoAzureClientId.trim()
        updates.AZURE_AD_TENANT_ID = ssoAzureTenantId.trim()
        if (ssoAzureClientSecret.trim()) updates.AZURE_AD_CLIENT_SECRET = ssoAzureClientSecret.trim()
        updates.GOOGLE_CLIENT_ID = ""
        updates.GOOGLE_CLIENT_SECRET = ""
      } else {
        updates.GOOGLE_CLIENT_ID = ""
        updates.GOOGLE_CLIENT_SECRET = ""
        updates.AZURE_AD_CLIENT_ID = ""
        updates.AZURE_AD_CLIENT_SECRET = ""
        updates.AZURE_AD_TENANT_ID = ""
      }
      patchAdminConfig(updates)
        .then(() => getSettingsSso())
        .then((s) => setSso(s))
        .catch((e: Error & { message?: string }) => setSsoSaveError((e as Error)?.message ?? t("common.saveError")))
        .finally(() => setSsoSaving(false))
    }, 1200)
    return () => clearTimeout(id)
  }, [ssoProvider, ssoGoogleClientId, ssoGoogleClientSecret, ssoAzureClientId, ssoAzureTenantId, ssoAzureClientSecret, t])

  const [projectsEnabled, setProjectsEnabled] = useState(true)
  const [projectsSaving, setProjectsSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      getAppSettings().then((appSettings) => {
        if (appSettings?.default_locale) setDefaultLocale(appSettings.default_locale)
        if (typeof appSettings?.projects_enabled === "boolean") setProjectsEnabled(appSettings.projects_enabled)
        else if (appSettings?.projects_enabled === false) setProjectsEnabled(false)
      }),
      getSettingsBranding()
        .then((b) => setBranding(b))
        .catch(() => setBranding({ systemName: "", systemSubtitle: "", themeColor: undefined, databaseName: "" })),
      getSettingsSso()
        .then((s) => {
          skipFirstSsoSaveRef.current = true
          setSso(s)
          if (s.azure.configured) {
            setSsoProvider("azure")
            setSsoAzureClientId(s.azure.clientId)
            setSsoAzureTenantId(s.azure.tenantId)
          } else if (s.google.configured) {
            setSsoProvider("google")
            setSsoGoogleClientId(s.google.clientId)
          } else {
            setSsoProvider("none")
          }
        })
        .catch(() => setSso(null)),
    ]).catch((e) => setError(e?.message ?? t("admin.settings.loadError"))).finally(() => setLoading(false))
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

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => setBranding((prev) => (prev ? { ...prev, logoDataUrl: reader.result as string } : null))
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleClearLogo = () => {
    setBranding((prev) => (prev ? { ...prev, logoDataUrl: undefined } : null))
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-2 w-full">
      {/* System */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" />
            {t("admin.settings.systemTitle")}
          </h3>
        </div>
        <div className="p-4 space-y-4 flex-1">
          {brandingSaveError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {brandingSaveError}
            </div>
          )}
          {branding != null && (
            <>
              <div className="flex flex-wrap items-start gap-6">
                <div className="space-y-2 min-w-0 flex-1">
                  <Label className="text-xs text-slate-500">{t("admin.settings.systemName")}</Label>
                  <Input
                    value={branding.systemName}
                    onChange={(e) => setBranding((prev) => (prev ? { ...prev, systemName: e.target.value } : null))}
                    placeholder={t("admin.settings.systemNamePlaceholder")}
                    className="max-w-md"
                    disabled={brandingSaving}
                  />
                </div>
                <div className="space-y-2 shrink-0">
                  <Label className="text-xs text-slate-500">{t("admin.settings.logoLabel")}</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    {branding.logoDataUrl ? (
                      <div className="relative w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900 flex-shrink-0">
                        <Image src={branding.logoDataUrl} alt="" fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-900 flex-shrink-0">
                        <ImagePlus className="h-7 w-7 text-slate-400" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={brandingSaving}
                      >
                        {t("admin.settings.logoChooseImage")}
                      </Button>
                      {branding.logoDataUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-slate-500"
                          onClick={handleClearLogo}
                          disabled={brandingSaving}
                        >
                          {t("admin.settings.logoRemove")}
                        </Button>
                      )}
                    </div>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">{t("admin.settings.systemSubtitle")}</Label>
                <Input
                  value={branding.systemSubtitle ?? ""}
                  onChange={(e) => setBranding((prev) => (prev ? { ...prev, systemSubtitle: e.target.value } : null))}
                  placeholder={t("admin.settings.systemSubtitlePlaceholder")}
                  className="max-w-md"
                  disabled={brandingSaving}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">{t("admin.settings.systemColorLabel")}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBranding((prev) => (prev ? { ...prev, themeColor: undefined } : null))}
                    disabled={brandingSaving}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                      !branding.themeColor
                        ? "border-slate-700 dark:border-slate-300 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-[#0061bb] shrink-0 border border-slate-300 dark:border-slate-600" aria-hidden />
                    {t("admin.settings.systemColorDefault")}
                  </button>
                  {[
                    "#0061bb",
                    "#0ea5e9",
                    "#059669",
                    "#8b5cf6",
                    "#dc2626",
                    "#ea580c",
                    "#ca8a04",
                    "#2563eb",
                    "#7c3aed",
                    "#db2777",
                    "#0891b2",
                    "#4f46e5",
                  ].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setBranding((prev) => (prev ? { ...prev, themeColor: hex } : null))}
                      disabled={brandingSaving}
                      className={`w-8 h-8 rounded-full border-2 transition-transform disabled:opacity-50 hover:scale-110 ${
                        branding.themeColor === hex
                          ? "border-slate-800 dark:border-slate-200 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 ring-offset-1"
                          : "border-slate-300 dark:border-slate-600 hover:border-slate-500 dark:hover:border-slate-400"
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                      aria-label={hex}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Ẩn / Hiện giao diện — ngang hàng với Hệ thống */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <EyeOff className="h-4 w-4 shrink-0" />
            {t("admin.settings.visibilityCardTitle")}
          </h3>
        </div>
        <div className="p-3 flex-1">
          {visibilitySaveError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-2 py-1.5 text-xs text-red-700 dark:text-red-300 mb-2">
              {visibilitySaveError}
            </div>
          )}
          {branding != null && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("admin.settings.sidebarOnAdminTitle")}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-new-chat" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.showNewChat")}</Label>
                      <Switch id="show-new-chat" checked={!(branding.hideNewChatOnAdmin ?? false)} onCheckedChange={(v) => setBranding((prev) => (prev ? { ...prev, hideNewChatOnAdmin: !v } : null))} disabled={brandingSaving} />
                    </div>
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-apps-all" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.showAppsAll")}</Label>
                      <Switch id="show-apps-all" checked={!(branding.hideAppsAllOnAdmin ?? false)} onCheckedChange={(v) => setBranding((prev) => (prev ? { ...prev, hideAppsAllOnAdmin: !v } : null))} disabled={brandingSaving} />
                    </div>
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-assistants-all" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.showAssistantsAll")}</Label>
                      <Switch id="show-assistants-all" checked={!(branding.hideAssistantsAllOnAdmin ?? false)} onCheckedChange={(v) => setBranding((prev) => (prev ? { ...prev, hideAssistantsAllOnAdmin: !v } : null))} disabled={brandingSaving} />
                    </div>
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-projects" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.projectsEnabled")}</Label>
                      <Switch
                        id="show-projects"
                        checked={projectsEnabled}
                        onCheckedChange={async (checked) => {
                          setProjectsSaving(true)
                          try {
                            await patchAppSettings({ projects_enabled: checked })
                            setProjectsEnabled(checked)
                            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("branding-updated"))
                          } catch (_) {}
                          finally {
                            setProjectsSaving(false)
                          }
                        }}
                        disabled={projectsSaving}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{t("admin.settings.profileMenuTitle")}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-menu-profile" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.showMenuProfile")}</Label>
                      <Switch id="show-menu-profile" checked={!(branding.hideMenuProfile ?? false)} onCheckedChange={(v) => setBranding((prev) => (prev ? { ...prev, hideMenuProfile: !v } : null))} disabled={brandingSaving} />
                    </div>
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-menu-notifications" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.showMenuNotifications")}</Label>
                      <Switch id="show-menu-notifications" checked={!(branding.hideMenuNotifications ?? false)} onCheckedChange={(v) => setBranding((prev) => (prev ? { ...prev, hideMenuNotifications: !v } : null))} disabled={brandingSaving} />
                    </div>
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-menu-settings" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.showMenuSettings")}</Label>
                      <Switch id="show-menu-settings" checked={!(branding.hideMenuSettings ?? false)} onCheckedChange={(v) => setBranding((prev) => (prev ? { ...prev, hideMenuSettings: !v } : null))} disabled={brandingSaving} />
                    </div>
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-menu-admin" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.showMenuAdmin")}</Label>
                      <Switch id="show-menu-admin" checked={!(branding.hideMenuAdmin ?? false)} onCheckedChange={(v) => setBranding((prev) => (prev ? { ...prev, hideMenuAdmin: !v } : null))} disabled={brandingSaving} />
                    </div>
                    <div className="flex items-center justify-between gap-2 py-0.5">
                      <Label htmlFor="show-menu-dev-docs" className="text-xs font-normal cursor-pointer flex-1">{t("admin.settings.showMenuDevDocs")}</Label>
                      <Switch id="show-menu-dev-docs" checked={!(branding.hideMenuDevDocs ?? false)} onCheckedChange={(v) => setBranding((prev) => (prev ? { ...prev, hideMenuDevDocs: !v } : null))} disabled={brandingSaving} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <Label className="text-xs text-slate-500">{t("admin.settings.defaultLocale")}</Label>
              <Select
                value={defaultLocale}
                onValueChange={(v) => {
                  setDefaultLocale(v)
                  setSavingLocale(true)
                  setLocaleSaveError(null)
                  patchAppSettings({ default_locale: v })
                    .then((res) => {
                      setDefaultLocale(res.default_locale)
                      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("site-strings-updated"))
                    })
                    .catch((e: Error & { body?: { errorCode?: string } }) => {
                      const msg = e?.body?.errorCode ? t(`admin.settings.error.${e.body.errorCode}`) : ((e as Error)?.message ?? t("common.saveError"))
                      setLocaleSaveError(msg)
                    })
                    .finally(() => setSavingLocale(false))
                }}
              >
                <SelectTrigger className="w-full sm:w-48" disabled={savingLocale}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLocales.map((loc) => (
                    <SelectItem key={loc} value={loc}>{getLocaleLabel(loc)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {savingLocale && (
              <span className="text-xs text-slate-500">{t("common.saving")}</span>
            )}
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

      {/* SSO */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0" />
            {t("admin.settings.ssoTitle")}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {t("admin.settings.ssoDesc")}
          </p>
        </div>
        <div className="p-4 space-y-4 flex-1">
          {ssoSaveError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {ssoSaveError}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">{t("admin.settings.ssoProvider")}</Label>
            <Select value={ssoProvider} onValueChange={(v: "none" | "google" | "azure") => setSsoProvider(v)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("admin.settings.ssoOff")}</SelectItem>
                <SelectItem value="google">{t("admin.settings.ssoGoogle")}</SelectItem>
                <SelectItem value="azure">{t("admin.settings.ssoAzure")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {ssoProvider === "google" && (
            <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.ssoClientId")}</Label>
                <Input
                  value={ssoGoogleClientId}
                  onChange={(e) => setSsoGoogleClientId(e.target.value)}
                  placeholder="xxx.apps.googleusercontent.com"
                  className="font-mono text-sm"
                  disabled={ssoSaving}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.ssoClientSecret")}</Label>
                <Input
                  type="password"
                  value={ssoGoogleClientSecret}
                  onChange={(e) => setSsoGoogleClientSecret(e.target.value)}
                  placeholder={sso?.google?.clientSecretSet ? t("admin.settings.ssoSecretPlaceholder") : ""}
                  className="font-mono text-sm"
                  disabled={ssoSaving}
                />
              </div>
            </div>
          )}
          {ssoProvider === "azure" && (
            <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.ssoClientId")}</Label>
                <Input
                  value={ssoAzureClientId}
                  onChange={(e) => setSsoAzureClientId(e.target.value)}
                  placeholder="Application (client) ID"
                  className="font-mono text-sm"
                  disabled={ssoSaving}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.ssoTenantId")}</Label>
                <Input
                  value={ssoAzureTenantId}
                  onChange={(e) => setSsoAzureTenantId(e.target.value)}
                  placeholder="Directory (tenant) ID"
                  className="font-mono text-sm"
                  disabled={ssoSaving}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.ssoClientSecret")}</Label>
                <Input
                  type="password"
                  value={ssoAzureClientSecret}
                  onChange={(e) => setSsoAzureClientSecret(e.target.value)}
                  placeholder={sso?.azure?.clientSecretSet ? t("admin.settings.ssoSecretPlaceholder") : ""}
                  className="font-mono text-sm"
                  disabled={ssoSaving}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backup & Restore */}
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
        <div className="p-4 space-y-4">
          {backupError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {backupError}
            </div>
          )}
          {restoreError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {restoreError}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
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
            <input
              ref={restoreInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f || restoreLoading) return
                setRestoreError(null)
                setRestoreLoading(true)
                const formData = new FormData()
                formData.append("file", f)
                postRestoreBackup(formData)
                  .then(() => {
                    if (typeof window !== "undefined") {
                      window.alert(t("admin.settings.restoreSuccess"))
                      window.location.reload()
                    }
                  })
                  .catch((err: Error & { body?: { error?: string } }) => {
                    setRestoreError(err?.body?.error ?? (err as Error)?.message ?? t("admin.settings.restoreError"))
                  })
                  .finally(() => {
                    setRestoreLoading(false)
                    e.target.value = ""
                  })
              }}
            />
            <Button
              variant="outline"
              className="gap-2"
              disabled={restoreLoading}
              onClick={() => restoreInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {restoreLoading ? t("admin.settings.restoreRestoring") : t("admin.settings.restoreButton")}
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("admin.settings.backupRestoreHint")}
          </p>
        </div>
      </div>

      {/* Reset app — ngang hàng với Backup, không thể hoàn tác */}
      <div className="rounded-lg border border-red-200 dark:border-red-900 overflow-hidden bg-red-50/50 dark:bg-red-950/20">
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
    </div>
  )
}
