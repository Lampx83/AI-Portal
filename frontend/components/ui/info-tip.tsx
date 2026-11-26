"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Biểu tượng (i) nhỏ: rê chuột hoặc chạm/Enter để xem giải thích ngắn gọn về một tính năng hoặc thuật ngữ. */
export function InfoTip({ text, className, side = "right" }: { text: string; className?: string; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={text}
            onClick={(e) => e.stopPropagation()}
            className={cn("inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[260px] text-xs leading-snug normal-case font-normal tracking-normal">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
