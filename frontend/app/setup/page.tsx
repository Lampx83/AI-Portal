"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { signIn, getSession } from "next-auth/react"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Database, User, Loader2, CheckCircle2, AlertCircle, Palette, ImagePlus, ArrowLeft, ArrowRight, Bot, ExternalLink, Languages, Archive, Home, Settings } from "lucide-react"
import Link from "next/link"
import { t as i18nT, BUILTIN_LOCALES, getLocaleLabel, type Locale, type BuiltinLocale } from "@/lib/i18n"

const API = {
  base: () => (typeof window !== "undefined" ? "" : ""),
  status: () =>
    fetch(`${API.base()}/api/setup/status`, { cache: "no-store" }).then((r) =>
      r.json().then((data) => ({ ...data, _status: r.status }))
    ) as Promise<{ needsSetup?: boolean; step?: "language" | "branding" | "database" | "admin"; databaseName?: string; error?: string; _status?: number }>,
  language: () =>
    fetch(`${API.base()}/api/setup/language`, { cache: "no-store" }).then((r) => r.json()) as Promise<{ defaultLocale?: string }>,
  saveLanguage: (body: { default_locale: string }) =>
    fetch(`${API.base()}/api/setup/language`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()) as Promise<{ ok?: boolean; error?: string; default_locale?: string }>,
  branding: () =>
    fetch(`${API.base()}/api/setup/branding`, { cache: "no-store" }).then((r) => r.json()) as Promise<{ systemName?: string; logoDataUrl?: string }>,
  saveBranding: (body: { system_name: string; logo?: string }) =>
    fetch(`${API.base()}/api/setup/branding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()) as Promise<{ ok?: boolean; error?: string; message?: string }>,
  initDatabase: (body?: { database_name?: string; force_recreate?: boolean }) =>
    fetch(`${API.base()}/api/setup/init-database`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then((r) => r.json()) as Promise<{ ok?: boolean; error?: string; message?: string; alreadyInitialized?: boolean }>,
  currentDatabase: () =>
    fetch(`${API.base()}/api/setup/current-database`, { cache: "no-store" }).then((r) => r.json()) as Promise<{ databaseName?: string }>,
  createAdmin: (body: { email: string; password: string; display_name?: string }) =>
    fetch(`${API.base()}/api/setup/create-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()) as Promise<{ ok?: boolean; error?: string; message?: string }>,
  saveCentralAssistant: (body: { provider: "openai" | "gemini" | "skip"; api_key?: string }) =>
    fetch(`${API.base()}/api/setup/central-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()) as Promise<{ ok?: boolean; error?: string; message?: string }>,
  restore: (formData: FormData) =>
    fetch(`${API.base()}/api/setup/restore`, {
      method: "POST",
      credentials: "include",
      body: formData,
    }).then((r) => r.json()) as Promise<{ ok?: boolean; error?: string; message?: string }>,
}

export const dynamic = "force-dynamic"

const NAME_SUGGESTIONS = ["AI Portal", "AI Assistant System", "Virtual Assistant", "AI Gateway"]

const SETUP_STEPS: { id: "language" | "branding" | "database" | "admin" | "central"; num: number }[] = [
  { id: "language", num: 1 },
  { id: "branding", num: 2 },
  { id: "database", num: 3 },
  { id: "admin", num: 4 },
  { id: "central", num: 5 },
]
const TOTAL_STEPS = SETUP_STEPS.length

const CENTRAL_PROVIDERS: { id: "openai" | "gemini"; name: string; description: string; keyLabel: string; keyPlaceholder: string; docUrl: string; docText: string }[] = [
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    description: "GPT-4, GPT-4o models for the main Q&A assistant.",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-...",
    docUrl: "https://platform.openai.com/api-keys",
    docText: "Get API key at platform.openai.com",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Google Gemini models. Requires an API key from Google AI Studio.",
    keyLabel: "Google AI API Key",
    keyPlaceholder: "AIza...",
    docUrl: "https://aistudio.google.com/apikey",
    docText: "Get API key at Google AI Studio",
  },
]

/**
 * Database name from system name: no spaces, non-ASCII (e.g. Vietnamese) → ASCII equivalent.
 * E.g. "Research" → "research", "AI Portal" → "ai_portal".
 */
function slugify(s: string): string {
  let t = s.trim()
  if (!t) return "app"
  t = t.replace(/đ/g, "d").replace(/Đ/g, "D")
  t = t.normalize("NFD").replace(/\p{M}/gu, "")
  t = t.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  return t || "app"
}

// Preset logos: SVG from Lucide Icons (ISC), rendered as data URL
const svg = (stroke: string, body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  )}`

const PRESET_LOGOS: { id: string; label: string; src: string }[] = [
  {
    id: "bot",
    label: "Robot",
    src: svg("#0ea5e9", '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>'),
  },
  {
    id: "sparkles",
    label: "Sparkles",
    src: svg("#8b5cf6", '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>'),
  },
  {
    id: "brain",
    label: "Brain",
    src: svg("#ec4899", '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>'),
  },
  {
    id: "message-circle",
    label: "Chat",
    src: svg("#10b981", '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
  },
  {
    id: "layout-dashboard",
    label: "Dashboard",
    src: svg("#f59e0b", '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
  },
]

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<"language" | "branding" | "database" | "admin" | "central" | null>(null)
  const [setupLocale, setSetupLocale] = useState<Locale>("en")
  const [languageSelectedByUser, setLanguageSelectedByUser] = useState(false)
  const [languageLoading, setLanguageLoading] = useState(false)
  const [languageError, setLanguageError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [systemName, setSystemName] = useState("")
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [brandingLoading, setBrandingLoading] = useState(false)
  const [brandingError, setBrandingError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [plannedDatabaseName, setPlannedDatabaseName] = useState<string | null>(null)
  const [databaseNameInput, setDatabaseNameInput] = useState("")
  const [initLoading, setInitLoading] = useState(false)
  const prevStepRef = useRef<"language" | "branding" | "database" | "admin" | "central" | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [email, setEmail] = useState("user@example.com")
  const [password, setPassword] = useState("password123")
  const [displayName, setDisplayName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [step4ActualDatabaseName, setStep4ActualDatabaseName] = useState<string | null>(null)
  const [centralProvider, setCentralProvider] = useState<"openai" | "gemini" | "skip">("skip")
  const [centralApiKey, setCentralApiKey] = useState("")
  const [centralLoading, setCentralLoading] = useState(false)
  const [centralError, setCentralError] = useState<string | null>(null)
  const adminCredentialsRef = useRef<{ email: string; password: string } | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [finishDialogOpen, setFinishDialogOpen] = useState(false)
  const [dbExistsDialogOpen, setDbExistsDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    API.status()
      .then((data) => {
        if (cancelled) return
        if (data.needsSetup !== true) {
          router.replace("/")
          return
        }
        if (data.error && data._status && data._status >= 400) setError(data.error)
        const nextStep = data.step ?? "language"
        setStep(nextStep)
        if (data.databaseName) setPlannedDatabaseName(data.databaseName)
        else if (nextStep !== "database") setPlannedDatabaseName(null)
        API.language().then((l) => {
          if (!cancelled && l.defaultLocale) {
            const loc = l.defaultLocale as string
            setSetupLocale(BUILTIN_LOCALES.includes(loc as Locale) ? (loc as Locale) : "en")
          }
        }).catch(() => {})
        if (nextStep === "branding" || nextStep === "database") {
          API.branding().then((b) => {
            if (!cancelled && b.systemName) setSystemName(b.systemName)
            if (!cancelled && b.logoDataUrl) setLogoDataUrl(b.logoDataUrl)
          }).catch(() => {})
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError(t("errorConnect"))
        setStep("language")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  // When entering step 3: prefer database name backend is using (setup-db.json) so form and step 4 use same name.
  useEffect(() => {
    if (step === "database") {
      if (prevStepRef.current !== "database") {
        prevStepRef.current = "database"
        const fromSystemName = systemName.trim() ? slugify(systemName) : ""
        const fallback = fromSystemName || plannedDatabaseName || "app"
        API.currentDatabase()
          .then((data) => {
            const name = typeof data.databaseName === "string" && data.databaseName.trim() ? data.databaseName.trim() : null
            setDatabaseNameInput(name ?? fallback)
          })
          .catch(() => setDatabaseNameInput(fallback))
      }
    } else {
      prevStepRef.current = step
    }
  }, [step, plannedDatabaseName, systemName])

  useEffect(() => {
    if (step === "language") {
      API.language().then((l) => {
        if (l.defaultLocale) {
          const loc = l.defaultLocale as string
          setSetupLocale(BUILTIN_LOCALES.includes(loc as Locale) ? (loc as Locale) : "en")
        }
      }).catch(() => {})
    }
  }, [step])

  // Step 4: get actual database name backend is using (setup-db.json) to display correctly and match errors.
  useEffect(() => {
    if (step !== "admin") {
      setStep4ActualDatabaseName(null)
      return
    }
    API.currentDatabase()
      .then((data) => setStep4ActualDatabaseName(typeof data.databaseName === "string" ? data.databaseName : null))
      .catch(() => setStep4ActualDatabaseName(null))
  }, [step])

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return
    setSelectedPresetId(null)
    const reader = new FileReader()
    reader.onload = () => setLogoDataUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handlePresetLogo = (preset: { id: string; label: string; src: string }) => {
    setSelectedPresetId(preset.id)
    setLogoDataUrl(preset.src)
  }

  const handleClearLogo = () => {
    setLogoDataUrl(null)
    setSelectedPresetId(null)
  }

  const SETUP_LOCALE_FLAGS: Record<BuiltinLocale, string> = {
    en: "🇺🇸",
    vi: "🇻🇳",
    zh: "🇨🇳",
    hi: "🇮🇳",
    es: "🇪🇸",
  }
  const SETUP_LOCALES = BUILTIN_LOCALES.map((code) => ({
    code,
    label: getLocaleLabel(code),
    flag: SETUP_LOCALE_FLAGS[code] ?? "🌐",
  }))

  const t = (key: string) => i18nT(setupLocale, `setup.${key}`)
  const currentStepNum = step ? SETUP_STEPS.findIndex((s) => s.id === step) + 1 : 0
  const adminFormValid =
    step === "admin" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 6
  const goToStep = (target: (typeof SETUP_STEPS)[number]["id"]) => {
    setStep(target)
  }

  const proceedFromLanguage = async () => {
    setLanguageError(null)
    setLanguageLoading(true)
    try {
      const res = await API.saveLanguage({ default_locale: setupLocale })
      if (res.ok) {
        setStep("branding")
      } else {
        setLanguageError(res.error || t("errorSaveLanguage"))
      }
    } catch (e) {
      setLanguageError((e as Error)?.message ?? t("errorSaveLanguage"))
    } finally {
      setLanguageLoading(false)
    }
  }

  const handleSaveBranding = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const name = systemName.trim()
    if (!name) {
      setBrandingError(t("errorSystemName"))
      return
    }
    if (!logoDataUrl) {
      setBrandingError(t("errorLogo"))
      return
    }
    setBrandingError(null)
    setBrandingLoading(true)
    try {
      const res = await API.saveBranding({ system_name: name, logo: logoDataUrl ?? undefined })
      if (res.ok) {
        setStep("database")
      } else {
        setBrandingError(res.error || res.message || t("errorSaveSettings"))
      }
    } catch (e) {
      setBrandingError((e as Error)?.message ?? t("errorSaveSettings"))
    } finally {
      setBrandingLoading(false)
    }
  }

  const DB_NAME_REGEX = /^[a-z0-9_]{1,63}$/

  const handleInitDatabase = async (forceRecreate = false) => {
    const name = databaseNameInput.trim().toLowerCase()
    if (!name) {
      setError(t("errorDbName"))
      return
    }
    if (!DB_NAME_REGEX.test(name)) {
      setError(t("errorDbFormat"))
      return
    }
    setInitLoading(true)
    setError(null)
    try {
      const res = await API.initDatabase({ database_name: name, force_recreate: forceRecreate })
      if (res.ok) {
        setError(null)
        setStep4ActualDatabaseName(name)
        if (res.alreadyInitialized && !forceRecreate) {
          setDbExistsDialogOpen(true)
        } else {
          setStep("admin")
        }
      } else {
        setError(res.message || res.error || t("errorInitDb"))
      }
    } catch (e) {
      setError((e as Error)?.message ?? t("errorInitDb"))
    } finally {
      setInitLoading(false)
    }
  }

  const handleStep3Next = async () => {
    await handleInitDatabase(false)
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    const emailTrim = email.trim()
    const pwd = password
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setCreateError(t("errorInvalidEmail"))
      return
    }
    if (pwd.length < 6) {
      setCreateError(t("errorPasswordLength"))
      return
    }
    setCreateLoading(true)
    try {
      const res = await API.createAdmin({
        email: emailTrim,
        password: pwd,
        display_name: displayName.trim() || undefined,
      })
      if (res.ok) {
        adminCredentialsRef.current = { email: emailTrim, password: pwd }
        setStep("central")
      } else {
        setCreateError(res.message || res.error || t("errorCreateAccount"))
        // Database not fully initialized → go back to step 2
        if ((res as { code?: string }).code === "NEED_INIT_DATABASE") {
          setStep("database")
        }
      }
    } catch (e) {
      setCreateError((e as Error)?.message ?? t("errorCreateAccount"))
    } finally {
      setCreateLoading(false)
    }
  }

  const finishSetupAndGoToAdmin = async () => {
    const creds = adminCredentialsRef.current
    if (!creds) {
      router.replace("/login?callbackUrl=%2Fadmin")
      return
    }
    const signInResult = await signIn("credentials", {
      email: creds.email,
      password: creds.password,
      callbackUrl: "/admin",
      redirect: false,
    })
    if (signInResult?.ok) {
      // Call getSession so server session (with is_admin) is updated; short delay for cookie to apply before navigating
      await getSession()
      await new Promise((r) => setTimeout(r, 150))
      window.location.href = "/admin"
      return
    }
    router.replace("/login?callbackUrl=%2Fadmin")
  }

  const handleCentralSkip = async () => {
    setCentralError(null)
    setCentralLoading(true)
    try {
      await API.saveCentralAssistant({ provider: "skip" })
      await finishSetupAndGoToAdmin()
    } catch {
      setCentralError(t("errorCentral"))
    } finally {
      setCentralLoading(false)
    }
  }

  const handleCentralSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setCentralError(null)
    setCentralLoading(true)
    try {
      const provider = centralProvider === "skip" ? "skip" : centralProvider
      await API.saveCentralAssistant({
        provider,
        api_key: provider !== "skip" && centralApiKey.trim() ? centralApiKey.trim() : undefined,
      })
      await finishSetupAndGoToAdmin()
    } catch (err: any) {
      setCentralError(err?.message || "Could not save. Try again or skip.")
    } finally {
      setCentralLoading(false)
    }
  }

  const handleFinishStep5 = async () => {
    setCentralError(null)
    setCentralLoading(true)
    try {
      const provider = centralProvider === "skip" ? "skip" : centralProvider
      await API.saveCentralAssistant({
        provider,
        api_key: provider !== "skip" && centralApiKey.trim() ? centralApiKey.trim() : undefined,
      })
      setFinishDialogOpen(true)
    } catch (err: any) {
      setCentralError(err?.message || t("errorCentral"))
    } finally {
      setCentralLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("checkingStatus")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("subtitle")}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {step === "language" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Languages className="h-5 w-5" />
                {t("step1Title")}
              </CardTitle>
              <CardDescription>{t("step1Desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {languageError && (
                  <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {languageError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("defaultLanguage")}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SETUP_LOCALES.map(({ code, label, flag }) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setSetupLocale(code)
                          setLanguageSelectedByUser(true)
                        }}
                        className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                          setupLocale === code
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <span className="text-lg leading-none" aria-hidden>{flag}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("step1SelectThenNext")}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "branding" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5" />
                {t("step2Title")}
              </CardTitle>
              <CardDescription>{t("step2Desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {brandingError && (
                  <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {brandingError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="setup-system-name">{t("systemName")} <span className="text-red-500">*</span></Label>
                  <Input
                    id="setup-system-name"
                    type="text"
                    placeholder={t("systemNamePlaceholder")}
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    disabled={brandingLoading}
                    autoComplete="off"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("suggestions")}{" "}
                    {NAME_SUGGESTIONS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSystemName(name)}
                        className="mr-1.5 mt-1 inline-flex items-center rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {name}
                      </button>
                    ))}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("systemLogo")} <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t("logoHint")}</p>
                  {!logoDataUrl && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">{t("logoRequired")}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {PRESET_LOGOS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handlePresetLogo(preset)}
                        disabled={brandingLoading}
                        className={`flex flex-col items-center rounded-lg border-2 p-2 w-16 h-16 overflow-hidden transition-colors ${
                          selectedPresetId === preset.id
                            ? "border-primary bg-primary/10"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                        title={preset.label}
                      >
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <Image
                            src={preset.src}
                            alt={preset.label}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full text-center mt-0.5">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start gap-4 pt-2">
                    <div className="flex items-center gap-3">
                      {logoDataUrl ? (
                        <div className="relative w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900">
                          <Image src={logoDataUrl} alt="Logo" fill className="object-contain" unoptimized />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                          <ImagePlus className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t("orUpload")}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={brandingLoading}
                        >
                          {t("chooseImage")}
                        </Button>
                        {logoDataUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-500"
                            onClick={handleClearLogo}
                            disabled={brandingLoading}
                          >
                            {t("removeLogo")}
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
              </div>
            </CardContent>
          </Card>
        )}

        {step === "database" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                {t("step3Title")}
              </CardTitle>
              <CardDescription>{t("step3Desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={restoreInputRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (!f || restoreLoading) return
                  setRestoreLoading(true)
                  setRestoreError(null)
                  const formData = new FormData()
                  formData.append("file", f)
                  try {
                    const res = await API.restore(formData)
                    if (res.ok) {
                      const status = await API.status()
                      if (status.needsSetup !== true) {
                        router.replace("/")
                        return
                      }
                      setRestoreError(null)
                      setStep(status.step === "database" ? "admin" : (status.step ?? "admin"))
                    } else {
                      setRestoreError(res.error || res.message || t("restoreError"))
                    }
                  } catch (err) {
                    setRestoreError((err as Error)?.message ?? t("restoreError"))
                  } finally {
                    setRestoreLoading(false)
                  }
                }}
              />
              {restoreError && (
                <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {restoreError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="setup-db-name">{t("databaseName")}</Label>
                <Input
                  id="setup-db-name"
                  type="text"
                  placeholder={t("databasePlaceholder")}
                  value={databaseNameInput}
                  onChange={(e) => setDatabaseNameInput(e.target.value)}
                  disabled={initLoading}
                  className="font-mono"
                  autoComplete="off"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("dbNameHint")} &quot;{systemName || "—"}&quot; → <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{plannedDatabaseName || (systemName.trim() ? slugify(systemName) : "app")}</code>
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("restoreHint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-dashed"
                  disabled={restoreLoading || initLoading}
                  onClick={() => restoreInputRef.current?.click()}
                >
                  {restoreLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("restoreRestoring")}
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      {t("restoreButton")}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("psqlHint")}</p>
            </CardContent>
          </Card>
        )}

        {step === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                {t("step4Title")}
              </CardTitle>
              <CardDescription>{t("step4Desc")}</CardDescription>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                <Database className="h-4 w-4 shrink-0" />
                {t("step4DatabaseInfo").replace("{name}", step4ActualDatabaseName ?? (databaseNameInput.trim() || plannedDatabaseName || "—"))}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                {createError && (
                  <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {createError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="setup-email">{t("email")}</Label>
                  <Input
                    id="setup-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={createLoading}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-password">{t("password")}</Label>
                  <Input
                    id="setup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={createLoading}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-display">{t("displayName")}</Label>
                  <Input
                    id="setup-display"
                    type="text"
                    placeholder="Administrator"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={createLoading}
                    autoComplete="name"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("step4FillThenNext")}</p>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "central" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5" />
                  {t("step5Title")}
                </CardTitle>
                <span className="rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium px-2.5 py-0.5">
                  {t("optional")}
                </span>
              </div>
              <CardDescription>{t("step5Desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {centralError && (
                <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {centralError}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); handleFinishStep5(); }} className="space-y-4">
                <div className="space-y-3">
                  <Label>{t("chooseProvider")}</Label>
                  <div className="grid gap-3">
                    <div
                      className={`rounded-lg border-2 p-4 transition-colors ${
                        centralProvider === "skip" ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="central_provider"
                          checked={centralProvider === "skip"}
                          onChange={() => setCentralProvider("skip")}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <span className="font-medium">{t("configureLater")}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("configureLaterDesc")}</p>
                        </div>
                      </label>
                    </div>
                    {CENTRAL_PROVIDERS.map((p) => (
                      <div
                        key={p.id}
                        className={`rounded-lg border-2 p-4 transition-colors ${
                          centralProvider === p.id ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="central_provider"
                            checked={centralProvider === p.id}
                            onChange={() => setCentralProvider(p.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{p.name}</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.description}</p>
                            <a
                              href={p.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              {p.docText}
                            </a>
                            {centralProvider === p.id && (
                              <div className="mt-3">
                                <Label htmlFor={`central-key-${p.id}`} className="text-xs">{p.keyLabel}</Label>
                                <Input
                                  id={`central-key-${p.id}`}
                                  type="password"
                                  placeholder={p.keyPlaceholder}
                                  value={centralApiKey}
                                  onChange={(e) => setCentralApiKey(e.target.value)}
                                  disabled={centralLoading}
                                  className="mt-1 font-mono text-sm"
                                  autoComplete="off"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  You can leave this blank and configure later in Admin → Settings.
                                </p>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                  {t("step5ClickFinish")}
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        <Dialog open={dbExistsDialogOpen} onOpenChange={setDbExistsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {t("dbExistsTitle")}
              </DialogTitle>
              <DialogDescription>{t("dbExistsMessage")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={initLoading}
                onClick={async () => {
                  await handleInitDatabase(true)
                  setDbExistsDialogOpen(false)
                }}
                className="gap-2"
              >
                {initLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("recreating")}
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    {t("recreateAndContinue")}
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDbExistsDialogOpen(false)
                  setStep4ActualDatabaseName(databaseNameInput.trim() || null)
                  setStep("admin")
                }}
                className="gap-2"
              >
                {t("justContinue")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                {t("congratsTitle")}
              </DialogTitle>
              <DialogDescription asChild>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  {t("congratsDesc")}
                </p>
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/welcome"
                className="flex items-center gap-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 transition-colors hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10"
              >
                <Home className="h-5 w-5 text-primary shrink-0" />
                <div className="text-left">
                  <span className="font-medium block">{t("goToWelcome")}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t("goToWelcomeDesc")}</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setFinishDialogOpen(false)
                  finishSetupAndGoToAdmin()
                }}
                className="flex items-center gap-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 transition-colors hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 text-left w-full"
              >
                <Settings className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <span className="font-medium block">{t("goToAdmin")}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t("goToAdminDesc")}</span>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {step && (
          <nav
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 flex items-center justify-between gap-3"
            aria-label={t("stepIndicatorLabel")}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const idx = SETUP_STEPS.findIndex((s) => s.id === step)
                if (idx > 0) goToStep(SETUP_STEPS[idx - 1].id)
              }}
              disabled={currentStepNum <= 1}
              className="gap-1.5 text-slate-600 dark:text-slate-400 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </Button>
            <div className="flex items-center justify-center gap-1.5">
              {SETUP_STEPS.map(({ id, num }) => {
                const isCurrent = step === id
                const isPast = currentStepNum > num
                const canGo = isPast || isCurrent
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => canGo && goToStep(id)}
                    disabled={!canGo}
                    aria-current={isCurrent ? "step" : undefined}
                    title={t("goToStep").replace("{n}", String(num))}
                    className={`rounded-full transition-colors shrink-0 ${
                      isCurrent
                        ? "h-2.5 w-2.5 sm:h-3 sm:w-3 bg-primary ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900"
                        : isPast
                          ? "h-2 w-2 sm:h-2.5 sm:w-2.5 bg-slate-400 dark:bg-slate-500 hover:bg-slate-500 dark:hover:bg-slate-400 cursor-pointer"
                          : "h-2 w-2 sm:h-2.5 sm:w-2.5 bg-slate-200 dark:bg-slate-700 cursor-not-allowed"
                    }`}
                  />
                )
              })}
            </div>
            <Button
              type="button"
              variant={step === "language" || step === "branding" || step === "database" || step === "admin" || step === "central" ? "default" : "ghost"}
              size="sm"
              onClick={async () => {
                if (step === "language") {
                  await proceedFromLanguage()
                  return
                }
                if (step === "branding") {
                  await handleSaveBranding()
                  return
                }
                if (step === "database") {
                  await handleStep3Next()
                  return
                }
                if (step === "admin") {
                  handleCreateAdmin({ preventDefault: () => {} } as React.FormEvent)
                  return
                }
                if (step === "central") {
                  await handleFinishStep5()
                  return
                }
                const idx = SETUP_STEPS.findIndex((s) => s.id === step)
                if (idx >= 0 && idx < SETUP_STEPS.length - 1) goToStep(SETUP_STEPS[idx + 1].id)
              }}
              disabled={
                step === "language"
                  ? !languageSelectedByUser || languageLoading
                  : step === "branding"
                    ? !systemName.trim() || !logoDataUrl || brandingLoading
                    : step === "database"
                      ? initLoading ||
                        restoreLoading ||
                        !databaseNameInput.trim() ||
                        !DB_NAME_REGEX.test(databaseNameInput.trim().toLowerCase())
                      : step === "admin"
                        ? !adminFormValid || createLoading
                        : step === "central"
                          ? centralLoading
                          : currentStepNum >= TOTAL_STEPS
              }
              className={`gap-1.5 shrink-0 ${
                step === "language" || step === "branding" || step === "database" || step === "admin" || step === "central"
                  ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900 shadow-md"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {(step === "language" && languageLoading) || (step === "branding" && brandingLoading) || (step === "database" && initLoading) || (step === "admin" && createLoading) || (step === "central" && centralLoading) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === "central" ? (
                <>
                  {t("finish")}
                  <CheckCircle2 className="h-4 w-4" />
                </>
              ) : (
                <>
                  {t("next")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </nav>
        )}
      </div>
    </div>
  )
}
