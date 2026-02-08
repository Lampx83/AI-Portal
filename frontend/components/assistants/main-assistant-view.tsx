"use client"

import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Toggle } from "@/components/ui/toggle"
import {
  FileText,
  Upload,
  Bold,
  Italic,
  Underline,
  Highlighter,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Type,
  Heading1,
  Heading2,
  Heading3,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  FileDown,
  FilePlus,
  FileCode,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  FolderOpen,
  Trash2,
  Superscript,
  Subscript,
  Table2,
  Sigma,
  Sparkles,
  Loader2,
  X,
  BookMarked,
  Image,
  IndentIncrease,
  IndentDecrease,
  Share2,
  Copy,
  Check,
  Scissors,
  ClipboardPaste,
  Link2,
  RemoveFormatting,
  Pencil,
  MessageCirclePlus,
  MessageSquarePlus,
  Smile,
  History,
  RotateCcw,
  Search,
  ChevronRight,
  ImagePlus,
  ArrowRightLeft,
  ClipboardCheck,
} from "lucide-react"
import MarkdownViewer from "@/components/markdown-viewer"
import { useSession } from "next-auth/react"
import { API_CONFIG, getCollabWsUrl } from "@/lib/config"
import { toast } from "sonner"
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage"
import { getOrCreateGuestDeviceId } from "@/lib/guest-device-id"
import {
  getWriteArticles,
  getWriteArticle,
  createWriteArticle,
  updateWriteArticle,
  updateWriteArticleByShareToken,
  deleteWriteArticle,
  getWriteArticleByShareToken,
  createShareLink,
  revokeShareLink,
  getWriteArticleComments,
  createWriteArticleComment,
  deleteWriteArticleComment,
  getArticleVersions,
  restoreArticleVersion,
  deleteArticleVersion,
  clearArticleVersionsExceptLatest,
  type WriteArticle,
  type WriteArticleWithShare,
  type WriteArticleComment,
  type WriteArticleVersion,
  type CitationReference,
} from "@/lib/api/write-articles"
import {
  toBibTeX,
  toEndNote,
  toRefMan,
  toRefWorks,
  formatInTextAPA,
  formatInTextAPANarrative,
  formatInTextIEEE,
  toReferenceListAPA,
  toReferenceListIEEE,
  markdownItalicsToHtml,
  parseCitationFormat,
  findDuplicateReferences,
} from "@/lib/citation-formats"
import { htmlToLatex } from "@/lib/html-to-latex"
import { htmlToMarkdown } from "@/lib/html-to-markdown"
import { useActiveResearch } from "@/contexts/active-research-context"
import "katex/dist/katex.min.css"

type Template = { id: string; title: string; description?: string; type?: string }

const FONTS = ["Arial", "Times New Roman", "Georgia", "Cambria", "Calibri"]

const FONT_SIZES = [10, 11, 12, 14, 16, 20]

const SCIENTIFIC_SYMBOLS = [
  { label: "α", char: "α", title: "Alpha" },
  { label: "β", char: "β", title: "Beta" },
  { label: "γ", char: "γ", title: "Gamma" },
  { label: "δ", char: "δ", title: "Delta" },
  { label: "ε", char: "ε", title: "Epsilon" },
  { label: "θ", char: "θ", title: "Theta" },
  { label: "μ", char: "μ", title: "Mu" },
  { label: "π", char: "π", title: "Pi" },
  { label: "σ", char: "σ", title: "Sigma" },
  { label: "ω", char: "ω", title: "Omega" },
  { label: "∑", char: "∑", title: "Tổng" },
  { label: "∫", char: "∫", title: "Tích phân" },
  { label: "≈", char: "≈", title: "Xấp xỉ" },
  { label: "±", char: "±", title: "Cộng trừ" },
  { label: "≤", char: "≤", title: "Nhỏ hơn hoặc bằng" },
  { label: "≥", char: "≥", title: "Lớn hơn hoặc bằng" },
  { label: "≠", char: "≠", title: "Khác" },
  { label: "°", char: "°", title: "Độ" },
  { label: "×", char: "×", title: "Nhân" },
  { label: "÷", char: "÷", title: "Chia" },
  { label: "→", char: "→", title: "Mũi tên" },
  { label: "∞", char: "∞", title: "Vô cùng" },
]

const FORMULA_INSERT_MARKER_ID = "formula-insert-marker"

const FORMULA_SAMPLES: { label: string; latex: string }[] = [
  { label: "½", latex: "\\frac{1}{2}" },
  { label: "√x", latex: "\\sqrt{x}" },
  { label: "x²", latex: "x^2" },
  { label: "α, β", latex: "\\alpha, \\beta" },
  { label: "∑", latex: "\\sum_{i=1}^n x_i" },
  { label: "∫", latex: "\\int_0^1 x^2 \\, dx" },
  { label: "→", latex: "a \\rightarrow b" },
  { label: "≠, ≤, ≥", latex: "a \\neq b,\\quad a \\le b,\\quad a \\ge b" },
]

const REF_TYPES = [
  { value: "article", label: "Bài báo" },
  { value: "book", label: "Sách" },
  { value: "inproceedings", label: "Hội nghị" },
  { value: "misc", label: "Khác" },
]

function CitationEditForm({
  initialRef,
  onSave,
  onCancel,
}: {
  initialRef: CitationReference & { __tempId?: number; __editIndex?: number }
  onSave: (r: CitationReference) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CitationReference>({
    type: initialRef.type || "article",
    author: initialRef.author || "",
    title: initialRef.title || "",
    year: initialRef.year || "",
    journal: initialRef.journal || "",
    volume: initialRef.volume || "",
    pages: initialRef.pages || "",
    publisher: initialRef.publisher || "",
    doi: initialRef.doi || "",
    url: initialRef.url || "",
    booktitle: initialRef.booktitle || "",
  })
  const [pasteValue, setPasteValue] = useState("")
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const applyParsedToForm = (parsed: { ref: CitationReference }) => {
    const ref = parsed.ref
    const updates: CitationReference = {
      type: ref.type || "article",
      author: ref.author || "",
      title: ref.title || "",
      year: ref.year || "",
      journal: ref.journal || "",
      volume: ref.volume || "",
      pages: ref.pages || "",
      publisher: ref.publisher || "",
      doi: ref.doi || "",
      url: ref.url || "",
      booktitle: ref.booktitle || "",
    }
    const filled = new Set<string>()
    if (updates.type) filled.add("type")
    if (updates.author) filled.add("author")
    if (updates.title) filled.add("title")
    if (updates.year) filled.add("year")
    if (updates.journal || updates.booktitle) filled.add("journal")
    if (updates.volume || updates.pages) filled.add("volume")
    if (updates.publisher) filled.add("publisher")
    if (updates.doi) filled.add("doi")
    if (updates.url) filled.add("url")
    setForm(updates)
    setHighlightedFields(filled)
    setTimeout(() => setHighlightedFields(new Set()), 2500)
  }

  const handlePasteParse = () => {
    const parsed = parseCitationFormat(pasteValue)
    if (parsed) {
      applyParsedToForm(parsed)
      setPasteError(null)
    } else {
      setPasteError("Không nhận dạng được format. Hỗ trợ: BibTeX, EndNote, RefMan, RefWorks.")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = (reader.result as string) || ""
      setPasteValue(text)
      setPasteError(null)
      const parsed = parseCitationFormat(text)
      if (parsed) {
        applyParsedToForm(parsed)
      } else {
        setPasteError("Không nhận dạng được format trong file.")
      }
    }
    reader.readAsText(file, "utf-8")
  }

  const inputHighlight = (field: string) =>
    highlightedFields.has(field)
      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-600"
      : ""

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <label className="text-xs font-medium">Dán chuỗi trích dẫn hoặc tải file (BibTeX, EndNote, RefMan, RefWorks)</label>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".bib,.enw,.ris,.txt,text/plain,application/x-bibtex"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Tải file
          </Button>
        </div>
        <textarea
          value={pasteValue}
          onChange={(e) => { setPasteValue(e.target.value); setPasteError(null) }}
          onPaste={(e) => {
            const pasted = e.clipboardData?.getData("text") ?? ""
            if (pasted.trim()) {
              const parsed = parseCitationFormat(pasted)
              if (parsed) {
                e.preventDefault()
                setPasteValue(pasted)
                applyParsedToForm(parsed)
                setPasteError(null)
              }
            }
          }}
          placeholder="Dán chuỗi BibTeX, EndNote (.enw), RefMan (.ris), RefWorks... hoặc tải file lên"
          className="w-full min-h-[72px] text-sm rounded border px-3 py-2 resize-none placeholder:text-muted-foreground"
          rows={3}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handlePasteParse} disabled={!pasteValue.trim()}>
            Nhận dạng & điền
          </Button>
          {pasteError && <span className="text-xs text-red-600 dark:text-red-400">{pasteError}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium">Loại</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className={`w-full mt-0.5 h-9 rounded border px-2 text-sm transition-colors ${inputHighlight("type")}`}
          >
            {REF_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Năm</label>
          <Input value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className={`h-9 mt-0.5 ${inputHighlight("year")}`} placeholder="2024" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium">Tác giả</label>
        <Input value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} className={`h-9 mt-0.5 ${inputHighlight("author")}`} placeholder="Nguyễn Văn A, Trần Thị B" />
      </div>
      <div>
        <label className="text-xs font-medium">Tiêu đề</label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={`h-9 mt-0.5 ${inputHighlight("title")}`} placeholder="Tiêu đề bài báo/sách" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium">Tạp chí / Sách / Hội nghị</label>
          <Input
            value={form.journal || form.booktitle || ""}
            onChange={(e) => {
              const v = e.target.value
              setForm((f) => ({ ...f, journal: v, booktitle: v }))
            }}
            className={`h-9 mt-0.5 ${inputHighlight("journal")}`}
            placeholder="Tên tạp chí, sách hoặc hội nghị"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Tập / Trang</label>
          <Input
            value={[form.volume, form.pages].filter(Boolean).join(", ")}
            onChange={(e) => {
              const v = e.target.value
              const parts = v.split(",").map((s) => s.trim())
              setForm((f) => ({ ...f, volume: parts[0] || "", pages: parts[1] || "" }))
            }}
            className={`h-9 mt-0.5 ${inputHighlight("volume")}`}
            placeholder="10, 1-15"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium">DOI</label>
          <Input value={form.doi} onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value }))} className={`h-9 mt-0.5 ${inputHighlight("doi")}`} placeholder="10.1234/..." />
        </div>
        <div>
          <label className="text-xs font-medium">URL</label>
          <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={`h-9 mt-0.5 ${inputHighlight("url")}`} placeholder="https://..." />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={() => onSave(form)}>Lưu</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Hủy</Button>
      </div>
    </div>
  )
}

/** Quick prompts cho chỉnh sửa inline với AI */
const INLINE_EDIT_PROMPTS = [
  { label: "Rút gọn", prompt: "Rút gọn đoạn văn sau, giữ ý chính:" },
  { label: "Làm rõ hơn", prompt: "Viết lại cho rõ ràng, dễ hiểu hơn:" },
  { label: "Phong cách học thuật", prompt: "Viết lại theo phong cách học thuật:" },
  { label: "Paraphrase", prompt: "Paraphrase đoạn văn sau (viết lại bằng từ ngữ khác, giữ nghĩa):" },
  { label: "Mở rộng", prompt: "Mở rộng chi tiết đoạn văn sau:" },
]

const DocEditor = forwardRef<
  HTMLDivElement,
  { initialContent: string; onInput: (html: string) => void; className?: string; onKeyDown?: (e: React.KeyboardEvent) => void }
>(({ initialContent, onInput, className, onKeyDown }, ref) => {
  const divRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => divRef.current!)
  // Chỉ set innerHTML một lần khi mount. Không sync từ initialContent mỗi lần gõ
  // (remount qua key khi load doc mới / chọn template)
  const mountContent = useRef(initialContent)
  mountContent.current = initialContent
  useEffect(() => {
    const el = divRef.current
    if (el) el.innerHTML = mountContent.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      ref={divRef}
      contentEditable={true}
      suppressContentEditableWarning
      className={className}
      onInput={() => onInput(divRef.current?.innerHTML ?? "")}
      onKeyDown={onKeyDown}
    />
  )
})
DocEditor.displayName = "DocEditor"

