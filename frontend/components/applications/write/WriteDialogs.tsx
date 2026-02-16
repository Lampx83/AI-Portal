"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  FolderOpen,
  Share2,
  History,
  RotateCcw,
  Trash2,
  Loader2,
  Check,
  Copy,
  Sparkles,
  FileText,
  ChevronRight,
  Table2,
  ArrowRightLeft,
  BookMarked,
  ClipboardCheck,
} from "lucide-react"
import MarkdownViewer from "@/components/markdown-viewer"
import { CitationEditForm } from "./CitationEditForm"
import { WRITING_FLOW_STEPS } from "./writing-flow-steps"
import { revokeShareLink } from "@/lib/api/write-articles"
import type { WriteArticle, WriteArticleVersion, CitationReference } from "@/lib/api/write-articles"
import { formatInTextAPA, formatInTextAPANarrative, findDuplicateReferences } from "@/lib/citation-formats"

export type CrossRefTarget = { type: "figure" | "table" | "equation" | "section"; id: string; label: string }

export interface WriteDialogsProps {
  showOpenModal: boolean
  setShowOpenModal: (v: boolean) => void
  articlesLoading: boolean
  articles: WriteArticle[]
  currentArticleId: string | null
  handleLoadArticle: (a: WriteArticle) => Promise<void>
  handleDeleteArticle: (e: React.MouseEvent, id: string) => void
  showShareDialog: boolean
  setShowShareDialog: (v: boolean) => void
  setShareUrl: (v: string | null) => void
  shareLoading: boolean
  shareUrl: string | null
  setShareCopied: (v: boolean) => void
  shareCopied: boolean
  setArticleShareToken: (v: string | null) => void
  setShareLoading: (v: boolean) => void
  showVersionHistoryDialog: boolean
  setShowVersionHistoryDialog: (v: boolean) => void
  setVersionList: (v: WriteArticleVersion[]) => void
  versionsLoading: boolean
  versionList: WriteArticleVersion[]
  handleClearVersionsExceptLatest: () => void
  clearingVersions: boolean
  restoringVersionId: string | null
  handleDeleteVersion: (id: string) => void
  deletingVersionId: string | null
  handleRestoreVersion: (id: string) => void
  showGeneratePapersDialog: boolean
  setShowGeneratePapersDialog: (v: boolean) => void
  selectedGenerateStep: number
  setSelectedGenerateStep: (n: number) => void
  applyGeneratedContent: (html: string) => void
  generatePapersInputRef: React.RefObject<HTMLInputElement | null>
  generatePapersDescription: string
  setGeneratePapersDescription: (v: string) => void
  handleGeneratePapersCreate: () => void
  showRequireProjectDialog: boolean
  setShowRequireProjectDialog: (v: boolean) => void
  showTableDialog: boolean
  setShowTableDialog: (v: boolean) => void
  tableRows: number
  setTableRows: (v: number) => void
  tableCols: number
  setTableCols: (v: number) => void
  editorRef: React.RefObject<HTMLDivElement | null>
  savedTableSelectionRef: React.MutableRefObject<Range[]>
  handleInsertTable: (rows: number, cols: number) => void
  showCrossRefDialog: boolean
  setShowCrossRefDialog: (v: boolean) => void
  collectCrossRefTargets: () => CrossRefTarget[]
  handleInsertCrossRef: (target: CrossRefTarget) => void
  showCitationDialog: boolean
  setShowCitationDialog: (v: boolean) => void
  setEditingRef: (r: CitationReference | null) => void
  citationStyle: "APA" | "IEEE"
  setCitationStyle: (v: "APA" | "IEEE") => void
  editingRef: CitationReference | null
  references: CitationReference[]
  setReferences: React.Dispatch<React.SetStateAction<CitationReference[]>>
  handleInsertCitation: (index?: number, apaVariant?: "parenthetical" | "narrative") => void
  handleInsertReferenceList: () => void
  handleExportReferences: (format: "bibtex" | "endnote" | "refman" | "refworks") => void
  duplicateCheckGroups: number[][] | null
  setDuplicateCheckGroups: (v: number[][] | null) => void
  showAcademicQualityDialog: boolean
  setShowAcademicQualityDialog: (v: boolean) => void
  academicQualityLoading: boolean
  academicQualityReport: string | null
}

