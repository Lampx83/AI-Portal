"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react"
import {
  ChevronDown,
  ChevronRight,
  Clock,
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
  Presentation,
  RefreshCw,
  Replace,
  Search,
  X,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import {
  getDesktopAgentBridge,
  getDesktopBridge,
  getDesktopFolderBridge,
  type DesktopFileEntry,
  type DesktopLinkedFolder,
  type DesktopRecentFolder,
  type DesktopSearchMode,
  type DesktopSearchResult,
  type NeuDesktopBridge,
  type NeuDesktopFolderBridge,
} from "@/lib/desktop-bridge"
import { FolderAssistantPanel } from "@/components/desktop/folder-assistant-panel"
import { FilePreviewPane } from "@/components/desktop/file-preview-pane"

const SPREADSHEET = new Set(["csv", "tsv", "xls", "xlsx", "ods", "sav", "dta", "parquet"])
const TEXT = new Set(["txt", "md", "doc", "docx", "odt", "rtf", "pdf", "tex", "bib", "json", "r", "rmd", "qmd", "ipynb"])
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "tif", "tiff", "bmp"])
const SLIDES = new Set(["ppt", "pptx", "odp", "key"])
/** Một trang khi liệt kê thư mục (app ≥ 0.3.0 phân trang được). */
const PAGE = 500