export function MainAssistantView() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeResearch } = useActiveResearch()
  const editorRef = useRef<HTMLDivElement>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [writeAgentModels, setWriteAgentModels] = useState<{ model_id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [docTitle, setDocTitle] = useState("")
  const [fileName, setFileName] = useState("")
  const [showRenameFileDialog, setShowRenameFileDialog] = useState(false)
  const [content, setContent] = useState("")
  const [documentKey, setDocumentKey] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [showOutline, setShowOutline] = useState(false)
  const [outlineItems, setOutlineItems] = useState<{ id: string; text: string; level: number }[]>([])
  const [currentOutlineIndex, setCurrentOutlineIndex] = useState<number | null>(null)

  // Màn rộng (lg+ 1024px): tự mở panel dàn ý; màn nhỏ (< 1024px) tự ẩn
  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)") : null
    if (!mq) return
    const onMatch = () => setShowOutline(mq.matches)
    onMatch()
    mq.addEventListener("change", onMatch)
    return () => mq.removeEventListener("change", onMatch)
  }, [])

  const [articles, setArticles] = useState<WriteArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [currentArticleId, setCurrentArticleId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [userStartedEditing, setUserStartedEditing] = useState(false)
  const [references, setReferences] = useState<CitationReference[]>([])
  const [showCitationDialog, setShowCitationDialog] = useState(false)
  const [editingRef, setEditingRef] = useState<CitationReference | null>(null)
  const [duplicateCheckGroups, setDuplicateCheckGroups] = useState<number[][] | null>(null)
  const [citationStyle, setCitationStyle] = useState<"APA" | "IEEE">("APA")
  /** Tag đoạn hiện tại (p, h1, h2, h3) để hiển thị trên nút Style */
  const [currentBlockTag, setCurrentBlockTag] = useState<string>("p")
  const [currentFont, setCurrentFont] = useState<string>("Arial")
  const [currentFontSize, setCurrentFontSize] = useState<string>("11")
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const [showCrossRefDialog, setShowCrossRefDialog] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [articleShareToken, setArticleShareToken] = useState<string | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  /** Lịch sử phiên bản bài viết */
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false)
  const [versionList, setVersionList] = useState<WriteArticleVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null)
  const [clearingVersions, setClearingVersions] = useState(false)
  /** Tìm trong bài */
  const [showFindBar, setShowFindBar] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findBackward, setFindBackward] = useState(false)
  /** Bình luận: danh sách comment của bài viết, popover đang mở (new | thread), draft nội dung */
  const [articleComments, setArticleComments] = useState<WriteArticleComment[]>([])
  const [commentPopover, setCommentPopover] = useState<
    | null
    | { type: "new"; commentId: string; rect: { top: number; left: number } }
    | { type: "thread"; commentId: string; rect: { top: number; left: number } }
  >(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentDeleting, setCommentDeleting] = useState(false)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const [formulaLatex, setFormulaLatex] = useState("")
  const [formulaError, setFormulaError] = useState<string | null>(null)
  /** Kiểm tra chất lượng học thuật (AI) */
  const [showAcademicQualityDialog, setShowAcademicQualityDialog] = useState(false)
  const [academicQualityReport, setAcademicQualityReport] = useState<string | null>(null)
  const [academicQualityLoading, setAcademicQualityLoading] = useState(false)
  /** Real-time collab: người đang xem cùng tài liệu */
  const [collabPresence, setCollabPresence] = useState<{ id: string; name: string }[]>([])
  const collabWsRef = useRef<WebSocket | null>(null)

  /** Inline edit: chọn text (có thể nhiều đoạn không liền mạch) → prompt → AI chỉnh sửa */
  const [inlineEdit, setInlineEdit] = useState<{
    editId: string
    rect: { top: number; left: number; bottom: number; right: number }
    customPrompt: string
    segmentCount?: number
  } | null>(null)
  const [inlineEditLoading, setInlineEditLoading] = useState(false)
  const inlineEditGroupIdRef = useRef<string | null>(null)
  const inlineEditInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  /** Dialog "Tạo bài viết" (Generate papers): gợi ý tài liệu nghiên cứu */
  const [showGeneratePapersDialog, setShowGeneratePapersDialog] = useState(false)
  const [generatePapersDescription, setGeneratePapersDescription] = useState("")
  const [selectedGenerateStep, setSelectedGenerateStep] = useState<number>(1)
  const generatePapersInputRef = useRef<HTMLInputElement>(null)

  /** Khi bấm Lưu mà chưa có project: bắt tạo/chọn project, sau khi có project thì mới lưu article */
  const [showRequireProjectDialog, setShowRequireProjectDialog] = useState(false)
  const pendingSaveAfterProjectRef = useRef(false)
  const savedSelectionRangesRef = useRef<Range[]>([])
  const savedTableSelectionRef = useRef<Range[]>([])
  const citationSpanRef = useRef<HTMLSpanElement | null>(null)
  const [citationContextMenu, setCitationContextMenu] = useState<{ refIndex: number; isNarrative: boolean } | null>(null)
  /** Popover trích dẫn khi bấm vào citation (giống comment) */
  const [citationPopover, setCitationPopover] = useState<{
    refIndex: number
    isNarrative: boolean
    rect: { top: number; left: number }
  } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  const DRAFT_KEY_PREFIX = "main-assistant-draft-"
  const SYNC_INTERVAL_MS = 5000
  const LOCALSTORAGE_DEBOUNCE_MS = 500
  const getDraftKey = (researchId: string | number | undefined, articleId: string | null) =>
    `${DRAFT_KEY_PREFIX}${researchId != null ? String(researchId) : "none"}-${articleId ?? "new"}`
  const BLOCK_STYLES = [
    { tag: "p", label: "Normal" },
    { tag: "h1", label: "Title" },
    { tag: "h2", label: "Subtitle" },
    { tag: "h3", label: "Heading 1" },
    { tag: "h4", label: "Heading 2" },
    { tag: "h5", label: "Heading 3" },
    { tag: "h6", label: "Heading 4" },
  ] as const
  const lastSyncedHtmlRef = useRef<string>("")
  const lastSyncedTitleRef = useRef<string>("")
  const lastSyncedReferencesRef = useRef<string>("[]")
  const wrapBareImagesForResizeRef = useRef<(html: string) => string>(() => "")

  const EMPTY_EDITOR_HTML = "<p><br></p>"
  const isEditorContentEmpty = (html: string) => {
    if (!html || !html.trim()) return true
    const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim()
    return text === ""
  }
  const showTemplates = (!currentArticleId && !userStartedEditing) || isEditorContentEmpty(content)
  const editorEmpty = isEditorContentEmpty(content)

  /** Đặt con trỏ vào editor (để hiện caret và gõ được khi click vào vùng soạn thảo) */
  const placeCaretInEditor = useCallback(() => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel) return
    if (sel.anchorNode && el.contains(sel.anchorNode)) return
    const firstBlock = el.querySelector("p, h1, h2, h3, h4, h5, h6, div") || el.firstChild || el
    const range = document.createRange()
    try {
      if (firstBlock && firstBlock !== el) {
        range.setStart(firstBlock, 0)
        range.collapse(true)
      } else {
        range.selectNodeContents(el)
        range.collapse(true)
      }
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      range.selectNodeContents(el)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [])

  useEffect(() => {
    if (isEditorContentEmpty(content)) setShowOutline(true)
  }, [content])

  // Load bình luận khi mở bài viết (chỉ khi có article id và không xem qua share link)
  useEffect(() => {
    if (!currentArticleId || shareToken) {
      setArticleComments([])
      return
    }
    getWriteArticleComments(currentArticleId)
      .then(setArticleComments)
      .catch(() => setArticleComments([]))
  }, [currentArticleId, shareToken])

  // Đồng bộ style đoạn hiện tại (p, h1..h6) với thanh Style: lấy từ formatBlock hoặc từ block chứa con trỏ
  const validBlockTags = ["p", "h1", "h2", "h3", "h4", "h5", "h6"] as const
  const getBlockTagFromSelection = useCallback((el: HTMLElement): string => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return "p"
    let value = document.queryCommandValue("formatBlock")?.toLowerCase() ?? ""
    if (value === "paragraph") value = "p"
    if (value.startsWith("heading ")) {
      const n = value.replace("heading ", "").trim()
      if (["1", "2", "3", "4", "5", "6"].includes(n)) value = `h${n}`
    }
    if (validBlockTags.includes(value as any)) return value
    const range = sel.getRangeAt(0)
    let node: Node | null = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    while (node && node !== el) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName?.toLowerCase()
        if (tag && validBlockTags.includes(tag as any)) return tag
      }
      node = node.parentNode
    }
    return "p"
  }, [])

  /** Chuẩn hóa font từ editor: Inter/Inter Fallback (font mặc định trang) → Arial để toolbar không hiện Inter */
  const normalizeToolbarFont = useCallback((font: string): string => {
    if (!font || /Inter(\s+Fallback)?/i.test(font)) return "Arial"
    return font
  }, [])

  const getFontFromSelection = useCallback((el: HTMLElement): string => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return "Arial"
    const font = document.queryCommandValue("fontName")?.trim()
    if (font && FONTS.includes(font)) return font
    try {
      let node: Node | null = sel.getRangeAt(0).startContainer
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        const family = window.getComputedStyle(node as HTMLElement).fontFamily
        const match = FONTS.find((f) => family.includes(f))
        if (match) return match
        if (/Inter(\s+Fallback)?/i.test(family)) return "Arial"
      }
    } catch {
      // ignore
    }
    return normalizeToolbarFont(font || "Arial")
  }, [normalizeToolbarFont])

  const getFontSizeFromSelection = useCallback((el: HTMLElement): string => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return "11"
    try {
      let node: Node | null = sel.getRangeAt(0).startContainer
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        const size = window.getComputedStyle(node as HTMLElement).fontSize
        const px = parseFloat(size)
        if (!Number.isNaN(px)) {
          const pt = Math.round(px * 0.75)
          const clamped = Math.max(10, Math.min(20, pt))
          const closest = FONT_SIZES.reduce((a, b) => (Math.abs(a - clamped) <= Math.abs(b - clamped) ? a : b))
          return String(closest)
        }
      }
    } catch {
      // ignore
    }
    const cmd = document.queryCommandValue("fontSize")
    if (cmd) return cmd
    return "11"
  }, [])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const updateToolbarFromSelection = () => {
      if (document.activeElement !== el) return
      setCurrentBlockTag(getBlockTagFromSelection(el))
      setCurrentFont(getFontFromSelection(el))
      setCurrentFontSize(getFontSizeFromSelection(el))
    }
    const onSelectionChange = () => updateToolbarFromSelection()
    const onEditorClick = () => {
      setTimeout(updateToolbarFromSelection, 0)
    }
    document.addEventListener("selectionchange", onSelectionChange)
    el.addEventListener("focus", updateToolbarFromSelection)
    el.addEventListener("click", onEditorClick)
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange)
      el.removeEventListener("focus", updateToolbarFromSelection)
      el.removeEventListener("click", onEditorClick)
    }
  }, [documentKey, getBlockTagFromSelection, getFontFromSelection, getFontSizeFromSelection])

  // Khi vùng soạn thảo trống: focus và đặt caret vào editor
  useEffect(() => {
    if (!editorEmpty) return
    const t = setTimeout(() => {
      editorRef.current?.focus()
      placeCaretInEditor()
    }, 100)
    return () => clearTimeout(t)
  }, [editorEmpty, documentKey, placeCaretInEditor])

  // Khi mở dialog Tạo bài viết: focus vào ô nhập
  useEffect(() => {
    if (!showGeneratePapersDialog) return
    setGeneratePapersDescription("")
    setSelectedGenerateStep(1)
    const t = setTimeout(() => generatePapersInputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [showGeneratePapersDialog])

  // Lưu nháp liên tục vào localStorage (debounced)
  useEffect(() => {
    const key = getDraftKey(activeResearch?.id, currentArticleId)
    const timer = setTimeout(() => {
      try {
        const payload = { docTitle, content, references, updatedAt: Date.now() }
        localStorage.setItem(key, JSON.stringify(payload))
      } catch {
        // ignore quota / private mode
      }
    }, LOCALSTORAGE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [content, docTitle, references, activeResearch?.id, currentArticleId])

  // Khi có project (chuyển nghiên cứu hoặc refresh): luôn lấy dữ liệu từ API trước (cộng tác: người khác save thì F5 thấy đúng)
  const prevResearchIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const researchId = activeResearch?.id != null ? String(activeResearch.id) : undefined
    const isSwitch = prevResearchIdRef.current !== undefined && prevResearchIdRef.current !== researchId
    prevResearchIdRef.current = researchId

    if (!researchId) return

    if (isSwitch) setCurrentArticleId(null)
    setDocumentKey((k) => k + 1)

    if (!session?.user) return
    let cancelled = false
    getWriteArticles(researchId)
      .then((list) => {
        if (cancelled) return
        if (list.length >= 1) {
          return getWriteArticle(list[0].id) as Promise<WriteArticleWithShare>
        }
        return null
      })
      .then((full) => {
        if (cancelled) return
        if (full) {
          const html = wrapBareImagesForResize(full.content)
          setDocTitle(full.title)
          setContent(html)
          setCurrentArticleId(full.id)
          setShareToken(null)
          setArticleShareToken((full as WriteArticleWithShare).share_token ?? null)
          setReferences(full.references ?? [])
          setDocumentKey((k) => k + 1)
          lastSyncedHtmlRef.current = html
          lastSyncedTitleRef.current = activeResearch?.name ?? full.title
          lastSyncedReferencesRef.current = JSON.stringify(full.references ?? [])
          if (full.updated_at) setLastSavedAt(new Date(full.updated_at))
          return
        }
        // Không có bài từ API (dự án mới hoặc chưa tạo bài): dùng nháp localStorage hoặc trống
        const key = getDraftKey(researchId, null)
        try {
          const raw = localStorage.getItem(key)
          if (!raw) {
            setContent(EMPTY_EDITOR_HTML)
            setDocTitle("")
            setReferences([])
            lastSyncedHtmlRef.current = EMPTY_EDITOR_HTML
            lastSyncedTitleRef.current = activeResearch?.name ?? "document"
            lastSyncedReferencesRef.current = "[]"
          } else {
            const data = JSON.parse(raw) as { docTitle?: string; content?: string; references?: CitationReference[] }
            if (data.content != null) {
              setContent(data.content)
              lastSyncedHtmlRef.current = data.content
            } else setContent(EMPTY_EDITOR_HTML)
            if (data.docTitle != null) setDocTitle(data.docTitle)
            else setDocTitle("")
            if (Array.isArray(data.references)) setReferences(data.references)
            else setReferences([])
            lastSyncedTitleRef.current = activeResearch?.name ?? (data.docTitle ?? "document")
            lastSyncedReferencesRef.current = JSON.stringify(Array.isArray(data.references) ? data.references : [])
          }
        } catch {
          setContent(EMPTY_EDITOR_HTML)
          setDocTitle("")
          setReferences([])
          lastSyncedHtmlRef.current = EMPTY_EDITOR_HTML
          lastSyncedTitleRef.current = ""
          lastSyncedReferencesRef.current = "[]"
        }
        setDocumentKey((k) => k + 1)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeResearch?.id, activeResearch?.name, session?.user])

  // Sau khi chuyển nghiên cứu / remount editor: focus và đặt caret vào editor để hiện con trỏ, gõ được
  useEffect(() => {
    if (activeResearch?.id == null) return
    const t = setTimeout(() => {
      editorRef.current?.focus()
      placeCaretInEditor()
    }, 150)
    return () => clearTimeout(t)
  }, [activeResearch?.id, documentKey, placeCaretInEditor])

  // Không còn effect ghi đè từ localStorage khi currentArticleId null — nội dung đã được set trong effect load từ API (API trước, localStorage chỉ khi API trả về 0 bài)

  const baseUrl = `${API_CONFIG.baseUrl}/api/write_agent/v1`

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const urls = [
        `${baseUrl}/data?type=templates`,
        `${baseUrl}/data?type=examples`,
      ]
      const allItems: Template[] = []
      for (const url of urls) {
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          const items = json?.items ?? []
          allItems.push(
            ...items.map((t: any) => ({
              id: t.id ?? t.title,
              title: t.title ?? t.id,
              description: t.description,
              type: t.type,
            }))
          )
        }
      }
      setTemplates(allItems)
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/metadata`)
        if (res.ok) {
          const json = await res.json()
          const models = (json?.supported_models ?? []).map((m: { model_id: string; name: string }) => ({
            model_id: m.model_id,
            name: m.name,
          }))
          setWriteAgentModels(models)
        }
      } catch {
        setWriteAgentModels([{ model_id: "gpt-4o-mini", name: "GPT-4o Mini" }])
      }
    }
    fetchMeta()
  }, [])

  const loadArticles = useCallback(async () => {
    if (!session?.user) return
    setArticlesLoading(true)
    try {
      const researchId = activeResearch?.id != null ? String(activeResearch.id) : undefined
      const list = await getWriteArticles(researchId)
      setArticles(list)
    } catch {
      setArticles([])
    } finally {
      setArticlesLoading(false)
    }
  }, [session?.user, activeResearch?.id])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  const baseShareUrl = typeof window !== "undefined" ? `${window.location.origin}/assistants/write` : ""

  useEffect(() => {
    if (!showShareDialog || !currentArticleId) return
    if (articleShareToken) {
      setShareUrl(`${baseShareUrl}?share=${articleShareToken}`)
      setShareLoading(false)
      return
    }
    setShareLoading(true)
    createShareLink(currentArticleId)
      .then((r) => {
        setArticleShareToken(r.share_token)
        setShareUrl(r.share_url)
      })
      .catch(() => setSaveError("Không tạo được link chia sẻ"))
      .finally(() => setShareLoading(false))
  }, [showShareDialog, currentArticleId, articleShareToken, baseShareUrl])

  useEffect(() => {
    if (!showVersionHistoryDialog || !currentArticleId || shareToken) return
    setVersionsLoading(true)
    getArticleVersions(currentArticleId)
      .then((list) => setVersionList(list))
      .catch(() => setVersionList([]))
      .finally(() => setVersionsLoading(false))
  }, [showVersionHistoryDialog, currentArticleId, shareToken])

  const shareParamLoadedRef = useRef(false)
  useEffect(() => {
    const token = searchParams.get("share")
    if (!token?.trim() || !session?.user || shareParamLoadedRef.current) return
    shareParamLoadedRef.current = true
    let cancelled = false
    setLoading(true)
    getWriteArticleByShareToken(token.trim())
      .then((art) => {
        if (cancelled) return
        setDocTitle(art.title)
        setFileName("")
        setContent(wrapBareImagesForResize(art.content))
        setCurrentArticleId(art.id)
        setShareToken(token.trim())
        setArticleShareToken(art.share_token || null)
        setReferences(art.references ?? [])
        setSelectedTemplate(null)
        setUserStartedEditing(false)
        setDocumentKey((k) => k + 1)
        if (art.updated_at) setLastSavedAt(new Date(art.updated_at))
      })
      .catch(() => {
        if (!cancelled) setSaveError("Link chia sẻ không hợp lệ hoặc đã hết hạn")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [session?.user])

  // Real-time collaborative editing: kết nối WebSocket theo bài viết, nhận cập nhật từ người khác
  useEffect(() => {
    const articleId = currentArticleId
    const token = shareToken
    if ((!articleId && !token) || !session?.user) {
      setCollabPresence([])
      if (collabWsRef.current) {
        collabWsRef.current.close()
        collabWsRef.current = null
      }
      return
    }
    const wsUrl = getCollabWsUrl()
    if (!wsUrl) return
    const qs = articleId ? `articleId=${encodeURIComponent(articleId)}` : `shareToken=${encodeURIComponent(token!)}`
    const ws = new WebSocket(`${wsUrl}/ws?${qs}`)
    collabWsRef.current = ws
    ws.onopen = () => setCollabPresence([])
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string)
        if (msg.type === "content" && msg.payload) {
          const wrap = wrapBareImagesForResizeRef.current
          const html = typeof wrap === "function" ? wrap(msg.payload.content ?? "") : (msg.payload.content ?? "")
          setDocTitle(msg.payload.title ?? "")
          setContent(html)
          setReferences(Array.isArray(msg.payload.references) ? msg.payload.references : [])
          setDocumentKey((k) => k + 1)
          const fromName = msg.from?.name || "Người khác"
          toast.success(`Đã đồng bộ từ ${fromName}`)
        } else if (msg.type === "presence" && Array.isArray(msg.users)) {
          setCollabPresence(msg.users)
        }
      } catch {
        // ignore
      }
    }
    ws.onclose = () => setCollabPresence([])
    ws.onerror = () => setCollabPresence([])
    return () => {
      ws.close()
      collabWsRef.current = null
      setCollabPresence([])
    }
  }, [currentArticleId, shareToken, session?.user])

  const handleSave = async (opts?: { requireProject?: boolean }) => {
    if (!session?.user) return
    if (!activeResearch?.id) {
      if (opts?.requireProject) {
        pendingSaveAfterProjectRef.current = true
        setShowRequireProjectDialog(true)
      }
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const title = getDocTitle()
      const html = editorRef.current?.innerHTML ?? content
      if (shareToken) {
        await updateWriteArticleByShareToken(shareToken, { title, content: html, references })
      } else if (currentArticleId) {
        await updateWriteArticle(currentArticleId, { title, content: html, references })
        await loadArticles()
      } else {
        const created = await createWriteArticle({
          title,
          content: html,
          references,
          research_id: String(activeResearch.id),
        })
        setCurrentArticleId(created.id)
        if (!activeResearch?.name) setDocTitle(created.title)
        await loadArticles()
      }
      setLastSavedAt(new Date())
      lastSyncedHtmlRef.current = html
      lastSyncedTitleRef.current = title
      lastSyncedReferencesRef.current = JSON.stringify(references)
      if (collabWsRef.current?.readyState === WebSocket.OPEN) {
        try {
          collabWsRef.current.send(
            JSON.stringify({ type: "content", payload: { content: html, title, references } })
          )
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setSaveError(err?.message || "Lưu thất bại")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAsNew = async () => {
    if (!session?.user) return
    setSaving(true)
    setSaveError(null)
    try {
      const title = getDocTitle()
      const html = editorRef.current?.innerHTML ?? content
      const created = await createWriteArticle({
        title,
        content: html,
        references,
        research_id: activeResearch?.id != null ? String(activeResearch.id) : undefined,
      })
      setCurrentArticleId(created.id)
      if (!activeResearch?.name) setDocTitle(created.title)
      setDocumentKey((k) => k + 1)
      setContent(created.content)
      lastSyncedHtmlRef.current = created.content
      lastSyncedTitleRef.current = title
      lastSyncedReferencesRef.current = JSON.stringify(references)
      await loadArticles()
    } catch (err: any) {
      setSaveError(err?.message || "Lưu thất bại")
    } finally {
      setSaving(false)
    }
  }

  const handleLoadArticle = async (article: WriteArticle) => {
    try {
      const full = await getWriteArticle(article.id) as WriteArticleWithShare
      const html = wrapBareImagesForResize(full.content)
      setDocTitle(full.title)
      setFileName(sanitizeForFilename(full.title) || "")
      setContent(html)
      setCurrentArticleId(full.id)
      setShareToken(null)
      setArticleShareToken(full.share_token || null)
      setReferences(full.references ?? [])
      setSelectedTemplate(null)
      setDocumentKey((k) => k + 1)
      lastSyncedHtmlRef.current = html
      lastSyncedTitleRef.current = activeResearch?.name ?? full.title
      lastSyncedReferencesRef.current = JSON.stringify(full.references ?? [])
      if (full.updated_at) setLastSavedAt(new Date(full.updated_at))
    } catch {
      setSaveError("Không tải được bài viết")
    }
  }

  const handleRestoreVersion = async (versionId: string) => {
    if (!currentArticleId) return
    setRestoringVersionId(versionId)
    try {
      const article = await restoreArticleVersion(currentArticleId, versionId)
      const html = wrapBareImagesForResize(article.content)
      setDocTitle(article.title)
      setContent(html)
      setReferences(article.references ?? [])
      setDocumentKey((k) => k + 1)
      lastSyncedHtmlRef.current = html
      lastSyncedTitleRef.current = article.title
      lastSyncedReferencesRef.current = JSON.stringify(article.references ?? [])
      setLastSavedAt(article.updated_at ? new Date(article.updated_at) : null)
      setShowVersionHistoryDialog(false)
    } catch (err: any) {
      setSaveError(err?.message || "Khôi phục thất bại")
    } finally {
      setRestoringVersionId(null)
    }
  }

  const handleDeleteVersion = async (versionId: string) => {
    if (!currentArticleId) return
    if (!confirm("Xóa phiên bản này khỏi lịch sử?")) return
    setDeletingVersionId(versionId)
    try {
      await deleteArticleVersion(currentArticleId, versionId)
      const list = await getArticleVersions(currentArticleId)
      setVersionList(list)
    } catch (err: any) {
      setSaveError(err?.message || "Xóa phiên bản thất bại")
    } finally {
      setDeletingVersionId(null)
    }
  }

  const handleClearVersionsExceptLatest = async () => {
    if (!currentArticleId) return
    if (!confirm("Xóa toàn bộ lịch sử và chỉ giữ lại phiên bản gần nhất?")) return
    setClearingVersions(true)
    try {
      await clearArticleVersionsExceptLatest(currentArticleId)
      const list = await getArticleVersions(currentArticleId)
      setVersionList(list)
    } catch (err: any) {
      setSaveError(err?.message || "Xóa lịch sử thất bại")
    } finally {
      setClearingVersions(false)
    }
  }

  const handleDeleteArticle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm("Bạn có chắc muốn xóa bài viết này?")) return
    try {
      await deleteWriteArticle(id)
      if (currentArticleId === id) {
        handleNewDoc()
      }
      await loadArticles()
    } catch (err: any) {
      setSaveError(err?.message || "Xóa thất bại")
    }
  }

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
    if (editorRef.current) setContent(editorRef.current.innerHTML)
  }

  /** Áp dụng cỡ chữ (pt) bằng span style — execCommand('fontSize') chỉ hỗ trợ 1–7 nên cỡ lớn (vd 72) không đổi */
  const applyFontSize = (pt: number) => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
    el.focus()
    const range = sel.getRangeAt(0)
    const span = document.createElement("span")
    span.style.fontSize = `${pt}pt`
    if (range.collapsed) {
      span.appendChild(document.createTextNode("\u200B"))
      range.insertNode(span)
      range.setStart(span.firstChild!, 1)
      range.collapse(true)
    } else {
      try {
        range.surroundContents(span)
      } catch {
        const fragment = range.extractContents()
        span.appendChild(fragment)
        range.insertNode(span)
      }
    }
    sel.removeAllRanges()
    sel.addRange(range)
    setContent(el.innerHTML)
  }

  /** Xóa đánh dấu (highlight) khỏi vùng chọn hoặc tại vị trí con trỏ để text tiếp theo không bị highlight */
  const removeHighlight = () => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
    const range = sel.getRangeAt(0)

    if (range.collapsed) {
      // Con trỏ đang trong vùng highlight: chèn span transparent để text gõ tiếp không bị highlight
      const span = document.createElement("span")
      span.style.backgroundColor = "transparent"
      span.setAttribute("data-clear-highlight", "1")
      span.appendChild(document.createTextNode("\u200B"))
      range.insertNode(span)
      range.setStartAfter(span)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      // Có vùng chọn: duyệt các element trong range có background-color, xóa highlight
      const root = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer as HTMLElement
        : range.commonAncestorContainer.parentElement
      if (!root || !el.contains(root)) return
      const collectWithBg = (node: HTMLElement, out: HTMLElement[]) => {
        if (node.style?.backgroundColor && node.style.backgroundColor !== "transparent")
          out.push(node)
        for (let i = 0; i < node.children.length; i++)
          collectWithBg(node.children[i] as HTMLElement, out)
      }
      const toClear: HTMLElement[] = []
      if (root.style?.backgroundColor && root.style.backgroundColor !== "transparent")
        toClear.push(root)
      for (let i = 0; i < root.children.length; i++)
        collectWithBg(root.children[i] as HTMLElement, toClear)
      toClear.forEach((node) => {
        if (range.intersectsNode(node))
          node.style.setProperty("background-color", "transparent")
      })
    }
    el.focus()
    setContent(el.innerHTML)
  }

  const applyBulletList = (listStyleType: "disc" | "circle" | "square") => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return
    const node = sel.anchorNode
    const start = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
    const ul = start?.closest?.("ul")
    if (ul && el.contains(ul)) {
      ;(ul as HTMLElement).style.listStyleType = listStyleType
      if (el) setContent(el.innerHTML)
      return
    }
    insertHtml(`<ul style="list-style-type: ${listStyleType}"><li><br></li></ul><p></p>`)
  }

  const applyNumberedList = (listStyleType: "decimal" | "lower-alpha" | "upper-alpha" | "lower-roman" | "upper-roman") => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return
    const node = sel.anchorNode
    const start = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
    const ol = start?.closest?.("ol")
    if (ol && el.contains(ol)) {
      ;(ol as HTMLElement).style.listStyleType = listStyleType
      if (el) setContent(el.innerHTML)
      return
    }
    insertHtml(`<ol style="list-style-type: ${listStyleType}"><li><br></li></ol><p></p>`)
  }

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const fmt = document.queryCommandValue("formatBlock")?.toLowerCase() ?? "p"
      const blockTag = fmt === "paragraph" ? "p" : fmt.startsWith("heading ") ? `h${fmt.replace("heading ", "").trim()}` : fmt
      if (blockTag !== "p" && ["h1", "h2", "h3", "h4", "h5", "h6"].includes(blockTag)) {
        e.preventDefault()
        document.execCommand("insertParagraph", false)
        document.execCommand("formatBlock", false, "p")
        setCurrentBlockTag("p")
        if (editorRef.current) setContent(editorRef.current.innerHTML)
      }
      return
    }
    if (e.key === "Tab") {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const node = sel.anchorNode
      if (!node) return
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
      if (!el || !editorRef.current?.contains(el)) return
      const inList = el.closest("li, ul, ol")
      if (inList) {
        e.preventDefault()
        document.execCommand(e.shiftKey ? "outdent" : "indent", false)
        if (editorRef.current) setContent(editorRef.current.innerHTML)
      }
    }
  }

  const insertHtml = (html: string) => {
    const el = editorRef.current
    if (!el) return
    const sel = window.getSelection()
    const selectionInEditor = sel && sel.rangeCount > 0 && sel.anchorNode && el.contains(sel.anchorNode)
    if (!selectionInEditor) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    document.execCommand("insertHTML", false, html)
    el.focus()
    setContent(el.innerHTML)
  }

  const insertFormulaMarkerAtSelection = useCallback(() => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return
    const node = sel.anchorNode
    if (!node || !el.contains(node)) return
    document.execCommand("insertHTML", false, `<span id="${FORMULA_INSERT_MARKER_ID}"></span>`)
    if (editorRef.current) setContent(editorRef.current.innerHTML)
  }, [])

  const removeFormulaMarkerIfPresent = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const marker = el.querySelector(`#${FORMULA_INSERT_MARKER_ID}`)
    if (marker) {
      marker.remove()
      setContent(el.innerHTML)
    }
  }, [])

  const insertLatexFormula = useCallback(async () => {
    const latex = formulaLatex.trim()
    if (!latex) return
    setFormulaError(null)
    try {
      const katex = (await import("katex")).default
      const rawHtml = katex.renderToString(latex, { throwOnError: true, displayMode: false })
      setFormulaLatex("")
      setFormulaError(null)
      const el = editorRef.current
      if (!el) return
      const marker = el.querySelector(`#${FORMULA_INSERT_MARKER_ID}`)
      const formulaHtml = `<span class="editor-formula-inline" style="display:inline;vertical-align:middle">${rawHtml}</span>\u200B`
      if (marker && marker.parentNode) {
        const temp = document.createElement("div")
        temp.innerHTML = formulaHtml
        const formulaSpan = temp.firstElementChild
        const afterSpace = temp.lastChild
        if (!formulaSpan) return
        marker.parentNode.insertBefore(formulaSpan, marker)
        if (afterSpace && afterSpace.nodeType === Node.TEXT_NODE) {
          marker.parentNode.insertBefore(afterSpace, marker)
        }
        marker.remove()
        const sel = window.getSelection()
        if (sel) {
          const range = document.createRange()
          range.setStartAfter(formulaSpan)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
        el.focus()
        setContent(el.innerHTML)
      } else {
        insertHtml(`<span class="editor-formula-inline" style="display:inline;vertical-align:middle">${rawHtml}</span>\u200B`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cú pháp LaTeX không hợp lệ"
      setFormulaError(msg)
    }
  }, [formulaLatex])

  const insertLatexFormulaBlock = useCallback(async () => {
    const latex = formulaLatex.trim()
    if (!latex) return
    setFormulaError(null)
    try {
      const katex = (await import("katex")).default
      const rawHtml = katex.renderToString(latex, { throwOnError: true, displayMode: true })
      setFormulaLatex("")
      setFormulaError(null)
      const blockHtml = `<p style="text-align:center;margin:1em 0"><span class="editor-formula-block" contenteditable="false" style="display:inline-block">${rawHtml}</span></p><p></p>`
      insertHtml(blockHtml)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cú pháp LaTeX không hợp lệ"
      setFormulaError(msg)
    }
  }, [formulaLatex])

  /** Tìm trong nội dung editor: dùng window.find (tìm trong trang, ưu tiên vùng visible). */
  const runFindInEditor = useCallback(() => {
    if (!findQuery.trim()) return
    editorRef.current?.focus()
    const w = window as Window & { find?(a: string, b: boolean, c: boolean, d: boolean, e: boolean, f: boolean, g: boolean): boolean }
    if (typeof w.find !== "function") return
    const found = w.find(findQuery.trim(), false, findBackward, true, false, false, false)
    if (!found && !findBackward) w.find(findQuery.trim(), false, false, true, false, true, false)
  }, [findQuery, findBackward])

  const TABLE_RESIZE_HANDLE_STYLE =
    "position:absolute;right:0;bottom:0;width:24px;height:24px;cursor:se-resize;pointer-events:auto;z-index:2;background:linear-gradient(135deg,transparent 50%,rgba(59,130,246,0.8) 50%);border:1px solid rgba(59,130,246,0.6);border-radius:2px 0 0 0"

  const handleInsertTable = (rows: number, cols: number) => {
    const n = countCaptionablesByType("table") + 1
    const tableId = `tbl-${n}`
    const thCell = "<th class=\"border border-gray-300 dark:border-gray-600 p-2 text-left bg-gray-100 dark:bg-gray-800\"><br></th>"
    const thCells = Array(cols).fill(thCell).join("")
    const header = `<tr>${thCells}</tr>`
    const tdCell = "<td class=\"border border-gray-300 dark:border-gray-600 p-2\"><br></td>"
    const bodyRows = Array(rows - 1)
      .fill(null)
      .map(() => `<tr>${Array(cols).fill(tdCell).join("")}</tr>`)
      .join("")
    const tableInner = `<table class="border-collapse border border-gray-300 dark:border-gray-600 my-4 text-sm" style="width:100%;table-layout:fixed"><thead>${header}</thead><tbody>${bodyRows}</tbody></table>`
    const captionStyle = "margin-top:0.25em;margin-bottom:1em;text-align:center;font-size:0.9em;color:var(--muted-foreground)"
    const captionHtml = `<p class="editor-caption" data-caption-type="table" data-caption-id="${tableId}" style="${captionStyle}"><strong>Bảng ${n}:</strong> </p>`
    const wrapperHtml = `<div class="editor-resizable-table" data-table-id="${tableId}" contenteditable="false" style="width:100%;min-width:200px;max-width:100%;position:relative;overflow:visible;margin:1em 0">${tableInner}<span class="resize-handle table-resize-handle" style="${TABLE_RESIZE_HANDLE_STYLE}" title="Kéo để đổi độ rộng bảng" contenteditable="false"></span></div>${captionHtml}<p></p>`
    insertHtml(wrapperHtml)
  }

  /** Lấy block (p, div) ngay trước vị trí con trỏ có chứa hình/bảng/công thức. */
  const getPreviousBlockElement = useCallback((): { block: Element; captionable: Element } | null => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    let node: Node | null = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    if (!node || !el.contains(node)) return null
    const currentBlock = (node as Element).closest?.("p, div, h1, h2, h3")
    if (!currentBlock || !el.contains(currentBlock)) return null
    const prev = currentBlock.previousElementSibling
    if (!prev) return null
    const imgWrap = prev.querySelector?.(".editor-resizable-img")
    const tableWrap = prev.classList?.contains("editor-resizable-table") ? prev : prev.querySelector?.(".editor-resizable-table")
    const formulaBlock = prev.querySelector?.(".editor-formula-block")
    const captionable = (imgWrap ?? tableWrap ?? formulaBlock) as Element | null
    if (!captionable) return null
    return { block: prev, captionable }
  }, [])

  /** Đếm số lượng figure/table/equation đã có (theo data-*-id hoặc .editor-caption). */
  const countCaptionablesByType = useCallback((type: "figure" | "table" | "equation"): number => {
    const el = editorRef.current
    if (!el) return 0
    const attr = type === "figure" ? "data-figure-id" : type === "table" ? "data-table-id" : "data-equation-id"
    const captions = el.querySelectorAll(`.editor-caption[data-caption-type="${type}"]`)
    const max = Array.from(captions).reduce((n, c) => {
      const id = c.getAttribute("data-caption-id") ?? ""
      const num = parseInt(id.replace(/\D/g, ""), 10)
      return isNaN(num) ? n : Math.max(n, num)
    }, 0)
    const byAttr = el.querySelectorAll(`[${attr}]`)
    const maxAttr = Array.from(byAttr).reduce((n, el) => {
      const id = (el as HTMLElement).getAttribute(attr) ?? ""
      const num = parseInt(id.replace(/\D/g, ""), 10)
      return isNaN(num) ? n : Math.max(n, num)
    }, 0)
    return Math.max(max, maxAttr, 0)
  }, [])

  const handleInsertCaption = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const prev = getPreviousBlockElement()
    if (!prev) {
      setSaveError("Đặt con trỏ ngay sau một hình ảnh, bảng hoặc công thức (block) rồi thử lại.")
      return
    }
    const { block, captionable } = prev
    let type: "figure" | "table" | "equation"
    if (captionable.classList?.contains("editor-resizable-img")) type = "figure"
    else if (captionable.classList?.contains("editor-resizable-table") || captionable.closest?.(".editor-resizable-table")) type = "table"
    else if (captionable.classList?.contains("editor-formula-block")) type = "equation"
    else return
    const n = countCaptionablesByType(type) + 1
    const id = type === "figure" ? `fig-${n}` : type === "table" ? `tbl-${n}` : `eq-${n}`
    const label = type === "figure" ? "Hình" : type === "table" ? "Bảng" : "Phương trình"
    const labelText = type === "equation" ? `${label} (${n})` : `${label} ${n}`
    const attr = type === "figure" ? "data-figure-id" : type === "table" ? "data-table-id" : "data-equation-id"
    captionable.setAttribute(attr, id)
    const p = document.createElement("p")
    p.className = "editor-caption"
    p.setAttribute("data-caption-type", type)
    p.setAttribute("data-caption-id", id)
    p.style.cssText = "margin-top:0.25em;margin-bottom:1em;text-align:center;font-size:0.9em;color:var(--muted-foreground)"
    p.innerHTML = `<strong>${escapeHtmlForEditor(labelText)}:</strong> `
    block.after(p)
    const sel = window.getSelection()
    if (sel) {
      const range = document.createRange()
      range.selectNodeContents(p)
      range.collapse(true)
      range.setStart(p, 1)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    el.focus()
    setContent(el.innerHTML)
  }, [getPreviousBlockElement, countCaptionablesByType])

  type CrossRefTarget = { type: "figure" | "table" | "equation" | "section"; id: string; label: string }
  const collectCrossRefTargets = useCallback((): CrossRefTarget[] => {
    const el = editorRef.current
    if (!el) return []
    const out: CrossRefTarget[] = []
    let sectionIndex = 0
    el.querySelectorAll(".editor-caption[data-caption-type][data-caption-id]").forEach((cap) => {
      const type = (cap.getAttribute("data-caption-type") ?? "") as "figure" | "table" | "equation"
      const id = cap.getAttribute("data-caption-id") ?? ""
      const text = (cap.textContent ?? "").trim()
      const label = text || (type === "figure" ? `Hình ${id.replace(/\D/g, "")}` : type === "table" ? `Bảng ${id.replace(/\D/g, "")}` : `Phương trình ${id.replace(/\D/g, "")}`)
      if (type && id) out.push({ type, id, label })
    })
    el.querySelectorAll("h1, h2, h3").forEach((h) => {
      sectionIndex++
      const secId = (h as HTMLElement).getAttribute("data-section-id") ?? `sec-${sectionIndex}`
      const label = (h.textContent ?? "").trim() || `Mục ${sectionIndex}`
      out.push({ type: "section", id: secId, label })
    })
    return out
  }, [])

  const handleInsertCrossRef = useCallback((target: CrossRefTarget) => {
    if (target.type === "section") {
      const el = editorRef.current
      if (el) {
        const headings = Array.from(el.querySelectorAll("h1, h2, h3"))
        const num = parseInt(target.id.replace(/\D/g, ""), 10)
        const h = headings[num - 1] as HTMLElement | undefined
        if (h && !h.getAttribute("data-section-id")) h.setAttribute("data-section-id", target.id)
      }
    }
    const spanHtml = `<span class="editor-crossref" contenteditable="false" data-ref-type="${escapeHtmlForEditor(target.type)}" data-ref-id="${escapeHtmlForEditor(target.id)}" style="font-weight:600;color:var(--primary)">${escapeHtmlForEditor(target.label)}</span>`
    insertHtml(spanHtml)
    setShowCrossRefDialog(false)
  }, [])

  const RESIZABLE_IMG_WRAPPER_STYLE =
    "display:inline-block;position:relative;min-width:80px;min-height:60px;width:300px;height:200px;max-width:100%;overflow:visible;z-index:1"
  const RESIZE_HANDLE_STYLE =
    "position:absolute;right:0;bottom:0;width:24px;height:24px;cursor:se-resize;pointer-events:auto;z-index:2;background:linear-gradient(135deg,transparent 50%,rgba(59,130,246,0.8) 50%);border:1px solid rgba(59,130,246,0.6);border-radius:2px 0 0 0"

  const wrapBareImagesForResize = (html: string): string => {
    if (!html.includes("<img")) return html
    if (html.includes("editor-resizable-img")) return html
    return html.replace(
      /<p>(\s*)<img([^>]*?)\s*\/?>(\s*)<\/p>/gi,
      (_, before, imgAttrs, after) => {
        const srcMatch = imgAttrs.match(/src\s*=\s*["']([^"']*)["']/i)
        const altMatch = imgAttrs.match(/alt\s*=\s*["']([^"']*)["']/i)
        const src = srcMatch?.[1] ?? ""
        const alt = (altMatch?.[1] ?? "").replace(/"/g, "&quot;")
        if (!src) return `<p>${before || ""}<img${imgAttrs}/>${after || ""}</p>`
        return `<p>${before || ""}<span class="editor-resizable-img" contenteditable="false" style="${RESIZABLE_IMG_WRAPPER_STYLE}"><img src="${src.replace(/"/g, "&quot;")}" alt="${alt}" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none" /><span class="resize-handle" style="${RESIZE_HANDLE_STYLE}" title="Kéo để đổi kích thước" contenteditable="false"></span></span>${after || ""}</p>`
      }
    )
  }
  wrapBareImagesForResizeRef.current = wrapBareImagesForResize

  const getResizableImageHtml = (src: string, alt: string, width?: number, height?: number) => {
    const w = width ? `${width}px` : "300px"
    const h = height ? `${height}px` : "200px"
    const wrapStyle = `display:inline-block;position:relative;min-width:80px;min-height:60px;width:${w};height:${h};max-width:100%;overflow:visible;z-index:1`
    return `<p><span class="editor-resizable-img" contenteditable="false" style="${wrapStyle}"><img src="${src.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none" /><span class="resize-handle" style="${RESIZE_HANDLE_STYLE}" title="Kéo để đổi kích thước" contenteditable="false"></span></span></p>`
  }

  /** Chèn ảnh có thể resize bằng DOM (tránh execCommand insertHTML làm mất wrapper/handle) */
  const insertResizableImageAtSelection = (src: string, alt: string, width?: number, height?: number) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    const range =
      sel && sel.rangeCount > 0 && sel.anchorNode && el.contains(sel.anchorNode)
        ? sel.getRangeAt(0)
        : (() => {
            const r = document.createRange()
            r.selectNodeContents(el)
            r.collapse(false)
            return r
          })()
    const w = width ?? 300
    const h = height ?? 200
    const p = document.createElement("p")
    const wrapper = document.createElement("span")
    wrapper.className = "editor-resizable-img"
    wrapper.setAttribute("contenteditable", "false")
    wrapper.style.cssText = `display:inline-block;position:relative;min-width:80px;min-height:60px;width:${w}px;height:${h}px;max-width:100%;overflow:visible;z-index:1`
    const img = document.createElement("img")
    img.src = src
    img.alt = alt
    img.style.cssText = "width:100%;height:100%;object-fit:contain;display:block;pointer-events:none"
    const handle = document.createElement("span")
    handle.className = "resize-handle"
    handle.setAttribute("contenteditable", "false")
    handle.setAttribute("title", "Kéo để đổi kích thước")
    handle.style.cssText = RESIZE_HANDLE_STYLE
    wrapper.appendChild(img)
    wrapper.appendChild(handle)
    p.appendChild(wrapper)
    range.deleteContents()
    range.insertNode(p)
    range.setStartAfter(p)
    range.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(range)
    setContent(el.innerHTML)
  }

  const handleInsertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !file.type.startsWith("image/")) return
    const alt = file.name.replace(/"/g, "&quot;")
    const tryInsert = (src: string, w?: number, h?: number) => {
      insertResizableImageAtSelection(src, alt, w, h)
    }
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("userEmail", (session as any)?.user?.email || "anonymous")
      const res = await fetch(`${API_CONFIG.baseUrl}/api/upload`, {
        method: "POST",
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      const urls = json?.files ?? []
      const url = urls[0]
      if (url) {
        const img = new window.Image()
        img.onload = () => {
          const max = 500
          let w = img.naturalWidth
          let h = img.naturalHeight
          if (w > max || h > max) {
            if (w > h) {
              h = (h * max) / w
              w = max
            } else {
              w = (w * max) / h
              h = max
            }
          }
          tryInsert(url, w, h)
        }
        img.onerror = () => tryInsert(url)
        img.src = url
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          const img = new window.Image()
          img.onload = () => {
            const max = 500
            let w = img.naturalWidth
            let h = img.naturalHeight
            if (w > max || h > max) {
              if (w > h) {
                h = (h * max) / w
                w = max
              } else {
                w = (w * max) / h
                h = max
              }
            }
            tryInsert(dataUrl, w, h)
          }
          img.onerror = () => tryInsert(dataUrl)
          img.src = dataUrl
        }
        reader.readAsDataURL(file)
      }
    } catch {
      const fallbackReader = new FileReader()
      fallbackReader.onload = () => {
        const dataUrl = fallbackReader.result as string
        tryInsert(dataUrl)
      }
      fallbackReader.readAsDataURL(file)
    }
  }

  const escapeHtmlForEditor = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const handleInsertCitation = (index?: number, apaVariant?: "parenthetical" | "narrative") => {
    if (references.length === 0) {
      setShowCitationDialog(true)
      return
    }
    const idx = index != null && index >= 0 && index < references.length ? index : references.length - 1
    const ref = references[idx]!
    if (citationStyle === "APA") {
      const text = apaVariant === "narrative" ? formatInTextAPANarrative(ref) : formatInTextAPA(ref)
      insertHtml(`<span class="citation-intext">${escapeHtmlForEditor(text)}</span> `)
    } else {
      const num = index != null ? index + 1 : references.length
      insertHtml(`<sup>[${num}]</sup> `)
    }
  }

  const handleInsertReferenceList = () => {
    if (references.length === 0) return
    const style = citationStyle
    const raw =
      style === "APA"
        ? toReferenceListAPA(references)
        : toReferenceListIEEE(references)
    const paras = raw.split(/\n\n+/).filter(Boolean)
    const html = `<h2>Tài liệu tham khảo</h2>${paras.map((p) => `<p class="mb-2 text-sm">${markdownItalicsToHtml(p.replace(/\n/g, " "))}</p>`).join("")}<p></p>`
    insertHtml(html)
    setShowCitationDialog(false)
  }

  const handleExportReferences = (format: "bibtex" | "endnote" | "refman" | "refworks") => {
    if (references.length === 0) return
    let content: string
    let ext: string
    let mime: string
    switch (format) {
      case "bibtex":
        content = toBibTeX(references)
        ext = "bib"
        mime = "application/x-bibtex"
        break
      case "endnote":
        content = toEndNote(references)
        ext = "enw"
        mime = "application/x-endnote-refer"
        break
      case "refman":
        content = toRefMan(references)
        ext = "ris"
        mime = "application/x-research-info-systems"
        break
      case "refworks":
        content = toRefWorks(references)
        ext = "txt"
        mime = "text/plain"
        break
    }
    const blob = new Blob([content], { type: `${mime};charset=utf-8` })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `references.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleSelectTemplate = (t: Template) => {
    setSelectedTemplate(t)
    setUserStartedEditing(false)
    const structure = getTemplateStructure(t)
    setDocumentKey((k) => k + 1)
    setContent(structure)
  }

  function getTemplateStructure(t: Template): string {
    const type = (t.type ?? t.id ?? "").toLowerCase()
    if (type.includes("thesis")) {
      return `<h1>Luận văn Thạc sĩ</h1><h2>1. Mở đầu</h2><p></p><h2>2. Tổng quan tài liệu</h2><p></p><h2>3. Phương pháp nghiên cứu</h2><p></p><h2>4. Kết quả và thảo luận</h2><p></p><h2>5. Kết luận</h2><p></p><h2>Tài liệu tham khảo</h2><p></p>`
    }
    return ""
  }

  /** Mẫu Cover letter gửi tạp chí — chèn tại vị trí con trỏ */
  const COVER_LETTER_TEMPLATE_HTML = `<h2>Cover Letter</h2>
<p>[Ngày]</p>
<p>Kính gửi: Biên tập viên / [Tên tạp chí]</p>
<p><strong>Re:</strong> Submission of manuscript &quot;[Tên bài báo]&quot;</p>
<p>Kính thưa Quý Tòa soạn,</p>
<p>Chúng tôi xin gửi kèm bản thảo bài báo &quot;[Tên bài báo]&quot; để xem xét đăng trên [Tên tạp chí]. Bài báo chưa được công bố hoặc gửi đăng ở nơi khác.</p>
<p>Đóng góp chính của nghiên cứu: [Tóm tắt ngắn 2–3 câu về đóng góp và phù hợp với tạp chí].</p>
<p>Chúng tôi xác nhận không có xung đột lợi ích. Tất cả tác giả đã đọc và đồng ý với nội dung bản thảo.</p>
<p>Trân trọng,<br>[Tên tác giả / Tất cả tác giả]</p>
<p></p>`

  /** Mẫu Submission checklist — chèn tại vị trí con trỏ (☐ = chưa xong, đổi thành ☑ khi xong) */
  const SUBMISSION_CHECKLIST_HTML = `<h2>Submission Checklist</h2>
<ul style="list-style-type: none;">
<li>☐ Định dạng bài theo hướng dẫn tác giả của tạp chí</li>
<li>☐ Title page và Abstract đầy đủ</li>
<li>☐ Tài liệu tham khảo đầy đủ, đúng chuẩn (APA/IEEE/…)</li>
<li>☐ Hình và bảng được đánh số, có chú thích</li>
<li>☐ Cover letter đính kèm</li>
<li>☐ File ẩn danh (blinded) nếu tạp chí yêu cầu double-blind</li>
<li>☐ Đã kiểm tra đạo văn / similarity</li>
<li>☐ Thông tin tác giả (affiliation, ORCID, correspondence) chính xác</li>
<li>☐ Đã đính kèm file bổ sung (nếu có)</li>
</ul>
<p></p>`

  /** Research framework 10 bước — AI hỗ trợ viết (dialog Trợ lý nghiên cứu) */
  const RESEARCH_FLOW_STEPS: {
    id: string
    number: number
    title: string
    aiSupport: string[]
    researcherProvides: string
    insertHtml: string
  }[] = [
    {
      id: "problem",
      number: 1,
      title: "Xác định vấn đề nghiên cứu",
      aiSupport: [
        "Soạn bối cảnh nghiên cứu theo cấu trúc từ rộng đến hẹp.",
        "Viết problem statement ngắn và dài.",
        "Xây dựng mục tiêu nghiên cứu và câu hỏi nghiên cứu theo chuẩn SMART.",
        "Gợi ý cách xác định phạm vi, đối tượng, biến số/khái niệm chính.",
      ],
      researcherProvides: "Chủ đề, bối cảnh, đối tượng và khoảng trống nhận thấy.",
      insertHtml: `<h2>1. Xác định vấn đề nghiên cứu</h2><h3>1.1. Bối cảnh nghiên cứu</h3><p><br></p><h3>1.2. Problem statement</h3><p><br></p><h3>1.3. Mục tiêu và câu hỏi nghiên cứu (SMART)</h3><p><br></p><h3>1.4. Phạm vi, đối tượng và biến số/khái niệm</h3><p><br></p><p><br></p>`,
    },
    {
      id: "literature",
      number: 2,
      title: "Tổng quan tài liệu (Literature Review)",
      aiSupport: [
        "Tạo dàn ý literature review theo chủ đề, mô hình hoặc phương pháp.",
        "Viết các đoạn tổng hợp (synthesis) thay vì liệt kê.",
        "Xây dựng bảng so sánh nghiên cứu trước.",
        "Soạn research gap rõ ràng để dẫn đến RQ hoặc giả thuyết.",
      ],
      researcherProvides: "Danh sách bài báo hoặc ý chính cần tổng hợp.",
      insertHtml: `<h2>2. Tổng quan tài liệu</h2><h3>2.1. Dàn ý và tổng hợp</h3><p><br></p><h3>2.2. Bảng so sánh nghiên cứu trước</h3><p><br></p><h3>2.3. Research gap</h3><p><br></p><p><br></p>`,
    },
    {
      id: "rq",
      number: 3,
      title: "Câu hỏi nghiên cứu và giả thuyết",
      aiSupport: [
        "Chuẩn hóa Research Questions theo dạng mô tả, quan hệ hoặc nhân quả.",
        "Viết hệ thống hypotheses và giải thích cơ sở lý thuyết.",
        "Soạn định nghĩa khái niệm và mô tả cách đo lường.",
      ],
      researcherProvides: "Mục tiêu nghiên cứu và các biến/khái niệm chính.",
      insertHtml: `<h2>3. Câu hỏi nghiên cứu và giả thuyết</h2><h3>3.1. Research Questions</h3><p><br></p><h3>3.2. Hypotheses / Propositions</h3><p><br></p><h3>3.3. Định nghĩa khái niệm và đo lường</h3><p><br></p><p><br></p>`,
    },
    {
      id: "methodology",
      number: 4,
      title: "Phương pháp nghiên cứu (Methodology)",
      aiSupport: [
        "Soạn phần Research Design đúng văn phong học thuật.",
        "Mô tả sampling, công cụ đo lường, quy trình nghiên cứu.",
        "Viết các đoạn về reliability, validity hoặc trustworthiness.",
      ],
      researcherProvides: "Loại nghiên cứu dự kiến (survey, experiment, case study…).",
      insertHtml: `<h2>4. Phương pháp nghiên cứu</h2><h3>4.1. Research Design</h3><p><br></p><h3>4.2. Sampling và công cụ đo lường</h3><p><br></p><h3>4.3. Quy trình, reliability và validity</h3><p><br></p><p><br></p>`,
    },
    {
      id: "collection",
      number: 5,
      title: "Thu thập dữ liệu",
      aiSupport: [
        "Kịch bản phỏng vấn bán cấu trúc.",
        "Phiếu khảo sát với phần giới thiệu, consent và thang đo.",
        "Protocol thực nghiệm và mô tả đạo đức nghiên cứu.",
      ],
      researcherProvides: "Loại dữ liệu, đối tượng tham gia và bối cảnh thực hiện.",
      insertHtml: `<h2>5. Thu thập dữ liệu</h2><h3>5.1. Quy trình và công cụ thu thập</h3><p><br></p><h3>5.2. Consent và đạo đức nghiên cứu</h3><p><br></p><p><br></p>`,
    },
    {
      id: "analysis",
      number: 6,
      title: "Phân tích dữ liệu",
      aiSupport: [
        "Analysis plan: phương pháp thống kê hoặc phân tích định tính phù hợp.",
        "Mô tả quy trình làm sạch dữ liệu và xử lý thiếu dữ liệu.",
        "Kế hoạch mã hóa dữ liệu định tính.",
      ],
      researcherProvides: "Loại dữ liệu, câu hỏi nghiên cứu và công cụ dự kiến sử dụng.",
      insertHtml: `<h2>6. Phân tích dữ liệu</h2><h3>6.1. Kế hoạch phân tích</h3><p><br></p><h3>6.2. Làm sạch dữ liệu và mã hóa</h3><p><br></p><p><br></p>`,
    },
    {
      id: "results",
      number: 7,
      title: "Kết quả (Results)",
      aiSupport: [
        "Tường thuật kết quả dựa trên bảng hoặc hình do Nhà nghiên cứu cung cấp.",
        "Viết chú thích bảng biểu và cấu trúc mục Results theo RQ/Hypothesis.",
      ],
      researcherProvides: "Bảng số liệu, biểu đồ hoặc mô tả kết quả.",
      insertHtml: `<h2>7. Kết quả</h2><h3>7.1. Kết quả theo RQ/Hypothesis</h3><p><br></p><h3>7.2. Bảng và hình</h3><p><br></p><p><br></p>`,
    },
    {
      id: "discussion",
      number: 8,
      title: "Thảo luận (Discussion)",
      aiSupport: [
        "Diễn giải ý nghĩa của kết quả.",
        "So sánh với nghiên cứu trước.",
        "Viết phần implications, limitations và future research.",
      ],
      researcherProvides: "Các điểm nhấn chính và các công trình cần đối chiếu.",
      insertHtml: `<h2>8. Thảo luận</h2><h3>8.1. Diễn giải và so sánh</h3><p><br></p><h3>8.2. Implications, limitations và future research</h3><p><br></p><p><br></p>`,
    },
    {
      id: "conclusion",
      number: 9,
      title: "Kết luận và đóng góp",
      aiSupport: [
        "Tổng hợp phát hiện chính.",
        "Viết mục contributions theo chuẩn học thuật.",
        "Đề xuất hướng nghiên cứu tiếp theo.",
      ],
      researcherProvides: "Các phát hiện chính và đóng góp dự kiến.",
      insertHtml: `<h2>9. Kết luận</h2><h3>9.1. Tóm tắt phát hiện</h3><p><br></p><h3>9.2. Đóng góp</h3><p><br></p><h3>9.3. Hướng nghiên cứu tiếp theo</h3><p><br></p><h2>Tài liệu tham khảo</h2><p><br></p><p><br></p>`,
    },
    {
      id: "standardize",
      number: 10,
      title: "Chuẩn hóa bài viết theo IMRaD hoặc Thesis",
      aiSupport: [
        "Chuẩn hóa giọng văn học thuật và cấu trúc lập luận.",
        "Chuyển bullet thành đoạn văn hoàn chỉnh.",
        "Viết abstract theo cấu trúc chuẩn.",
        "Rà soát tính logic và nhất quán thuật ngữ.",
      ],
      researcherProvides: "Bản nháp hoặc nội dung cần chuẩn hóa.",
      insertHtml: `<h2>Chuẩn hóa và hoàn thiện</h2><p><br></p><h3>Abstract</h3><p><br></p><h3>Rà soát logic và thuật ngữ</h3><p><br></p><p><br></p>`,
    },
  ]

  const applyGeneratedContent = useCallback((html: string) => {
    setContent(html)
    setDocumentKey((k) => k + 1)
    setShowGeneratePapersDialog(false)
    setGeneratePapersDescription("")
    setUserStartedEditing(true)
    setTimeout(() => editorRef.current?.focus(), 50)
  }, [])

  const handleGeneratePapersCreate = useCallback(() => {
    const desc = generatePapersDescription.trim()
    if (desc) {
      const safe = desc.replace(/</g, "&lt;").replace(/>/g, "&gt;")
      applyGeneratedContent(`<h1>Tài liệu mới</h1><p>${safe}</p><p></p>`)
    } else {
      applyGeneratedContent("<h1>Tài liệu mới</h1><p></p><p>Bắt đầu soạn thảo...</p>")
    }
  }, [generatePapersDescription, applyGeneratedContent])

  const [words, setWords] = useState(0)


  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  const prevActiveResearchIdRef = useRef<string | number | undefined>(undefined)

  // Sau khi user tạo/chọn project (đang pending lưu): tự gọi lưu article
  useEffect(() => {
    const currentId = activeResearch?.id
    const hadProject = prevActiveResearchIdRef.current != null
    if (currentId != null && !hadProject && pendingSaveAfterProjectRef.current) {
      pendingSaveAfterProjectRef.current = false
      setShowRequireProjectDialog(false)
      handleSaveRef.current()
    }
    prevActiveResearchIdRef.current = currentId
  }, [activeResearch?.id])

  // Đồng bộ lên server mỗi vài giây khi có thay đổi chưa lưu
  useEffect(() => {
    if (!session?.user) return
    const interval = setInterval(() => {
      const html = editorRef.current?.innerHTML ?? content
      if (html === lastSyncedHtmlRef.current) return
      if (!html || !html.trim()) return
      handleSaveRef.current()
    }, SYNC_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [session?.user, content])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (session?.user) handleSaveRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [session?.user])

  useEffect(() => {
    const timer = setInterval(() => {
      const el = editorRef.current
      if (el) {
        const text = el.innerText.replace(/\s+/g, " ").trim()
        setWords(text ? text.split(" ").filter(Boolean).length : 0)
        // Update outline from headings
        const headings = el.querySelectorAll("h1, h2, h3, h4, h5, h6")
        const items: { id: string; text: string; level: number }[] = []
        headings.forEach((h, i) => {
          const tag = (h as HTMLElement).tagName
          const level = tag === "H1" ? 1 : tag === "H2" ? 2 : tag === "H3" ? 3 : tag === "H4" ? 4 : tag === "H5" ? 5 : 6
          items.push({ id: `h-${i}`, text: (h as HTMLElement).innerText, level })
        })
        setOutlineItems(items)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [content])

  // Highlight mục dàn ý tương ứng với vị trí con trỏ / selection trong editor
  useEffect(() => {
    const onSelectionChange = () => {
      const el = editorRef.current
      const sel = window.getSelection()
      if (!el || !sel || sel.rangeCount === 0) {
        setCurrentOutlineIndex(null)
        return
      }
      const node = sel.anchorNode
      if (!node || !el.contains(node)) {
        setCurrentOutlineIndex(null)
        return
      }
      const headings = el.querySelectorAll("h1, h2, h3, h4, h5, h6")
      if (headings.length === 0) {
        setCurrentOutlineIndex(null)
        return
      }
      let index: number | null = null
      for (let i = 0; i < headings.length; i++) {
        if ((headings[i] as HTMLElement).contains(node)) {
          index = i
          break
        }
      }
      if (index === null) {
        for (let i = headings.length - 1; i >= 0; i--) {
          const pos = (headings[i] as Node).compareDocumentPosition(node)
          if (pos === Node.DOCUMENT_POSITION_FOLLOWING || (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
            index = i
            break
          }
        }
      }
      setCurrentOutlineIndex(index)
    }
    document.addEventListener("selectionchange", onSelectionChange)
    return () => document.removeEventListener("selectionchange", onSelectionChange)
  }, [])

  // Resize ảnh / bảng: kéo handle góc phải-dưới để đổi kích thước (event delegation trên document)
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const handle = (e.target as HTMLElement).closest(".resize-handle")
      if (!handle) return
      const imgWrapper = handle.closest(".editor-resizable-img") as HTMLElement
      const tableWrapper = handle.closest(".editor-resizable-table") as HTMLElement
      const wrapper = imgWrapper ?? tableWrapper
      if (!wrapper) return
      const editor = editorRef.current
      if (!editor || !editor.contains(wrapper)) return
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const rect = wrapper.getBoundingClientRect()
      let startW = rect.width
      let startH = rect.height
      const isTable = !!tableWrapper
      const onMove = (e2: MouseEvent) => {
        e2.preventDefault()
        const dw = e2.clientX - startX
        const newW = Math.max(isTable ? 200 : 80, Math.round(startW + dw))
        wrapper.style.width = `${newW}px`
        if (!isTable) {
          const dh = e2.clientY - startY
          const newH = Math.max(60, Math.round(startH + dh))
          wrapper.style.height = `${newH}px`
        }
      }
      const onUp = () => {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
        if (editorRef.current) setContent(editorRef.current.innerHTML)
      }
      document.body.style.userSelect = "none"
      document.body.style.cursor = "se-resize"
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    }
    document.addEventListener("mousedown", onMouseDown, true)
    return () => document.removeEventListener("mousedown", onMouseDown, true)
  }, [])

  const handleNewDoc = () => {
    setDocTitle("")
    setFileName("")
    setContent("")
    setSelectedTemplate(null)
    setCurrentArticleId(null)
    setShareToken(null)
    setArticleShareToken(null)
    setReferences([])
    setUserStartedEditing(false)
    setDocumentKey((k) => k + 1)
    lastSyncedHtmlRef.current = ""
    lastSyncedTitleRef.current = ""
    lastSyncedReferencesRef.current = "[]"
    try {
      localStorage.removeItem(getDraftKey(activeResearch?.id, null))
    } catch {
      // ignore
    }
  }

  const sanitizeForFilename = (s: string) => (s || "").trim().replace(/[<>:"/\\|?*]/g, "_") || "document"

  const getDocTitle = () => activeResearch?.name ?? (docTitle || "document")
  const getDocFilename = () => fileName.trim() || sanitizeForFilename(getDocTitle())
  const hasUnsavedChanges =
    content !== lastSyncedHtmlRef.current ||
    getDocTitle() !== lastSyncedTitleRef.current ||
    JSON.stringify(references) !== lastSyncedReferencesRef.current
  const getDocHtml = () => {
    const title = getDocTitle()
    const bodyContent = editorRef.current?.innerHTML ?? content
    const titleBlock = title ? `<h1 class="doc-title" style="font-size:22pt;font-weight:600;margin:0 0 1em;text-align:center">${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h1>` : ""
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title><style>
      body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;padding:48px 56px;color:#111;max-width:595px;margin:0 auto}
      h1{font-size:18pt;font-weight:600;margin:1em 0 .5em}h2{font-size:14pt;font-weight:600;margin:1em 0 .5em}h3{font-size:12pt;font-weight:600;margin:1em 0 .5em}
      p{margin:.5em 0}table{border-collapse:collapse;width:100%;margin:1em 0}th,td{border:1px solid #ccc;padding:8px;text-align:left}
      blockquote{border-left:4px solid #ddd;padding-left:16px;margin:1em 0;color:#555}
    </style></head><body>${bodyContent}</body></html>`
  }

  const handleDownload = (format: "html" | "pdf" | "docx" | "latex" | "markdown") => {
    const filename = getDocTitle().replace(/[<>:"/\\|?*]/g, "_")
    if (format === "html") {
      const html = getDocHtml()
      const blob = new Blob([html], { type: "text/html" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `${filename}.html`
      a.click()
      URL.revokeObjectURL(a.href)
      return
    }
    if (format === "docx") {
      const html = getDocHtml()
      fetch(`${API_CONFIG.baseUrl}/api/write-articles/export-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ html }),
      })
        .then((res) => {
          if (!res.ok) return res.json().then((j) => Promise.reject(new Error(j?.error || `HTTP ${res.status}`)))
          return res.blob()
        })
        .then((blob) => {
          const a = document.createElement("a")
          a.href = URL.createObjectURL(blob)
          a.download = `${filename}.docx`
          a.click()
          URL.revokeObjectURL(a.href)
        })
        .catch((err) => {
          console.error("Word export error:", err)
          setSaveError(err?.message || "Không thể xuất Word. Vui lòng thử lại.")
        })
      return
    }
    if (format === "pdf") {
      import("html2pdf.js").then(({ default: html2pdf }) => {
        const opt = {
          margin: 10,
          filename: `${filename}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        }
        const html = getDocHtml()
        html2pdf().set(opt).from(html, "string").save()
      }).catch((err) => {
        console.error("PDF export error:", err)
        setSaveError("Không thể xuất PDF. Vui lòng thử lại.")
      })
      return
    }
    if (format === "latex") {
      const html = editorRef.current?.innerHTML ?? content
      const latex = htmlToLatex(html, getDocTitle())
      const blob = new Blob([latex], { type: "text/x-tex" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `${filename}.tex`
      a.click()
      URL.revokeObjectURL(a.href)
      return
    }
    if (format === "markdown") {
      const html = editorRef.current?.innerHTML ?? content
      const md = htmlToMarkdown(html, getDocTitle())
      const blob = new Blob([md], { type: "text/markdown" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `${filename}.md`
      a.click()
      URL.revokeObjectURL(a.href)
    }
  }

  const scrollToHeading = (index: number) => {
    const el = editorRef.current
    if (!el) return
    const headings = el.querySelectorAll("h1, h2, h3, h4, h5, h6")
    const target = headings[index] as HTMLElement
    target?.scrollIntoView({ behavior: "smooth" })
  }

  /** Bỏ wrap và ẩn popover inline edit */
  const clearInlineEdit = useCallback(() => {
    const el = editorRef.current
    const groupId = inlineEditGroupIdRef.current
    if (el && groupId) {
      const spans = el.querySelectorAll(`[data-inline-edit-group="${groupId}"]`)
      spans.forEach((span) => {
        const parent = span.parentNode
        if (parent) {
          while (span.firstChild) parent.insertBefore(span.firstChild, span)
          parent.removeChild(span)
        }
      })
      setContent(el.innerHTML)
      inlineEditGroupIdRef.current = null
    }
    setInlineEdit(null)
  }, [])

  useEffect(() => {
    if (!inlineEdit) return
    const onPointerDown = (e: PointerEvent) => {
      const popover = document.getElementById("inline-edit-popover")
      if (popover?.contains(e.target as Node)) return
      const editor = editorRef.current
      if (editor?.contains(e.target as Node)) return
      clearInlineEdit()
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [inlineEdit, clearInlineEdit])

  /** Xử lý khi user chọn text trong editor - hỗ trợ chọn nhiều đoạn không liền mạch (Ctrl/Cmd + kéo) */
  const handleEditorSelection = useCallback(() => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return

    const selectedText = sel.toString().trim()
    if (!selectedText) {
      clearInlineEdit()
      return
    }

    // Bỏ wrap cũ nếu có
    if (inlineEditGroupIdRef.current) {
      const oldSpans = el.querySelectorAll(`[data-inline-edit-group="${inlineEditGroupIdRef.current}"]`)
      oldSpans.forEach((span) => {
        const parent = span.parentNode
        if (parent) {
          while (span.firstChild) parent.insertBefore(span.firstChild, span)
          parent.removeChild(span)
        }
      })
      inlineEditGroupIdRef.current = null
    }

    const groupId = crypto.randomUUID()
    let firstRect: DOMRect | null = null

    // Xử lý từ cuối lên đầu để tránh thay đổi DOM ảnh hưởng vị trí các range trước đó
    for (let i = sel.rangeCount - 1; i >= 0; i--) {
      const range = sel.getRangeAt(i)
      if (!el.contains(range.commonAncestorContainer)) continue
      const text = range.toString().trim()
      if (!text) continue

      try {
        const span = document.createElement("span")
        span.setAttribute("data-inline-edit-group", groupId)
        span.setAttribute("data-inline-edit-index", String(i))
        span.style.backgroundColor = "rgba(59, 130, 246, 0.2)"
        span.style.borderRadius = "2px"
        const fragment = range.extractContents()
        span.appendChild(fragment)
        range.insertNode(span)
        if (!firstRect) firstRect = span.getBoundingClientRect()
      } catch {
        // Một số range phức tạp (qua thẻ, bảng...) có thể fail - bỏ qua
      }
    }

    const spansCreated = el.querySelectorAll(`[data-inline-edit-group="${groupId}"]`)

    const spanCount = spansCreated.length
    if (spanCount > 0 && firstRect) {
      inlineEditGroupIdRef.current = groupId
      setInlineEdit({
        editId: groupId,
        rect: { top: firstRect.top, left: firstRect.left, bottom: firstRect.bottom, right: firstRect.right },
        customPrompt: "",
        segmentCount: spanCount,
      })
      setContent(el.innerHTML)
    } else if (sel.rangeCount === 1) {
      setSaveError("Vui lòng chọn đoạn văn không chứa thẻ phức tạp (bảng, danh sách lồng nhau)")
    }
  }, [clearInlineEdit])

  /** Mở popover thêm bình luận: bọc vùng chọn trong span data-comment-id */
  const handleOpenCommentPopover = useCallback(() => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) return
    const text = range.toString().trim()
    if (!text) return
    const commentId = crypto.randomUUID()
    try {
      const span = document.createElement("span")
      span.setAttribute("data-comment-id", commentId)
      span.className = "editor-comment-highlight"
      span.style.backgroundColor = "rgba(250, 204, 21, 0.35)"
      span.style.borderRadius = "2px"
      const fragment = range.extractContents()
      span.appendChild(fragment)
      range.insertNode(span)
      setContent(el.innerHTML)
      const rect = span.getBoundingClientRect()
      setCommentPopover({ type: "new", commentId, rect: { top: rect.top, left: rect.left } })
      setCommentDraft("")
      setTimeout(() => commentInputRef.current?.focus(), 50)
    } catch {
      setSaveError("Không thể thêm bình luận vào vùng chọn này")
    }
  }, [])

  /** Gửi bình luận mới (sau khi đã bọc span và mở popover) */
  const handleSubmitNewComment = useCallback(async () => {
    if (!currentArticleId || !commentPopover || commentPopover.type !== "new" || shareToken) return
    const text = commentDraft.trim()
    if (!text) return
    setCommentSubmitting(true)
    try {
      if (shareToken) {
        await updateWriteArticleByShareToken(shareToken, { content: editorRef.current?.innerHTML ?? content })
      } else {
        await updateWriteArticle(currentArticleId, { content: editorRef.current?.innerHTML ?? content, title: getDocTitle(), references })
      }
      await createWriteArticleComment(currentArticleId, { content: text, id: commentPopover.commentId })
      setArticleComments((prev) => [
        ...prev,
        {
          id: commentPopover.commentId,
          article_id: currentArticleId,
          user_id: "",
          author_display: session?.user?.name ?? session?.user?.email ?? "Bạn",
          content: text,
          parent_id: null,
          created_at: new Date().toISOString(),
        } as WriteArticleComment,
      ])
      setCommentPopover(null)
      setCommentDraft("")
    } catch (err: any) {
      setSaveError(err?.message ?? "Gửi bình luận thất bại")
    } finally {
      setCommentSubmitting(false)
    }
  }, [currentArticleId, commentPopover, commentDraft, shareToken, session?.user?.name, session?.user?.email, content])

  /** Gửi reply vào thread */
  const handleSubmitReply = useCallback(async () => {
    if (!currentArticleId || !commentPopover || commentPopover.type !== "thread") return
    const text = commentDraft.trim()
    if (!text) return
    setCommentSubmitting(true)
    try {
      const created = await createWriteArticleComment(currentArticleId, { content: text, parent_id: commentPopover.commentId })
      setArticleComments((prev) => [...prev, created])
      setCommentPopover(null)
      setCommentDraft("")
    } catch (err: any) {
      setSaveError(err?.message ?? "Gửi phản hồi thất bại")
    } finally {
      setCommentSubmitting(false)
    }
  }, [currentArticleId, commentPopover, commentDraft])

  /** Xóa bình luận (và gỡ đánh dấu trong bài) */
  const handleDeleteComment = useCallback(async () => {
    if (!currentArticleId || !commentPopover || commentPopover.type !== "thread") return
    const commentId = commentPopover.commentId
    setCommentDeleting(true)
    try {
      await deleteWriteArticleComment(currentArticleId, commentId)
      const editor = editorRef.current
      if (editor) {
        const spans = editor.querySelectorAll(`[data-comment-id="${commentId}"]`)
        spans.forEach((span) => {
          const text = document.createTextNode(span.textContent ?? "")
          span.parentNode?.replaceChild(text, span)
        })
        setContent(editor.innerHTML)
      }
      setArticleComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId))
      setCommentPopover(null)
      setCommentDraft("")
    } catch (err: any) {
      setSaveError(err?.message ?? "Xóa bình luận thất bại")
    } finally {
      setCommentDeleting(false)
    }
  }, [currentArticleId, commentPopover])

  const SEGMENT_DELIMITER = "[---ĐOẠN---]"

  /** Áp dụng chỉnh sửa với AI - hỗ trợ nhiều đoạn không liền mạch */
  const applyInlineEdit = useCallback(
    async (promptText: string) => {
      const el = editorRef.current
      const groupId = inlineEditGroupIdRef.current
      if (!el || !groupId || !promptText.trim()) return

      const spanNodes = el.querySelectorAll<HTMLElement>(`[data-inline-edit-group="${groupId}"]`)
      const spans = Array.from(spanNodes).sort((a, b) => {
        const iA = parseInt(a.getAttribute("data-inline-edit-index") ?? "0", 10)
        const iB = parseInt(b.getAttribute("data-inline-edit-index") ?? "0", 10)
        return iA - iB
      })
      if (spans.length === 0) return

      const texts = spans.map((s) => (s.innerText || s.textContent || "").trim()).filter(Boolean)
      if (texts.length === 0) {
        clearInlineEdit()
        return
      }

      setInlineEditLoading(true)
      setSaveError(null)

      const isMulti = texts.length > 1
      const fullPrompt = isMulti
        ? `Người dùng muốn bạn chỉnh sửa ${texts.length} đoạn văn sau. Chỉ trả về các đoạn đã chỉnh sửa, không thêm giải thích.
Quan trọng: Giữa mỗi đoạn đã chỉnh sửa, chèn chính xác chuỗi: ${SEGMENT_DELIMITER}

Đoạn 1:
${texts[0]}
${texts.slice(1).map((t, i) => `\nĐoạn ${i + 2}:\n${t}`).join("\n")}

Yêu cầu chỉnh sửa: ${promptText.trim()}`
        : `Người dùng muốn bạn chỉnh sửa đoạn văn sau. Chỉ trả về đoạn văn đã chỉnh sửa, không thêm giải thích hay nội dung khác. Trả về văn bản thuần (plain text), không dùng markdown.

Đoạn văn gốc:
${texts[0]}

Yêu cầu chỉnh sửa: ${promptText.trim()}`

      try {
        let sid = getStoredSessionId("write")
        if (!sid) {
          sid = crypto.randomUUID()
          setStoredSessionId("write", sid)
        }
        const modelId = writeAgentModels[0]?.model_id ?? "gpt-4o-mini"
        const res = await fetch(`${API_CONFIG.baseUrl}/api/chat/sessions/${sid}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            assistant_base_url: `${API_CONFIG.baseUrl}/api/write_agent/v1`,
            assistant_alias: "write",
            session_title: "Chỉnh sửa inline",
            model_id: modelId,
            prompt: fullPrompt,
            user_id: (session as any)?.user?.id ?? (session as any)?.user?.email ?? null,
            ...(session?.user ? {} : { guest_device_id: getOrCreateGuestDeviceId() }),
            research_id: activeResearch?.id ?? null,
            context: {
              language: "vi",
              inline_edit: true,
              selected_text: texts.join("\n\n"),
              project: activeResearch?.name ?? null,
              research_id: activeResearch?.id ?? null,
            },
          }),
        })

        if (!res.ok) {
          if (res.status === 429 && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("refresh-quota"))
          }
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.message || `HTTP ${res.status}`)
        }

        const json = await res.json()
        let result = (json?.content_markdown ?? json?.content ?? "").trim()
        if (!result) throw new Error("Không nhận được nội dung chỉnh sửa")
        result = result.replace(/^```\w*\n?|\n?```$/g, "").trim()

        const results = isMulti ? result.split(SEGMENT_DELIMITER).map((s) => s.trim()) : [result]
        for (let i = 0; i < spans.length && i < results.length; i++) {
          const span = spans[i]!
          const replacement = results[i] ?? ""
          const fragment = document.createRange().createContextualFragment(replacement)
          const parent = span.parentNode
          if (parent) parent.replaceChild(fragment, span)
        }
        inlineEditGroupIdRef.current = null
        setInlineEdit(null)
        setContent(el.innerHTML)
      } catch (err: any) {
        setSaveError(err?.message || "Chỉnh sửa thất bại")
      } finally {
        setInlineEditLoading(false)
      }
    },
    [clearInlineEdit, writeAgentModels, session, activeResearch?.name]
  )

  /** Kiểm tra chất lượng học thuật: gửi nội dung bài lên AI, nhận báo cáo theo các tiêu chí (grammar, style, IMRaD, citation, ...). */
  const runAcademicQualityCheck = useCallback(async () => {
    const el = editorRef.current
    const html = el?.innerHTML ?? content
    if (!html || !html.trim()) {
      setSaveError("Chưa có nội dung để kiểm tra")
      return
    }
    const temp = typeof document !== "undefined" ? document.createElement("div") : null
    if (temp) {
      temp.innerHTML = html
      if (!temp.innerText?.trim()) {
        setSaveError("Chưa có nội dung văn bản để kiểm tra")
        return
      }
    }
    const plainText = temp?.innerText?.trim() ?? ""
    setAcademicQualityLoading(true)
    setSaveError(null)
    setAcademicQualityReport(null)
    setShowAcademicQualityDialog(true)
    const prompt = `Bạn là chuyên gia đánh giá chất lượng học thuật. Phân tích bài báo/nghiên cứu dưới đây và trả về MỘT báo cáo bằng tiếng Việt, định dạng Markdown, theo ĐÚNG các mục sau (mỗi mục một heading ##):

1. **Ngữ pháp theo phong cách học thuật**: Lỗi ngữ pháp, cách dùng từ học thuật.
2. **Nhất quán phong cách**: Viết hoa, viết tắt, cách xưng hô (ngôi thứ nhất/ba) có nhất quán không.
3. **Gợi ý về trùng lặp/đạo văn**: Nếu có đoạn nào nghe giống văn mẫu hoặc cần trích nguồn, nêu rõ (kiểm tra đạo văn chi tiết cần công cụ chuyên dụng).
4. **Nhất quán thuật ngữ**: Thuật ngữ chuyên ngành dùng có thống nhất không, có nên chuẩn hóa không.
5. **Câu quá dài hoặc khó hiểu**: Liệt kê (hoặc nêu ví dụ) các câu nên rút gọn hoặc tách ý.
6. **Độ dễ đọc (readability)**: Nhận xét tổng thể, gợi ý cải thiện.
7. **Cấu trúc IMRaD**: Bài có đủ/rõ Introduction, Methods, Results, Discussion (hoặc tương đương) không; phần nào thiếu hoặc yếu.
8. **Thiếu trích dẫn**: Chỗ nào nên trích dẫn nguồn mà chưa có.
9. **Lỗi định dạng trích dẫn**: Trích dẫn trong bài có đúng chuẩn (APA/IEEE) không, lỗi cụ thể nếu có.
10. **Tone học thuật**: Giọng văn có phù hợp văn bản khoa học không, gợi ý chỉnh.

Chỉ trả về báo cáo Markdown, không thêm lời mở đầu hay kết luận ngoài các mục trên.

NỘI DUNG BÀI BÁO:
---
${plainText.slice(0, 120000)}
---`

    try {
      let sid = getStoredSessionId("write")
      if (!sid) {
        sid = crypto.randomUUID()
        setStoredSessionId("write", sid)
      }
      const modelId = writeAgentModels[0]?.model_id ?? "gpt-4o-mini"
      const res = await fetch(`${API_CONFIG.baseUrl}/api/chat/sessions/${sid}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assistant_base_url: `${API_CONFIG.baseUrl}/api/write_agent/v1`,
          assistant_alias: "write",
          session_title: "Kiểm tra chất lượng học thuật",
          model_id: modelId,
          prompt,
          user_id: (session as any)?.user?.id ?? (session as any)?.user?.email ?? null,
          ...(session?.user ? {} : { guest_device_id: getOrCreateGuestDeviceId() }),
          research_id: activeResearch?.id ?? null,
          context: {
            language: "vi",
            academic_quality_check: true,
            project: activeResearch?.name ?? null,
            research_id: activeResearch?.id ?? null,
          },
        }),
      })
      if (!res.ok) {
        if (res.status === 429 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-quota"))
        }
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `HTTP ${res.status}`)
      }
      const json = await res.json()
      const report = (json?.content_markdown ?? json?.content ?? "").trim()
      setAcademicQualityReport(report || "Không nhận được báo cáo.")
    } catch (err: any) {
      setAcademicQualityReport(null)
      setSaveError(err?.message || "Kiểm tra chất lượng thất bại")
    } finally {
      setAcademicQualityLoading(false)
    }
  }, [content, writeAgentModels, session, activeResearch?.id, activeResearch?.name])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8f9fa] dark:bg-gray-950">
      {/* Menu bar — tiêu đề, nút chỉnh sửa (dự án), undo/redo, thời gian lưu phải */}
      <div className="flex-shrink-0 h-9 px-3 flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-sm">
        <div className="flex items-center gap-1 min-w-0 flex-1 mr-4">
          <span
            className="text-base font-semibold text-foreground truncate min-w-0"
            title={getDocTitle()}
          >
            {(() => {
              const full = activeResearch?.name ?? (docTitle || "Nghiên cứu mới")
              return full.length > 64 ? full.slice(0, 64) + "…" : full
            })()}
          </span>
          {activeResearch && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              title="Chỉnh sửa dự án"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-edit-research", { detail: activeResearch }))
                }
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => execCmd("undo")} title="Hoàn tác">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => execCmd("redo")} title="Làm lại">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShowFindBar((v) => !v)} title="Tìm trong bài">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <span className="flex items-center gap-2 shrink-0">
          {collabPresence.length > 0 && (
            <span className="text-xs text-muted-foreground" title="Đang xem cùng tài liệu">
              Đang xem: {collabPresence.map((u) => u.name).join(", ")}
            </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums" title={currentArticleId && lastSavedAt ? `Đã lưu lúc ${lastSavedAt.toLocaleTimeString("vi-VN")}` : "Chưa lưu"}>
            {saving ? "Đang lưu…" : currentArticleId && lastSavedAt ? `Đã lưu ${lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Chưa lưu"}
          </span>
          {session?.user && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handleSave({ requireProject: true })}
                disabled={saving || !hasUnsavedChanges}
                title={hasUnsavedChanges ? "Lưu bài viết vào project" : "Chưa có thay đổi để lưu"}
              >
                <Save className="h-4 w-4 mr-1" />
                Lưu
              </Button>
              {currentArticleId && !shareToken && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setShowVersionHistoryDialog(true)}
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
              <DropdownMenuItem onClick={() => handleDownload("html")}>
                <FileCode className="h-4 w-4 mr-2" />
                HTML (.html)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload("docx")}>
                <FileText className="h-4 w-4 mr-2" />
                Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                <BookOpen className="h-4 w-4 mr-2" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload("latex")}>
                <Sigma className="h-4 w-4 mr-2" />
                LaTeX (.tex)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload("markdown")}>
                <Type className="h-4 w-4 mr-2" />
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Xuất tài liệu tham khảo</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleExportReferences("bibtex")} disabled={references.length === 0}>
                BibTeX (.bib)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportReferences("endnote")} disabled={references.length === 0}>
                EndNote (.enw)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportReferences("refman")} disabled={references.length === 0}>
                RefMan (.ris)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportReferences("refworks")} disabled={references.length === 0}>
                RefWorks (.txt)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {/* Toolbar — trên mobile thu gọn: cuộn ngang, ít padding */}
      <div className="flex-shrink-0 flex items-center gap-0.5 px-2 md:px-3 py-1.5 md:py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto overflow-y-hidden flex-nowrap md:flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-[6rem] justify-between font-normal text-xs" title="Phông chữ">
              <span
                className="truncate"
                style={{
                  fontFamily: (() => {
                    const raw = normalizeToolbarFont(currentFont)
                    const displayFont = FONTS.includes(raw) ? raw : (FONTS.find((f) => raw.includes(f)) ?? raw)
                    return displayFont ? `${displayFont}, sans-serif` : undefined
                  })(),
                }}
              >
                {(() => {
                  const raw = normalizeToolbarFont(currentFont)
                  return FONTS.includes(raw) ? raw : (FONTS.find((f) => raw.includes(f)) ?? raw)
                })()}
              </span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {FONTS.map((f) => (
              <DropdownMenuItem key={f} onClick={() => { execCmd("fontName", f); setCurrentFont(f) }} className={currentFont === f ? "bg-muted font-medium" : ""}>
                <span style={{ fontFamily: f }}>{f}</span>
                {currentFont === f && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-[2.5rem] justify-between font-normal text-xs" title="Cỡ chữ">
              <span>{currentFontSize}</span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {FONT_SIZES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => { applyFontSize(s); setCurrentFontSize(String(s)) }} className={currentFontSize === String(s) ? "bg-muted font-medium" : ""}>
                {s}
                {currentFontSize === String(s) && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-[7rem] justify-between font-normal text-xs" title="Kiểu đoạn văn">
              <span className="truncate">{BLOCK_STYLES.find((s) => s.tag === currentBlockTag)?.label ?? "Normal"}</span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {BLOCK_STYLES.map(({ tag, label }) => (
              <DropdownMenuItem
                key={tag}
                onClick={() => {
                  execCmd("formatBlock", tag)
                  setCurrentBlockTag(tag)
                }}
                className={currentBlockTag === tag ? "bg-muted font-medium" : ""}
              >
                {label}
                {currentBlockTag === tag && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Toggle size="sm" className="h-8 w-8 p-0" onPressedChange={() => execCmd("bold")}>
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-8 w-8 p-0" onPressedChange={() => execCmd("italic")}>
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-8 w-8 p-0" onPressedChange={() => execCmd("underline")}>
          <Underline className="h-4 w-4" />
        </Toggle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Đánh dấu (highlight)"
              onMouseDown={(e) => {
                e.preventDefault()
                editorRef.current?.focus()
              }}
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => execCmd("backColor", "#fef08a")}
              title="Tô vàng vùng chọn hoặc text gõ tiếp"
            >
              <Highlighter className="h-4 w-4 mr-2" />
              Đánh dấu
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={removeHighlight}
              title="Bỏ đánh dấu / để text tiếp theo không bị highlight"
            >
              Xóa đánh dấu
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Chèn bảng"
          onClick={() => {
            const el = editorRef.current
            const sel = window.getSelection()
            savedTableSelectionRef.current = []
            if (el && sel && sel.rangeCount) {
              const node = sel.anchorNode
              if (node && el.contains(node)) {
                for (let i = 0; i < sel.rangeCount; i++)
                  savedTableSelectionRef.current.push(sel.getRangeAt(i).cloneRange())
              }
            }
            setTableRows(3)
            setTableCols(3)
            setShowTableDialog(true)
          }}
        >
          <Table2 className="h-4 w-4" />
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInsertImage}
        />
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Chèn ảnh" onClick={() => imageInputRef.current?.click()}>
          <Image className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Chú thích và tham chiếu">
              <ImagePlus className="h-4 w-4 mr-1" />
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chú thích & Tham chiếu</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleInsertCaption}>
              <ImagePlus className="h-4 w-4 mr-2" />
              Chèn chú thích
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowCrossRefDialog(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Chèn tham chiếu (Figure/Table/Equation/Section)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Chèn mẫu Cover letter hoặc Submission checklist">
              <FileText className="h-4 w-4 mr-1" />
              Chèn mẫu
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Mẫu nộp bài</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => insertHtml(COVER_LETTER_TEMPLATE_HTML)}>
              <FileText className="h-4 w-4 mr-2" />
              Cover letter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertHtml(SUBMISSION_CHECKLIST_HTML)}>
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Submission checklist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("insertUnorderedList")} title="Danh sách dấu đầu dòng">
          <List className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("insertOrderedList")} title="Danh sách đánh số">
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); execCmd("indent") }}
          title="Tăng cấp (Tab)"
        >
          <IndentIncrease className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); execCmd("outdent") }}
          title="Giảm cấp (Shift+Tab)"
        >
          <IndentDecrease className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyLeft")}>
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyCenter")}>
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyRight")}>
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Căn đều hai bên" onClick={() => execCmd("justifyFull")}>
          <AlignJustify className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <DropdownMenu
          onOpenChange={(open) => {
            if (!open) removeFormulaMarkerIfPresent()
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              title="Công thức và ký hiệu"
              onPointerDownCapture={() => insertFormulaMarkerAtSelection()}
            >
              <Sigma className="h-4 w-4 mr-1" />
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[14rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Gõ công thức (LaTeX)</DropdownMenuLabel>
            <div className="p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input
                placeholder="VD: \\frac{1}{2}, \\sqrt{x}, \\alpha, \\sum_{i=1}^n"
                value={formulaLatex}
                onChange={(e) => {
                  setFormulaLatex(e.target.value)
                  setFormulaError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    insertLatexFormula()
                  }
                }}
                className="h-8 text-xs font-mono"
              />
              {formulaError && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {formulaError}
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {FORMULA_SAMPLES.map((s) => (
                  <Button
                    key={s.latex}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs font-mono"
                    onClick={() => {
                      setFormulaLatex(s.latex)
                      setFormulaError(null)
                    }}
                    title={s.latex}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={insertLatexFormula} disabled={!formulaLatex.trim()}>
                  Chèn (inline)
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={insertLatexFormulaBlock} disabled={!formulaLatex.trim()}>
                  Chèn (block)
                </Button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => execCmd("superscript")}>
              <Superscript className="h-4 w-4 mr-2" />
              Chỉ số trên (x²)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => execCmd("subscript")}>
              <Subscript className="h-4 w-4 mr-2" />
              Chỉ số dưới (H₂O)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Ký hiệu khoa học</DropdownMenuLabel>
            <div className="grid grid-cols-6 gap-0.5 p-2 max-h-48 overflow-auto">
              {SCIENTIFIC_SYMBOLS.map((s) => (
                <Button
                  key={s.char}
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-lg font-normal"
                  onClick={() => insertHtml(s.char)}
                  title={s.title}
                >
                  {s.char}
                </Button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Trích dẫn và tài liệu tham khảo">
              <BookMarked className="h-4 w-4 mr-1" />
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chuẩn trích dẫn</DropdownMenuLabel>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex gap-1">
              <button type="button" onClick={() => setCitationStyle("APA")} className={`px-2 py-1 text-xs rounded ${citationStyle === "APA" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>APA</button>
              <button type="button" onClick={() => setCitationStyle("IEEE")} className={`px-2 py-1 text-xs rounded ${citationStyle === "IEEE" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>IEEE</button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCitationDialog(true)}>
              <BookMarked className="h-4 w-4 mr-2" />
              Quản lý tài liệu tham khảo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chèn trích dẫn</DropdownMenuLabel>
            {citationStyle === "APA"
              ? references.map((r, i) => (
                  <DropdownMenuItem key={i} className="text-xs" onClick={() => handleInsertCitation(i, "parenthetical")}>
                    {formatInTextAPA(r)}
                  </DropdownMenuItem>
                ))
              : references.map((r, i) => (
                  <DropdownMenuItem key={i} onClick={() => handleInsertCitation(i)}>
                    [{i + 1}] {r.title || r.author || "Tài liệu"}
                  </DropdownMenuItem>
                ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleInsertReferenceList()} disabled={references.length === 0}>
              <BookMarked className="h-4 w-4 mr-2" />
              Chèn danh sách TLTK
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!editorEmpty && <Separator orientation="vertical" className="mx-1 h-6" />}
        {!editorEmpty && (
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm"
            title="AI hỗ trợ viết"
            onClick={() => setShowGeneratePapersDialog(true)}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        )}
        {!editorEmpty && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 min-w-[8rem] justify-between font-normal text-xs"
                title="Kiểm tra chất lượng học thuật bằng AI"
                disabled={academicQualityLoading}
              >
                {academicQualityLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ClipboardCheck className="h-4 w-4 mr-1" />
                )}
                <span className="truncate">Chất lượng học thuật</span>
                <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Kiểm tra bằng AI</DropdownMenuLabel>
              <DropdownMenuItem onClick={runAcademicQualityCheck} disabled={academicQualityLoading}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Chạy kiểm tra chất lượng học thuật
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {showFindBar && (
        <div className="flex-shrink-0 flex items-center gap-2 px-2 py-1.5 bg-muted/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Tìm trong bài..."
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                setFindBackward(e.shiftKey)
                runFindInEditor()
              }
            }}
            className="h-8 max-w-[200px] text-sm"
          />
          <Button variant="outline" size="sm" className="h-8" onClick={() => { setFindBackward(false); runFindInEditor() }}>
            Tìm tiếp
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => { setFindBackward(true); runFindInEditor() }}>
            Tìm trước
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setShowFindBar(false); setFindQuery("") }} title="Đóng">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden flex-row">
        {/* Sidebar: Templates + Outline — màn < 1024px luôn ẩn (w-0), màn lg+ mới có thể mở */}
        <div
          className={`w-0 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all flex flex-col ${showOutline ? "lg:w-64" : ""}`}
        >
          {showOutline && (
            <>
              {showTemplates && (
                <>
                  <div className="p-3 border-b shrink-0">
                    <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Mẫu template
                    </h3>
                  </div>
                  <div className="p-2 space-y-1 shrink-0">
                    {loading ? (
                      <p className="text-sm text-muted-foreground p-4">Đang tải...</p>
                    ) : templates.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4">Không có mẫu</p>
                    ) : (
                      templates.map((t) => (
                        <Button
                          key={t.id}
                          variant={selectedTemplate?.id === t.id ? "secondary" : "ghost"}
                          className="w-full justify-start text-left h-auto py-2 px-3 gap-2"
                          onClick={() => handleSelectTemplate(t)}
                        >
                          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="text-sm font-medium">{t.title.replace(/^Template\s+/i, "")}</span>
                        </Button>
                      ))
                    )}
                  </div>
                  <Separator className="shrink-0" />
                </>
              )}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-t pt-3 px-3 pb-3">
                <div className="flex-1 min-h-0 overflow-auto space-y-1">
                  {outlineItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Chưa có tiêu đề</p>
                  ) : (
                    outlineItems.map((item, i) => (
                      <button
                        key={item.id}
                        className={`block w-full text-left text-xs rounded px-2 py-1 truncate ${
                          i === currentOutlineIndex
                            ? "bg-primary/15 dark:bg-primary/25 font-medium text-primary"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                        onClick={() => scrollToHeading(i)}
                      >
                        {item.text || "(Trống)"}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Main document area */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-auto bg-[#e8eaed] dark:bg-gray-950 relative"
          >
            <ContextMenu
              onOpenChange={(open) => {
                if (open) {
                  const el = editorRef.current
                  const sel = window.getSelection()
                  savedSelectionRangesRef.current = []
                  citationSpanRef.current = null
                  setCitationContextMenu(null)
                  if (el && sel && sel.rangeCount) {
                    const node = sel.anchorNode
                    if (node && el.contains(node)) {
                      for (let i = 0; i < sel.rangeCount; i++)
                        savedSelectionRangesRef.current.push(sel.getRangeAt(i).cloneRange())
                    }
                    const elNode = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null)
                    const span = elNode?.closest?.(".citation-intext")
                    if (span && references.length > 0) {
                      const text = (span as HTMLElement).textContent?.trim() ?? ""
                      for (let i = 0; i < references.length; i++) {
                        const r = references[i]!
                        if (formatInTextAPA(r) === text) {
                          citationSpanRef.current = span as HTMLSpanElement
                          setCitationContextMenu({ refIndex: i, isNarrative: false })
                          break
                        }
                        if (formatInTextAPANarrative(r) === text) {
                          citationSpanRef.current = span as HTMLSpanElement
                          setCitationContextMenu({ refIndex: i, isNarrative: true })
                          break
                        }
                      }
                    }
                  }
                } else {
                  setCitationContextMenu(null)
                  citationSpanRef.current = null
                }
              }}
            >
              <ContextMenuTrigger asChild>
                <div
                  ref={paperRef}
                  className="w-full min-h-full bg-white dark:bg-gray-900 shadow-sm relative"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top center",
                    padding: "32px 40px 32px 40px",
                  }}
                  onContextMenu={() => {
                    const el = editorRef.current
                    const sel = window.getSelection()
                    if (el && sel && sel.rangeCount && sel.toString().trim()) {
                      savedSelectionRangesRef.current = []
                      for (let i = 0; i < sel.rangeCount; i++)
                        savedSelectionRangesRef.current.push(sel.getRangeAt(i).cloneRange())
                    }
                  }}
                >
                  {/* Chỉ nội dung bài viết — không chọn template thì vùng này trắng */}
              <div className="relative z-10 flex flex-col min-h-full">
                {editorEmpty && (
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm"
                      onClick={() => setShowGeneratePapersDialog(true)}
                    >
                      <Sparkles className="h-4 w-4 mr-1.5 shrink-0" />
                      Tạo bài viết nghiên cứu
                    </Button>
                  </div>
                )}
                <div
                  className="min-h-0 flex-1 min-h-[50vh] cursor-text"
                  onClick={(e) => {
                    if (!editorRef.current || (e.target as HTMLElement).closest("button, [role='menuitem']")) return
                    const commentSpan = (e.target as HTMLElement).closest?.("[data-comment-id]") as HTMLElement | null
                    if (commentSpan && currentArticleId && !shareToken) {
                      const id = commentSpan.getAttribute("data-comment-id")
                      if (id) {
                        e.preventDefault()
                        e.stopPropagation()
                        const r = commentSpan.getBoundingClientRect()
                        setCommentPopover({ type: "thread", commentId: id, rect: { top: r.top, left: r.left } })
                        setCommentDraft("")
                        return
                      }
                    }
                    const citationSpan = (e.target as HTMLElement).closest?.(".citation-intext") as HTMLElement | null
                    if (citationSpan && references.length > 0) {
                      const text = citationSpan.textContent?.trim() ?? ""
                      for (let i = 0; i < references.length; i++) {
                        const r = references[i]!
                        if (formatInTextAPA(r) === text) {
                          e.preventDefault()
                          e.stopPropagation()
                          citationSpanRef.current = citationSpan
                          const rect = citationSpan.getBoundingClientRect()
                          setCitationPopover({ refIndex: i, isNarrative: false, rect: { top: rect.top, left: rect.left } })
                          return
                        }
                        if (formatInTextAPANarrative(r) === text) {
                          e.preventDefault()
                          e.stopPropagation()
                          citationSpanRef.current = citationSpan
                          const rect = citationSpan.getBoundingClientRect()
                          setCitationPopover({ refIndex: i, isNarrative: true, rect: { top: rect.top, left: rect.left } })
                          return
                        }
                      }
                    }
                    setCitationPopover(null)
                    citationSpanRef.current = null
                    editorRef.current.focus()
                    if (editorRef.current.contains(e.target as Node)) {
                      placeCaretInEditor()
                    } else {
                      const sel = window.getSelection()
                      if (sel) {
                        sel.selectAllChildren(editorRef.current)
                        sel.collapseToEnd()
                      }
                    }
                  }}
                  onPasteCapture={(e) => {
                    const files = e.clipboardData?.files
                    if (!files?.length || !editorRef.current) return
                    const file = Array.from(files).find((f) => f.type.startsWith("image/"))
                    if (!file) return
                    e.preventDefault()
                    e.stopPropagation()
                    const reader = new FileReader()
                    reader.onload = () => {
                      const dataUrl = reader.result as string
                      const img = new window.Image()
                      img.onload = () => {
                        const max = 500
                        let w = img.naturalWidth
                        let h = img.naturalHeight
                        if (w > max || h > max) {
                          if (w > h) {
                            h = (h * max) / w
                            w = max
                          } else {
                            w = (w * max) / h
                            h = max
                          }
                        }
                        insertResizableImageAtSelection(dataUrl, file.name.replace(/"/g, "&quot;"), w, h)
                      }
                      img.onerror = () => insertResizableImageAtSelection(dataUrl, file.name.replace(/"/g, "&quot;"))
                      img.src = dataUrl
                    }
                    reader.readAsDataURL(file)
                  }}
                >
                <DocEditor
                  key={`editor-${documentKey}`}
                  ref={editorRef}
                  initialContent={content}
                  onInput={(html) => {
                    setContent(html)
                    setUserStartedEditing(true)
                  }}
                  onKeyDown={handleEditorKeyDown}
                  className="min-h-full text-sm text-gray-900 dark:text-gray-100 leading-relaxed outline-none focus:ring-0 prose prose-sm max-w-none dark:prose-invert [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-6 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-3 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:mt-2 [&_h5]:text-sm [&_h5]:font-medium [&_h5]:mt-2 [&_h6]:text-xs [&_h6]:font-medium [&_h6]:mt-2 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul_ul]:list-[circle] [&_ul_ul]:pl-6 [&_ul_ul_ul]:list-[square] [&_ul_ul_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-6 [&_ol_ol_ol]:list-[lower-roman] [&_ol_ol_ol]:pl-6"
                />
                </div>
              </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-[12rem]" alignOffset={4}>
                {citationContextMenu !== null && (() => {
                  const { refIndex, isNarrative } = citationContextMenu
                  const ref = references[refIndex]
                  if (!ref) return null
                  return (
                    <>
                      <ContextMenuItem
                        onSelect={() => {
                          setShowCitationDialog(true)
                          setEditingRef({ ...ref, __editIndex: refIndex } as CitationReference & { __editIndex?: number })
                        }}
                      >
                        <BookMarked className="h-4 w-4 mr-2" />
                        Sửa tài liệu tham khảo
                      </ContextMenuItem>
                      {!isNarrative ? (
                        <ContextMenuItem
                          onSelect={() => {
                            const span = citationSpanRef.current
                            if (span) {
                              span.textContent = formatInTextAPANarrative(ref)
                              if (editorRef.current) setContent(editorRef.current.innerHTML)
                            }
                            setCitationContextMenu(null)
                          }}
                        >
                          Chuyển sang trích dẫn trong câu
                        </ContextMenuItem>
                      ) : (
                        <ContextMenuItem
                          onSelect={() => {
                            const span = citationSpanRef.current
                            if (span) {
                              span.textContent = formatInTextAPA(ref)
                              if (editorRef.current) setContent(editorRef.current.innerHTML)
                            }
                            setCitationContextMenu(null)
                          }}
                        >
                          Chuyển sang trích dẫn cuối câu
                        </ContextMenuItem>
                      )}
                      <ContextMenuSeparator />
                    </>
                  )
                })()}
                <ContextMenuItem
                  onSelect={() => {
                    editorRef.current?.focus()
                    document.execCommand("cut", false)
                  }}
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  Cắt
                  <ContextMenuShortcut>⌘X</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    editorRef.current?.focus()
                    document.execCommand("copy", false)
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Sao chép
                  <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    editorRef.current?.focus()
                    document.execCommand("paste", false)
                  }}
                >
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Dán
                  <ContextMenuShortcut>⌘V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={async () => {
                    editorRef.current?.focus()
                    try {
                      const text = await navigator.clipboard.readText()
                      document.execCommand("insertText", false, text)
                      if (editorRef.current) setContent(editorRef.current.innerHTML)
                    } catch {
                      document.execCommand("paste", false)
                      if (editorRef.current) setContent(editorRef.current.innerHTML)
                    }
                  }}
                >
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Dán không định dạng
                  <ContextMenuShortcut>⌘⇧V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    editorRef.current?.focus()
                    document.execCommand("delete", false)
                    if (editorRef.current) setContent(editorRef.current.innerHTML)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Xóa
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    const ranges = savedSelectionRangesRef.current.slice()
                    setTimeout(() => {
                      const el = editorRef.current
                      const sel = window.getSelection()
                      if (el && sel && ranges.length > 0) {
                        sel.removeAllRanges()
                        ranges.forEach((r) => sel.addRange(r))
                        el.focus()
                        handleEditorSelection()
                      }
                    }, 50)
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  <span className="flex-1">AI hỗ trợ viết</span>
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    const ranges = savedSelectionRangesRef.current.slice()
                    setTimeout(() => {
                      const el = editorRef.current
                      const sel = window.getSelection()
                      if (el && sel && ranges.length > 0) {
                        sel.removeAllRanges()
                        ranges.forEach((r) => sel.addRange(r))
                        el.focus()
                        handleOpenCommentPopover()
                      }
                    }, 50)
                  }}
                  disabled={!currentArticleId || !!shareToken}
                >
                  <MessageCirclePlus className="h-4 w-4 mr-2" />
                  Bình luận
                  <ContextMenuShortcut>⌘⌥M</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    editorRef.current?.focus()
                    const url = window.prompt("Nhập URL liên kết:", "https://")
                    if (url) document.execCommand("createLink", false, url)
                    if (editorRef.current) setContent(editorRef.current.innerHTML)
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Chèn liên kết
                  <ContextMenuShortcut>⌘K</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Type className="h-4 w-4 mr-2" />
                    Định dạng
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    <ContextMenuItem onSelect={() => { editorRef.current?.focus(); execCmd("bold") }}>
                      <Bold className="h-4 w-4 mr-2" />
                      Đậm
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => { editorRef.current?.focus(); execCmd("italic") }}>
                      <Italic className="h-4 w-4 mr-2" />
                      Nghiêng
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => { editorRef.current?.focus(); execCmd("underline") }}>
                      <Underline className="h-4 w-4 mr-2" />
                      Gạch chân
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => { editorRef.current?.focus(); execCmd("backColor", "#fef08a") }}>
                      <Highlighter className="h-4 w-4 mr-2" />
                      Đánh dấu
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => { editorRef.current?.focus(); removeHighlight() }}>
                      Xóa đánh dấu
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuItem
                  onSelect={() => {
                    editorRef.current?.focus()
                    document.execCommand("removeFormat", false)
                    if (editorRef.current) setContent(editorRef.current.innerHTML)
                  }}
                >
                  <RemoveFormatting className="h-4 w-4 mr-2" />
                  Xóa định dạng
                  <ContextMenuShortcut>⌘\</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>

          {/* Popover chỉnh sửa inline với AI */}
          {inlineEdit && (
            <div
              id="inline-edit-popover"
              className="fixed z-50 w-80 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3"
              style={{
                top: inlineEdit.rect.top - 8,
                left: Math.max(8, Math.min(inlineEdit.rect.left, typeof window !== "undefined" ? window.innerWidth - 336 : inlineEdit.rect.left)),
                transform: "translateY(-100%)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Chỉnh sửa
                  {inlineEdit.segmentCount != null && inlineEdit.segmentCount > 1 && (
                    <span className="text-blue-600 dark:text-blue-400">({inlineEdit.segmentCount} đoạn)</span>
                  )}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearInlineEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2" title="Giữ Ctrl (Cmd trên Mac) và kéo để chọn thêm đoạn khác">
                Giữ Ctrl/Cmd + kéo để chọn nhiều đoạn
              </p>
              <div className="space-y-2">
                {INLINE_EDIT_PROMPTS.map((p) => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start h-8 text-xs"
                    disabled={inlineEditLoading}
                    onClick={() => applyInlineEdit(p.prompt)}
                  >
                    {inlineEditLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-2 text-amber-500" />
                    )}
                    {p.label}
                  </Button>
                ))}
                <div className="flex gap-1.5">
                  <Input
                    ref={inlineEditInputRef}
                    placeholder="Hoặc nhập yêu cầu riêng..."
                    className="h-8 text-xs flex-1"
                    value={inlineEdit.customPrompt}
                    onChange={(e) => setInlineEdit((prev) => prev ? { ...prev, customPrompt: e.target.value } : null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        applyInlineEdit(inlineEdit.customPrompt || "Cải thiện đoạn văn này")
                      }
                    }}
                    disabled={inlineEditLoading}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3"
                    disabled={inlineEditLoading || !inlineEdit.customPrompt.trim()}
                    onClick={() => applyInlineEdit(inlineEdit.customPrompt.trim() || "Cải thiện đoạn văn này")}
                  >
                    {inlineEditLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Áp dụng"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Popover bình luận (mới hoặc xem thread) */}
          {commentPopover && (
            <div
              className="fixed z-50 w-80 max-h-[70vh] flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
              style={{
                top: commentPopover.rect.top - 8,
                left: Math.max(8, Math.min(commentPopover.rect.left, typeof window !== "undefined" ? window.innerWidth - 336 : commentPopover.rect.left)),
                transform: "translateY(-100%)",
              }}
            >
              <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <MessageCirclePlus className="h-3.5 w-3.5" />
                  {commentPopover.type === "new" ? "Bình luận mới" : "Bình luận"}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCommentPopover(null); setCommentDraft("") }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="p-2 overflow-y-auto flex-1 min-h-0">
                {commentPopover.type === "thread" && (() => {
                  const root = articleComments.find((c) => c.id === commentPopover.commentId)
                  const replies = articleComments.filter((c) => c.parent_id === commentPopover.commentId)
                  return (
                    <div className="space-y-2">
                      {root && (
                        <div className="text-xs p-2 rounded bg-muted/50">
                          <span className="font-medium text-foreground">{root.author_display}</span>
                          <span className="text-muted-foreground ml-1">
                            {new Date(root.created_at).toLocaleString("vi-VN")}
                          </span>
                          <p className="mt-1 text-foreground">{root.content}</p>
                        </div>
                      )}
                      {replies.map((r) => (
                        <div key={r.id} className="text-xs pl-3 border-l-2 border-muted p-2 rounded bg-muted/30">
                          <span className="font-medium text-foreground">{r.author_display}</span>
                          <span className="text-muted-foreground ml-1">
                            {new Date(r.created_at).toLocaleString("vi-VN")}
                          </span>
                          <p className="mt-1 text-foreground">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                {commentPopover.type === "thread" && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-start text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                      onClick={handleDeleteComment}
                      disabled={commentDeleting}
                    >
                      {commentDeleting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                      Xóa bình luận
                    </Button>
                  </div>
                )}
                <div className="mt-2">
                  <textarea
                    ref={commentInputRef}
                    className="w-full min-h-[60px] px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-background resize-y"
                    placeholder={commentPopover.type === "new" ? "Nhập bình luận..." : "Phản hồi..."}
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        if (commentPopover.type === "new") handleSubmitNewComment()
                        else handleSubmitReply()
                      }
                    }}
                    disabled={commentSubmitting}
                  />
                  <Button
                    size="sm"
                    className="mt-1.5 w-full h-8"
                    disabled={commentSubmitting || !commentDraft.trim()}
                    onClick={() => (commentPopover.type === "new" ? handleSubmitNewComment() : handleSubmitReply())}
                  >
                    {commentSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : commentPopover.type === "new" ? "Gửi bình luận" : "Gửi phản hồi"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Popover trích dẫn (bấm vào citation trong bài) */}
          {citationPopover !== null && (() => {
            const { refIndex, isNarrative, rect } = citationPopover
            const ref = references[refIndex]
            if (!ref) return null
            return (
              <div
                className="fixed z-50 w-64 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
                style={{
                  top: rect.top - 8,
                  left: Math.max(8, Math.min(rect.left, typeof window !== "undefined" ? window.innerWidth - 272 : rect.left)),
                  transform: "translateY(-100%)",
                }}
              >
                <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <BookMarked className="h-3.5 w-3.5" />
                    Trích dẫn
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCitationPopover(null); citationSpanRef.current = null }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="p-2 flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 justify-start text-xs font-normal"
                    onClick={() => {
                      setShowCitationDialog(true)
                      setEditingRef({ ...ref, __editIndex: refIndex } as CitationReference & { __editIndex?: number })
                      setCitationPopover(null)
                      citationSpanRef.current = null
                    }}
                  >
                    <BookMarked className="h-4 w-4 mr-2" />
                    Sửa tài liệu tham khảo
                  </Button>
                  {!isNarrative ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 justify-start text-xs font-normal"
                      onClick={() => {
                        const span = citationSpanRef.current
                        if (span) {
                          span.textContent = formatInTextAPANarrative(ref)
                          if (editorRef.current) setContent(editorRef.current.innerHTML)
                        }
                        setCitationPopover(null)
                        citationSpanRef.current = null
                      }}
                    >
                      Chuyển sang trích dẫn trong câu
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 justify-start text-xs font-normal"
                      onClick={() => {
                        const span = citationSpanRef.current
                        if (span) {
                          span.textContent = formatInTextAPA(ref)
                          if (editorRef.current) setContent(editorRef.current.innerHTML)
                        }
                        setCitationPopover(null)
                        citationSpanRef.current = null
                      }}
                    >
                      Chuyển sang trích dẫn cuối câu
                    </Button>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Status bar: trái = ẩn/hiện dàn ý + lỗi lưu, phải = đếm từ + zoom */}
          <div className="flex-shrink-0 min-h-7 px-3 md:px-4 flex items-center text-xs text-muted-foreground bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 shrink-0 w-[33%] min-w-0 justify-start">
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex h-6 w-6 shrink-0"
                onClick={() => setShowOutline((v) => !v)}
                title={showOutline ? "Ẩn dàn ý" : "Hiện dàn ý"}
              >
                {showOutline ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
              </Button>
              {saveError && (
                <span className="text-red-600 dark:text-red-400 truncate" title={saveError}>
                  {saveError}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 min-w-0 justify-end flex-1">
              <span>{words} từ</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="w-12 text-center">{zoom}%</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.min(200, z + 10))}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal chọn bài viết đã lưu */}
      <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Chọn bài viết đã lưu
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {articlesLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Đang tải…</p>
            ) : articles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Chưa có bài viết nào</p>
            ) : (
              <div className="space-y-1">
                {articles.map((a) => (
                  <div
                    key={a.id}
                    className={`group flex items-center gap-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${currentArticleId === a.id ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                  >
                    <button
                      className="flex-1 min-w-0 text-left py-3 px-4 text-sm truncate"
                      onClick={() => {
                        handleLoadArticle(a)
                        setShowOpenModal(false)
                      }}
                    >
                      {a.title || "Chưa có tiêu đề"}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={(e) => handleDeleteArticle(e, a.id)}
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

      {/* Dialog chia sẻ bài viết */}
      <Dialog
        open={showShareDialog}
        onOpenChange={(open) => {
          setShowShareDialog(open)
          if (!open) setShareUrl(null)
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
          {shareLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Đang tạo link…</span>
            </div>
          ) : shareUrl ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-sm" />
                <Button
                  variant={shareCopied ? "secondary" : "outline"}
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl)
                    setShareCopied(true)
                    setTimeout(() => setShareCopied(false), 2000)
                  }}
                >
                  {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {shareCopied && <p className="text-xs text-emerald-600">Đã sao chép vào clipboard</p>}
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!currentArticleId) return
                  setShareLoading(true)
                  try {
                    await revokeShareLink(currentArticleId)
                    setArticleShareToken(null)
                    setShareUrl(null)
                  } finally {
                    setShareLoading(false)
                  }
                }}
              >
                Thu hồi link chia sẻ
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialog Lịch sử phiên bản */}
      <Dialog open={showVersionHistoryDialog} onOpenChange={(open) => { setShowVersionHistoryDialog(open); if (!open) setVersionList([]) }}>
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
          {versionsLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Đang tải…</span>
            </div>
          ) : versionList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chưa có phiên bản nào được lưu.</p>
          ) : (
            <>
              {versionList.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 mb-2"
                  onClick={handleClearVersionsExceptLatest}
                  disabled={clearingVersions || restoringVersionId !== null}
                >
                  {clearingVersions ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Xóa toàn bộ lịch sử (chỉ giữ phiên bản gần nhất)
                </Button>
              )}
              <ScrollArea className="flex-1 min-h-0 -mx-2 px-2 border rounded-md">
                <div className="space-y-1 py-2">
                  {versionList.map((v) => (
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
                          disabled={restoringVersionId !== null || deletingVersionId !== null}
                          onClick={() => handleDeleteVersion(v.id)}
                        >
                          {deletingVersionId === v.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          disabled={restoringVersionId !== null || deletingVersionId !== null}
                          onClick={() => handleRestoreVersion(v.id)}
                        >
                          {restoringVersionId === v.id ? (
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

      {/* Dialog Trợ lý nghiên cứu — AI hỗ trợ viết (Research framework 10 bước) */}
      <Dialog open={showGeneratePapersDialog} onOpenChange={setShowGeneratePapersDialog}>
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
          {/* Stepper ngang: 1 → 2 → … → 10 */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max">
              {RESEARCH_FLOW_STEPS.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-0">
                  <button
                    type="button"
                    onClick={() => setSelectedGenerateStep(step.number)}
                    className={`
                      flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold shrink-0 transition
                      ${selectedGenerateStep === step.number
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-950"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                      }
                    `}
                    title={step.title}
                  >
                    {step.number}
                  </button>
                  {idx < RESEARCH_FLOW_STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-0.5 text-muted-foreground shrink-0" aria-hidden />
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Nội dung bước được chọn: AI giúp người dùng [tên bước] */}
          <ScrollArea className="flex-1 min-h-0 px-6 py-4">
            <div className="pr-4 space-y-4">
              {(() => {
                const step = RESEARCH_FLOW_STEPS.find((s) => s.number === selectedGenerateStep)
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
                          applyGeneratedContent(step.insertHtml)
                          setShowGeneratePapersDialog(false)
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
                ref={generatePapersInputRef}
                placeholder="VD: Đề cương nghiên cứu về AI trong giáo dục..."
                className="flex-1"
                value={generatePapersDescription}
                onChange={(e) => setGeneratePapersDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleGeneratePapersCreate()
                  }
                }}
              />
              <Button onClick={handleGeneratePapersCreate}>Tạo tài liệu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: chưa có project — bắt tạo hoặc chọn project rồi mới lưu article */}
      <Dialog open={showRequireProjectDialog} onOpenChange={setShowRequireProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cần tạo hoặc chọn dự án (Project)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn chưa thuộc dự án nào. Để lưu bài viết vào hệ thống, hãy tạo dự án mới hoặc chọn một dự án nghiên cứu từ sidebar. Nội dung hiện tại đang được lưu tạm trên trình duyệt.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => {
                setShowRequireProjectDialog(false)
                if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("open-add-research"))
              }}
            >
              Tạo dự án mới
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowRequireProjectDialog(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog chọn số hàng và cột bảng */}
      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
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
                value={tableRows}
                onChange={(e) => setTableRows(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
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
                value={tableCols}
                onChange={(e) => setTableCols(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowTableDialog(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setShowTableDialog(false)
                const rows = tableRows
                const cols = tableCols
                setTimeout(() => {
                  const el = editorRef.current
                  const sel = window.getSelection()
                  if (el && sel && savedTableSelectionRef.current.length) {
                    el.focus()
                    sel.removeAllRanges()
                    savedTableSelectionRef.current.forEach((r) => sel.addRange(r))
                  } else if (el) {
                    el.focus()
                  }
                  handleInsertTable(rows, cols)
                }, 0)
              }}
            >
              Chèn bảng {tableRows}×{tableCols}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog chèn tham chiếu (Figure/Table/Equation/Section) */}
      <Dialog open={showCrossRefDialog} onOpenChange={setShowCrossRefDialog}>
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
              const targets = collectCrossRefTargets()
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
                      onClick={() => handleInsertCrossRef(t)}
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

      {/* Modal quản lý tài liệu tham khảo / trích dẫn */}
      <Dialog open={showCitationDialog} onOpenChange={(open) => { setShowCitationDialog(open); if (!open) setEditingRef(null) }}>
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
                  onClick={() => setCitationStyle("APA")}
                  className={`px-2 py-1 text-xs rounded ${citationStyle === "APA" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  APA
                </button>
                <button
                  type="button"
                  onClick={() => setCitationStyle("IEEE")}
                  className={`px-2 py-1 text-xs rounded ${citationStyle === "IEEE" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
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
            {editingRef !== null ? (
              <CitationEditForm
                initialRef={editingRef}
                onSave={(r) => {
                  const editIdx = (editingRef as any).__editIndex
                  if (typeof editIdx === "number" && editIdx >= 0) {
                    setReferences((prev) => prev.map((x, i) => (i === editIdx ? r : x)))
                  } else {
                    setReferences((prev) => [...prev, r])
                  }
                  setEditingRef(null)
                }}
                onCancel={() => setEditingRef(null)}
              />
            ) : (
              <>
                <ScrollArea className="h-[280px] border rounded-lg p-2">
                  {references.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Chưa có tài liệu tham khảo</p>
                  ) : (
                    <div className="space-y-2">
                      {references.map((r, i) => (
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
                            {citationStyle === "APA" ? (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { handleInsertCitation(i, "narrative"); setShowCitationDialog(false) }} title="Trong câu: Tác giả (Năm)">
                                  {formatInTextAPANarrative(r)}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { handleInsertCitation(i, "parenthetical"); setShowCitationDialog(false) }} title="Cuối câu: (Tác giả, Năm)">
                                  {formatInTextAPA(r)}
                                </Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-7" onClick={() => { handleInsertCitation(i); setShowCitationDialog(false) }} title={`[${i + 1}]`}>
                                Chèn [{i + 1}]
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingRef({ ...r, __editIndex: i } as CitationReference & { __editIndex?: number })}>
                              Sửa
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-red-600"
                              onClick={() => setReferences((prev) => prev.filter((_, j) => j !== i))}
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
                  <Button onClick={() => setEditingRef({ type: "article", author: "", title: "", year: "" })}>
                    <BookMarked className="h-4 w-4 mr-2" />
                    Thêm tài liệu
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDuplicateCheckGroups(findDuplicateReferences(references))}
                    disabled={references.length < 2}
                    title="Tìm các tài liệu trùng (cùng tác giả, năm, nhan đề)"
                  >
                    Kiểm tra trùng
                  </Button>
                  <Button variant="outline" onClick={handleInsertReferenceList} disabled={references.length === 0} title="Chèn danh sách TLTK theo chuẩn đã chọn">
                    Chèn danh sách TLTK ({citationStyle})
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={references.length === 0}>
                        Xuất
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleExportReferences("bibtex")}>BibTeX (.bib)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReferences("endnote")}>EndNote (.enw)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReferences("refman")}>RefMan (.ris)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReferences("refworks")}>RefWorks (.txt)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog kết quả kiểm tra trùng citation */}
      <Dialog open={duplicateCheckGroups !== null} onOpenChange={(open) => { if (!open) setDuplicateCheckGroups(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kiểm tra trùng tài liệu tham khảo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {duplicateCheckGroups && duplicateCheckGroups.length === 0 && (
              <p className="text-sm text-muted-foreground">Không phát hiện tài liệu trùng (cùng tác giả, năm, nhan đề).</p>
            )}
            {duplicateCheckGroups && duplicateCheckGroups.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Phát hiện {duplicateCheckGroups.length} nhóm trùng. Có thể giữ một mục mỗi nhóm và xóa các bản trùng.
                </p>
                <ScrollArea className="max-h-[240px] border rounded-lg p-2">
                  <div className="space-y-3">
                    {duplicateCheckGroups.map((group, gIdx) => (
                      <div key={gIdx} className="text-sm">
                        <span className="font-medium">Nhóm {gIdx + 1}:</span>{" "}
                        {group.map((idx) => (
                          <span key={idx} className="mr-2">
                            [{idx + 1}] {references[idx]?.title || references[idx]?.author || "—"}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  onClick={() => {
                    if (!duplicateCheckGroups) return
                    const toRemove = new Set(duplicateCheckGroups.flatMap((g) => g.slice(1)))
                    setReferences((prev) => prev.filter((_, j) => !toRemove.has(j)))
                    setDuplicateCheckGroups(null)
                  }}
                >
                  Xóa bản trùng (giữ 1 mục mỗi nhóm)
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog kết quả kiểm tra chất lượng học thuật */}
      <Dialog open={showAcademicQualityDialog} onOpenChange={setShowAcademicQualityDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Kiểm tra chất lượng học thuật
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {academicQualityLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang phân tích bài báo…
              </div>
            )}
            {!academicQualityLoading && academicQualityReport && (
              <ScrollArea className="flex-1 border rounded-lg p-4 text-sm">
                <MarkdownViewer content={academicQualityReport} className="prose prose-sm dark:prose-invert max-w-none" />
              </ScrollArea>
            )}
            {!academicQualityLoading && !academicQualityReport && (
              <p className="text-sm text-muted-foreground py-4">Chọn &quot;Chạy kiểm tra chất lượng học thuật&quot; từ dropdown trên toolbar để bắt đầu.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
