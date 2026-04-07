"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Maximize2, Minimize2, X } from "lucide-react"

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
  position?: "left" | "right"
}

export function FloatingEmbedDialog({
  open,
  title = "AI Assistant",
  onClose,
  sizeExpandable = false,
  expandLabel = "Expand",
  collapseLabel = "Collapse",
  children,
  headerContent,
  position = "right",
}: FloatingEmbedDialogProps) {
  const [panelExpanded, setPanelExpanded] = useState(false)

  useEffect(() => {
    if (!open) setPanelExpanded(false)
  }, [open])

  if (!open) return null

  const edge = position === "left" ? "left-6" : "right-6"
  const widthClass = panelExpanded
    ? "w-[min(920px,calc(100vw-48px))] max-w-[calc(100vw-32px)]"
    : "w-[380px] max-w-[calc(100vw-48px)]"
  const height = panelExpanded ? "min(88vh, calc(100vh - 72px))" : "min(600px, calc(100vh - 100px))"

  return (
    <div
      className={`fixed ${edge} bottom-28 z-[9999] flex flex-col overflow-hidden rounded-xl border bg-background shadow-2xl ${widthClass}`}
      style={{ height }}
    >
      <div className="flex shrink-0 items-center gap-2 bg-brand px-3 py-2 text-white">
        {headerContent ?? <span className="truncate flex-1 font-semibold text-sm">{title}</span>}
        {sizeExpandable ? (
          <button
            type="button"
            onClick={() => setPanelExpanded((p) => !p)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/20 text-white text-lg leading-none transition hover:bg-white/30"
            aria-label={panelExpanded ? collapseLabel : expandLabel}
            title={panelExpanded ? collapseLabel : expandLabel}
          >
            {panelExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/20 text-white text-lg leading-none transition hover:bg-white/30"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 min-h-[320px] overflow-hidden flex flex-col bg-background">
        {children}
      </div>
    </div>
  )
}

