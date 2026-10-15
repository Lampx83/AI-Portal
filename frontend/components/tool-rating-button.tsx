"use client"

import { useEffect, useState } from "react"
import { Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getTodayToolRating, submitToolRating } from "@/lib/api/tool-rating"
import { cn } from "@/lib/utils"

const MAX_COMMENT = 500

function todayKey(alias: string): string {
  const d = new Date()
  return `ai_portal_tool_rated:${alias}:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLocal(key: string, v: string): void {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* bỏ qua */
  }
}

/**
 * Nút nhỏ «Đánh giá» ở góc dưới bên trái trang công cụ nhúng (không che giao diện công cụ; trên điện thoại chỉ là
 * một nút tròn có ngôi sao). Mở hộp chấm 1–5 sao + 1 câu góp ý tuỳ chọn. Đã đánh giá hôm nay → nút thu nhỏ hơn,
 * mở lại được để sửa. Ẩn được trong phiên làm việc bằng nút ×.
 */
export function ToolRatingButton({ alias, toolName }: { alias: string; toolName: string }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [ratedToday, setRatedToday] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setRatedToday(!!readLocal(todayKey(alias)))
    try {
      setHidden(sessionStorage.getItem(`ai_portal_tool_rating_hidden:${alias}`) === "1")
    } catch {
      setHidden(false)
    }
  }, [alias])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getTodayToolRating(alias).then((r) => {
      if (cancelled || !r.rated) return
      setRatedToday(true)
      if (r.rating) setRating(r.rating)
      if (r.comment) setComment(r.comment)
    })
    return () => {
      cancelled = true
    }
  }, [open, alias])

  if (hidden) return null

  const submit = async () => {
    if (rating < 1 || submitting) return
    setSubmitting(true)
    const r = await submitToolRating(alias, rating, comment.trim())
    setSubmitting(false)
    if (!r.ok) {
      toast({ title: t("toolRating.errorTitle"), description: t(r.error || "feedback.sendError"), variant: "destructive" })
      return
    }
    writeLocal(todayKey(alias), String(rating))
    setRatedToday(true)
    setOpen(false)
    toast({ title: r.updated ? t("toolRating.updated") : t("toolRating.thanks") })
  }

  const shown = hover || rating
  return (
    <>
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-1" data-testid="tool-rating">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "pointer-events-auto inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 text-xs font-medium text-foreground shadow-md backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-9 sm:px-3",
            ratedToday ? "opacity-60" : "opacity-90"
          )}
          aria-label={t("toolRating.buttonAria").replace("{name}", toolName)}
          title={t("toolRating.buttonAria").replace("{name}", toolName)}
        >
          <Star className={cn("h-4 w-4", ratedToday ? "fill-amber-400 text-amber-500" : "text-amber-500")} aria-hidden="true" />
          <span className="hidden sm:inline">{ratedToday ? t("toolRating.rated") : t("toolRating.button")}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setHidden(true)
            try {
              sessionStorage.setItem(`ai_portal_tool_rating_hidden:${alias}`, "1")
            } catch {
              /* bỏ qua */
            }
          }}
          className="pointer-events-auto hidden h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow hover:text-foreground sm:inline-flex"
          aria-label={t("toolRating.hide")}
          title={t("toolRating.hide")}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-lg" aria-describedby="tool-rating-desc">
          <DialogTitle className="pr-6 text-base">{t("toolRating.title").replace("{name}", toolName)}</DialogTitle>
          <DialogDescription id="tool-rating-desc">{t("toolRating.desc")}</DialogDescription>
          <div className="flex justify-center gap-1 py-1" role="radiogroup" aria-label={t("toolRating.starsAria")} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t("toolRating.starAria").replace("{n}", String(n))}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Star className={cn("h-8 w-8 transition-colors", n <= shown ? "fill-amber-400 text-amber-500" : "text-gray-300 dark:text-gray-600")} aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="-mt-1 h-4 text-center text-xs text-muted-foreground" aria-live="polite">
            {shown ? t(`toolRating.level${shown}`) : ""}
          </p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
            placeholder={t("toolRating.commentPlaceholder")}
            rows={2}
            className="resize-none text-sm"
            aria-label={t("toolRating.commentAria")}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t("toolRating.oncePerDay")}</span>
            <Button onClick={() => void submit()} disabled={rating < 1 || submitting} className="min-h-[40px]">
              {submitting ? t("feedback.submitting") : t("toolRating.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
