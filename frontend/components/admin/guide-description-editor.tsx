"use client"

import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import { API_CONFIG } from "@/lib/config"
import { rewriteMinioHostsInHtml } from "@/lib/storage-url-browser"
import { Label } from "@/components/ui/label"

// Also imported from guide-ckeditor-inner (dynamic). Reference here so Turbopack keeps this module
// in this graph after HMR; otherwise the dynamic chunk can lose the factory (Next 16 / Turbopack).
void rewriteMinioHostsInHtml

const GuideCkEditorInner = dynamic(
  () => import("./guide-ckeditor-inner").then((m) => m.GuideCkEditorInner),
  { ssr: false, loading: () => <p className="text-xs text-muted-foreground py-6">…</p> }
)

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
  const { data: session } = useSession()
  const apiBase = API_CONFIG.baseUrl.replace(/\/+$/, "")
  const userEmail = session?.user?.email?.trim() || "guide-page"

  return (
    <div className="space-y-2">
      <Label className="text-xs">{t("admin.pages.cardDescriptionLabel")}</Label>
      {/* overflow-visible: CKEditor balloon (căn ảnh, resize) nằm ngoài box — overflow-hidden sẽ cắt mất */}
      <div className="rounded-md border border-input overflow-visible bg-background relative z-0 [&_.ck-balloon-panel]:z-[100]">
        <GuideCkEditorInner
          cardIndex={cardIndex}
          value={value}
          onChange={onChange}
          disabled={disabled}
          t={t}
          apiBase={apiBase}
          userEmail={userEmail}
        />
      </div>
    </div>
  )
}