function FileIcon({ entry, open }: { entry: Pick<DesktopFileEntry, "type" | "ext">; open?: boolean }) {
  const cls = "h-4 w-4 shrink-0"
  if (entry.type === "dir") return open ? <FolderOpen className={`${cls} text-amber-500`} /> : <Folder className={`${cls} text-amber-500`} />
  if (SPREADSHEET.has(entry.ext)) return <FileSpreadsheet className={`${cls} text-emerald-600 dark:text-emerald-400`} />
  if (IMAGE.has(entry.ext)) return <ImageIcon className={`${cls} text-violet-500`} />
  if (SLIDES.has(entry.ext)) return <Presentation className={`${cls} text-orange-500`} />
  if (TEXT.has(entry.ext)) return <FileText className={`${cls} text-blue-600 dark:text-blue-400`} />
  return <File className={`${cls} text-muted-foreground`} />
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

type DirState = { entries: DesktopFileEntry[]; truncated: boolean; total?: number }

/**
 * Thẻ «Thư mục trên máy» trên trang dự án. Chỉ hiện khi chạy trong ứng dụng desktop NEU Research
 * (có `window.neuDesktop`); trên trình duyệt thường trả về null.
 * Giai đoạn 1: chỉ xem/mở tệp — không ghi, không tải tệp lên máy chủ.
 * Giai đoạn 2: bên dưới thẻ là khung «Trợ lý thư mục» (ứng dụng ≥ 0.2.0, sau khi đã liên kết thư mục).
 * 0.3.0 (tự nhận biết theo API của app): tìm tên + nội dung toàn thư mục, xem trước tệp, phân trang thư mục lớn,
 * thư mục gần đây, kéo-thả thư mục để liên kết. App cũ vẫn thấy thẻ như trước.
 */
export function LocalFolderCard({ projectId }: { projectId: string }) {
  const { t, locale } = useLanguage()
  const { toast } = useToast()
  const [api, setApi] = useState<NeuDesktopBridge | null>(null)
  const [fapi, setFapi] = useState<NeuDesktopFolderBridge | null>(null)
  const [hasAgent, setHasAgent] = useState(false)
  const [linked, setLinked] = useState<DesktopLinkedFolder | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [dirs, setDirs] = useState<Record<string, DirState>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  // 0.3.0
  const [selected, setSelected] = useState<{ relPath: string; mtimeMs?: number } | null>(null)
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<DesktopSearchMode>("all")
  const [result, setResult] = useState<DesktopSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [recent, setRecent] = useState<DesktopRecentFolder[]>([])
  const [dragOver, setDragOver] = useState(false)
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  const searchSeq = useRef(0)

  const fail = useCallback(
    (e: unknown) => toast({ title: t("desktopFolder.error"), description: (e as Error)?.message ?? String(e), variant: "destructive" }),
    [t, toast],
  )

  useEffect(() => {
    setApi(getDesktopBridge())
    setFapi(getDesktopFolderBridge())
    setHasAgent(!!getDesktopAgentBridge())
  }, [])

  const listPage = useCallback(
    (a: NeuDesktopBridge, p: string, offset = 0) => (fapi ? a.listFiles(projectId, p, { offset, limit: PAGE }) : a.listFiles(projectId, p)),
    [fapi, projectId],
  )

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
            const r = await listPage(a, p)
            next[p] = { entries: r.entries, truncated: r.truncated, total: r.total }
            if (p) stillOpen.add(p)
          } catch {
            /* thư mục con đã bị xoá → đóng lại */
          }
        }),
      )
      setDirs(next)
      setExpanded(stillOpen)
    },
    [listPage],
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
    setSelected(null)
    setQuery("")
    setResult(null)
    void loadLinked()
  }, [loadLinked])

  // Báo cho menu ứng dụng biết dự án đang mở; tự cập nhật khi tệp thay đổi.
  useEffect(() => {
    if (!api || !projectId) return
    api.setActiveProject(projectId)
    return () => api.setActiveProject(null)
  }, [api, projectId])

  const runSearch = useCallback(
    async (q: string, m: DesktopSearchMode) => {
      if (!fapi) return
      const seq = ++searchSeq.current
      if (q.trim().length < 2) {
        setResult(null)
        setSearching(false)
        return
      }
      setSearching(true)
      try {
        const r = await fapi.searchFiles(projectId, q.trim(), { mode: m, limit: 200 })
        if (seq === searchSeq.current && !r.cancelled) setResult(r)
      } catch (e) {
        if (seq === searchSeq.current) {
          setResult(null)
          fail(e)
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false)
      }
    },
    [fapi, projectId, fail],
  )

  // Gõ tới đâu tìm tới đó (chờ 300 ms sau phím cuối); tìm mới huỷ tìm cũ ở tiến trình chính.
  useEffect(() => {
    if (!fapi) return
    const h = setTimeout(() => void runSearch(query, mode), 300)
    return () => clearTimeout(h)
  }, [fapi, query, mode, runSearch])

  const queryRef = useRef(query)
  queryRef.current = query
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    if (!api || !projectId || !linked?.exists) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const off = api.onFolderChange(projectId, (ev) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void reload(api, linked)
        // Tệp đang xem trước vừa đổi → tải lại khung xem trước; đang tìm → tìm lại.
        setSelected((s) => (s && (ev.paths.length === 0 || ev.paths.some((p) => p === s.relPath || p.normalize("NFC") === s.relPath.normalize("NFC"))) ? { ...s, mtimeMs: Date.now() } : s))
        if (queryRef.current.trim().length >= 2) void runSearch(queryRef.current, modeRef.current)
      }, 150)
    })
    return () => {
      if (timer) clearTimeout(timer)
      off()
    }
  }, [api, projectId, linked, reload, runSearch])

  const afterLinked = useCallback(
    async (info: DesktopLinkedFolder) => {
      if (!api) return
      setLinked(info)
      setExpanded(new Set())
      expandedRef.current = new Set()
      setSelected(null)
      setQuery("")
      setResult(null)
      await reload(api, info)
      toast({ title: t("desktopFolder.linked").replace("{name}", info.name) })
    },
    [api, reload, t, toast],
  )

  const handleLink = useCallback(async () => {
    if (!api) return
    setBusy(true)
    try {
      const dir = await api.pickProjectFolder()
      if (!dir) return
      await afterLinked(await api.linkProjectFolder(projectId, dir))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }, [api, projectId, afterLinked, fail])

  const handleLinkRecent = async (p: string) => {
    if (!fapi) return
    setBusy(true)
    try {
      await afterLinked(await fapi.linkRecentFolder(projectId, p))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const loadRecent = useCallback(async () => {
    if (!fapi) return
    try {
      setRecent(await fapi.listRecentFolders())
    } catch {
      setRecent([])
    }
  }, [fapi])

  useEffect(() => {
    if (loaded && !linked) void loadRecent()
  }, [loaded, linked, loadRecent])

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
      setSelected(null)
      setQuery("")
      setResult(null)
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
      const r = await listPage(api, relPath)
      setDirs((d) => ({ ...d, [relPath]: { entries: r.entries, truncated: r.truncated, total: r.total } }))
      next.add(relPath)
      setExpanded(next)
    } catch (e) {
      fail(e)
    }
  }

  const loadMore = async (relPath: string) => {
    if (!api || !fapi) return
    const cur = dirs[relPath]
    if (!cur) return
    try {
      const r = await api.listFiles(projectId, relPath, { offset: cur.entries.length, limit: PAGE })
      setDirs((d) => {
        const c = d[relPath]
        if (!c) return d
        const seen = new Set(c.entries.map((e) => e.relPath))
        return { ...d, [relPath]: { entries: [...c.entries, ...r.entries.filter((e) => !seen.has(e.relPath))], truncated: r.truncated, total: r.total } }
      })
    } catch (e) {
      fail(e)
    }
  }

  // ── Kéo-thả thư mục (app ≥ 0.3.0) ──
  const canDrop = !!fapi && typeof fapi.pickDroppedFolder === "function"
  const onDragOver = (e: DragEvent) => {
    if (!canDrop || !e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "link"
    if (!dragOver) setDragOver(true)
  }
  const onDrop = async (e: DragEvent) => {
    if (!canDrop) return
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !fapi) return
    setBusy(true)
    try {
      const dir = await fapi.pickDroppedFolder(file)
      if (!dir) return
      await afterLinked(await fapi.linkProjectFolder(projectId, dir))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  if (!api || !projectId) return null

  const isMac = api.platform === "darwin"
  const revealLabel = isMac ? t("desktopFolder.revealFinder") : api.platform === "win32" ? t("desktopFolder.revealExplorer") : t("desktopFolder.revealFolder")
  const revealItemLabel = isMac ? t("desktopFolder.revealFinder") : api.platform === "win32" ? t("desktopFolder.revealExplorer") : t("desktopFolder.revealItem")
  const dateFmt = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", { dateStyle: "short", timeStyle: "short" })
  const root = dirs[""]
  const openFile = (relPath: string) => void api.openFile(projectId, relPath).catch(fail)
  /** App ≥ 0.3.0: bấm = xem trước, bấm đúp = mở bằng ứng dụng mặc định. App cũ: bấm = mở. */
  const clickFile = (e: DesktopFileEntry) => (fapi ? setSelected({ relPath: e.relPath, mtimeMs: e.mtimeMs }) : openFile(e.relPath))

  const rowActions = (e: DesktopFileEntry) => (
    <>
      {fapi && e.type === "file" && (
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => openFile(e.relPath)}
          title={t("desktopFolder.openFile")}
          aria-label={`${t("desktopFolder.openFile")}: ${e.name}`}
          data-action="open"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => void api.revealInFolder(projectId, e.relPath).catch(fail)}
        title={fapi ? revealItemLabel : t("desktopFolder.revealItem")}
        aria-label={`${t("desktopFolder.revealItem")}: ${e.name}`}
        data-action="reveal"
      >
        <FolderSearch className="h-3.5 w-3.5" />
      </button>
    </>
  )

  const renderDir = (relPath: string, depth: number): ReactNode => {
    const d = dirs[relPath]
    if (!d) return null
    if (d.entries.length === 0 && depth === 0) {
      return <p className="px-3 py-4 text-sm text-muted-foreground">{t("desktopFolder.empty")}</p>
    }
    const remaining = d.total !== undefined ? d.total - d.entries.length : 0
    return (
      <>
        {d.entries.map((e) => {
          const isOpen = e.type === "dir" && expanded.has(e.relPath)
          const isSel = selected?.relPath === e.relPath
          return (
            <div key={e.relPath}>
              <div
                className={`group flex items-center gap-2 px-2 py-1 rounded-md text-sm ${isSel ? "bg-primary/10" : "hover:bg-muted/70"}`}
                style={{ paddingLeft: 8 + depth * 16 }}
                data-relpath={e.relPath}
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
                  onClick={() => (e.type === "dir" ? void toggleDir(e.relPath) : clickFile(e))}
                  onDoubleClick={() => fapi && e.type === "file" && openFile(e.relPath)}
                  title={e.type === "dir" ? e.relPath : fapi ? `${e.relPath} — ${t("desktopFolder.tipDblClick")}` : `${t("desktopFolder.openFile")}: ${e.relPath}`}
                  aria-current={isSel ? "true" : undefined}
                >
                  {e.type === "dir" ? (
                    isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <FileIcon entry={e} open={isOpen} />
                  <span className="truncate text-gray-900 dark:text-gray-100">{e.name}</span>
                </button>
                <span className={`hidden w-16 text-right text-xs text-muted-foreground tabular-nums shrink-0 ${selected ? "" : "sm:block"}`}>
                  {e.type === "file" ? formatSize(e.size) : ""}
                </span>
                <span className={`hidden w-28 text-right text-xs text-muted-foreground tabular-nums shrink-0 ${selected ? "" : "md:block"}`}>
                  {dateFmt.format(new Date(e.mtimeMs))}
                </span>
                {rowActions(e)}
              </div>
              {isOpen && renderDir(e.relPath, depth + 1)}
            </div>
          )
        })}
        {d.truncated &&
          (fapi && remaining > 0 ? (
            <button
              type="button"
              className="px-3 py-1 text-xs text-primary hover:underline"
              style={{ paddingLeft: 8 + depth * 16 }}
              onClick={() => void loadMore(relPath)}
              data-testid="desktop-show-more"
            >
              {t("desktopFolder.showMore").replace("{n}", String(remaining))}
            </button>
          ) : (
            <p className="px-3 py-1 text-xs text-amber-700 dark:text-amber-400" style={{ paddingLeft: 8 + depth * 16 }}>
              {t("desktopFolder.truncated")}
            </p>
          ))}
      </>
    )
  }

  const renderResults = () => {
    if (!result) {
      return (
        <p className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
          {searching && <Loader2 className="h-4 w-4 animate-spin" />}
          {searching ? t("desktopFolder.searching") : t("desktopFolder.searchNone")}
        </p>
      )
    }
    return (
      <div data-testid="desktop-search-results">
        {result.hits.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">{t("desktopFolder.searchNone")}</p>}
        {result.hits.map((h) => {
          const isSel = selected?.relPath === h.relPath
          const dir = h.relPath.includes("/") ? h.relPath.slice(0, h.relPath.lastIndexOf("/")) : ""
          return (
            <div key={h.relPath} className={`group rounded-md px-2 py-1 text-sm ${isSel ? "bg-primary/10" : "hover:bg-muted/70"}`} data-relpath={h.relPath} data-search-hit="1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
                  onClick={() => {
                    if (h.type === "file") setSelected({ relPath: h.relPath, mtimeMs: h.mtimeMs })
                    else void api.revealInFolder(projectId, h.relPath).catch(fail)
                  }}
                  onDoubleClick={() => h.type === "file" && openFile(h.relPath)}
                  title={h.relPath}
                >
                  <FileIcon entry={h} />
                  <span className="truncate text-gray-900 dark:text-gray-100">{h.name}</span>
                  {dir && <span className="truncate text-xs text-muted-foreground">{dir}/</span>}
                </button>
                {h.nameMatch && <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground shrink-0">{t("desktopFolder.nameMatch")}</span>}
                {rowActions(h)}
              </div>
              {h.matches.length > 0 && (
                <ul className="ml-6 mt-0.5 space-y-0.5">
                  {h.matches.map((m) => (
                    <li key={m.line} className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      <span className="text-muted-foreground tabular-nums mr-1.5">{t("desktopFolder.line").replace("{n}", String(m.line))}</span>
                      {m.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
        <p className="px-3 pt-2 pb-1 text-[11px] text-muted-foreground" data-testid="desktop-search-stats">
          {t("desktopFolder.searchStats")
            .replace("{n}", String(result.hits.length))
            .replace("{entries}", result.scannedEntries.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB"))
            .replace("{files}", result.scannedFiles.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB"))
            .replace("{sec}", (result.elapsedMs / 1000).toFixed(1))}
          {" · "}
          {t("desktopFolder.searchSkipped")}
        </p>
        {(result.truncated || result.timedOut) && <p className="px-3 pb-1 text-[11px] text-amber-700 dark:text-amber-400">{t("desktopFolder.searchTruncated")}</p>}
      </div>
    )
  }

  const otherRecent = recent.filter((r) => r.exists && r.path !== linked?.path)
  const changeButton = fapi ? (
    <DropdownMenu onOpenChange={(o) => o && void loadRecent()}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={busy}>
          <Replace className="h-3.5 w-3.5" />
          {t("desktopFolder.change")}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuItem onSelect={() => void handleLink()}>
          <FolderOpen className="h-4 w-4 mr-2" />
          {t("desktopFolder.chooseOther")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("desktopFolder.recent")}</DropdownMenuLabel>
        {otherRecent.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("desktopFolder.recentNone")}</p>
        ) : (
          otherRecent.map((r) => (
            <DropdownMenuItem key={r.path} onSelect={() => void handleLinkRecent(r.path)} title={r.path} data-recent-path={r.path}>
              <Clock className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
              <span className="flex flex-col min-w-0">
                <span className="truncate">{r.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{r.path}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void handleLink()} disabled={busy}>
      <Replace className="h-3.5 w-3.5" />
      {t("desktopFolder.change")}
    </Button>
  )

  const searchActive = !!fapi && query.trim().length >= 2

  return (
    <>
    <section
      className="w-full mb-8 text-left"
      aria-labelledby="desktop-folder-title"
      data-testid="desktop-folder-card"
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
      }}
      onDrop={(e) => void onDrop(e)}
    >
      <div
        className={`relative rounded-xl border bg-white/70 dark:bg-gray-800/40 ${dragOver ? "border-primary ring-2 ring-primary/30" : "border-gray-200 dark:border-gray-700"}`}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 rounded-xl bg-primary/5 flex items-center justify-center pointer-events-none" data-testid="desktop-drop-overlay">
            <span className="rounded-full bg-white dark:bg-gray-900 shadow px-4 py-2 text-sm font-medium text-primary">{t("desktopFolder.dropHere")}</span>
          </div>
        )}
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
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => void handleLink()} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                {t("desktopFolder.link")}
              </Button>
              {canDrop && <span className="text-xs text-muted-foreground">{t("desktopFolder.dropHint")}</span>}
            </div>
            {fapi && recent.filter((r) => r.exists).length > 0 && (
              <div className="mt-3" data-testid="desktop-recent">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("desktopFolder.recent")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {recent
                    .filter((r) => r.exists)
                    .slice(0, 6)
                    .map((r) => (
                      <span key={r.path} className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 text-xs">
                        <button type="button" className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 hover:text-primary" title={r.path} onClick={() => void handleLinkRecent(r.path)} disabled={busy}>
                          <Folder className="h-3.5 w-3.5 text-amber-500" />
                          {r.name}
                        </button>
                        <button
                          type="button"
                          className="pr-2 pl-0.5 py-1 text-muted-foreground hover:text-foreground"
                          title={t("desktopFolder.forget")}
                          aria-label={`${t("desktopFolder.forget")}: ${r.name}`}
                          onClick={() => void fapi.forgetRecentFolder(r.path).then(loadRecent).catch(fail)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            )}
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
              <>
                {fapi && (
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="relative flex-1 min-w-[12rem]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setQuery("")
                        }}
                        placeholder={t("desktopFolder.searchPlaceholder")}
                        className="w-full h-8 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        aria-label={t("desktopFolder.searchPlaceholder")}
                        data-testid="desktop-search"
                        maxLength={300}
                      />
                      {searching ? (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : query ? (
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground" onClick={() => setQuery("")} aria-label={t("desktopFolder.clearSearch")}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as DesktopSearchMode)}
                      className="h-8 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-xs"
                      aria-label={t("desktopFolder.searchMode.all")}
                      data-testid="desktop-search-mode"
                    >
                      <option value="all">{t("desktopFolder.searchMode.all")}</option>
                      <option value="name">{t("desktopFolder.searchMode.name")}</option>
                      <option value="content">{t("desktopFolder.searchMode.content")}</option>
                    </select>
                  </div>
                )}
                <div className={selected && fapi ? "grid gap-2 lg:grid-cols-2" : ""}>
                  <div className={`rounded-lg border border-gray-100 dark:border-gray-700/70 overflow-auto py-1 ${selected ? "max-h-[30rem]" : "max-h-72"}`} role="tree" aria-label={linked.name}>
                    {searchActive ? renderResults() : root ? renderDir("", 0) : <p className="px-3 py-3 text-sm text-muted-foreground">{t("desktopFolder.loading")}</p>}
                  </div>
                  {selected && fapi && (
                    <FilePreviewPane
                      api={fapi}
                      projectId={projectId}
                      relPath={selected.relPath}
                      mtimeMs={selected.mtimeMs}
                      revealLabel={revealItemLabel}
                      canAsk={hasAgent}
                      onClose={() => setSelected(null)}
                      onError={fail}
                    />
                  )}
                </div>
              </>
            )}
            <div className="flex flex-wrap items-center gap-1 mt-2">
              {changeButton}
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => setConfirmUnlink(true)}>
                <Link2Off className="h-3.5 w-3.5" />
                {t("desktopFolder.unlink")}
              </Button>
              {linked.exists && root && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {t("desktopFolder.items").replace("{n}", String(root.total ?? root.entries.length))} · {t("desktopFolder.updated")}
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
