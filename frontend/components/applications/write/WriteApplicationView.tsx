"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { useActiveProject } from "@/contexts/active-project-context"
import { useLanguage } from "@/contexts/language-context"
import "katex/dist/katex.min.css"
import type { Template } from "./constants"
import {
  FONTS,
  FONT_SIZES,
  LINE_SPACING_OPTIONS,
  SCIENTIFIC_SYMBOLS,
  FORMULA_INSERT_MARKER_ID,
  FORMULA_SAMPLES,
  INLINE_EDIT_PROMPTS,
  BLOCK_STYLES,
} from "./constants"
import { CitationEditForm } from "./CitationEditForm"
import { DocEditor } from "./DocEditor"
import { WriteDialogs } from "./WriteDialogs"
import { WriteHeader } from "./WriteHeader"
import { WriteSidebar } from "./WriteSidebar"
import { WriteToolbar } from "./WriteToolbar"

export function WriteApplicationView() {
  const { t } = useLanguage()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const { activeProject } = useActiveProject()
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

  // lg+: auto-open outline panel; below lg: auto-hide
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
  /** Current block tag (p, h1–h3) for Style toolbar */
  const [currentBlockTag, setCurrentBlockTag] = useState<string>("p")
  const [currentFont, setCurrentFont] = useState<string>("Arial")
  const [currentFontSize, setCurrentFontSize] = useState<string>("11")
  const [currentLineSpacing, setCurrentLineSpacing] = useState<number>(1.5)
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
  /** Article version history */
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false)
  const [versionList, setVersionList] = useState<WriteArticleVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null)
  const [clearingVersions, setClearingVersions] = useState(false)
  /** Find in document */
  const [showFindBar, setShowFindBar] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findBackward, setFindBackward] = useState(false)
  /** Comments: list, open popover (new | thread), draft */
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
  /** Academic quality check (AI) */
  const [showAcademicQualityDialog, setShowAcademicQualityDialog] = useState(false)
  const [academicQualityReport, setAcademicQualityReport] = useState<string | null>(null)
  const [academicQualityLoading, setAcademicQualityLoading] = useState(false)
  /** Real-time collab: viewers of same document */
  const [collabPresence, setCollabPresence] = useState<{ id: string; name: string }[]>([])
  const collabWsRef = useRef<WebSocket | null>(null)

  /** Inline edit: selected text (possibly non-contiguous) → prompt → AI edit */
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

  /** Create-article dialog: document suggestions */
  const [showGeneratePapersDialog, setShowGeneratePapersDialog] = useState(false)
  const [generatePapersDescription, setGeneratePapersDescription] = useState("")
  const [selectedGenerateStep, setSelectedGenerateStep] = useState<number>(1)
  const generatePapersInputRef = useRef<HTMLInputElement>(null)

  /** On Save without project: force create/select project, then save article */
  const [showRequireProjectDialog, setShowRequireProjectDialog] = useState(false)
  const pendingSaveAfterProjectRef = useRef(false)
  const savedSelectionRangesRef = useRef<Range[]>([])
  const savedTableSelectionRef = useRef<Range[]>([])
  const citationSpanRef = useRef<HTMLSpanElement | null>(null)
  const [citationContextMenu, setCitationContextMenu] = useState<{ refIndex: number; isNarrative: boolean } | null>(null)
  /** Citation popover when clicking a citation */
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
  const getDraftKey = (projectId: string | number | undefined, articleId: string | null) =>
    `${DRAFT_KEY_PREFIX}${projectId != null ? String(projectId) : "none"}-${articleId ?? "new"}`
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

  /** Place caret in editor (show caret on click) */
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

  // Load comments when opening article (when article id present, not share view)
  useEffect(() => {
    if (!currentArticleId || shareToken) {
      setArticleComments([])
      return
    }
    getWriteArticleComments(currentArticleId)
      .then(setArticleComments)
      .catch(() => setArticleComments([]))
  }, [currentArticleId, shareToken])

  // Sync current block style (p, h1..h6) with Style toolbar
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

  /** Normalize font from editor: Inter/Inter Fallback → Arial so toolbar does not show Inter */
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

  const getLineHeightFromSelection = useCallback((el: HTMLElement): number => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return 1.5
    try {
      let node: Node | null = sel.getRangeAt(0).startContainer
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = window.getComputedStyle(node as HTMLElement)
        const lh = style.lineHeight
        const fs = style.fontSize
        if (lh === "normal") return 1.2
        const lhNum = parseFloat(lh)
        if (!Number.isNaN(lhNum)) {
          if (lh.includes("px") && fs && !fs.includes("%")) {
            const fsNum = parseFloat(fs)
            if (!Number.isNaN(fsNum) && fsNum > 0) return Math.round((lhNum / fsNum) * 100) / 100
          }
          return lhNum
        }
      }
    } catch {
      // ignore
    }
    return 1.5
  }, [])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const updateToolbarFromSelection = () => {
      if (document.activeElement !== el) return
      setCurrentBlockTag(getBlockTagFromSelection(el))
      setCurrentFont(getFontFromSelection(el))
      setCurrentFontSize(getFontSizeFromSelection(el))
      const lh = getLineHeightFromSelection(el)
      const closest = LINE_SPACING_OPTIONS.reduce((a, b) =>
        Math.abs(a.value - lh) <= Math.abs(b.value - lh) ? a : b
      )
      setCurrentLineSpacing(closest.value)
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
  }, [documentKey, getBlockTagFromSelection, getFontFromSelection, getFontSizeFromSelection, getLineHeightFromSelection])

  // When editor area is empty: focus and place caret
  useEffect(() => {
    if (!editorEmpty) return
    const t = setTimeout(() => {
      editorRef.current?.focus()
      placeCaretInEditor()
    }, 100)
    return () => clearTimeout(t)
  }, [editorEmpty, documentKey, placeCaretInEditor])

  // When Create-article dialog opens: focus input
  useEffect(() => {
    if (!showGeneratePapersDialog) return
    setGeneratePapersDescription("")
    setSelectedGenerateStep(1)
    const t = setTimeout(() => generatePapersInputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [showGeneratePapersDialog])

  // Persist draft to localStorage (debounced)
  useEffect(() => {
    const key = getDraftKey(activeProject?.id, currentArticleId)
    const timer = setTimeout(() => {
      try {
        const payload = { docTitle, content, references, updatedAt: Date.now() }
        localStorage.setItem(key, JSON.stringify(payload))
      } catch {
        // ignore quota / private mode
      }
    }, LOCALSTORAGE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [content, docTitle, references, activeProject?.id, currentArticleId])

  // On project change/refresh: load from API first (collab: others’ saves visible on refresh)
  const prevProjectIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const projectId = activeProject?.id != null ? String(activeProject.id) : undefined
    const isSwitch = prevProjectIdRef.current !== undefined && prevProjectIdRef.current !== projectId
    prevProjectIdRef.current = projectId

    if (!projectId) return

    if (isSwitch) setCurrentArticleId(null)
    setDocumentKey((k) => k + 1)

    if (!session?.user) return
    let cancelled = false
    getWriteArticles(projectId)
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
          lastSyncedTitleRef.current = full.title
          lastSyncedReferencesRef.current = JSON.stringify(full.references ?? [])
          if (full.updated_at) setLastSavedAt(new Date(full.updated_at))
          return
        }
        // No article from API: use localStorage draft or empty
        const key = getDraftKey(projectId, null)
        try {
          const raw = localStorage.getItem(key)
          if (!raw) {
            setContent(EMPTY_EDITOR_HTML)
            setDocTitle("")
            setReferences([])
            lastSyncedHtmlRef.current = EMPTY_EDITOR_HTML
            lastSyncedTitleRef.current = ""
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
            lastSyncedTitleRef.current = data.docTitle ?? ""
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
  }, [activeProject?.id, activeProject?.name, session?.user])

  // After project switch / remount: focus editor so caret is visible
  useEffect(() => {
    if (activeProject?.id == null) return
    const t = setTimeout(() => {
      editorRef.current?.focus()
      placeCaretInEditor()
    }, 150)
    return () => clearTimeout(t)
  }, [activeProject?.id, documentKey, placeCaretInEditor])

  // Content set in API-load effect; localStorage only when API returns no article

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
      const projectId = activeProject?.id != null ? String(activeProject.id) : undefined
      const list = await getWriteArticles(projectId)
      setArticles(list)
    } catch {
      setArticles([])
    } finally {
      setArticlesLoading(false)
    }
  }, [session?.user, activeProject?.id])

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

  // Real-time collaborative: WebSocket per article, receive others’ updates
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
    if (!activeProject?.id) {
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
          project_id: String(activeProject.id),
        })
        setCurrentArticleId(created.id)
        setDocTitle(created.title)
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
        project_id: activeProject?.id != null ? String(activeProject.id) : undefined,
      })
      setCurrentArticleId(created.id)
      setDocTitle(created.title)
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
      lastSyncedTitleRef.current = full.title
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

  /** Apply font via span style (execCommand fontName unreliable with mixed sizes). */
  const applyFontFamily = (fontFamily: string) => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
    el.focus()
    const range = sel.getRangeAt(0)
    const span = document.createElement("span")
    span.style.fontFamily = fontFamily
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
    setCurrentFont(fontFamily)
  }

  /** Override line-height on children with inline line-height/font-size so paragraph uses new spacing. */
  const setLineHeightRecursive = (root: HTMLElement, value: number) => {
    if (root.style && (root.style.lineHeight || root.style.fontSize)) {
      root.style.lineHeight = String(value)
    }
    for (let i = 0; i < root.children.length; i++) {
      setLineHeightRecursive(root.children[i] as HTMLElement, value)
    }
  }

  /** Apply line spacing (unitless line-height). Wrap selection in span and override children. */
  const applyLineHeight = (value: number) => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
    el.focus()
    const range = sel.getRangeAt(0)
    const span = document.createElement("span")
    span.style.lineHeight = String(value)
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
      setLineHeightRecursive(span, value)
    }
    sel.removeAllRanges()
    sel.addRange(range)
    setContent(el.innerHTML)
    setCurrentLineSpacing(value)
  }

  /** Override font-size (and line-height) on children with inline font-size so mixed sizes get new size. */
  const setFontSizeRecursive = (root: HTMLElement, pt: number) => {
    if (root.style?.fontSize) {
      root.style.fontSize = `${pt}pt`
      root.style.lineHeight = "1.5"
    }
    for (let i = 0; i < root.children.length; i++) {
      setFontSizeRecursive(root.children[i] as HTMLElement, pt)
    }
  }

  /** Apply font size (pt) via span style; set lineHeight so spacing scales. Override children font-size for mixed content. */
  const applyFontSize = (pt: number) => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
    el.focus()
    const range = sel.getRangeAt(0)
    const span = document.createElement("span")
    span.style.fontSize = `${pt}pt`
    span.style.lineHeight = "1.5"
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
      setFontSizeRecursive(span, pt)
    }
    sel.removeAllRanges()
    sel.addRange(range)
    setContent(el.innerHTML)
  }

  /** Remove highlight from selection or caret so following text is not highlighted */
  const removeHighlight = () => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
    const range = sel.getRangeAt(0)

    if (range.collapsed) {
      // Caret in highlight: insert transparent span so typed text is not highlighted
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
      // With selection: clear highlight on elements in range that have background-color
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

  /** Find in editor content using window.find. */
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

  /** Get block (p, div) immediately before caret that contains figure/table/equation. */
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

  /** Count existing figures/tables/equations (by data-*-id or .editor-caption). */
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

  /** Insert resizable image via DOM (avoids execCommand insertHTML losing wrapper/handle) */
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
        mime = "application/x-info-systems"
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
      return `<h1>Luận văn Thạc sĩ</h1><h2>1. Mở đầu</h2><p></p><h2>2. Tổng quan tài liệu</h2><p></p><h2>3. Phương pháp</h2><p></p><h2>4. Kết quả và thảo luận</h2><p></p><h2>5. Kết luận</h2><p></p><h2>Tài liệu tham khảo</h2><p></p>`
    }
    return ""
  }

  /** Cover letter template — insert at caret */
  const COVER_LETTER_TEMPLATE_HTML = `<h2>Cover Letter</h2>
<p>[Ngày]</p>
<p>Kính gửi: Biên tập viên / [Tên tạp chí]</p>
<p><strong>Re:</strong> Submission of manuscript &quot;[Tên bài báo]&quot;</p>
<p>Kính thưa Quý Tòa soạn,</p>
<p>Chúng tôi xin gửi kèm bản thảo bài báo &quot;[Tên bài báo]&quot; để xem xét đăng trên [Tên tạp chí]. Bài báo chưa được công bố hoặc gửi đăng ở nơi khác.</p>
<p>Đóng góp chính của bài báo: [Tóm tắt ngắn 2–3 câu về đóng góp và phù hợp với tạp chí].</p>
<p>Chúng tôi xác nhận không có xung đột lợi ích. Tất cả tác giả đã đọc và đồng ý với nội dung bản thảo.</p>
<p>Trân trọng,<br>[Tên tác giả / Tất cả tác giả]</p>
<p></p>`

  /** Submission checklist template — insert at caret */
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

  const prevActiveProjectIdRef = useRef<string | number | undefined>(undefined)

  // After user creates/selects project (pending save): auto-save article
  useEffect(() => {
    const currentId = activeProject?.id
    const hadProject = prevActiveProjectIdRef.current != null
    if (currentId != null && !hadProject && pendingSaveAfterProjectRef.current) {
      pendingSaveAfterProjectRef.current = false
      setShowRequireProjectDialog(false)
      handleSaveRef.current()
    }
    prevActiveProjectIdRef.current = currentId
  }, [activeProject?.id])

  // Sync to server every few seconds when there are unsaved changes
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

  // Highlight outline item matching cursor/selection in editor
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

  // Resize image/table: drag bottom-right handle (event delegation on document)
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
      localStorage.removeItem(getDraftKey(activeProject?.id, null))
    } catch {
      // ignore
    }
  }

  /** In project: create new article and open it */
  const handleCreateNewArticleInProject = async () => {
    if (!session?.user || !activeProject?.id) return
    setSaving(true)
    setSaveError(null)
    try {
      const created = await createWriteArticle({
        title: "Bài viết mới",
        content: "",
        references: [],
        project_id: String(activeProject.id),
      })
      await loadArticles()
      await handleLoadArticle(created)
    } catch (err: any) {
      setSaveError(err?.message || "Tạo bài thất bại")
    } finally {
      setSaving(false)
    }
  }

  const sanitizeForFilename = (s: string) => (s || "").trim().replace(/[<>:"/\\|?*]/g, "_") || "document"

  /** Article title (user-defined). Project is folder of articles. */
  const getDocTitle = () => docTitle?.trim() || "Chưa đặt tên"
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

  /** Remove wrap and close inline-edit popover */
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

  /** Handle text selection in editor; supports non-contiguous selection (Ctrl/Cmd + drag) */
  const handleEditorSelection = useCallback(() => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return

    const selectedText = sel.toString().trim()
    if (!selectedText) {
      clearInlineEdit()
      return
    }

    // Remove existing wrap if any
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

    // Process from end to start so DOM changes don’t affect prior ranges
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
        // Complex ranges may fail; skip
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

  /** Open add-comment popover: wrap selection in span data-comment-id */
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

  /** Send new comment (after wrapping span and opening popover) */
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
      setSaveError(err?.message ?? t("comment.sendCommentFailed"))
    } finally {
      setCommentSubmitting(false)
    }
  }, [currentArticleId, commentPopover, commentDraft, shareToken, session?.user?.name, session?.user?.email, content, t])

  /** Send reply in thread */
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
      setSaveError(err?.message ?? t("comment.sendFeedbackFailed"))
    } finally {
      setCommentSubmitting(false)
    }
  }, [currentArticleId, commentPopover, commentDraft, t])

  /** Delete comment (and remove marker in document) */
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

  /** Apply AI edit; supports non-contiguous segments */
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
            project_id: activeProject?.id ?? null,
            context: {
              language: "vi",
              inline_edit: true,
              selected_text: texts.join("\n\n"),
              project: activeProject?.name ?? null,
              project_id: activeProject?.id ?? null,
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
    [clearInlineEdit, writeAgentModels, session, activeProject?.name]
  )

  /** Academic quality check: send content to AI, get report (grammar, style, IMRaD, citation, etc.). */
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
    const prompt = `Bạn là chuyên gia đánh giá chất lượng học thuật. Phân tích bài báo dưới đây và trả về MỘT báo cáo bằng tiếng Việt, định dạng Markdown, theo ĐÚNG các mục sau (mỗi mục một heading ##):

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
          session_title: "Kiểm tra",
          model_id: modelId,
          prompt,
          user_id: (session as any)?.user?.id ?? (session as any)?.user?.email ?? null,
          ...(session?.user ? {} : { guest_device_id: getOrCreateGuestDeviceId() }),
          project_id: activeProject?.id ?? null,
          context: {
            language: "vi",
            academic_quality_check: true,
            project: activeProject?.name ?? null,
            project_id: activeProject?.id ?? null,
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
  }, [content, writeAgentModels, session, activeProject?.id, activeProject?.name])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8f9fa] dark:bg-gray-950">
      <WriteHeader
        activeProject={activeProject}
        currentArticleId={currentArticleId}
        articles={articles}
        articlesLoading={articlesLoading}
        getDocTitle={getDocTitle}
        handleLoadArticle={handleLoadArticle}
        handleCreateNewArticleInProject={handleCreateNewArticleInProject}
        saving={saving}
        execCmd={execCmd}
        setShowFindBar={setShowFindBar}
        collabPresence={collabPresence}
        lastSavedAt={lastSavedAt}
        hasUnsavedChanges={hasUnsavedChanges}
        handleSave={handleSave}
        shareToken={shareToken}
        setShowVersionHistoryDialog={setShowVersionHistoryDialog}
        handleDownload={handleDownload}
        handleExportReferences={handleExportReferences}
        references={references}
        sessionUser={session?.user}
      />

      <WriteToolbar
        normalizeToolbarFont={normalizeToolbarFont}
        currentFont={currentFont}
        applyFontFamily={applyFontFamily}
        currentFontSize={currentFontSize}
        setCurrentFontSize={setCurrentFontSize}
        applyFontSize={applyFontSize}
        currentLineSpacing={currentLineSpacing}
        applyLineHeight={applyLineHeight}
        currentBlockTag={currentBlockTag}
        setCurrentBlockTag={setCurrentBlockTag}
        execCmd={execCmd}
        removeHighlight={removeHighlight}
        imageInputRef={imageInputRef}
        handleInsertImage={handleInsertImage}
        handleInsertCaption={handleInsertCaption}
        setShowCrossRefDialog={setShowCrossRefDialog}
        savedTableSelectionRef={savedTableSelectionRef}
        setTableRows={setTableRows}
        setTableCols={setTableCols}
        setShowTableDialog={setShowTableDialog}
        editorRef={editorRef}
        formulaLatex={formulaLatex}
        setFormulaLatex={setFormulaLatex}
        setFormulaError={setFormulaError}
        insertLatexFormula={insertLatexFormula}
        insertLatexFormulaBlock={insertLatexFormulaBlock}
        removeFormulaMarkerIfPresent={removeFormulaMarkerIfPresent}
        insertFormulaMarkerAtSelection={insertFormulaMarkerAtSelection}
        insertHtml={insertHtml}
        citationStyle={citationStyle}
        setCitationStyle={setCitationStyle}
        setShowCitationDialog={setShowCitationDialog}
        references={references}
        handleInsertCitation={handleInsertCitation}
        handleInsertReferenceList={handleInsertReferenceList}
        editorEmpty={editorEmpty}
        runAcademicQualityCheck={runAcademicQualityCheck}
        academicQualityLoading={academicQualityLoading}
        setShowGeneratePapersDialog={setShowGeneratePapersDialog}
        showFindBar={showFindBar}
        findQuery={findQuery}
        setFindQuery={setFindQuery}
        setFindBackward={setFindBackward}
        runFindInEditor={runFindInEditor}
        setShowFindBar={setShowFindBar}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden flex-row">
        <WriteSidebar
          showOutline={showOutline}
          showTemplates={showTemplates}
          loading={loading}
          templates={templates}
          selectedTemplate={selectedTemplate}
          handleSelectTemplate={handleSelectTemplate}
          outlineItems={outlineItems}
          currentOutlineIndex={currentOutlineIndex}
          scrollToHeading={scrollToHeading}
        />

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
                  {/* Document body only */}
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
                      Tạo bài viết
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
                  className="min-h-full text-sm text-gray-900 dark:text-gray-100 leading-relaxed outline-none focus:ring-0 prose prose-sm max-w-none dark:prose-invert [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-6 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-3 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:mt-2 [&_h5]:text-sm [&_h5]:font-medium [&_h5]:mt-2 [&_h6]:text-xs [&_h6]:font-medium [&_h6]:mt-2 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul_ul]:list-[circle] [&_ul_ul]:pl-6 [&_ul_ul_ul]:list-[square] [&_ul_ul_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-6 [&_ol_ol_ol]:list-[lower-roman] [&_ol_ol_ol]:pl-6 [&_*[style*='font-size']]:!leading-[1.5]"
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

          {/* Inline edit with AI popover */}
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

          {/* Comment popover (new or thread) */}
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
                    {commentSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : commentPopover.type === "new" ? t("comment.sendComment") : t("comment.sendFeedback")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Citation popover */}
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

          {/* Status bar: outline toggle + save error | word count + zoom */}
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

      <WriteDialogs
        showOpenModal={showOpenModal}
        setShowOpenModal={setShowOpenModal}
        articlesLoading={articlesLoading}
        articles={articles}
        currentArticleId={currentArticleId}
        handleLoadArticle={handleLoadArticle}
        handleDeleteArticle={handleDeleteArticle}
        showShareDialog={showShareDialog}
        setShowShareDialog={setShowShareDialog}
        setShareUrl={setShareUrl}
        shareLoading={shareLoading}
        shareUrl={shareUrl}
        setShareCopied={setShareCopied}
        shareCopied={shareCopied}
        setArticleShareToken={setArticleShareToken}
        setShareLoading={setShareLoading}
        showVersionHistoryDialog={showVersionHistoryDialog}
        setShowVersionHistoryDialog={setShowVersionHistoryDialog}
        setVersionList={setVersionList}
        versionsLoading={versionsLoading}
        versionList={versionList}
        handleClearVersionsExceptLatest={handleClearVersionsExceptLatest}
        clearingVersions={clearingVersions}
        restoringVersionId={restoringVersionId}
        handleDeleteVersion={handleDeleteVersion}
        deletingVersionId={deletingVersionId}
        handleRestoreVersion={handleRestoreVersion}
        showGeneratePapersDialog={showGeneratePapersDialog}
        setShowGeneratePapersDialog={setShowGeneratePapersDialog}
        selectedGenerateStep={selectedGenerateStep}
        setSelectedGenerateStep={setSelectedGenerateStep}
        applyGeneratedContent={applyGeneratedContent}
        generatePapersInputRef={generatePapersInputRef}
        generatePapersDescription={generatePapersDescription}
        setGeneratePapersDescription={setGeneratePapersDescription}
        handleGeneratePapersCreate={handleGeneratePapersCreate}
        showRequireProjectDialog={showRequireProjectDialog}
        setShowRequireProjectDialog={setShowRequireProjectDialog}
        showTableDialog={showTableDialog}
        setShowTableDialog={setShowTableDialog}
        tableRows={tableRows}
        setTableRows={setTableRows}
        tableCols={tableCols}
        setTableCols={setTableCols}
        editorRef={editorRef}
        savedTableSelectionRef={savedTableSelectionRef}
        handleInsertTable={handleInsertTable}
        showCrossRefDialog={showCrossRefDialog}
        setShowCrossRefDialog={setShowCrossRefDialog}
        collectCrossRefTargets={collectCrossRefTargets}
        handleInsertCrossRef={handleInsertCrossRef}
        showCitationDialog={showCitationDialog}
        setShowCitationDialog={setShowCitationDialog}
        setEditingRef={setEditingRef}
        citationStyle={citationStyle}
        setCitationStyle={setCitationStyle}
        editingRef={editingRef}
        references={references}
        setReferences={setReferences}
        handleInsertCitation={handleInsertCitation}
        handleInsertReferenceList={handleInsertReferenceList}
        handleExportReferences={handleExportReferences}
        duplicateCheckGroups={duplicateCheckGroups}
        setDuplicateCheckGroups={setDuplicateCheckGroups}
        showAcademicQualityDialog={showAcademicQualityDialog}
        setShowAcademicQualityDialog={setShowAcademicQualityDialog}
        academicQualityLoading={academicQualityLoading}
        academicQualityReport={academicQualityReport}
      />
    </div>
  )
}
