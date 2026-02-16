"use client"

import { useEffect, useRef } from "react"
import { API_CONFIG, getCollabWsUrl } from "@/lib/config"
import { toast } from "sonner"
import {
  getWriteArticles,
  getWriteArticle,
  getWriteArticleByShareToken,
  getWriteArticleComments,
  getArticleVersions,
  createShareLink,
  type WriteArticleWithShare,
  type CitationReference,
} from "@/lib/api/write-articles"
import { getDraftKey, isEditorContentEmpty } from "./useWriteEditorState"
import { LINE_SPACING_OPTIONS } from "../constants"
import type { WriteEditorStateBag } from "./useWriteEditorState"

const LOCALSTORAGE_DEBOUNCE_MS = 500
const SYNC_INTERVAL_MS = 5000

export type WriteEditorEnv = {
  session: { user?: unknown } | null
  activeProject: { id?: string | number; name?: string } | null
  searchParams: URLSearchParams
}

export type WriteEditorEffectsHandlers = {
  handleSave: (opts?: { requireProject?: boolean }) => void | Promise<void>
  clearInlineEdit?: () => void
}

export function useWriteEditorEffects(
  bag: WriteEditorStateBag,
  env: WriteEditorEnv,
  handlers: WriteEditorEffectsHandlers
) {
  const {
    content,
    setContent,
    setShowOutline,
    currentArticleId,
    shareToken,
    setArticleComments,
    editorRef,
    setCurrentBlockTag,
    setCurrentFont,
    setCurrentFontSize,
    setCurrentLineSpacing,
    getBlockTagFromSelection,
    getFontFromSelection,
    getFontSizeFromSelection,
    getLineHeightFromSelection,
    editorEmpty,
    documentKey,
    placeCaretInEditor,
    setGeneratePapersDescription,
    setSelectedGenerateStep,
    generatePapersInputRef,
    showGeneratePapersDialog,
    docTitle,
    references,
    setDocTitle,
    setReferences,
    setCurrentArticleId,
    setShareToken,
    setArticleShareToken,
    setDocumentKey,
    lastSyncedHtmlRef,
    lastSyncedTitleRef,
    lastSyncedReferencesRef,
    EMPTY_EDITOR_HTML,
    wrapBareImagesForResizeRef,
    setLoading,
    setVersionList,
    setVersionsLoading,
    setCollabPresence,
    collabWsRef,
    setSaveError,
    setFileName,
    setSelectedTemplate,
    setUserStartedEditing,
    setWords,
    setOutlineItems,
    setCurrentOutlineIndex,
    pendingSaveAfterProjectRef,
    setShowRequireProjectDialog,
  } = bag

  const handleSaveRef = useRef(handlers.handleSave)
  handleSaveRef.current = handlers.handleSave
  const prevProjectIdRef = useRef<string | undefined>(undefined)
  const shareParamLoadedRef = useRef(false)
  const prevActiveProjectIdRef = useRef<string | number | undefined>(undefined)

  // wrapBareImagesForResizeRef is set by useWriteEditorHandlers

  // lg+: auto-open outline panel
  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)") : null
    if (!mq) return
    const onMatch = () => setShowOutline(mq.matches)
    onMatch()
    mq.addEventListener("change", onMatch)
    return () => mq.removeEventListener("change", onMatch)
  }, [setShowOutline])

  // Outline when content empty
  useEffect(() => {
    if (isEditorContentEmpty(content)) setShowOutline(true)
  }, [content, setShowOutline])

  // Load comments when opening article
  useEffect(() => {
    if (!currentArticleId || shareToken) {
      setArticleComments([])
      return
    }
    getWriteArticleComments(currentArticleId)
      .then(setArticleComments)
      .catch(() => setArticleComments([]))
  }, [currentArticleId, shareToken, setArticleComments])

  // Sync current block style with Style toolbar
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
    const onEditorClick = () => setTimeout(updateToolbarFromSelection, 0)
    document.addEventListener("selectionchange", onSelectionChange)
    el.addEventListener("focus", updateToolbarFromSelection)
    el.addEventListener("click", onEditorClick)
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange)
      el.removeEventListener("focus", updateToolbarFromSelection)
      el.removeEventListener("click", onEditorClick)
    }
  }, [
    documentKey,
    editorRef,
    getBlockTagFromSelection,
    getFontFromSelection,
    getFontSizeFromSelection,
    getLineHeightFromSelection,
    setCurrentBlockTag,
    setCurrentFont,
    setCurrentFontSize,
    setCurrentLineSpacing,
  ])

  // When editor area empty: focus and place caret
  useEffect(() => {
    if (!editorEmpty) return
    const t = setTimeout(() => {
      editorRef.current?.focus()
      placeCaretInEditor()
    }, 100)
    return () => clearTimeout(t)
  }, [editorEmpty, documentKey, placeCaretInEditor, editorRef])

  // When Create-article dialog opens: focus input
  useEffect(() => {
    if (!showGeneratePapersDialog) return
    setGeneratePapersDescription("")
    setSelectedGenerateStep(1)
    const t = setTimeout(() => generatePapersInputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [showGeneratePapersDialog, setGeneratePapersDescription, setSelectedGenerateStep, generatePapersInputRef])

  // Persist draft to localStorage (debounced)
  useEffect(() => {
    const key = getDraftKey(env.activeProject?.id, currentArticleId)
    const timer = setTimeout(() => {
      try {
        const payload = { docTitle, content, references, updatedAt: Date.now() }
        localStorage.setItem(key, JSON.stringify(payload))
      } catch {
        // ignore
      }
    }, LOCALSTORAGE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [content, docTitle, references, env.activeProject?.id, currentArticleId])

  // On project: load from API (or localStorage if no article)
  useEffect(() => {
    const projectId = env.activeProject?.id != null ? String(env.activeProject.id) : undefined
    const isSwitch = prevProjectIdRef.current !== undefined && prevProjectIdRef.current !== projectId
    prevProjectIdRef.current = projectId
    if (!projectId) return
    if (isSwitch) setCurrentArticleId(null)
    setDocumentKey((k: number) => k + 1)
    if (!env.session?.user) return
    let cancelled = false
    getWriteArticles(projectId)
      .then((list) => {
        if (cancelled) return
        if (list.length >= 1) return getWriteArticle(list[0].id) as Promise<WriteArticleWithShare>
        return null
      })
      .then((full) => {
        if (cancelled) return
        const wrap = wrapBareImagesForResizeRef.current
        if (full) {
          const html = typeof wrap === "function" ? wrap(full.content) : full.content
          setDocTitle(full.title)
          setContent(html)
          setCurrentArticleId(full.id)
          setShareToken(null)
          setArticleShareToken((full as WriteArticleWithShare).share_token ?? null)
          setReferences(full.references ?? [])
          setDocumentKey((k: number) => k + 1)
          lastSyncedHtmlRef.current = html
          lastSyncedTitleRef.current = full.title
          lastSyncedReferencesRef.current = JSON.stringify(full.references ?? [])
          if (full.updated_at) bag.setLastSavedAt(new Date(full.updated_at))
          return
        }
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
        setDocumentKey((k: number) => k + 1)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [env.activeProject?.id, env.activeProject?.name, env.session?.user])

  // After project switch: focus editor
  useEffect(() => {
    if (env.activeProject?.id == null) return
    const t = setTimeout(() => {
      editorRef.current?.focus()
      placeCaretInEditor()
    }, 150)
    return () => clearTimeout(t)
  }, [env.activeProject?.id, documentKey, placeCaretInEditor, editorRef])

  const baseUrl = `${API_CONFIG.baseUrl}/api/write_agent/v1`

  // Load templates
  useEffect(() => {
    let cancelled = false
    bag.setLoading(true)
    const urls = [`${baseUrl}/data?type=templates`, `${baseUrl}/data?type=examples`]
    Promise.all(
      urls.map((url) =>
        fetch(url).then(async (res) => {
          if (!res.ok) return []
          const json = await res.json()
          const items = json?.items ?? []
          return items.map((t: { id?: string; title?: string; description?: string; type?: string }) => ({
            id: t.id ?? t.title,
            title: t.title ?? t.id,
            description: t.description,
            type: t.type,
          }))
        })
      )
    )
      .then((results) => {
        if (cancelled) return
        bag.setTemplates(results.flat())
      })
      .catch(() => {
        if (!cancelled) bag.setTemplates([])
      })
      .finally(() => {
        if (!cancelled) bag.setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  // Fetch write agent metadata (models)
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
          bag.setWriteAgentModels(models)
        }
      } catch {
        bag.setWriteAgentModels([{ model_id: "gpt-4o-mini", name: "GPT-4o Mini" }])
      }
    }
    fetchMeta()
  }, [baseUrl])

  // Load articles list
  useEffect(() => {
    if (!env.session?.user) return
    const projectId = env.activeProject?.id != null ? String(env.activeProject.id) : undefined
    bag.setArticlesLoading(true)
    getWriteArticles(projectId)
      .then(bag.setArticles)
      .catch(() => bag.setArticles([]))
      .finally(() => bag.setArticlesLoading(false))
  }, [env.session?.user, env.activeProject?.id])

  const baseShareUrl = typeof window !== "undefined" ? `${window.location.origin}/assistants/write` : ""

  // Share dialog: build share URL
  useEffect(() => {
    if (!bag.showShareDialog || !currentArticleId) return
    if (bag.articleShareToken) {
      bag.setShareUrl(`${baseShareUrl}?share=${bag.articleShareToken}`)
      bag.setShareLoading(false)
      return
    }
    bag.setShareLoading(true)
    createShareLink(currentArticleId)
      .then((r) => {
        bag.setArticleShareToken(r.share_token)
        bag.setShareUrl(r.share_url)
      })
      .catch(() => bag.setSaveError("Không tạo được link chia sẻ"))
      .finally(() => bag.setShareLoading(false))
  }, [bag.showShareDialog, currentArticleId, bag.articleShareToken, baseShareUrl])

  // Version history: load list
  useEffect(() => {
    if (!bag.showVersionHistoryDialog || !currentArticleId || shareToken) return
    setVersionsLoading(true)
    getArticleVersions(currentArticleId)
      .then(setVersionList)
      .catch(() => setVersionList([]))
      .finally(() => setVersionsLoading(false))
  }, [bag.showVersionHistoryDialog, currentArticleId, shareToken, setVersionList, setVersionsLoading])

  // Share param: load article by share token
  useEffect(() => {
    const token = env.searchParams.get("share")
    if (!token?.trim() || !env.session?.user || shareParamLoadedRef.current) return
    shareParamLoadedRef.current = true
    let cancelled = false
    setLoading(true)
    const wrap = wrapBareImagesForResizeRef.current
    getWriteArticleByShareToken(token.trim())
      .then((art) => {
        if (cancelled) return
        setDocTitle(art.title)
        setFileName("")
        setContent(typeof wrap === "function" ? wrap(art.content) : art.content)
        setCurrentArticleId(art.id)
        setShareToken(token.trim())
        setArticleShareToken(art.share_token || null)
        setReferences(art.references ?? [])
        setSelectedTemplate(null)
        setUserStartedEditing(false)
        setDocumentKey((k: number) => k + 1)
        if (art.updated_at) bag.setLastSavedAt(new Date(art.updated_at))
      })
      .catch(() => {
        if (!cancelled) setSaveError("Link chia sẻ không hợp lệ hoặc đã hết hạn")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [env.session?.user])

  // Real-time collaborative editing WebSocket
  useEffect(() => {
    const articleId = currentArticleId
    const token = shareToken
    if ((!articleId && !token) || !env.session?.user) {
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
          setDocumentKey((k: number) => k + 1)
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
  }, [currentArticleId, shareToken, env.session?.user])

  // After user creates/selects project (pending save): auto-save
  useEffect(() => {
    const currentId = env.activeProject?.id
    const hadProject = prevActiveProjectIdRef.current != null
    if (currentId != null && !hadProject && pendingSaveAfterProjectRef.current) {
      pendingSaveAfterProjectRef.current = false
      setShowRequireProjectDialog(false)
      handleSaveRef.current()
    }
    prevActiveProjectIdRef.current = currentId
  }, [env.activeProject?.id])

  // Sync to server every few seconds when dirty
  useEffect(() => {
    if (!env.session?.user) return
    const interval = setInterval(() => {
      const html = editorRef.current?.innerHTML ?? content
      if (html === lastSyncedHtmlRef.current) return
      if (!html || !html.trim()) return
      handleSaveRef.current()
    }, SYNC_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [env.session?.user, content])

  // Cmd+S / Ctrl+S to save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (env.session?.user) handleSaveRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [env.session?.user])

  // Word count + outline from editor
  useEffect(() => {
    const timer = setInterval(() => {
      const el = editorRef.current
      if (el) {
        const text = el.innerText.replace(/\s+/g, " ").trim()
        setWords(text ? text.split(" ").filter(Boolean).length : 0)
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

  // Highlight outline item by cursor position
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

  // Inline edit: close popover on outside click
  useEffect(() => {
    if (!bag.inlineEdit) return
    const onPointerDown = (e: PointerEvent) => {
      const popover = document.getElementById("inline-edit-popover")
      if (popover?.contains(e.target as Node)) return
      const editor = editorRef.current
      if (editor?.contains(e.target as Node)) return
      handlers.clearInlineEdit?.()
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [bag.inlineEdit, handlers.clearInlineEdit, editorRef])

  // Resize image/table: event delegation
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
        if (editorRef.current) bag.setContent(editorRef.current.innerHTML)
      }
      document.body.style.userSelect = "none"
      document.body.style.cursor = "se-resize"
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    }
    document.addEventListener("mousedown", onMouseDown, true)
    return () => document.removeEventListener("mousedown", onMouseDown, true)
  }, [bag])
}
