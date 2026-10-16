"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderSearch,
  HardDrive,
  ImageIcon,
  Link2Off,
  Loader2,
  Lock,
  RefreshCw,
  Replace,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import {
  getDesktopBridge,
  type DesktopFileEntry,
  type DesktopLinkedFolder,
  type NeuDesktopBridge,
} from "@/lib/desktop-bridge"
import { FolderAssistantPanel } from "@/components/desktop/folder-assistant-panel"

const SPREADSHEET = new Set(["csv", "tsv", "xls", "xlsx", "ods", "sav", "dta", "parquet"])
const TEXT = new Set(["txt", "md", "doc", "docx", "odt", "rtf", "pdf", "tex", "bib", "json", "r", "rmd", "qmd", "ipynb"])
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "tif", "tiff", "bmp"])

function FileIcon({ entry, open }: { entry: DesktopFileEntry; open?: boolean }) {
  const cls = "h-4 w-4 shrink-0"
  if (entry.type === "dir") return open ? <FolderOpen className={`${cls} text-amber-500`} /> : <Folder className={`${cls} text-amber-500`} />
  if (SPREADSHEET.has(entry.ext)) return <FileSpreadsheet className={`${cls} text-emerald-600 dark:text-emerald-400`} />
  if (IMAGE.has(entry.ext)) return <ImageIcon className={`${cls} text-violet-500`} />
  if (TEXT.has(entry.ext)) return <FileText className={`${cls} text-blue-600 dark:text-blue-400`} />
  return <File className={`${cls} text-muted-foreground`} />
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

type DirState = { entries: DesktopFileEntry[]; truncated: boolean }

/**
 * Thẻ «Thư mục trên máy» trên trang dự án. Chỉ hiện khi chạy trong ứng dụng desktop NEU Research
 * (có `window.neuDesktop`); trên trình duyệt thường trả về null.
 * Giai đoạn 1: chỉ xem/mở tệp — không ghi, không tải tệp lên máy chủ.
 * Giai đoạn 2: bên dưới thẻ là khung «Trợ lý thư mục» (ứng dụng ≥ 0.2.0, sau khi đã liên kết thư mục).
 */
export function LocalFolderCard({ projectId }: { projectId: string }) {
  const { t, locale } = useLanguage()
  const { toast } = useToast()
  const [api, setApi] = useState<NeuDesktopBridge | null>(null)
  const [linked, setLinked] = useState<DesktopLinkedFolder | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [dirs, setDirs] = useState<Record<string, DirState>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded

  const fail = useCallback(
    (e: unknown) => toast({ title: t("desktopFolder.error"), description: (e as Error)?.message ?? String(e), variant: "destructive" }),
    [t, toast],
  )

  useEffect(() => {
    setApi(getDesktopBridge())
  }, [])

  /** Đọc lại thư mục gốc và các thư mục con đang mở. */
  const reload = useCallback(
    async (a: NeuDesktopBridge, info: DesktopLinkedFolder | null) => {
      if (!info?.exists) {
        setDirs({})
        return
      }
      const paths = ["", ...[...expandedRef.current]]
      const next: Record<string, DirState> = {}
      const stillOpen = new Set<string>()
      await Promise.all(
        paths.map(async (p) => {
          try {
            const r = await a.listFiles(projectId, p)
            next[p] = { entries: r.entries, truncated: r.truncated }
            if (p) stillOpen.add(p)
          } catch {
            /* thư mục con đã bị xoá → đóng lại */
          }
        }),
      )
      setDirs(next)
      setExpanded(stillOpen)
    },
    [projectId],
  )

  const loadLinked = useCallback(async () => {
    if (!api || !projectId) return
    try {
      const info = await api.getLinkedFolder(projectId)
      setLinked(info)
      await reload(api, info)
    } catch (e) {
      fail(e)
    } finally {
      setLoaded(true)
    }
  }, [api, projectId, reload, fail])

  useEffect(() => {
    setLinked(null)
    setDirs({})
    setExpanded(new Set())
    setLoaded(false)
    void loadLinked()
  }, [loadLinked])

  // Báo cho menu ứng dụng biết dự án đang mở; tự cập nhật khi tệp thay đổi.
  useEffect(() => {
    if (!api || !projectId) return
    api.setActiveProject(projectId)
    return () => api.setActiveProject(null)
  }, [api, projectId])

  useEffect(() => {
    if (!api || !projectId || !linked?.exists) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const off = api.onFolderChange(projectId, () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void reload(api, linked), 150)
    })
    return () => {
      if (timer) clearTimeout(timer)
      off()
    }
  }, [api, projectId, linked, reload])

  const handleLink = useCallback(async () => {
    if (!api) return
    setBusy(true)
    try {
      const dir = await api.pickProjectFolder()
      if (!dir) return
      const info = await api.linkProjectFolder(projectId, dir)
      setLinked(info)
      setExpanded(new Set())
      expandedRef.current = new Set()
      await reload(api, info)
      toast({ title: t("desktopFolder.linked").replace("{name}", info.name) })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }, [api, projectId, reload, fail, t, toast])

  // «Tệp → Mở thư mục dự án…» trong menu ứng dụng dùng chung luồng liên kết.
  useEffect(() => {
    if (!api) return
    return api.onMenuCommand((c) => {
      if (c === "link-folder") void handleLink()
    })
  }, [api, handleLink])

  const handleUnlink = async () => {
    if (!api) return
    try {
      await api.unlinkProjectFolder(projectId)
      setLinked(null)
      setDirs({})
      setExpanded(new Set())
      toast({ title: t("desktopFolder.unlinked") })
    } catch (e) {
      fail(e)
    }
  }

  const toggleDir = async (relPath: string) => {
    if (!api) return
    const next = new Set(expanded)
    if (next.has(relPath)) {
      next.delete(relPath)
      setExpanded(next)
      return
    }
    try {
      const r = await api.listFiles(projectId, relPath)
      setDirs((d) => ({ ...d, [relPath]: { entries: r.entries, truncated: r.truncated } }))
      next.add(relPath)
      setExpanded(next)
    } catch (e) {
      fail(e)
    }
  }

  if (!api || !projectId) return null

  const isMac = api.platform === "darwin"
  const revealLabel = isMac ? t("desktopFolder.revealFinder") : api.platform === "win32" ? t("desktopFolder.revealExplorer") : t("desktopFolder.revealFolder")
  const dateFmt = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", { dateStyle: "short", timeStyle: "short" })
  const root = dirs[""]

  const renderDir = (relPath: string, depth: number): ReactNode => {
    const d = dirs[relPath]
    if (!d) return null
    if (d.entries.length === 0 && depth === 0) {
      return <p className="px-3 py-4 text-sm text-muted-foreground">{t("desktopFolder.empty")}</p>
    }
    return (
      <>
        {d.entries.map((e) => {
          const isOpen = e.type === "dir" && expanded.has(e.relPath)
          return (
            <div key={e.relPath}>
              <div
                className="group flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/70 text-sm"
                style={{ paddingLeft: 8 + depth * 16 }}
                data-relpath={e.relPath}
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
                  onClick={() =>
                    e.type === "dir" ? void toggleDir(e.relPath) : void api.openFile(projectId, e.relPath).catch(fail)
                  }
                  title={e.type === "dir" ? e.relPath : `${t("desktopFolder.openFile")}: ${e.relPath}`}
                >
                  {e.type === "dir" ? (
                    isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <FileIcon entry={e} open={isOpen} />
                  <span className="truncate text-gray-900 dark:text-gray-100">{e.name}</span>
                </button>
                <span className="hidden sm:block w-16 text-right text-xs text-muted-foreground tabular-nums shrink-0">
                  {e.type === "file" ? formatSize(e.size) : ""}
                </span>
                <span className="hidden md:block w-28 text-right text-xs text-muted-foreground tabular-nums shrink-0">
                  {dateFmt.format(new Date(e.mtimeMs))}
                </span>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => void api.revealInFolder(projectId, e.relPath).catch(fail)}
                  title={t("desktopFolder.revealItem")}
                  aria-label={`${t("desktopFolder.revealItem")}: ${e.name}`}
                >
                  <FolderSearch className="h-3.5 w-3.5" />
                </button>
              </div>
              {isOpen && renderDir(e.relPath, depth + 1)}
            </div>
          )
        })}
        {d.truncated && (
          <p className="px-3 py-1 text-xs text-amber-700 dark:text-amber-400" style={{ paddingLeft: 8 + depth * 16 }}>
            {t("desktopFolder.truncated")}
          </p>
        )}
      </>
    )
  }

  return (
    <>
    <section className="w-full mb-8 text-left" aria-labelledby="desktop-folder-title" data-testid="desktop-folder-card">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/40">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
          <HardDrive className="h-4 w-4 text-primary shrink-0" />
          <h2 id="desktop-folder-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("desktopFolder.title")}
          </h2>
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium px-2 py-0.5">
            {t("desktopFolder.badge")}
          </span>
          {linked?.exists && (
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-xs" onClick={() => void api.revealInFolder(projectId).catch(fail)}>
                <ExternalLink className="h-3.5 w-3.5" />
                {revealLabel}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void loadLinked()} title={t("desktopFolder.refresh")} aria-label={t("desktopFolder.refresh")}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {!loaded ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("desktopFolder.loading")}
          </p>
        ) : !linked ? (
          <div className="px-4 pb-4">
            <p className="text-sm text-muted-foreground mb-3">{t("desktopFolder.intro")}</p>
            <Button size="sm" className="gap-1.5" onClick={() => void handleLink()} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
              {t("desktopFolder.link")}
            </Button>
          </div>
        ) : (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 min-w-0 mb-2">
              <Folder className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100 shrink-0">{linked.name}</span>
              <span className="text-xs text-muted-foreground truncate" title={linked.path}>
                {linked.path}
              </span>
            </div>
            {!linked.exists ? (
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">{t("desktopFolder.missing")}</p>
            ) : (
              <div className="rounded-lg border border-gray-100 dark:border-gray-700/70 max-h-72 overflow-auto py-1" role="tree" aria-label={linked.name}>
                {root ? renderDir("", 0) : <p className="px-3 py-3 text-sm text-muted-foreground">{t("desktopFolder.loading")}</p>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1 mt-2">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void handleLink()} disabled={busy}>
                <Replace className="h-3.5 w-3.5" />
                {t("desktopFolder.change")}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => setConfirmUnlink(true)}>
                <Link2Off className="h-3.5 w-3.5" />
                {t("desktopFolder.unlink")}
              </Button>
              {linked.exists && root && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {t("desktopFolder.items").replace("{n}", String(root.entries.length))} · {t("desktopFolder.updated")}
                </span>
              )}
            </div>
          </div>
        )}

        <p className="flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-700/70 px-4 py-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" />
          {t("desktopFolder.privacy")}
        </p>
      </div>

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("desktopFolder.unlinkTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("desktopFolder.unlinkDesc").replace("{name}", linked?.name ?? "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("desktopFolder.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleUnlink()}>{t("desktopFolder.unlink")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
    {loaded && linked && <FolderAssistantPanel projectId={projectId} linked={linked} />}
    </>
  )
}
