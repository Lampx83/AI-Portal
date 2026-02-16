"use client"

import { useCallback } from "react"
import { API_CONFIG } from "@/lib/config"
import {
  getWriteArticles,
  getWriteArticle,
  createWriteArticle,
  updateWriteArticle,
  updateWriteArticleByShareToken,
  deleteWriteArticle,
  getWriteArticleByShareToken,
  getArticleVersions,
  restoreArticleVersion,
  deleteArticleVersion,
  clearArticleVersionsExceptLatest,
  type WriteArticle,
  type WriteArticleWithShare,
} from "@/lib/api/write-articles"
import { getDraftKey } from "./useWriteEditorState"
import type { WriteEditorStateBag } from "./useWriteEditorState"
import type { WriteEditorEnv } from "./useWriteEditorEffects"

const RESIZABLE_IMG_WRAPPER_STYLE =
  "display:inline-block;position:relative;min-width:80px;min-height:60px;width:300px;height:200px;max-width:100%;overflow:visible;z-index:1"
const RESIZE_HANDLE_STYLE =
  "position:absolute;right:0;bottom:0;width:24px;height:24px;cursor:se-resize;pointer-events:auto;z-index:2;background:linear-gradient(135deg,transparent 50%,rgba(59,130,246,0.8) 50%);border:1px solid rgba(59,130,246,0.6);border-radius:2px 0 0 0"

