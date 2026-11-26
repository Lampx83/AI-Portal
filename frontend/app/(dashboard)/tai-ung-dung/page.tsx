"use client"

import { useEffect, useMemo, useState } from "react"
import { Apple, Download, Monitor, ShieldCheck, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { getDesktopBridge } from "@/lib/desktop-bridge"

/** Thông tin phát hành do agent build đặt cạnh tệp cài đặt (apps/launching/public/downloads/latest.json trên máy chủ). */
type ReleaseFile = { name: string; os: "mac" | "win"; arch: "arm64" | "x64"; size: number; sha256: string; url: string }
type Release = { version: string; date: string; notes?: string[]; files: ReleaseFile[] }

type Platform = "mac-arm64" | "mac-x64" | "mac" | "win" | "other"

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ""
const MANIFEST_URL = `${BASE_PATH}/embed/launching/downloads/latest.json`

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "")
}

/** Đoán hệ điều hành/kiến trúc. Safari không cho biết chip Mac → trả "mac" (hiện cả hai bản). */
async function detectPlatform(): Promise<Platform> {
  if (typeof navigator === "undefined") return "other"
  const ua = navigator.userAgent || ""
  if (/Windows/i.test(ua)) return "win"
  if (!/Mac OS X|Macintosh/i.test(ua) || /iPhone|iPad|iPod/i.test(ua)) return "other"
  const uaData = (navigator as unknown as { userAgentData?: { getHighEntropyValues?: (h: string[]) => Promise<{ architecture?: string }> } }).userAgentData
  try {
    const v = await uaData?.getHighEntropyValues?.(["architecture"])
    if (v?.architecture === "arm") return "mac-arm64"
    if (v?.architecture === "x86") return "mac-x64"
  } catch {
    /* trình duyệt không hỗ trợ — rơi xuống đoán qua WebGL */
  }
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null
    const ext = gl?.getExtension("WEBGL_debug_renderer_info")
    const renderer = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : ""
    if (/Apple M\d|Apple GPU/i.test(renderer)) return "mac-arm64"
    if (/Intel|AMD|Radeon/i.test(renderer)) return "mac-x64"
  } catch {
    /* bỏ qua */
  }
  return "mac"
}

function fileKey(f: ReleaseFile): Platform {
  if (f.os === "win") return "win"
  return f.arch === "arm64" ? "mac-arm64" : "mac-x64"
}

export default function DesktopDownloadPage() {
  const { t } = useLanguage()
  const [release, setRelease] = useState<Release | null>(null)
  const [error, setError] = useState(false)
  const [platform, setPlatform] = useState<Platform>("other")
  const [inAppVersion, setInAppVersion] = useState<string | null>(null)

  useEffect(() => {
    fetch(MANIFEST_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Release) => setRelease(d))
      .catch(() => setError(true))
    detectPlatform().then(setPlatform)
    const bridge = getDesktopBridge()
    if (bridge) setInAppVersion(bridge.version)
  }, [])

  const labelFor = (f: ReleaseFile) =>
    f.os === "win" ? t("desktopDownload.win") : f.arch === "arm64" ? t("desktopDownload.macArm") : t("desktopDownload.macIntel")
  const iconFor = (f: ReleaseFile) => (f.os === "win" ? Monitor : Apple)

  const { primary, others } = useMemo(() => {
    const files = release?.files ?? []
    const match = files.filter((f) =>
      platform === "mac" ? f.os === "mac" : platform === "other" ? false : fileKey(f) === platform
    )
    return { primary: match, others: files.filter((f) => !match.includes(f)) }
  }, [release, platform])

  const sizeMb = (n: number) => fill(t("desktopDownload.size"), { size: (n / 1024 / 1024).toFixed(0) })

  const FileRow = ({ f, highlight }: { f: ReleaseFile; highlight?: boolean }) => {
    const Icon = iconFor(f)
    return (
      <div className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center ${highlight ? "border-primary/50 bg-primary/5" : ""}`}>
        <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{labelFor(f)}</div>
          <div className="text-xs text-muted-foreground break-all">
            {f.name} · {sizeMb(f.size)}
          </div>
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">{t("desktopDownload.checksum")}</summary>
            <code className="break-all">{f.sha256}</code>
          </details>
        </div>
        <Button asChild className={highlight ? "bg-brand hover:bg-brand/90 text-white" : undefined} variant={highlight ? "default" : "outline"}>
          <a href={`${BASE_PATH}${f.url}`} download={f.name}>
            <Download className="h-4 w-4" />
            {t("desktopDownload.download")}
          </a>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
        <div className="mb-6 flex items-start gap-3">
          <Laptop className="mt-1 h-8 w-8 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">{t("desktopDownload.title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("desktopDownload.subtitle")}</p>
          </div>
        </div>

        {inAppVersion && (
          <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            {fill(t("desktopDownload.inApp"), { version: inAppVersion })}
          </div>
        )}

        {!release && !error && <p className="text-muted-foreground">{t("desktopDownload.loading")}</p>}
        {error && <p className="text-destructive">{t("desktopDownload.loadError")}</p>}

        {release && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">{t("desktopDownload.beta")}</span>
              <span>{fill(t("desktopDownload.version"), { version: release.version, date: release.date.split("-").reverse().join("/") })}</span>
            </div>

            {primary.length > 0 && (
              <div className="mb-6 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("desktopDownload.recommended")}</h2>
                {primary.map((f) => (
                  <FileRow key={f.name} f={f} highlight />
                ))}
              </div>
            )}

            {others.length > 0 && (
              <div className="mb-8 space-y-3">
                {primary.length > 0 && (
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("desktopDownload.otherVersions")}</h2>
                )}
                {others.map((f) => (
                  <FileRow key={f.name} f={f} />
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {release.notes && release.notes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t("desktopDownload.whatsNew")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {release.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("desktopDownload.howToInstall")}</CardTitle>
                  <CardDescription className="flex items-start gap-2 pt-1">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{t("desktopDownload.privacy")}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    <strong>macOS.</strong> {t("desktopDownload.macSteps")}
                  </p>
                  <p className="text-muted-foreground">{t("desktopDownload.macWhichChip")}</p>
                  <p>
                    <strong>Windows.</strong> {t("desktopDownload.winSteps")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
