"use client"

import { Button } from "@/components/ui/button"
import { FileText, X } from "lucide-react"
import type { Research } from "@/app/page"

interface ResearchContextBannerProps {
  research: Research
  onClear: () => void
}

export function ResearchContextBanner({ research, onClear }: ResearchContextBannerProps) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-blue-800 dark:text-blue-200">
          <FileText className="h-5 w-5" />
          <span className="font-medium">{research.name}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
          <X className="h-4 w-4" />
          <span className="sr-only">Bỏ chọn nghiên cứu</span>
        </Button>
      </div>
    </div>
  )
}
