"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import { ExternalLink, FolderSearch, Loader2, MessageSquareText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { chatRemarkPlugins, prepareChatMarkdown } from "@/lib/markdown-plugins"
import { DESKTOP_ASK_EVENT, type DesktopFilePreview, type NeuDesktopFolderBridge } from "@/lib/desktop-bridge"

/** Tách CSV/TSV đơn giản (có ngoặc kép) — chỉ để xem trước, tối đa `maxRows` dòng. */
export function parseDelimited(text: string, sep: string, maxRows = 200): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
      continue
    }
    if (c === '"' && cell === "") quoted = true
    else if (c === sep) {
      row.push(cell)
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      if (rows.length >= maxRows) return rows
    } else cell += c
  }
  if (cell !== "" || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

/**
 * Khung xem trước một tệp trong thư mục đã liên kết (ứng dụng ≥ 0.3.0). Chỉ đọc — nội dung do tiến trình chính
 * của app trích (văn bản, Markdown, CSV, .docx/.pdf/.xlsx/.pptx, ảnh), không tải lên máy chủ.
 */
export function FilePreviewPane({
  api,
  projectId,
  relPath,
  mtimeMs,
  revealLabel,
  canAsk,
  onClose,
  onError,
}: {
  api: NeuDesktopFolderBridge
  projectId: string
  relPath: string
  /** Đổi khi tệp thay đổi trên đĩa ⇒ tải lại. */
  mtimeMs?: number
  revealLabel: string
  canAsk: boolean
  onClose: () => void
  onError: (e: unknown) => void
}) {
  const { t, locale } = useLanguage()
  const [preview, setPreview] = useState<DesktopFilePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    api
      .previewFile(projectId, relPath)
      .then((p) => alive && setPreview(p))
      .catch((e) => {
        if (!alive) return
        setPreview(null)
        setError((e as Error)?.message ?? String(e))
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [api, projectId, relPath, mtimeMs])

  const dateFmt = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", { dateStyle: "short", timeStyle: "short" })
  const name = preview?.name ?? relPath.split("/").pop() ?? relPath

  const body = () => {
    if (loading && !preview) {
      return (
        <p className="p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("desktopFolder.loading")}
        </p>
      )
    }
    if (error) return <p className="p-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>
    if (!preview) return null
    if (preview.kind === "image" && preview.dataUrl) {
      return (
        <div className="p-3 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.dataUrl} alt={preview.name} className="max-w-full max-h-[22rem] object-contain rounded border border-gray-100 dark:border-gray-700" />
          {preview.width && preview.height ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {preview.width} × {preview.height} px
            </span>
          ) : null}
        </div>
      )
    }
    if (preview.kind === "markdown" && preview.text !== undefined) {
      return (
        <div className="p-3 text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5">
          {/* Tệp cục bộ: không tải ảnh/liên kết từ Internet khi xem trước (tránh lộ thông tin), chỉ hiện chữ. */}
          <ReactMarkdown
            remarkPlugins={chatRemarkPlugins}
            components={{
              a: ({ children, href }) => (
                <span className="underline decoration-dotted" title={href}>
                  {children}
                </span>
              ),
              img: ({ alt }) => <span className="text-muted-foreground">[{alt || "ảnh"}]</span>,
            }}
          >
            {prepareChatMarkdown(preview.text)}
          </ReactMarkdown>
        </div>
      )
    }
    if (preview.kind === "csv" && preview.text !== undefined) {
      const rows = parseDelimited(preview.text, preview.ext === "tsv" ? "\t" : ",")
      return (
        <div className="overflow-auto">
          <table className="text-xs border-collapse min-w-full" data-testid="desktop-preview-table">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i === 0 ? "bg-muted/60 font-semibold" : "odd:bg-muted/20"}>
                  {r.map((c, j) => (
                    <td key={j} className="border border-gray-100 dark:border-gray-700 px-2 py-1 whitespace-nowrap max-w-[16rem] truncate">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    if ((preview.kind === "text" || preview.kind === "document") && preview.text !== undefined) {
      return <pre className="p-3 text-xs leading-5 whitespace-pre-wrap break-words font-mono text-gray-800 dark:text-gray-200">{preview.text}</pre>
    }
    return <p className="p-3 text-sm text-muted-foreground">{preview.note ?? t("desktopFolder.previewUnsupported")}</p>
  }

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700/70 flex flex-col min-h-0" data-testid="desktop-preview" data-relpath={relPath}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/70">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={relPath}>
            {name}
          </p>
          {preview && (
            <p className="text-[11px] text-muted-foreground tabular-nums truncate">
              {formatSize(preview.size)} · {dateFmt.format(new Date(preview.mtimeMs))}
              {relPath.includes("/") ? ` · ${relPath.slice(0, relPath.lastIndexOf("/"))}/` : ""}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} title={t("desktopFolder.closePreview")} aria-label={t("desktopFolder.closePreview")}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700/70">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={preview ? !preview.openable : false}
          title={preview && !preview.openable ? t("desktopFolder.openBlocked") : undefined}
          onClick={() => void api.openFile(projectId, relPath).catch(onError)}
          data-testid="desktop-preview-open"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t("desktopFolder.openFile")}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void api.revealInFolder(projectId, relPath).catch(onError)}>
          <FolderSearch className="h-3.5 w-3.5" />
          {revealLabel}
        </Button>
        {canAsk && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              window.dispatchEvent(new CustomEvent(DESKTOP_ASK_EVENT, { detail: { projectId, text: t("desktopFolder.askTemplate").replace("{path}", relPath) } }))
            }
            data-testid="desktop-preview-ask"
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            {t("desktopFolder.askAssistant")}
          </Button>
        )}
      </div>
      <div className="overflow-auto max-h-[26rem] min-h-[8rem]">{body()}</div>
      {preview?.truncated && <p className="px-3 py-1 text-[11px] text-muted-foreground border-t border-gray-100 dark:border-gray-700/70">{t("desktopFolder.previewTruncated")}</p>}
    </div>
  )
}
