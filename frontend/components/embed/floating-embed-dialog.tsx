"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

type FloatingEmbedDialogProps = {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  headerContent?: ReactNode
  position?: "left" | "right"
}

export function FloatingEmbedDialog({
  open,
  title = "AI Assistant",
  onClose,
  children,
  headerContent,
  position = "right",
}: FloatingEmbedDialogProps) {
  if (!open) return null

  return (
    <div
      className={`fixed ${position === "left" ? "left-6" : "right-6"} bottom-28 z-[9999] flex w-[380px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl`}
      style={{ height: "min(600px, calc(100vh - 100px))" }}
    >
      <div className="flex shrink-0 items-center gap-2 bg-brand px-3 py-2 text-white">
        {headerContent ?? <span className="truncate flex-1 font-semibold text-sm">{title}</span>}
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

