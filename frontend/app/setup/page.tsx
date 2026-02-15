"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Database, User, Loader2, CheckCircle2, AlertCircle, Palette, ImagePlus, ArrowLeft, Bot, ExternalLink } from "lucide-react"

const API = {
  base: () => (typeof window !== "undefined" ? "" : ""),
  status: () =>
    fetch(`${API.base()}/api/setup/status`, { cache: "no-store" }).then((r) =>
      r.json().then((data) => ({ ...data, _status: r.status }))
    ) as Promise<{ needsSetup?: boolean; step?: "branding" | "database" | "admin"; databaseName?: string; error?: string; _status?: number }>,
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
}

export const dynamic = "force-dynamic"

const NAME_SUGGESTIONS = ["AI Portal", "AI Assistant System", "Virtual Assistant", "AI Gateway"]

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
  const [step, setStep] = useState<"branding" | "database" | "admin" | "central" | null>(null)
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
  const [dbAlreadyInitialized, setDbAlreadyInitialized] = useState(false)
  const prevStepRef = useRef<"branding" | "database" | "admin" | "central" | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [email, setEmail] = useState("user@example.com")
  const [password, setPassword] = useState("password123")
  const [displayName, setDisplayName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [centralProvider, setCentralProvider] = useState<"openai" | "gemini" | "skip">("skip")
  const [centralApiKey, setCentralApiKey] = useState("")
  const [centralLoading, setCentralLoading] = useState(false)
  const [centralError, setCentralError] = useState<string | null>(null)
  const adminCredentialsRef = useRef<{ email: string; password: string } | null>(null)

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
        const nextStep = data.step ?? "branding"
        setStep(nextStep)
        if (data.databaseName) setPlannedDatabaseName(data.databaseName)
        else if (nextStep !== "database") setPlannedDatabaseName(null)
        if (nextStep === "branding" || nextStep === "database") {
          API.branding().then((b) => {
            if (!cancelled && b.systemName) setSystemName(b.systemName)
            if (!cancelled && b.logoDataUrl) setLogoDataUrl(b.logoDataUrl)
          }).catch(() => {})
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError("Cannot connect to server. Check that the backend is running (e.g. npm run dev) and environment variables.")
        setStep("branding")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  // When moving to step 2: update suggested DB name from system name (step 1).
  useEffect(() => {
    if (step === "database") {
      if (prevStepRef.current !== "database") {
        const fromSystemName = systemName.trim() ? slugify(systemName) : ""
        const suggested = fromSystemName || plannedDatabaseName || "app"
        setDatabaseNameInput(suggested)
        prevStepRef.current = "database"
      }
    } else {
      prevStepRef.current = step
    }
  }, [step, plannedDatabaseName, systemName])

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

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = systemName.trim()
    if (!name) {
      setBrandingError("Please enter the system name.")
      return
    }
    if (!logoDataUrl) {
      setBrandingError("Please select a logo (icon) before continuing to step 2.")
      return
    }
    setBrandingError(null)
    setBrandingLoading(true)
    try {
      const res = await API.saveBranding({ system_name: name, logo: logoDataUrl ?? undefined })
      if (res.ok) {
        setStep("database")
      } else {
        setBrandingError(res.error || res.message || "Failed to save settings.")
      }
    } catch (e) {
      setBrandingError((e as Error)?.message ?? "Failed to save settings.")
    } finally {
      setBrandingLoading(false)
    }
  }

  const DB_NAME_REGEX = /^[a-z0-9_]{1,63}$/

  const handleInitDatabase = async (forceRecreate = false) => {
    const name = databaseNameInput.trim().toLowerCase()
    if (!name) {
      setError("Please enter the database name.")
      return
    }
    if (!DB_NAME_REGEX.test(name)) {
      setError("Database name may only contain lowercase letters, numbers and underscores (max 63 characters).")
      return
    }
    setInitLoading(true)
    setError(null)
    setDbAlreadyInitialized(false)
    try {
      const res = await API.initDatabase({ database_name: name, force_recreate: forceRecreate })
      if (res.ok) {
        setError(null)
        if (res.alreadyInitialized) {
          setDbAlreadyInitialized(true)
        } else {
          setStep("admin")
        }
      } else {
        setError(res.message || res.error || "Failed to initialize database")
      }
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to initialize database")
    } finally {
      setInitLoading(false)
    }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    const emailTrim = email.trim()
    const pwd = password
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setCreateError("Invalid email.")
      return
    }
    if (pwd.length < 6) {
      setCreateError("Password must be at least 6 characters.")
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
        setCreateError(res.error || res.message || "Failed to create account")
        // Database not fully initialized → go back to step 2
        if ((res as { code?: string }).code === "NEED_INIT_DATABASE") {
          setStep("database")
          setDbAlreadyInitialized(false)
        }
      }
    } catch (e) {
      setCreateError((e as Error)?.message ?? "Failed to create account")
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
      // Luôn chuyển thẳng tới /admin; tránh dùng signInResult.url vì NextAuth có thể trả /login?... → treo trang
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
      setCentralError("Could not save. You can still go to the admin panel and configure later.")
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Checking setup status…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">AI Portal Setup</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enter basic information to start the application for the first time.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {step === "branding" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5" />
                Step 1: System name and logo
              </CardTitle>
              <CardDescription>
                Set the display name and choose a logo (shown in the header and on the login page).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveBranding} className="space-y-4">
                {brandingError && (
                  <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {brandingError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="setup-system-name">System name <span className="text-red-500">*</span></Label>
                  <Input
                    id="setup-system-name"
                    type="text"
                    placeholder="VD: AI Portal"
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    disabled={brandingLoading}
                    autoComplete="off"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Suggestions:{" "}
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
                  <Label>System logo <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Choose a preset logo or upload one (JPG, PNG, SVG; square or landscape, max 2MB).
                  </p>
                  {!logoDataUrl && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                      Please select a logo below or upload an image to continue.
                    </p>
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
                        <span className="text-xs text-slate-500 dark:text-slate-400">Or upload a logo:</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={brandingLoading}
                        >
                          Choose image
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
                            Remove logo
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
                <Button type="submit" disabled={brandingLoading || !logoDataUrl} className="w-full gap-2">
                  {brandingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Save and continue
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "database" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Step 2: Database setup
              </CardTitle>
              <CardDescription>
                Database name is suggested from the system name (step 1); you can edit or keep it. PostgreSQL must be running and connection details in .env.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dbAlreadyInitialized ? (
                <>
                  <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Database has been initialized. No need to run again. You can go to step 3 or recreate the database.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => { setStep("branding"); setDbAlreadyInitialized(false) }} className="gap-2 shrink-0">
                      <ArrowLeft className="h-4 w-4" />
                      Back to step 1
                    </Button>
                    <Button onClick={() => { setStep("admin"); setDbAlreadyInitialized(false) }} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Continue to step 3
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (typeof window !== "undefined" && window.confirm("Recreating will delete all data in the current schema. Are you sure you want to recreate?")) {
                          handleInitDatabase(true)
                        }
                      }}
                      disabled={initLoading}
                      className="gap-2"
                    >
                      {initLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Recreating…
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4" />
                          Recreate database
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="setup-db-name">Database name</Label>
                    <Input
                      id="setup-db-name"
                      type="text"
                      placeholder="ai_portal"
                      value={databaseNameInput}
                      onChange={(e) => setDatabaseNameInput(e.target.value)}
                      disabled={initLoading}
                      className="font-mono"
                      autoComplete="off"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Use only lowercase letters, numbers and underscores (max 63 characters). Suggested from system name &quot;{systemName || "—"}&quot; → <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{plannedDatabaseName || (systemName.trim() ? slugify(systemName) : "app")}</code>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep("branding")} className="gap-2 shrink-0">
                      <ArrowLeft className="h-4 w-4" />
                      Back to step 1
                    </Button>
                    <Button onClick={() => handleInitDatabase(false)} disabled={initLoading} className="flex-1 gap-2">
                      {initLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Initializing…
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4" />
                          Initialize database
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    If you get &quot;psql not found&quot;, install the PostgreSQL client (psql) or run the schema manually.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {step === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Step 3: Create admin account
              </CardTitle>
              <CardDescription>
                Create the first admin account. You will use this email and password to sign in and access the admin panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button type="button" variant="outline" onClick={() => setStep("database")} className="gap-2 w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4" />
                Back to step 2
              </Button>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                {createError && (
                  <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {createError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="setup-email">Email</Label>
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
                  <Label htmlFor="setup-password">Password (min 6 characters)</Label>
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
                  <Label htmlFor="setup-display">Display name (optional)</Label>
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
                <Button type="submit" disabled={createLoading} className="w-full gap-2">
                  {createLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Create account and sign in
                    </>
                  )}
                </Button>
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
                  Step 4: Central AI assistant
                </CardTitle>
                <span className="rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium px-2.5 py-0.5">
                  Optional
                </span>
              </div>
              <CardDescription>
                The main Q&A assistant. Choose a provider and enter an API key below, or skip to configure later in the admin panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {centralError && (
                <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {centralError}
                </div>
              )}
              <form onSubmit={handleCentralSave} className="space-y-4">
                <div className="space-y-3">
                  <Label>Choose provider (or skip)</Label>
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
                          <span className="font-medium">Configure later</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Do not set a provider now. You can configure the Central AI assistant later in the admin panel.
                          </p>
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCentralSkip}
                    disabled={centralLoading}
                    className="gap-2"
                  >
                    {centralLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Skip — Configure later
                  </Button>
                  <Button type="submit" disabled={centralLoading} className="gap-2">
                    {centralLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Save and finish
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