export function WriteDialogs(p: WriteDialogsProps) {
  return (
    <>
      <Dialog open={p.showOpenModal} onOpenChange={p.setShowOpenModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Chọn bài viết đã lưu
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {p.articlesLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Đang tải…</p>
            ) : p.articles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Chưa có bài viết nào</p>
            ) : (
              <div className="space-y-1">
                {p.articles.map((a) => (
                  <div
                    key={a.id}
                    className={`group flex items-center gap-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${p.currentArticleId === a.id ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                  >
                    <button
                      className="flex-1 min-w-0 text-left py-3 px-4 text-sm truncate"
                      onClick={() => {
                        p.handleLoadArticle(a)
                        p.setShowOpenModal(false)
                      }}
                    >
                      {a.title || "Chưa đặt tên"}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={(e) => p.handleDeleteArticle(e, a.id)}
                      title="Xóa"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={p.showShareDialog}
        onOpenChange={(open) => {
          p.setShowShareDialog(open)
          if (!open) p.setShareUrl(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Chia sẻ bài viết
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gửi link này để nhiều người cùng chỉnh sửa. Người nhận cần đăng nhập để mở và chỉnh sửa.
          </p>
          {p.shareLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Đang tạo link…</span>
            </div>
          ) : p.shareUrl ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={p.shareUrl} readOnly className="font-mono text-sm" />
                <Button
                  variant={p.shareCopied ? "secondary" : "outline"}
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(p.shareUrl!)
                    p.setShareCopied(true)
                    setTimeout(() => p.setShareCopied(false), 2000)
                  }}
                >
                  {p.shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {p.shareCopied && <p className="text-xs text-emerald-600">Đã sao chép vào clipboard</p>}
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!p.currentArticleId) return
                  p.setShareLoading(true)
                  try {
                    await revokeShareLink(p.currentArticleId)
                    p.setArticleShareToken(null)
                    p.setShareUrl(null)
                  } finally {
                    p.setShareLoading(false)
                  }
                }}
              >
                Thu hồi link chia sẻ
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={p.showVersionHistoryDialog} onOpenChange={(open) => { p.setShowVersionHistoryDialog(open); if (!open) p.setVersionList([]) }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Lịch sử phiên bản
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Các phiên bản được lưu mỗi khi bạn nhấn Lưu. Chọn một phiên bản và nhấn Khôi phục để quay lại nội dung trước đó.
          </p>
          {p.versionsLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Đang tải…</span>
            </div>
          ) : p.versionList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chưa có phiên bản nào được lưu.</p>
          ) : (
            <>
              {p.versionList.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 mb-2"
                  onClick={p.handleClearVersionsExceptLatest}
                  disabled={p.clearingVersions || p.restoringVersionId !== null}
                >
                  {p.clearingVersions ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Xóa toàn bộ lịch sử (chỉ giữ phiên bản gần nhất)
                </Button>
              )}
              <ScrollArea className="flex-1 min-h-0 -mx-2 px-2 border rounded-md">
                <div className="space-y-1 py-2">
                  {p.versionList.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{v.title || "(Không tiêu đề)"}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {new Date(v.created_at).toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                          title="Xóa phiên bản"
                          disabled={p.restoringVersionId !== null || p.deletingVersionId !== null}
                          onClick={() => p.handleDeleteVersion(v.id)}
                        >
                          {p.deletingVersionId === v.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          disabled={p.restoringVersionId !== null || p.deletingVersionId !== null}
                          onClick={() => p.handleRestoreVersion(v.id)}
                        >
                          {p.restoringVersionId === v.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Khôi phục
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={p.showGeneratePapersDialog} onOpenChange={p.setShowGeneratePapersDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 shrink-0 pr-12">
            <div>
              <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI hỗ trợ viết
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Chọn bước — AI hỗ trợ diễn đạt, cấu trúc và lập luận học thuật theo từng bước
              </p>
            </div>
          </div>
          <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max">
              {WRITING_FLOW_STEPS.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-0">
                  <button
                    type="button"
                    onClick={() => p.setSelectedGenerateStep(step.number)}
                    className={`
                      flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold shrink-0 transition
                      ${p.selectedGenerateStep === step.number
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-950"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                      }
                    `}
                    title={step.title}
                  >
                    {step.number}
                  </button>
                  {idx < WRITING_FLOW_STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-0.5 text-muted-foreground shrink-0" aria-hidden />
                  )}
                </div>
              ))}
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0 px-6 py-4">
            <div className="pr-4 space-y-4">
              {(() => {
                const step = WRITING_FLOW_STEPS.find((s) => s.number === p.selectedGenerateStep)
                if (!step) return null
                return (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 overflow-hidden">
                    <div className="p-4">
                      <h3 className="text-base font-semibold text-foreground">
                        Bước {step.number}: AI giúp bạn {step.title}
                      </h3>
                      <div className="mt-3 space-y-2 text-xs">
                        <div>
                          <span className="font-semibold text-foreground">AI hỗ trợ:</span>
                          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-0.5">
                            {step.aiSupport.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          p.applyGeneratedContent(step.insertHtml)
                          p.setShowGeneratePapersDialog(false)
                        }}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Chèn khung bước {step.number} vào editor
                      </Button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </ScrollArea>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-gray-900/30">
            <p className="text-xs text-muted-foreground mb-2">Hoặc mô tả nhanh ý tưởng để tạo tài liệu mới:</p>
            <div className="flex gap-2">
              <Input
                ref={p.generatePapersInputRef}
                placeholder="VD: Đề cương về AI trong giáo dục..."
                className="flex-1"
                value={p.generatePapersDescription}
                onChange={(e) => p.setGeneratePapersDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    p.handleGeneratePapersCreate()
                  }
                }}
              />
              <Button onClick={p.handleGeneratePapersCreate}>Tạo tài liệu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={p.showRequireProjectDialog} onOpenChange={p.setShowRequireProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cần tạo hoặc chọn dự án (Project)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn chưa thuộc dự án nào. Để lưu bài viết vào hệ thống, hãy tạo dự án mới hoặc chọn một dự án từ sidebar. Nội dung hiện tại đang được lưu tạm trên trình duyệt.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => {
                p.setShowRequireProjectDialog(false)
                if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("open-add-project"))
              }}
            >
              Tạo dự án mới
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => p.setShowRequireProjectDialog(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={p.showTableDialog} onOpenChange={p.setShowTableDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              Chèn bảng
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label htmlFor="table-rows">Số hàng</Label>
              <Input
                id="table-rows"
                type="number"
                min={1}
                max={20}
                value={p.tableRows}
                onChange={(e) => p.setTableRows(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="table-cols">Số cột</Label>
              <Input
                id="table-cols"
                type="number"
                min={1}
                max={10}
                value={p.tableCols}
                onChange={(e) => p.setTableCols(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => p.setShowTableDialog(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                p.setShowTableDialog(false)
                const rows = p.tableRows
                const cols = p.tableCols
                setTimeout(() => {
                  const el = p.editorRef.current
                  const sel = window.getSelection()
                  if (el && sel && p.savedTableSelectionRef.current.length) {
                    el.focus()
                    sel.removeAllRanges()
                    p.savedTableSelectionRef.current.forEach((r) => sel.addRange(r))
                  } else if (el) {
                    el.focus()
                  }
                  p.handleInsertTable(rows, cols)
                }, 0)
              }}
            >
              Chèn bảng {p.tableRows}×{p.tableCols}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={p.showCrossRefDialog} onOpenChange={p.setShowCrossRefDialog}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Chèn tham chiếu
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Chọn một mục để chèn tham chiếu vào vị trí con trỏ (Hình, Bảng, Phương trình, Mục).
            </p>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto space-y-3 py-2">
            {(() => {
              const targets = p.collectCrossRefTargets()
              if (targets.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Chưa có chú thích hoặc mục nào. Thêm chú thích cho hình/bảng/công thức hoặc dùng heading (H1–H3) để tạo mục.
                  </p>
                )
              }
              const byType = { figure: "Hình", table: "Bảng", equation: "Phương trình", section: "Mục" }
              return (
                <div className="space-y-2">
                  {targets.map((t, i) => (
                    <Button
                      key={`${t.type}-${t.id}-${i}`}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-9 text-sm font-normal"
                      onClick={() => p.handleInsertCrossRef(t)}
                    >
                      <span className="text-muted-foreground mr-2">{byType[t.type]}:</span>
                      {t.label}
                    </Button>
                  ))}
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={p.showCitationDialog} onOpenChange={(open) => { p.setShowCitationDialog(open); if (!open) p.setEditingRef(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="h-5 w-5" />
              Tài liệu tham khảo
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 -mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Chuẩn trích dẫn:</span>
              <div className="flex rounded-md border p-0.5">
                <button
                  type="button"
                  onClick={() => p.setCitationStyle("APA")}
                  className={`px-2 py-1 text-xs rounded ${p.citationStyle === "APA" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  APA
                </button>
                <button
                  type="button"
                  onClick={() => p.setCitationStyle("IEEE")}
                  className={`px-2 py-1 text-xs rounded ${p.citationStyle === "IEEE" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  IEEE
                </button>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              Xuất: BibTeX, EndNote, RefMan, RefWorks
            </span>
          </div>
          <p className="text-xs text-muted-foreground -mt-1 mb-1">
            Liên kết với Zotero, Mendeley, EndNote: trong các công cụ đó chọn tài liệu → xuất ra BibTeX hoặc RIS → dán vào form &quot;Thêm tài liệu&quot; hoặc tải file lên. Định dạng xuất bên dưới tương thích với các công cụ trên.
          </p>
          <div className="flex-1 min-h-0 overflow-auto">
            {p.editingRef !== null ? (
              <CitationEditForm
                initialRef={p.editingRef}
                onSave={(r) => {
                  const editIdx = (p.editingRef as CitationReference & { __editIndex?: number }).__editIndex
                  if (typeof editIdx === "number" && editIdx >= 0) {
                    p.setReferences((prev) => prev.map((x, i) => (i === editIdx ? r : x)))
                  } else {
                    p.setReferences((prev) => [...prev, r])
                  }
                  p.setEditingRef(null)
                }}
                onCancel={() => p.setEditingRef(null)}
              />
            ) : (
              <>
                <ScrollArea className="h-[280px] border rounded-lg p-2">
                  {p.references.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Chưa có tài liệu tham khảo</p>
                  ) : (
                    <div className="space-y-2">
                      {p.references.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                          <span className="flex-shrink-0 w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 text-xs flex items-center justify-center font-medium">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.title || r.author || "Tài liệu"}</p>
                            <p className="text-xs text-muted-foreground">
                              {[r.author, r.year, r.journal].filter(Boolean).join(" • ")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1 opacity-0 group-hover:opacity-100">
                            {p.citationStyle === "APA" ? (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { p.handleInsertCitation(i, "narrative"); p.setShowCitationDialog(false) }} title="Trong câu: Tác giả (Năm)">
                                  {formatInTextAPANarrative(r)}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { p.handleInsertCitation(i, "parenthetical"); p.setShowCitationDialog(false) }} title="Cuối câu: (Tác giả, Năm)">
                                  {formatInTextAPA(r)}
                                </Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-7" onClick={() => { p.handleInsertCitation(i); p.setShowCitationDialog(false) }} title={`[${i + 1}]`}>
                                Chèn [{i + 1}]
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => p.setEditingRef({ ...r, __editIndex: i } as CitationReference & { __editIndex?: number })}>
                              Sửa
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-red-600"
                              onClick={() => p.setReferences((prev) => prev.filter((_, j) => j !== i))}
                            >
                              Xóa
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button onClick={() => p.setEditingRef({ type: "article", author: "", title: "", year: "" })}>
                    <BookMarked className="h-4 w-4 mr-2" />
                    Thêm tài liệu
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => p.setDuplicateCheckGroups(findDuplicateReferences(p.references))}
                    disabled={p.references.length < 2}
                    title="Tìm các tài liệu trùng (cùng tác giả, năm, nhan đề)"
                  >
                    Kiểm tra trùng
                  </Button>
                  <Button variant="outline" onClick={p.handleInsertReferenceList} disabled={p.references.length === 0} title="Chèn danh sách TLTK theo chuẩn đã chọn">
                    Chèn danh sách TLTK ({p.citationStyle})
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={p.references.length === 0}>
                        Xuất
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => p.handleExportReferences("bibtex")}>BibTeX (.bib)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => p.handleExportReferences("endnote")}>EndNote (.enw)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => p.handleExportReferences("refman")}>RefMan (.ris)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => p.handleExportReferences("refworks")}>RefWorks (.txt)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={p.duplicateCheckGroups !== null} onOpenChange={(open) => { if (!open) p.setDuplicateCheckGroups(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kiểm tra trùng tài liệu tham khảo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {p.duplicateCheckGroups && p.duplicateCheckGroups.length === 0 && (
              <p className="text-sm text-muted-foreground">Không phát hiện tài liệu trùng (cùng tác giả, năm, nhan đề).</p>
            )}
            {p.duplicateCheckGroups && p.duplicateCheckGroups.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Phát hiện {p.duplicateCheckGroups.length} nhóm trùng. Có thể giữ một mục mỗi nhóm và xóa các bản trùng.
                </p>
                <ScrollArea className="max-h-[240px] border rounded-lg p-2">
                  <div className="space-y-3">
                    {p.duplicateCheckGroups.map((group, gIdx) => (
                      <div key={gIdx} className="text-sm">
                        <span className="font-medium">Nhóm {gIdx + 1}:</span>{" "}
                        {group.map((idx) => (
                          <span key={idx} className="mr-2">
                            [{idx + 1}] {p.references[idx]?.title || p.references[idx]?.author || "—"}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  onClick={() => {
                    if (!p.duplicateCheckGroups) return
                    const toRemove = new Set(p.duplicateCheckGroups.flatMap((g) => g.slice(1)))
                    p.setReferences((prev) => prev.filter((_, j) => !toRemove.has(j)))
                    p.setDuplicateCheckGroups(null)
                  }}
                >
                  Xóa bản trùng (giữ 1 mục mỗi nhóm)
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={p.showAcademicQualityDialog} onOpenChange={p.setShowAcademicQualityDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Kiểm tra
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {p.academicQualityLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang phân tích bài báo…
              </div>
            )}
            {!p.academicQualityLoading && p.academicQualityReport && (
              <ScrollArea className="flex-1 border rounded-lg p-4 text-sm">
                <MarkdownViewer content={p.academicQualityReport} className="prose prose-sm dark:prose-invert max-w-none" />
              </ScrollArea>
            )}
            {!p.academicQualityLoading && !p.academicQualityReport && (
              <p className="text-sm text-muted-foreground py-4">Chọn &quot;Chạy kiểm tra&quot; từ dropdown trên toolbar để bắt đầu.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
