"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  FileText,
  FilePlus,
  ChevronDown,
  Undo2,
  Redo2,
  Search,
  Save,
  History,
  FileDown,
  FileCode,
  Type,
  BookOpen,
  Sigma,
} from "lucide-react"
import type { WriteArticle } from "@/lib/api/write-articles"

export interface WriteHeaderProps {
  activeProject: { id: string | number; name?: string } | null | undefined
  currentArticleId: string | null
  articles: WriteArticle[]
  articlesLoading: boolean
  getDocTitle: () => string
  handleLoadArticle: (a: WriteArticle) => Promise<void>
  handleCreateNewArticleInProject: () => void
  saving: boolean
  execCmd: (cmd: string, value?: string) => void
  setShowFindBar: (fn: (v: boolean) => boolean) => void
  collabPresence: { id: string; name: string }[]
  lastSavedAt: Date | null
  hasUnsavedChanges: boolean
  handleSave: (opts?: { requireProject?: boolean }) => void
  shareToken: string | null
  setShowVersionHistoryDialog: (v: boolean) => void
  handleDownload: (format: "html" | "pdf" | "docx" | "latex" | "markdown") => void
  handleExportReferences: (format: "bibtex" | "endnote" | "refman" | "refworks") => void
  references: { author?: string; title?: string; year?: string }[]
  sessionUser: unknown
}

export function WriteHeader(p: WriteHeaderProps) {
  return (
    <div className="flex-shrink-0 h-9 px-3 flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-sm">
      <div className="flex items-center gap-1 min-w-0 flex-1 mr-4">
        {p.activeProject && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1 max-w-[220px] justify-start font-normal">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {p.currentArticleId
                      ? (p.articles.find((a) => a.id === p.currentArticleId)?.title || "Chưa đặt tên")
                      : "Chọn bài viết"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[50vh] overflow-auto">
                {p.articlesLoading ? (
                  <DropdownMenuItem disabled>Đang tải…</DropdownMenuItem>
                ) : p.articles.length === 0 ? (
                  <DropdownMenuItem disabled>Chưa có bài viết</DropdownMenuItem>
                ) : (
                  p.articles.map((a) => (
                    <DropdownMenuItem
                      key={a.id}
                      onClick={() => p.handleLoadArticle(a)}
                      className={p.currentArticleId === a.id ? "bg-muted" : ""}
                    >
                      <span className="truncate block max-w-[280px]">{a.title || "Chưa đặt tên"}</span>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={p.handleCreateNewArticleInProject} disabled={p.saving}>
                  <FilePlus className="h-4 w-4 mr-2 shrink-0" />
                  Tạo bài viết mới
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />
          </>
        )}
        <span
          className="text-base font-semibold text-foreground truncate min-w-0"
          title={p.getDocTitle()}
        >
          {(() => {
            const title = p.getDocTitle()
            return title.length > 64 ? title.slice(0, 64) + "…" : title
          })()}
        </span>
        <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => p.execCmd("undo")} title="Hoàn tác">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => p.execCmd("redo")} title="Làm lại">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => p.setShowFindBar((v) => !v)} title="Tìm trong bài">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>
      <span className="flex items-center gap-2 shrink-0">
        {p.collabPresence.length > 0 && (
          <span className="text-xs text-muted-foreground" title="Đang xem cùng tài liệu">
            Đang xem: {p.collabPresence.map((u) => u.name).join(", ")}
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums" title={p.currentArticleId && p.lastSavedAt ? `Đã lưu lúc ${p.lastSavedAt.toLocaleTimeString("vi-VN")}` : "Chưa lưu"}>
          {p.saving ? "Đang lưu…" : p.currentArticleId && p.lastSavedAt ? `Đã lưu ${p.lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Chưa lưu"}
        </span>
        {p.sessionUser && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => p.handleSave({ requireProject: true })}
              disabled={p.saving || !p.hasUnsavedChanges}
              title={p.hasUnsavedChanges ? "Lưu bài viết vào project" : "Chưa có thay đổi để lưu"}
            >
              <Save className="h-4 w-4 mr-1" />
              Lưu
            </Button>
            {p.currentArticleId && !p.shareToken && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => p.setShowVersionHistoryDialog(true)}
                title="Lịch sử phiên bản"
              >
                <History className="h-4 w-4 mr-1" />
                Lịch sử
              </Button>
            )}
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" title="Xuất file và tài liệu tham khảo">
              <FileDown className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Xuất</span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Tải xuống tài liệu</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => p.handleDownload("html")}>
              <FileCode className="h-4 w-4 mr-2" />
              HTML (.html)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.handleDownload("docx")}>
              <FileText className="h-4 w-4 mr-2" />
              Word (.docx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.handleDownload("pdf")}>
              <BookOpen className="h-4 w-4 mr-2" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.handleDownload("latex")}>
              <Sigma className="h-4 w-4 mr-2" />
              LaTeX (.tex)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.handleDownload("markdown")}>
              <Type className="h-4 w-4 mr-2" />
              Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Xuất tài liệu tham khảo</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => p.handleExportReferences("bibtex")} disabled={p.references.length === 0}>
              BibTeX (.bib)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.handleExportReferences("endnote")} disabled={p.references.length === 0}>
              EndNote (.enw)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.handleExportReferences("refman")} disabled={p.references.length === 0}>
              RefMan (.ris)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.handleExportReferences("refworks")} disabled={p.references.length === 0}>
              RefWorks (.txt)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  )
}
