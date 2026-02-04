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
import { Toggle } from "@/components/ui/toggle"
import {
  FileText,
  Upload,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
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
  MessageSquare,
  Superscript,
  Subscript,
  Quote,
  Table2,
  Minus,
  Sigma,
  Sparkles,
  Loader2,
  X,
  BookMarked,
  Image,
  ChevronLeft,
  ChevronRight,
  IndentIncrease,
  IndentDecrease,
  Columns3,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { API_CONFIG } from "@/lib/config"
import {
  getWriteArticles,
  getWriteArticle,
  createWriteArticle,
  updateWriteArticle,
  deleteWriteArticle,
  type WriteArticle,
  type CitationReference,
} from "@/lib/api/write-articles"
import {
  toBibTeX,
  toEndNote,
  toRefMan,
  toRefWorks,
  formatInTextAPA,
  formatInTextIEEE,
  toReferenceListAPA,
  toReferenceListIEEE,
  markdownItalicsToHtml,
  parseCitationFormat,
} from "@/lib/citation-formats"
import { htmlToLatex } from "@/lib/html-to-latex"
import { htmlToMarkdown } from "@/lib/html-to-markdown"
import { ChatInterface, type ChatInterfaceHandle } from "@/components/chat-interface"
import { ChatSuggestions } from "@/components/chat-suggestions"
import { useActiveResearch } from "@/contexts/active-research-context"

type Template = { id: string; title: string; description?: string; type?: string }

const FONTS = ["Arial", "Times New Roman", "Georgia", "Cambria", "Calibri"]

const RESEARCH_WRITING_SUGGESTIONS = [
  "Viết Abstract/Tóm tắt cho bài nghiên cứu của tôi",
  "Viết phần Giới thiệu (Introduction)",
  "Viết phần Phương pháp nghiên cứu (Methodology)",
  "Viết phần Kết quả và thảo luận (Results & Discussion)",
  "Viết phần Kết luận (Conclusion)",
  "Cải thiện văn phong cho phù hợp với văn phong học thuật",
  "Paraphrase đoạn văn này",
  "Tạo đề cương chi tiết cho bài báo khoa học",
  "Đề xuất từ vựng học thuật thay thế",
  "Kiểm tra logic và cấu trúc đoạn văn",
]
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 36, 48, 72]

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
      contentEditable
      suppressContentEditableWarning
      className={className}
      onInput={() => onInput(divRef.current?.innerHTML ?? "")}
      onKeyDown={onKeyDown}
    />
  )
})
DocEditor.displayName = "DocEditor"