function wrapBareImagesForResize(html: string): string {
  if (!html.includes("<img")) return html
  if (html.includes("editor-resizable-img")) return html
  return html.replace(
    /<p>(\s*)<img([^>]*?)\s*\/?>(\s*)<\/p>/gi,
    (_, before: string, imgAttrs: string, after: string) => {
      const srcMatch = imgAttrs.match(/src\s*=\s*["']([^"']*)["']/i)
      const altMatch = imgAttrs.match(/alt\s*=\s*["']([^"']*)["']/i)
      const src = srcMatch?.[1] ?? ""
      const alt = (altMatch?.[1] ?? "").replace(/"/g, "&quot;")
      if (!src) return `<p>${before || ""}<img${imgAttrs}/>${after || ""}</p>`
      return `<p>${before || ""}<span class="editor-resizable-img" contenteditable="false" style="${RESIZABLE_IMG_WRAPPER_STYLE}"><img src="${src.replace(/"/g, "&quot;")}" alt="${alt}" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none" /><span class="resize-handle" style="${RESIZE_HANDLE_STYLE}" title="Kéo để đổi kích thước" contenteditable="false"></span></span>${after || ""}</p>`
    }
  )
}

function sanitizeForFilename(s: string) {
  return (s || "").trim().replace(/[<>:"/\\|?*]/g, "_") || "document"
}

export function useWriteEditorHandlers(bag: WriteEditorStateBag, env: WriteEditorEnv) {
  const {
    editorRef,
    content,
    setContent,
    setDocTitle,
    setSaving,
    setSaveError,
    setLastSavedAt,
    setCurrentArticleId,
    setDocumentKey,
    lastSyncedHtmlRef,
    lastSyncedTitleRef,
    lastSyncedReferencesRef,
    references,
    currentArticleId,
    shareToken,
    collabWsRef,
    wrapBareImagesForResizeRef,
    setShowRequireProjectDialog,
    pendingSaveAfterProjectRef,
    setArticles,
    setArticlesLoading,
    setArticleShareToken,
    setShareToken,
    setSelectedTemplate,
    setFileName,
    setReferences,
    setVersionList,
    setRestoringVersionId,
    setShowVersionHistoryDialog,
    setDeletingVersionId,
    setClearingVersions,
    setInlineEdit,
    setInlineEditLoading,
    inlineEditGroupIdRef,
    docTitle,
  } = bag

  wrapBareImagesForResizeRef.current = wrapBareImagesForResize

  const getDocTitle = useCallback(() => docTitle?.trim() || "Chưa đặt tên", [docTitle])

  const loadArticles = useCallback(async () => {
    if (!env.session?.user) return
    setArticlesLoading(true)
    try {
      const projectId = env.activeProject?.id != null ? String(env.activeProject.id) : undefined
      const list = await getWriteArticles(projectId)
      setArticles(list)
    } catch {
      setArticles([])
    } finally {
      setArticlesLoading(false)
    }
  }, [env.session?.user, env.activeProject?.id, setArticles, setArticlesLoading])

  const handleSave = useCallback(
    async (opts?: { requireProject?: boolean }) => {
      if (!env.session?.user) return
      if (!env.activeProject?.id) {
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
            project_id: String(env.activeProject.id),
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
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : "Lưu thất bại")
      } finally {
        setSaving(false)
      }
    },
    [
      env.session?.user,
      env.activeProject?.id,
      getDocTitle,
      content,
      references,
      shareToken,
      currentArticleId,
      editorRef,
      setSaving,
      setSaveError,
      setLastSavedAt,
      setCurrentArticleId,
      setDocTitle,
      lastSyncedHtmlRef,
      lastSyncedTitleRef,
      lastSyncedReferencesRef,
      collabWsRef,
      pendingSaveAfterProjectRef,
      setShowRequireProjectDialog,
      loadArticles,
    ]
  )

  const handleLoadArticle = useCallback(
    async (article: WriteArticle) => {
      try {
        const full = (await getWriteArticle(article.id)) as WriteArticleWithShare
        const html = wrapBareImagesForResize(full.content)
        setDocTitle(full.title)
        setFileName(sanitizeForFilename(full.title) || "")
        setContent(html)
        setCurrentArticleId(full.id)
        setShareToken(null)
        setArticleShareToken(full.share_token ?? null)
        setReferences(full.references ?? [])
        setSelectedTemplate(null)
        setDocumentKey((k: number) => k + 1)
        lastSyncedHtmlRef.current = html
        lastSyncedTitleRef.current = full.title
        lastSyncedReferencesRef.current = JSON.stringify(full.references ?? [])
        if (full.updated_at) setLastSavedAt(new Date(full.updated_at))
      } catch {
        setSaveError("Không tải được bài viết")
      }
    },
    [
      setDocTitle,
      setFileName,
      setContent,
      setCurrentArticleId,
      setShareToken,
      setArticleShareToken,
      setReferences,
      setSelectedTemplate,
      setDocumentKey,
      setSaveError,
      setLastSavedAt,
      lastSyncedHtmlRef,
      lastSyncedTitleRef,
      lastSyncedReferencesRef,
    ]
  )

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
  }, [editorRef, inlineEditGroupIdRef, setContent, setInlineEdit])

  const handleNewDoc = useCallback(() => {
    setDocTitle("")
    bag.setFileName("")
    setContent("")
    bag.setSelectedTemplate(null)
    setCurrentArticleId(null)
    setShareToken(null)
    setArticleShareToken(null)
    setReferences([])
    bag.setUserStartedEditing(false)
    setDocumentKey((k: number) => k + 1)
    lastSyncedHtmlRef.current = ""
    lastSyncedTitleRef.current = ""
    lastSyncedReferencesRef.current = "[]"
    try {
      localStorage.removeItem(getDraftKey(env.activeProject?.id, null))
    } catch {
      // ignore
    }
  }, [setDocTitle, setContent, setCurrentArticleId, setShareToken, setArticleShareToken, setReferences, setDocumentKey, env.activeProject?.id, bag, lastSyncedHtmlRef, lastSyncedTitleRef, lastSyncedReferencesRef])

  const handleSaveAsNew = useCallback(async () => {
    if (!env.session?.user) return
    setSaving(true)
    setSaveError(null)
    try {
      const title = getDocTitle()
      const html = editorRef.current?.innerHTML ?? content
      const created = await createWriteArticle({
        title,
        content: html,
        references,
        project_id: env.activeProject?.id != null ? String(env.activeProject.id) : undefined,
      })
      setCurrentArticleId(created.id)
      setDocTitle(created.title)
      setDocumentKey((k: number) => k + 1)
      setContent(created.content)
      lastSyncedHtmlRef.current = created.content
      lastSyncedTitleRef.current = title
      lastSyncedReferencesRef.current = JSON.stringify(references)
      await loadArticles()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Lưu thất bại")
    } finally {
      setSaving(false)
    }
  }, [env.session?.user, env.activeProject?.id, getDocTitle, content, references, editorRef, setSaving, setSaveError, setCurrentArticleId, setDocTitle, setDocumentKey, setContent, lastSyncedHtmlRef, lastSyncedTitleRef, lastSyncedReferencesRef, loadArticles])

  const handleRestoreVersion = useCallback(async (versionId: string) => {
    if (!currentArticleId) return
    setRestoringVersionId(versionId)
    try {
      const article = await restoreArticleVersion(currentArticleId, versionId)
      const html = wrapBareImagesForResize(article.content)
      setDocTitle(article.title)
      setContent(html)
      setReferences(article.references ?? [])
      setDocumentKey((k: number) => k + 1)
      lastSyncedHtmlRef.current = html
      lastSyncedTitleRef.current = article.title
      lastSyncedReferencesRef.current = JSON.stringify(article.references ?? [])
      setLastSavedAt(article.updated_at ? new Date(article.updated_at) : null)
      bag.setShowVersionHistoryDialog(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Khôi phục thất bại")
    } finally {
      setRestoringVersionId(null)
    }
  }, [currentArticleId, setRestoringVersionId, setDocTitle, setContent, setReferences, setDocumentKey, setLastSavedAt, setSaveError, lastSyncedHtmlRef, lastSyncedTitleRef, lastSyncedReferencesRef, bag])

  const handleDeleteVersion = useCallback(async (versionId: string) => {
    if (!currentArticleId) return
    if (!confirm("Xóa phiên bản này khỏi lịch sử?")) return
    setDeletingVersionId(versionId)
    try {
      await deleteArticleVersion(currentArticleId, versionId)
      const list = await getArticleVersions(currentArticleId)
      setVersionList(list)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Xóa phiên bản thất bại")
    } finally {
      setDeletingVersionId(null)
    }
  }, [currentArticleId, setDeletingVersionId, setVersionList, setSaveError])

  const handleClearVersionsExceptLatest = useCallback(async () => {
    if (!currentArticleId) return
    if (!confirm("Xóa toàn bộ lịch sử và chỉ giữ lại phiên bản gần nhất?")) return
    setClearingVersions(true)
    try {
      await clearArticleVersionsExceptLatest(currentArticleId)
      const list = await getArticleVersions(currentArticleId)
      setVersionList(list)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Xóa lịch sử thất bại")
    } finally {
      setClearingVersions(false)
    }
  }, [currentArticleId, setClearingVersions, setVersionList, setSaveError])

  const handleDeleteArticle = useCallback(async (_e: React.MouseEvent, id: string) => {
    if (!confirm("Bạn có chắc muốn xóa bài viết này?")) return
    try {
      await deleteWriteArticle(id)
      if (currentArticleId === id) handleNewDoc()
      await loadArticles()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Xóa thất bại")
    }
  }, [currentArticleId, handleNewDoc, loadArticles, setSaveError])

  return {
    wrapBareImagesForResize,
    getDocTitle,
    loadArticles,
    handleSave,
    handleLoadArticle,
    handleSaveAsNew,
    handleRestoreVersion,
    handleDeleteVersion,
    handleClearVersionsExceptLatest,
    handleDeleteArticle,
    handleNewDoc,
    clearInlineEdit,
    sanitizeForFilename,
  }
}
