"use client"

import { useCallback, useEffect, useState } from "react"
import { ExternalLink, Loader2, CheckCircle2, XCircle, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getAdminSeoSettings, updateAdminSeoSettings } from "@/lib/api/admin"

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")

type Check = { state: "idle" | "loading" | "ok" | "fail"; detail?: string }

export function SeoTab() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [google, setGoogle] = useState("")
  const [bing, setBing] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [origin, setOrigin] = useState("")
  const [sitemapCheck, setSitemapCheck] = useState<Check>({ state: "idle" })
  const [metaCheck, setMetaCheck] = useState<Check>({ state: "idle" })

  useEffect(() => {
    setOrigin(window.location.origin)
    getAdminSeoSettings()
      .then((s) => {
        setGoogle(s.googleSiteVerification || "")
        setBing(s.bingSiteVerification || "")
      })
      .catch((e) => toast({ title: (e as Error).message, variant: "destructive" }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const siteUrl = origin + BASE_PATH
  const sitemapUrl = `${siteUrl}/sitemap.xml`
  const robotsUrl = `${siteUrl}/robots.txt`

  const save = async () => {
    setSaving(true)
    try {
      const s = await updateAdminSeoSettings({
        google_site_verification: google,
        bing_site_verification: bing,
      })
      setGoogle(s.googleSiteVerification)
      setBing(s.bingSiteVerification)
      toast({ title: t("admin.seo.saved") })
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast({ title: t("admin.seo.copied") }),
      () => {}
    )
  }

  const checkSitemap = useCallback(async () => {
    setSitemapCheck({ state: "loading" })
    try {
      const res = await fetch(sitemapUrl, { cache: "no-store" })
      const text = await res.text()
      const count = (text.match(/<loc>/g) || []).length
      if (!res.ok || count === 0) throw new Error(`HTTP ${res.status}, ${count} URL`)
      setSitemapCheck({ state: "ok", detail: t("admin.seo.sitemapOk").replace("{count}", String(count)) })
    } catch (e) {
      setSitemapCheck({ state: "fail", detail: (e as Error).message })
    }
  }, [sitemapUrl, t])

  // Kiểm tra thẻ meta đã xuất hiện trên trang công khai (sau khi lưu có thể trễ tới ~5 phút do cache).
  const checkMeta = useCallback(async () => {
    setMetaCheck({ state: "loading" })
    try {
      const res = await fetch(`${siteUrl}/welcome`, { cache: "no-store" })
      const html = await res.text()
      const found = /name="google-site-verification"\s+content="([^"]+)"/.exec(html)
      if (found) setMetaCheck({ state: "ok", detail: found[1] })
      else setMetaCheck({ state: "fail", detail: t("admin.seo.metaMissing") })
    } catch (e) {
      setMetaCheck({ state: "fail", detail: (e as Error).message })
    }
  }, [siteUrl, t])

  const Row = ({ label, url }: { label: string; url: string }) => (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <code className="rounded bg-muted px-2 py-1 break-all">{url}</code>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(url)} aria-label={t("admin.seo.copy")}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )

  const StatusLine = ({ c }: { c: Check }) =>
    c.state === "idle" ? null : c.state === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <span className={`inline-flex items-center gap-1 text-sm ${c.state === "ok" ? "text-green-600" : "text-destructive"}`}>
        {c.state === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {c.detail}
      </span>
    )

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">{t("admin.seo.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.seo.intro")}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="seo-google">{t("admin.seo.googleLabel")}</Label>
            <Input
              id="seo-google"
              value={google}
              onChange={(e) => setGoogle(e.target.value)}
              placeholder={t("admin.seo.googlePlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">{t("admin.seo.googleHelp")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="seo-bing">{t("admin.seo.bingLabel")}</Label>
            <Input
              id="seo-bing"
              value={bing}
              onChange={(e) => setBing(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.seo.save")}
            </Button>
            <Button variant="outline" onClick={checkMeta} disabled={metaCheck.state === "loading"}>
              {t("admin.seo.checkMeta")}
            </Button>
            <StatusLine c={metaCheck} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <h3 className="font-medium">{t("admin.seo.urlsTitle")}</h3>
          <Row label="Sitemap" url={sitemapUrl} />
          <Row label="robots.txt" url={robotsUrl} />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="outline" onClick={checkSitemap} disabled={sitemapCheck.state === "loading"}>
              {t("admin.seo.checkSitemap")}
            </Button>
            <StatusLine c={sitemapCheck} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <h3 className="font-medium">{t("admin.seo.stepsTitle")}</h3>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm">
            <li>
              {t("admin.seo.step1")}{" "}
              <a
                href="https://search.google.com/search-console/welcome"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Google Search Console <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <code className="ml-1 rounded bg-muted px-1.5 py-0.5">{siteUrl}/</code>
            </li>
            <li>{t("admin.seo.step2")}</li>
            <li>{t("admin.seo.step3")}</li>
            <li>{t("admin.seo.step4")}</li>
          </ol>
          <p className="text-xs text-muted-foreground">{t("admin.seo.note")}</p>
        </CardContent>
      </Card>
    </div>
  )
}