export function WriteAssistantView() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeResearch } = useActiveResearch()
  const chatRef = useRef<ChatInterfaceHandle>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showChatPanel, setShowChatPanel] = useState(true)
  const [chatSessionId, setChatSessionId] = useState<string>(searchParams.get("sid") || "")
  const [hasChatMessages, setHasChatMessages] = useState(false)
  const [writeAgentModels, setWriteAgentModels] = useState<{ model_id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [docTitle, setDocTitle] = useState("Tài liệu chưa có tiêu đề")
  const [fileName, setFileName] = useState("")
  const [showRenameFileDialog, setShowRenameFileDialog] = useState(false)
  const [content, setContent] = useState("")
  const [documentKey, setDocumentKey] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [showOutline, setShowOutline] = useState(true)
  const [outlineItems, setOutlineItems] = useState<{ id: string; text: string; level: number }[]>([])

  const [articles, setArticles] = useState<WriteArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [currentArticleId, setCurrentArticleId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [userStartedEditing, setUserStartedEditing] = useState(false)
  const [references, setReferences] = useState<CitationReference[]>([])
  const [showCitationDialog, setShowCitationDialog] = useState(false)
  const [editingRef, setEditingRef] = useState<CitationReference | null>(null)
  const [citationStyle, setCitationStyle] = useState<"APA" | "IEEE">("APA")
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)

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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const PAGE_HEIGHT = 842

  const updatePagination = useCallback(() => {
    const scrollEl = scrollContainerRef.current
    const paperEl = paperRef.current
    if (!scrollEl || !paperEl) return
    const contentHeight = paperEl.offsetHeight
    const scrollTop = scrollEl.scrollTop
    const total = Math.max(1, Math.ceil(contentHeight / PAGE_HEIGHT))
    const current = Math.min(total, Math.max(1, Math.floor(scrollTop / PAGE_HEIGHT) + 1))
    setTotalPages(total)
    setCurrentPage(current)
  }, [])

  useEffect(() => {
    const scrollEl = scrollContainerRef.current
    const paperEl = paperRef.current
    if (!scrollEl || !paperEl) return
    const ro = new ResizeObserver(updatePagination)
    ro.observe(paperEl)
    scrollEl.addEventListener("scroll", updatePagination)
    updatePagination()
    return () => {
      ro.disconnect()
      scrollEl.removeEventListener("scroll", updatePagination)
    }
  }, [updatePagination, content])

  const scrollToPage = (page: number) => {
    const scrollEl = scrollContainerRef.current
    if (!scrollEl || page < 1 || page > totalPages) return
    const targetTop = (page - 1) * PAGE_HEIGHT
    scrollEl.scrollTo({ top: targetTop, behavior: "smooth" })
  }

  const showTemplates = !currentArticleId && !userStartedEditing

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

  const sidEnsuredRef = useRef(false)
  useEffect(() => {
    if (sidEnsuredRef.current) return
    const sid = searchParams.get("sid")
    if (!sid) {
      const newSid = crypto.randomUUID()
      const sp = new URLSearchParams(searchParams?.toString() || "")
      sp.set("sid", newSid)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
      setChatSessionId(newSid)
    } else {
      setChatSessionId(sid)
    }
    sidEnsuredRef.current = true
  }, [pathname, router, searchParams])

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

  const ensureChatSessionId = () => {
    if (searchParams.get("sid")) return searchParams.get("sid")!
    const newSid = crypto.randomUUID()
    setChatSessionId(newSid)
    const sp = new URLSearchParams(searchParams?.toString() || "")
    sp.set("sid", newSid)
    router.replace(`${pathname}?${sp.toString()}`)
    return newSid
  }

  const loadArticles = useCallback(async () => {
    if (!session?.user) return
    setArticlesLoading(true)
    try {
      const list = await getWriteArticles()
      setArticles(list)
    } catch {
      setArticles([])
    } finally {
      setArticlesLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  const handleSave = async () => {
    if (!session?.user) return
    setSaving(true)
    setSaveError(null)
    try {
      const title = titleRef.current?.innerText?.trim() || docTitle
      const html = editorRef.current?.innerHTML ?? content
      if (currentArticleId) {
        await updateWriteArticle(currentArticleId, { title, content: html, references })
        await loadArticles()
      } else {
        const created = await createWriteArticle({ title, content: html, references })
        setCurrentArticleId(created.id)
        setDocTitle(created.title)
        await loadArticles()
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
      const title = titleRef.current?.innerText?.trim() || docTitle
      const html = editorRef.current?.innerHTML ?? content
      const created = await createWriteArticle({ title, content: html, references })
      setCurrentArticleId(created.id)
      setDocTitle(created.title)
      setDocumentKey((k) => k + 1)
      setContent(created.content)
      await loadArticles()
    } catch (err: any) {
      setSaveError(err?.message || "Lưu thất bại")
    } finally {
      setSaving(false)
    }
  }

  const handleLoadArticle = async (article: WriteArticle) => {
    try {
      const full = await getWriteArticle(article.id)
      setDocTitle(full.title)
      setFileName(sanitizeForFilename(full.title) || "")
      setContent(wrapBareImagesForResize(full.content))
      setCurrentArticleId(full.id)
      setReferences(full.references ?? [])
      setSelectedTemplate(null)
      setDocumentKey((k) => k + 1)
    } catch {
      setSaveError("Không tải được bài viết")
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

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
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
    document.execCommand("insertHTML", false, html)
    editorRef.current?.focus()
    if (editorRef.current) setContent(editorRef.current.innerHTML)
  }

  const handleInsertColumns = (colCount: number) => {
    const gap = "1.5em"
    insertHtml(
      `<div class="editor-columns" style="column-count:${colCount};column-gap:${gap};margin:1em 0;width:100%;"><p></p></div><p></p>`
    )
  }

  const handleInsertTable = (rows: number, cols: number) => {
    const thCells = Array(cols).fill("<th class=\"border border-gray-300 dark:border-gray-600 p-2 text-left bg-gray-100 dark:bg-gray-800\"></th>").join("")
    const header = `<tr>${thCells}</tr>`
    const tdCell = "<td class=\"border border-gray-300 dark:border-gray-600 p-2\"></td>"
    const bodyRows = Array(rows - 1)
      .fill(null)
      .map(() => `<tr>${Array(cols).fill(tdCell).join("")}</tr>`)
      .join("")
    insertHtml(`<table class="border-collapse border border-gray-300 dark:border-gray-600 my-4 w-full text-sm"><thead>${header}</thead><tbody>${bodyRows}</tbody></table><p></p>`)
  }

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
        return `<p>${before || ""}<span class="editor-resizable-img" contenteditable="false" style="display:inline-block;position:relative;min-width:80px;min-height:60px;width:300px;height:200px;max-width:100%"><img src="${src.replace(/"/g, "&quot;")}" alt="${alt}" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none" /><span class="resize-handle" style="position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(59,130,246,0.6) 50%);border-radius:2px 0 0 0" title="Kéo để đổi kích thước" contenteditable="false"></span></span>${after || ""}</p>`
      }
    )
  }

  const getResizableImageHtml = (src: string, alt: string, width?: number, height?: number) => {
    const w = width ? `${width}px` : "300px"
    const h = height ? `${height}px` : "200px"
    return `<p><span class="editor-resizable-img" contenteditable="false" style="display:inline-block;position:relative;min-width:80px;min-height:60px;width:${w};height:${h};max-width:100%;"><img src="${src.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none" /><span class="resize-handle" style="position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:se-resize;background:linear-gradient(135deg,transparent 50%,rgba(59,130,246,0.6) 50%);border-radius:2px 0 0 0" title="Kéo để đổi kích thước" contenteditable="false"></span></span></p>`
  }

  const handleInsertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !file.type.startsWith("image/")) return
    const alt = file.name.replace(/"/g, "&quot;")
    const tryInsert = (src: string, w?: number, h?: number) => {
      insertHtml(getResizableImageHtml(src, alt, w, h))
      if (editorRef.current) setContent(editorRef.current.innerHTML)
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

  const handleInsertCitation = (index?: number) => {
    if (references.length === 0) {
      setShowCitationDialog(true)
      return
    }
    const idx = index != null && index >= 0 && index < references.length ? index : references.length - 1
    const ref = references[idx]!
    if (citationStyle === "APA") {
      const text = formatInTextAPA(ref)
      insertHtml(`${text} `)
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
    if (type.includes("paper")) {
      return `<h1>Bài báo Khoa học</h1><h2>Tóm tắt</h2><p></p><h2>1. Giới thiệu</h2><p></p><h2>2. Phương pháp</h2><p></p><h2>3. Kết quả</h2><p></p><h2>4. Thảo luận</h2><p></p><h2>Kết luận</h2><p></p><h2>Tài liệu tham khảo</h2><p></p>`
    }
    if (type === "report") {
      return `<h1>Báo cáo Nghiên cứu</h1><h2>1. Mục tiêu</h2><p></p><h2>2. Nội dung thực hiện</h2><p></p><h2>3. Kết quả đạt được</h2><p></p><h2>4. Kiến nghị</h2><p></p>`
    }
    if (type.includes("conference")) {
      return `<h1>Bài báo Hội nghị</h1><h2>Tóm tắt</h2><p></p><h2>1. Giới thiệu</h2><p></p><h2>2. Phương pháp</h2><p></p><h2>3. Kết quả</h2><p></p><h2>4. Thảo luận</h2><p></p><h2>Kết luận</h2><p></p><h2>Tài liệu tham khảo</h2><p></p>`
    }
    if (type.includes("internship")) {
      return `<h1>Báo cáo Thực tập</h1><h2>1. Giới thiệu doanh nghiệp</h2><p></p><h2>2. Nội dung thực tập</h2><p></p><h2>3. Kết quả đạt được</h2><p></p><h2>4. Nhận xét và kiến nghị</h2><p></p>`
    }
    if (type.includes("essay")) {
      return `<h1>Tiểu luận</h1><h2>1. Mở bài</h2><p></p><h2>2. Thân bài</h2><p></p><h2>3. Kết luận</h2><p></p><h2>Tài liệu tham khảo</h2><p></p>`
    }
    if (type.includes("proposal")) {
      return `<h1>Đề cương Nghiên cứu</h1><h2>1. Tên đề tài</h2><p></p><h2>2. Mục tiêu nghiên cứu</h2><p></p><h2>3. Tổng quan tài liệu</h2><p></p><h2>4. Phương pháp nghiên cứu</h2><p></p><h2>5. Kế hoạch thực hiện</h2><p></p>`
    }
    if (type.includes("abstract")) {
      return `<h1>Tóm tắt Nghiên cứu</h1><h2>Mục tiêu</h2><p></p><h2>Phương pháp</h2><p></p><h2>Kết quả chính</h2><p></p><h2>Kết luận</h2><p></p>`
    }
    if (type.includes("survey")) {
      return `<h1>Báo cáo Khảo sát</h1><h2>1. Giới thiệu</h2><p></p><h2>2. Phương pháp khảo sát</h2><p></p><h2>3. Kết quả phân tích</h2><p></p><h2>4. Kết luận và kiến nghị</h2><p></p>`
    }
    if (type.includes("dissertation")) {
      return `<h1>Luận án Tiến sĩ</h1><h2>1. Mở đầu</h2><p></p><h2>2. Tổng quan lĩnh vực nghiên cứu</h2><p></p><h2>3. Cơ sở lý thuyết và phương pháp</h2><p></p><h2>4. Kết quả nghiên cứu</h2><p></p><h2>5. Kết luận và hướng phát triển</h2><p></p><h2>Tài liệu tham khảo</h2><p></p>`
    }
    return `<h1>${t.title}</h1><p></p><p>Bắt đầu soạn thảo...</p>`
  }

  const [words, setWords] = useState(0)

  // Khởi tạo nội dung tiêu đề khi load document mới (documentKey đổi)
  useEffect(() => {
    const el = titleRef.current
    if (el) el.innerText = docTitle || ""
  }, [documentKey])

  useEffect(() => {
    const timer = setInterval(() => {
      const el = editorRef.current
      if (el) {
        const text = el.innerText.replace(/\s+/g, " ").trim()
        setWords(text ? text.split(" ").filter(Boolean).length : 0)
        // Update outline from headings
        const headings = el.querySelectorAll("h1, h2, h3")
        const items: { id: string; text: string; level: number }[] = []
        headings.forEach((h, i) => {
          const tag = h.tagName
          const level = tag === "H1" ? 1 : tag === "H2" ? 2 : 3
          items.push({ id: `h-${i}`, text: (h as HTMLElement).innerText, level })
        })
        setOutlineItems(items)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [content])

  // Resize ảnh: kéo handle góc phải-dưới để đổi kích thước
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const onMouseDown = (e: MouseEvent) => {
      const handle = (e.target as HTMLElement).closest(".resize-handle")
      if (!handle) return
      e.preventDefault()
      const wrapper = handle.closest(".editor-resizable-img") as HTMLElement
      if (!wrapper) return
      const startX = e.clientX
      const startY = e.clientY
      const rect = wrapper.getBoundingClientRect()
      let startW = rect.width
      let startH = rect.height
      const onMove = (e2: MouseEvent) => {
        const dw = e2.clientX - startX
        const dh = e2.clientY - startY
        const newW = Math.max(80, Math.round(startW + dw))
        const newH = Math.max(60, Math.round(startH + dh))
        wrapper.style.width = `${newW}px`
        wrapper.style.height = `${newH}px`
      }
      const onUp = () => {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        if (editorRef.current) setContent(editorRef.current.innerHTML)
      }
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    }
    el.addEventListener("mousedown", onMouseDown)
    return () => el.removeEventListener("mousedown", onMouseDown)
  }, [])

  const handleNewDoc = () => {
    setDocTitle("Tài liệu chưa có tiêu đề")
    setFileName("")
    setContent("")
    setSelectedTemplate(null)
    setCurrentArticleId(null)
    setReferences([])
    setUserStartedEditing(false)
    setDocumentKey((k) => k + 1)
  }

  const sanitizeForFilename = (s: string) => (s || "").trim().replace(/[<>:"/\\|?*]/g, "_") || "document"

  const getDocTitle = () => titleRef.current?.innerText?.trim() || docTitle || "document"
  const getDocFilename = () => fileName.trim() || sanitizeForFilename(getDocTitle())
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
    const headings = el.querySelectorAll("h1, h2, h3")
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
        const sid = ensureChatSessionId()
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
            user_id: (session as any)?.user?.id ?? (session as any)?.user?.email,
            context: {
              language: "vi",
              inline_edit: true,
              selected_text: texts.join("\n\n"),
              project: activeResearch?.name ?? null,
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
    [clearInlineEdit, ensureChatSessionId, writeAgentModels, session, activeResearch?.name]
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8f9fa] dark:bg-gray-950">
      {/* Menu bar */}
      <div className="flex-shrink-0 h-9 px-3 flex items-center gap-1 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              Tệp
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleNewDoc}>
              <FilePlus className="h-4 w-4 mr-2" />
              Tài liệu mới
            </DropdownMenuItem>
            {session?.user && (
              <>
                <DropdownMenuItem onClick={() => { loadArticles(); setShowOpenModal(true) }}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Mở bài viết đã lưu
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Đang lưu…" : "Lưu"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSaveAsNew} disabled={saving}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  Lưu thành bài mới
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => handleDownload("html")}>
              <FileCode className="h-4 w-4 mr-2" />
              Tải xuống (.html)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownload("docx")}>
              <FileText className="h-4 w-4 mr-2" />
              Tải xuống Word (.docx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownload("pdf")}>
              <BookOpen className="h-4 w-4 mr-2" />
              Tải xuống PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownload("latex")}>
              <Sigma className="h-4 w-4 mr-2" />
              Tải xuống LaTeX (.tex)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownload("markdown")}>
              <Type className="h-4 w-4 mr-2" />
              Tải xuống Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Xuất tài liệu tham khảo
            </DropdownMenuLabel>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              Chèn
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
              <Image className="h-4 w-4 mr-2" />
              Chèn ảnh
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setTableRows(3); setTableCols(3); setShowTableDialog(true) }}>
              <Table2 className="h-4 w-4 mr-2" />
              Chèn bảng
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => execCmd("insertHorizontalRule")}>
              <Minus className="h-4 w-4 mr-2" />
              Đường kẻ ngang
            </DropdownMenuItem>
            <DropdownMenuLabel className="text-xs">Chuẩn: {citationStyle}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex gap-2">
              <span className="text-xs text-muted-foreground">Chuyển:</span>
              <button type="button" onClick={() => setCitationStyle("APA")} className={`px-1.5 py-0.5 text-xs rounded ${citationStyle === "APA" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>APA</button>
              <button type="button" onClick={() => setCitationStyle("IEEE")} className={`px-1.5 py-0.5 text-xs rounded ${citationStyle === "IEEE" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>IEEE</button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {references.map((r, i) => (
              <DropdownMenuItem key={i} onClick={() => handleInsertCitation(i)}>
                <Quote className="h-4 w-4 mr-2" />
                {citationStyle === "APA" ? `Chèn ${formatInTextAPA(r)}` : `Chèn [${i + 1}]`}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleInsertReferenceList()} disabled={references.length === 0}>
              Chèn danh sách TLTK ({citationStyle})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowCitationDialog(true)}>
              <BookMarked className="h-4 w-4 mr-2" />
              Quản lý tài liệu tham khảo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              Chỉnh sửa
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => execCmd("undo")}>Hoàn tác</DropdownMenuItem>
            <DropdownMenuItem onClick={() => execCmd("redo")}>Làm lại</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Chọn văn bản → dùng AI chỉnh sửa
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              Xem
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setShowChatPanel((v) => !v)}>
              {showChatPanel ? "Ẩn" : "Hiện"} chat hỗ trợ viết
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowOutline((v) => !v)}>
              {showOutline ? "Ẩn" : "Hiện"} dàn ý
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setZoom((z) => Math.min(200, z + 10))}>
              Phóng to
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setZoom((z) => Math.max(50, z - 10))}>
              Thu nhỏ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-0.5 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("undo")}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("redo")}>
          <Redo2 className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 font-normal">
              <Type className="h-4 w-4 mr-1" />
              Arial <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {FONTS.map((f) => (
              <DropdownMenuItem key={f} onClick={() => execCmd("fontName", f)}>
                {f}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 font-normal min-w-[3rem]">
              11 <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {FONT_SIZES.map((s) => {
              const sizeNum = Math.min(7, Math.max(1, Math.floor(s / 6) + 1))
              return (
                <DropdownMenuItem key={s} onClick={() => execCmd("fontSize", String(sizeNum))}>
                  {s}
                </DropdownMenuItem>
              )
            })}
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
        <Toggle size="sm" className="h-8 w-8 p-0" onPressedChange={() => execCmd("strikeThrough")}>
          <Strikethrough className="h-4 w-4" />
        </Toggle>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("formatBlock", "blockquote")} title="Trích dẫn">
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Chèn bảng"
          onClick={() => { setTableRows(3); setTableCols(3); setShowTableDialog(true) }}
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
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("insertHorizontalRule")} title="Đường kẻ ngang">
          <Minus className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Chia cột">
              <Columns3 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleInsertColumns(2)}>2 cột</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleInsertColumns(3)}>3 cột</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Chèn trích dẫn">
              <span className="text-xs">[1]</span>
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {references.map((r, i) => (
              <DropdownMenuItem key={i} onClick={() => handleInsertCitation(i)}>
                [{i + 1}] {r.title || r.author || "Tài liệu"}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCitationDialog(true)}>
              <BookMarked className="h-4 w-4 mr-2" />
              Quản lý tài liệu tham khảo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("formatBlock", "h1")}>
          <Heading1 className="h-4 w-4" title="Tiêu đề 1" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("formatBlock", "h2")}>
          <Heading2 className="h-4 w-4" title="Tiêu đề 2" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("formatBlock", "h3")}>
          <Heading3 className="h-4 w-4" title="Tiêu đề 3" />
        </Button>
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
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("superscript")} title="Chỉ số trên (x²)">
          <Superscript className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("subscript")} title="Chỉ số dưới (H₂O)">
          <Subscript className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Ký hiệu khoa học">
              <Sigma className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
            <div className="grid grid-cols-6 gap-0.5 p-2">
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
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden flex-row">
        {/* Sidebar: Templates + Outline */}
        <div
          className={`${showOutline ? "w-64" : "w-0"} flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all flex flex-col`}
        >
          {showOutline && (
            <>
              {showTemplates && (
                <>
                  <div className="p-3 border-b">
                    <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Mẫu template
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Chọn mẫu khi tạo bài mới</p>
                  </div>
                  <ScrollArea className="max-h-48 shrink-0">
                    <div className="p-2 space-y-1">
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
                  </ScrollArea>
                  <Separator />
                </>
              )}
              <div className="p-3 border-t">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
                  Dàn ý
                </h3>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {outlineItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Chưa có tiêu đề</p>
                  ) : (
                    outlineItems.map((item, i) => (
                      <button
                        key={item.id}
                        className="block w-full text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1 truncate"
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
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto py-8 bg-[#e8eaed] dark:bg-gray-950"
          >
            <div
              ref={paperRef}
              className="mx-auto bg-white dark:bg-gray-900 shadow-lg relative"
              style={{
                width: 595,
                minHeight: PAGE_HEIGHT,
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                padding: "48px 56px 48px 56px",
              }}
              onMouseUp={handleEditorSelection}
            >
              {/* Đường phân trang: mỗi trang A4 842px */}
              <div
                className="absolute inset-0 pointer-events-none rounded overflow-hidden"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${PAGE_HEIGHT - 1}px, rgba(0,0,0,0.06) ${PAGE_HEIGHT - 1}px, rgba(0,0,0,0.06) ${PAGE_HEIGHT}px)`,
                }}
                aria-hidden
              />
              {/* Document title - contentEditable, chỉ set innerHTML khi documentKey đổi (load doc mới) */}
              <div
                key={`title-${documentKey}`}
                ref={titleRef}
                contentEditable
                suppressContentEditableWarning
                className="relative z-10 text-2xl font-normal text-gray-900 dark:text-gray-100 border-none outline-none mb-6 pb-2 focus:ring-0 min-h-[2rem] empty:before:content-['Tài_liệu_chưa_có_tiêu_đề'] empty:before:text-gray-400"
                onInput={() => setDocTitle(titleRef.current?.innerText?.trim() ?? "")}
              />
              {/* Editor - key forces remount on template/new doc */}
              <div className="relative z-10">
              <DocEditor
                key={`editor-${documentKey}`}
                ref={editorRef}
                initialContent={content}
                onInput={(html) => {
                  setContent(html)
                  setUserStartedEditing(true)
                }}
                onKeyDown={handleEditorKeyDown}
                className="min-h-[500px] text-sm text-gray-900 dark:text-gray-100 leading-relaxed outline-none focus:ring-0 prose prose-sm max-w-none dark:prose-invert [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-6 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-3 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul_ul]:list-[circle] [&_ul_ul]:pl-6 [&_ul_ul_ul]:list-[square] [&_ul_ul_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-6 [&_ol_ol_ol]:list-[lower-roman] [&_ol_ol_ol]:pl-6 [&_.editor-columns_p]:break-inside-avoid"
              />
              </div>
            </div>
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
                  <Sparkles className="h-3.5 w-3.5" />
                  Chỉnh sửa với AI
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

          {/* Status bar */}
          <div className="flex-shrink-0 min-h-7 px-4 flex items-center justify-between text-xs text-muted-foreground bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-4">
              {saveError && (
                <span className="text-red-600 dark:text-red-400" title={saveError}>
                  {saveError}
                </span>
              )}
              <span>{words} từ</span>
              <div className="flex items-center gap-1" title="Phân trang">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={currentPage <= 1}
                  onClick={() => scrollToPage(currentPage - 1)}
                  title="Trang trước"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-[4.5rem] text-center tabular-nums">
                  Trang {currentPage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={currentPage >= totalPages}
                  onClick={() => scrollToPage(currentPage + 1)}
                  title="Trang sau"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
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
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowOutline((v) => !v)}
          title={showOutline ? "Ẩn dàn ý" : "Hiện dàn ý"}
        >
          {showOutline ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant={showChatPanel ? "secondary" : "ghost"}
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowChatPanel((v) => !v)}
          title={showChatPanel ? "Ẩn chat hỗ trợ" : "Hiện chat hỗ trợ"}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
          </div>
        </div>

        {/* Chat panel hỗ trợ viết nghiên cứu - bên phải */}
        {showChatPanel && (
        <div className="w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Trợ lý viết nghiên cứu
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gợi ý và hỗ trợ viết bài báo khoa học
            </p>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {!hasChatMessages && (
              <div className="flex-1 overflow-auto p-3">
                <ChatSuggestions
                  suggestions={RESEARCH_WRITING_SUGGESTIONS}
                  onSuggestionClick={(s) => chatRef.current?.applySuggestion(s)}
                  assistantName="Trợ lý viết"
                />
              </div>
            )}
            <ChatInterface
              key={chatSessionId || "no-sid"}
              ref={chatRef}
              className={hasChatMessages ? "flex-1 min-h-0" : "flex-none"}
              composerLayout="stacked"
              assistantName="Trợ lý viết"
              researchContext={activeResearch ?? null}
              sessionId={chatSessionId || undefined}
              onMessagesChange={(count) => setHasChatMessages(count > 0)}
              onChatStart={() => {
                ensureChatSessionId()
                setHasChatMessages(true)
              }}
              onSendMessage={async (prompt, modelId, signal) => {
                const sid = ensureChatSessionId()
                const res = await fetch(`${API_CONFIG.baseUrl}/api/chat/sessions/${sid}/send`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    assistant_base_url: `${API_CONFIG.baseUrl}/api/write_agent/v1`,
                    assistant_alias: "write",
                    session_title: (prompt || "").slice(0, 60) || "Trợ lý viết",
                    model_id: modelId,
                    prompt,
                    user_id: (session as any)?.user?.id ?? (session as any)?.user?.email,
                    context: {
                      language: "vi",
                      project: activeResearch?.name ?? null,
                      extra_data: { document: [] },
                    },
                  }),
                  signal,
                })
                if (!res.ok) {
                  if (res.status === 429 && typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("refresh-quota"))
                  }
                  const err = await res.json().catch(() => ({}))
                  throw new Error(err?.message || `HTTP ${res.status}`)
                }
                const json = await res.json()
                if (json?.status === "success") {
                  return json.content_markdown || ""
                }
                throw new Error(json?.error || "Gửi thất bại")
              }}
              models={writeAgentModels.length > 0 ? writeAgentModels : [{ model_id: "gpt-4o-mini", name: "GPT-4o Mini" }]}
            />
          </div>
        </div>
        )}
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
                handleInsertTable(tableRows, tableCols)
                setShowTableDialog(false)
              }}
            >
              Chèn bảng {tableRows}×{tableCols}
            </Button>
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
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => { handleInsertCitation(i); setShowCitationDialog(false) }} title={citationStyle === "APA" ? formatInTextAPA(r) : `[${i + 1}]`}>
                              {citationStyle === "APA" ? `Chèn ${formatInTextAPA(r)}` : `Chèn [${i + 1}]`}
                            </Button>
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
    </div>
  )
}
