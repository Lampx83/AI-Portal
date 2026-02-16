"use client"

import { useState, useRef, useCallback } from "react"
import type { Template } from "../constants"
import type { CitationReference, WriteArticleVersion, WriteArticleComment } from "@/lib/api/write-articles"
import { FONTS, FONT_SIZES, LINE_SPACING_OPTIONS } from "../constants"

const DRAFT_KEY_PREFIX = "main-assistant-draft-"
const EMPTY_EDITOR_HTML = "<p><br></p>"

export function isEditorContentEmpty(html: string) {
  if (!html || !html.trim()) return true
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim()
  return text === ""
}

export function getDraftKey(projectId: string | number | undefined, articleId: string | null) {
  return `${DRAFT_KEY_PREFIX}${projectId != null ? String(projectId) : "none"}-${articleId ?? "new"}`
}

export type WriteEditorStateBag = ReturnType<typeof useWriteEditorState>

export function useWriteEditorState() {
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
  const [words, setWords] = useState(0)
  const [articles, setArticles] = useState<import("@/lib/api/write-articles").WriteArticle[]>([])
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
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false)
  const [versionList, setVersionList] = useState<WriteArticleVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null)
  const [clearingVersions, setClearingVersions] = useState(false)
  const [showFindBar, setShowFindBar] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findBackward, setFindBackward] = useState(false)
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
  const [showAcademicQualityDialog, setShowAcademicQualityDialog] = useState(false)
  const [academicQualityReport, setAcademicQualityReport] = useState<string | null>(null)
  const [academicQualityLoading, setAcademicQualityLoading] = useState(false)
  const [collabPresence, setCollabPresence] = useState<{ id: string; name: string }[]>([])
  const collabWsRef = useRef<WebSocket | null>(null)
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
  const [showGeneratePapersDialog, setShowGeneratePapersDialog] = useState(false)
  const [generatePapersDescription, setGeneratePapersDescription] = useState("")
  const [selectedGenerateStep, setSelectedGenerateStep] = useState<number>(1)
  const generatePapersInputRef = useRef<HTMLInputElement>(null)
  const [showRequireProjectDialog, setShowRequireProjectDialog] = useState(false)
  const pendingSaveAfterProjectRef = useRef(false)
  const savedSelectionRangesRef = useRef<Range[]>([])
  const savedTableSelectionRef = useRef<Range[]>([])
  const citationSpanRef = useRef<HTMLSpanElement | null>(null)
  const [citationContextMenu, setCitationContextMenu] = useState<{ refIndex: number; isNarrative: boolean } | null>(null)
  const [citationPopover, setCitationPopover] = useState<{
    refIndex: number
    isNarrative: boolean
    rect: { top: number; left: number }
  } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const lastSyncedHtmlRef = useRef<string>("")
  const lastSyncedTitleRef = useRef<string>("")
  const lastSyncedReferencesRef = useRef<string>("[]")
  const wrapBareImagesForResizeRef = useRef<(html: string) => string>(() => "")

  const showTemplates = (!currentArticleId && !userStartedEditing) || isEditorContentEmpty(content)
  const editorEmpty = isEditorContentEmpty(content)

  const validBlockTags = ["p", "h1", "h2", "h3", "h4", "h5", "h6"] as const
  const normalizeToolbarFont = useCallback((font: string): string => {
    if (!font || /Inter(\s+Fallback)?/i.test(font)) return "Arial"
    return font
  }, [])

  const getBlockTagFromSelection = useCallback((el: HTMLElement): string => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return "p"
    let value = document.queryCommandValue("formatBlock")?.toLowerCase() ?? ""
    if (value === "paragraph") value = "p"
    if (value.startsWith("heading ")) {
      const n = value.replace("heading ", "").trim()
      if (["1", "2", "3", "4", "5", "6"].includes(n)) value = `h${n}`
    }
    if (validBlockTags.includes(value as (typeof validBlockTags)[number])) return value
    const range = sel.getRangeAt(0)
    let node: Node | null = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    while (node && node !== el) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName?.toLowerCase()
        if (tag && validBlockTags.includes(tag as (typeof validBlockTags)[number])) return tag
      }
      node = node.parentNode
    }
    return "p"
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

  return {
    EMPTY_EDITOR_HTML,
    editorRef,
    templates,
    setTemplates,
    writeAgentModels,
    setWriteAgentModels,
    loading,
    setLoading,
    selectedTemplate,
    setSelectedTemplate,
    docTitle,
    setDocTitle,
    fileName,
    setFileName,
    showRenameFileDialog,
    setShowRenameFileDialog,
    content,
    setContent,
    documentKey,
    setDocumentKey,
    zoom,
    setZoom,
    showOutline,
    setShowOutline,
    outlineItems,
    setOutlineItems,
    currentOutlineIndex,
    setCurrentOutlineIndex,
    words,
    setWords,
    articles,
    setArticles,
    articlesLoading,
    setArticlesLoading,
    currentArticleId,
    setCurrentArticleId,
    saving,
    setSaving,
    saveError,
    setSaveError,
    lastSavedAt,
    setLastSavedAt,
    showOpenModal,
    setShowOpenModal,
    userStartedEditing,
    setUserStartedEditing,
    references,
    setReferences,
    showCitationDialog,
    setShowCitationDialog,
    editingRef,
    setEditingRef,
    duplicateCheckGroups,
    setDuplicateCheckGroups,
    citationStyle,
    setCitationStyle,
    currentBlockTag,
    setCurrentBlockTag,
    currentFont,
    setCurrentFont,
    currentFontSize,
    setCurrentFontSize,
    currentLineSpacing,
    setCurrentLineSpacing,
    showTableDialog,
    setShowTableDialog,
    tableRows,
    setTableRows,
    tableCols,
    setTableCols,
    showCrossRefDialog,
    setShowCrossRefDialog,
    shareToken,
    setShareToken,
    articleShareToken,
    setArticleShareToken,
    showShareDialog,
    setShowShareDialog,
    shareUrl,
    setShareUrl,
    shareCopied,
    setShareCopied,
    shareLoading,
    setShareLoading,
    showVersionHistoryDialog,
    setShowVersionHistoryDialog,
    versionList,
    setVersionList,
    versionsLoading,
    setVersionsLoading,
    restoringVersionId,
    setRestoringVersionId,
    deletingVersionId,
    setDeletingVersionId,
    clearingVersions,
    setClearingVersions,
    showFindBar,
    setShowFindBar,
    findQuery,
    setFindQuery,
    findBackward,
    setFindBackward,
    articleComments,
    setArticleComments,
    commentPopover,
    setCommentPopover,
    commentDraft,
    setCommentDraft,
    commentSubmitting,
    setCommentSubmitting,
    commentDeleting,
    setCommentDeleting,
    commentInputRef,
    formulaLatex,
    setFormulaLatex,
    formulaError,
    setFormulaError,
    showAcademicQualityDialog,
    setShowAcademicQualityDialog,
    academicQualityReport,
    setAcademicQualityReport,
    academicQualityLoading,
    setAcademicQualityLoading,
    collabPresence,
    setCollabPresence,
    collabWsRef,
    inlineEdit,
    setInlineEdit,
    inlineEditLoading,
    setInlineEditLoading,
    inlineEditGroupIdRef,
    inlineEditInputRef,
    imageInputRef,
    showGeneratePapersDialog,
    setShowGeneratePapersDialog,
    generatePapersDescription,
    setGeneratePapersDescription,
    selectedGenerateStep,
    setSelectedGenerateStep,
    generatePapersInputRef,
    showRequireProjectDialog,
    setShowRequireProjectDialog,
    pendingSaveAfterProjectRef,
    savedSelectionRangesRef,
    savedTableSelectionRef,
    citationSpanRef,
    citationContextMenu,
    setCitationContextMenu,
    citationPopover,
    setCitationPopover,
    scrollContainerRef,
    paperRef,
    lastSyncedHtmlRef,
    lastSyncedTitleRef,
    lastSyncedReferencesRef,
    wrapBareImagesForResizeRef,
    showTemplates,
    editorEmpty,
    validBlockTags,
    normalizeToolbarFont,
    getBlockTagFromSelection,
    getFontFromSelection,
    getFontSizeFromSelection,
    getLineHeightFromSelection,
    placeCaretInEditor,
  }
}
