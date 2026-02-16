"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Maximize2 } from "lucide-react"

/** Wrapper cho từng chart, có nút phóng to fullscreen */
export function ChartCard({
  title,
  icon,
  className = "",
  children,
}: {
  title: string
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const [fullscreen, setFullscreen] = useState(false)
  return (
    <>
      <section
        className={`bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-4 shadow-sm relative group ${className}`.trim()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-60 hover:opacity-100"
            onClick={() => setFullscreen(true)}
            title="Phóng to toàn màn hình"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-64">{children}</div>
      </section>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-4 flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {icon}
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 pt-4">
            <div className="h-full min-h-[400px]">{children}</div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
