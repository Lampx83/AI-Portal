"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Pencil, FileText, BarChart3, MessageSquare, LayoutGrid, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getProjectIcon } from "@/lib/project-icons"
import { getWriteArticles } from "@/lib/api/write-articles"
import { getIconComponent, type IconName } from "@/lib/assistants"
import type { Project } from "@/types"

export type ChatAssistantOption = { alias: string; name: string; icon?: string }

interface ProjectCenterViewProps {
  project: Project
  /** Danh sách trợ lý để chọn chat (không gồm Trợ lý chính — mặc định khi không chọn; không gồm write/data) */
  chatAssistants?: ChatAssistantOption[]
  /** Khi có: chọn trợ lý tại chỗ (không chuyển trang), gọi với (alias, name) */
  onSelectAssistantForChat?: (alias: string, name: string) => void
}

/** Màn hình trung tâm khi chọn dự án: tên dự án, chọn trợ lý chat, ứng dụng. */
export function ProjectCenterView({ project, chatAssistants = [], onSelectAssistantForChat }: ProjectCenterViewProps) {
  const name = project.name?.trim() || "Dự án"
  const icon = (project.icon?.trim() || "FolderKanban") as string
  const IconComp = getProjectIcon(icon)
  const [articlesCount, setArticlesCount] = useState<number | null>(null)

  const projectId = project?.id != null ? String(project.id) : ""
  const baseQuery = projectId ? `?rid=${encodeURIComponent(projectId)}` : ""

  useEffect(() => {
    if (!projectId) {
      setArticlesCount(null)
      return
    }
    let cancelled = false
    getWriteArticles(projectId)
      .then((list) => { if (!cancelled) setArticlesCount(list.length) })
      .catch(() => { if (!cancelled) setArticlesCount(0) })
    return () => { cancelled = true }
  }, [projectId])

  const openEditDialog = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-edit-project", { detail: project }))
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 md:py-12 text-center max-w-3xl mx-auto">
      <div className="flex items-center justify-center mb-4 w-full">
        <div className="flex items-center gap-3 shrink-0 max-w-full">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 shrink-0">
            <IconComp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 min-w-0">
            <span className="truncate">{name}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={openEditDialog} title="Chỉnh sửa dự án" aria-label="Chỉnh sửa dự án">
              <Pencil className="h-4 w-4" />
            </Button>
          </h1>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Chọn trợ lý để chat hoặc ứng dụng để làm việc
      </p>

      {/* Chat with assistant */}
      {chatAssistants.length > 0 && (
        <div className="w-full mb-8 text-center">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center justify-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4" />
            Chat với trợ lý
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {chatAssistants.map((a) => {
              const AssistantIcon = getIconComponent((a.icon || "Bot") as IconName);
              return onSelectAssistantForChat ? (
                <Button
                  key={a.alias}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onSelectAssistantForChat(a.alias, a.name)}
                >
                  <AssistantIcon className="h-4 w-4 shrink-0" />
                  {a.name}
                </Button>
              ) : (
                <Button key={a.alias} variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link href={`/assistants/${encodeURIComponent(a.alias)}${baseQuery}`}>
                    <AssistantIcon className="h-4 w-4 shrink-0" />
                    {a.name}
                  </Link>
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-project-chat-history", { detail: project }))
                }
              }}
              title="Xem lịch sử chat của dự án"
            >
              <History className="h-4 w-4 shrink-0" />
              Lịch sử chat
            </Button>
          </div>
        </div>
      )}

      {/* Applications */}
      <div className="w-full mb-8 text-center">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center justify-center gap-2 mb-4">
          <LayoutGrid className="h-4 w-4" />
          Ứng dụng
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Viết bài</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Tạo nhiều bài viết trong dự án. Mỗi bài là một phiên bản riêng.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {articlesCount !== null && (
                <span className="text-xs text-muted-foreground">{articlesCount} bài viết</span>
              )}
              <Button variant="secondary" size="sm" className="gap-1.5" asChild>
                <Link href={`/assistants/write${baseQuery}`}>
                  <FileText className="h-3.5 w-3.5" />
                  {articlesCount !== null && articlesCount > 0 ? "Mở bài viết" : "Tạo bài viết mới"}
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Phân tích dữ liệu</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Thực hiện nhiều lần phân tích dữ liệu trong dự án. Mỗi lần là một phiên riêng.
            </p>
            <Button variant="secondary" size="sm" className="gap-1.5" asChild>
              <Link href={`/assistants/data${baseQuery}`}>
                <BarChart3 className="h-3.5 w-3.5" />
                Mở ứng dụng
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
