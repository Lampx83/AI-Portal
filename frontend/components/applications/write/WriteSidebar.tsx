"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FolderOpen, FileText } from "lucide-react"
import type { Template } from "./constants"

export interface WriteSidebarProps {
  showOutline: boolean
  showTemplates: boolean
  loading: boolean
  templates: Template[]
  selectedTemplate: Template | null
  handleSelectTemplate: (t: Template) => void
  outlineItems: { id: string; text: string; level: number }[]
  currentOutlineIndex: number | null
  scrollToHeading: (index: number) => void
}

export function WriteSidebar(p: WriteSidebarProps) {
  return (
    <div
      className={`w-0 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all flex flex-col ${p.showOutline ? "lg:w-64" : ""}`}
    >
      {p.showOutline && (
        <>
          {p.showTemplates && (
            <>
              <div className="p-3 border-b shrink-0">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Mẫu template
                </h3>
              </div>
              <div className="p-2 space-y-1 shrink-0">
                {p.loading ? (
                  <p className="text-sm text-muted-foreground p-4">Đang tải...</p>
                ) : p.templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Không có mẫu</p>
                ) : (
                  p.templates.map((t) => (
                    <Button
                      key={t.id}
                      variant={p.selectedTemplate?.id === t.id ? "secondary" : "ghost"}
                      className="w-full justify-start text-left h-auto py-2 px-3 gap-2"
                      onClick={() => p.handleSelectTemplate(t)}
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
              {p.outlineItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa đặt tên</p>
              ) : (
                p.outlineItems.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`block w-full text-left text-xs rounded px-2 py-1 truncate ${
                      i === p.currentOutlineIndex
                        ? "bg-primary/15 dark:bg-primary/25 font-medium text-primary"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                    onClick={() => p.scrollToHeading(i)}
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
  )
}
