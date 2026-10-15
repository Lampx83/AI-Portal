"use client"

import { CornerDownRight, X } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

/** 2–3 nút gợi ý câu hỏi tiếp theo, hiện ngay trên ô nhập; bấm vào là gửi luôn câu đó. */
export function FollowupSuggestions({
  items,
  onPick,
  onDismiss,
}: {
  items: string[]
  onPick: (q: string) => void
  onDismiss?: () => void
}) {
  const { t } = useLanguage()
  if (!items.length) return null
  return (
    <div className="border-t border-border/50 px-3 pt-2 sm:px-4" role="group" aria-label={t("followups.title")} data-testid="followup-suggestions">
      <div className="mx-auto flex max-w-4xl items-start gap-2">
        <span className="mt-1.5 hidden shrink-0 text-xs text-muted-foreground sm:inline">{t("followups.title")}</span>
        <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible">
          {items.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="inline-flex min-h-[36px] max-w-[85vw] shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-full sm:text-[13px]"
            >
              <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="line-clamp-2">{q}</span>
            </button>
          ))}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label={t("followups.dismiss")}
            title={t("followups.dismiss")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
