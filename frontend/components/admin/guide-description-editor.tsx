"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { useSession } from "next-auth/react"
import { ImagePlus } from "lucide-react"
import { API_CONFIG } from "@/lib/config"
import { rewriteMinioUrlForBrowser } from "@/lib/storage-url-browser"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GuideBodyRenderer } from "@/components/guide-body-renderer"
import type { GuideCkEditorApi } from "./guide-ckeditor-inner"

const GuideCkEditorInner = dynamic(
  () => import("./guide-ckeditor-inner").then((m) => m.GuideCkEditorInner),
  { ssr: false, loading: () => <p className="text-xs text-muted-foreground py-6">…</p> }
)

const GUIDE_SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024

function markdownSafeAlt(name: string): string {
  return name.replace(/[[\]]/g, "").trim() || "screenshot"
}

function GuideEditorToolbar({
  disabled,
  uploading,
  onPickImage,
  t,
}: {
  disabled?: boolean
  uploading: boolean
  onPickImage: () => void
  t: (key: string) => string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Label className="text-xs">{t("admin.pages.cardDescriptionLabel")}</Label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        disabled={disabled || uploading}
        onClick={onPickImage}
      >
        <ImagePlus className="h-3.5 w-3.5 mr-1" />
        {uploading ? t("admin.pages.uploadingScreenshot") : t("admin.pages.insertScreenshot")}
      </Button>
    </div>
  )
}

export function GuideCardDescriptionEditor({
  value,
  onChange,
  disabled,
  t,
  cardIndex,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  t: (key: string) => string
  cardIndex: number
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<GuideCkEditorApi | null>(null)
  const [uploading, setUploading] = useState(false)
  const { data: session } = useSession()
  const { toast } = useToast()
  const apiBase = API_CONFIG.baseUrl.replace(/\/+$/, "")
  const userEmail = session?.user?.email?.trim() || "guide-page"

  useEffect(() => {
    editorRef.current = null
  }, [cardIndex])

  const runUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: t("admin.pages.screenshotNotImage"), variant: "destructive" })
        return
      }
      if (file.size > GUIDE_SCREENSHOT_MAX_BYTES) {
        toast({ title: t("admin.pages.screenshotTooLarge"), variant: "destructive" })
        return
      }
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("userEmail", userEmail)
        const uploadUrl = `${apiBase}/api/upload?folder=guide-page`
        const res = await fetch(uploadUrl, { method: "POST", body: formData })
        const data = (await res.json().catch(() => ({}))) as {
          status?: string
          files?: string[]
          error?: string
        }
        const ok = res.ok && (res.status === 200 || res.status === 207)
        const rawUrl = ok && data.files?.[0]
        const url = rawUrl ? rewriteMinioUrlForBrowser(rawUrl) : ""
        if (!url) {
          toast({
            title: t("admin.pages.screenshotUploadError"),
            description: typeof data.error === "string" ? data.error : undefined,
            variant: "destructive",
          })
          return
        }
        const ed = editorRef.current
        if (ed) {
          try {
            ed.execute("insertImage", { source: url })
            return
          } catch {
            const alt = markdownSafeAlt(file.name.replace(/\.[^.]+$/, ""))
            const snippet = `<figure class="image"><img alt="${alt.replace(/"/g, "&quot;")}" src="${url.replace(/"/g, "&quot;")}"></figure>`
            try {
              onChange(ed.getData() + snippet)
              return
            } catch {
              /* fall through */
            }
          }
        }
        const alt = markdownSafeAlt(file.name.replace(/\.[^.]+$/, ""))
        onChange((value || "") + `\n\n![${alt}](${url})\n`)
      } catch {
        toast({ title: t("admin.pages.screenshotUploadError"), variant: "destructive" })
      } finally {
        setUploading(false)
      }
    },
    [apiBase, onChange, t, toast, userEmail, value]
  )

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) void runUpload(file)
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onFileChange}
      />
      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9 mb-2">
          <TabsTrigger value="edit" className="text-xs">
            {t("admin.pages.guideEditTab")}
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">
            {t("admin.pages.guidePreviewTab")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="mt-0 space-y-2">
          <GuideEditorToolbar
            disabled={disabled}
            uploading={uploading}
            onPickImage={() => fileInputRef.current?.click()}
            t={t}
          />
          <div className="rounded-md border border-input overflow-hidden bg-background">
            <GuideCkEditorInner
              cardIndex={cardIndex}
              value={value}
              onChange={onChange}
              disabled={disabled}
              t={t}
              apiBase={apiBase}
              userEmail={userEmail}
              onReady={(ed) => {
                editorRef.current = ed
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("admin.pages.guideCkHint")}</p>
        </TabsContent>
        <TabsContent value="preview" className="mt-0 rounded-md border border-border/60 bg-muted/20 p-3 min-h-[240px] max-h-[min(480px,50vh)] overflow-y-auto">
          <GuideBodyRenderer source={value} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
