"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

type FloatingEmbedDialogProps = {
  open: boolean
  title?: string
  onClose: () => void
  /** Toggle larger panel in place (same React tree — chat/streaming state is preserved). */
  sizeExpandable?: boolean
  expandLabel?: string
  collapseLabel?: string
  children: ReactNode
  headerContent?: ReactNode
  /** Extra icon buttons rendered between headerContent and the expand toggle (e.g. history, new chat). */
  headerActions?: ReactNode
  position?: "left" | "right"
  /** Báo cho nơi chứa (vd. iframe nút chat nổi trong chế độ nhúng) biết panel đang mở rộng hay thu gọn. */
  onExpandedChange?: (expanded: boolean) => void
}

export function FloatingEmbedDialog({
  open,
  title,
  onClose: _onClose,
  sizeExpandable = false,
  expandLabel,
  collapseLabel,
  children,
  headerContent,
  headerActions,
  position = "right",
  onExpandedChange,
}: FloatingEmbedDialogProps) {
  const { t } = useLanguage()
  const resolvedTitle = title ?? t("chat.assistantAI")
  const resolvedExpandLabel = expandLabel ?? t("common.expand")
  const resolvedCollapseLabel = collapseLabel ?? t("common.collapse")
  const [panelExpanded, setPanelExpanded] = useState(false)

  useEffect(() => {
    if (!open) setPanelExpanded(false)
  }, [open])

  useEffect(() => {
    onExpandedChange?.(open && panelExpanded)
  }, [open, panelExpanded, onExpandedChange])

  if (!open) return null

  const edge = position === "left" ? "left-6" : "right-6"
  const widthClass = panelExpanded
    ? "w-[min(1100px,calc(100vw-48px))] max-w-[calc(100vw-32px)]"
    : "w-[380px] max-w-[calc(100vw-48px)]"
  // bottom-28 (112px) đẩy panel lên từ đáy — trừ thêm để mép trên luôn cách trần ít nhất ~24px, không chạm trần khi mở rộng.
  const height = panelExpanded ? "min(75vh, calc(100vh - 160px))" : "min(600px, calc(100vh - 100px))"

  return (
    <>
      {/* Dim + blur the page behind the panel while it is expanded */}
      {panelExpanded ? (
        <div
          className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => setPanelExpanded(false)}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`fixed ${edge} bottom-28 z-[9999] flex flex-col overflow-hidden rounded-xl border bg-background shadow-2xl ${widthClass}`}
        style={{ height }}
      >
        <div className="flex shrink-0 items-center gap-2 bg-brand px-3 py-2 text-white">
          {headerContent ?? <span className="truncate flex-1 font-semibold text-sm">{resolvedTitle}</span>}
          {headerActions}
          {sizeExpandable ? (
            <button
              type="button"
              onClick={() => setPanelExpanded((p) => !p)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/20 text-white text-lg leading-none transition hover:bg-white/30"
              aria-label={panelExpanded ? resolvedCollapseLabel : resolvedExpandLabel}
              title={panelExpanded ? resolvedCollapseLabel : resolvedExpandLabel}
            >
              {panelExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        <div className="flex-1 min-h-0 min-h-[320px] overflow-hidden flex flex-col bg-background">
          {children}
        </div>
      </div>
    </>
  )
}

