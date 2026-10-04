"use client"

import { CheckCircle2, CircleDot, Circle } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { STAGE_COUNT, STAGE_DEFS, summarizeLifecycle } from "@/lib/project-lifecycle"
import type { ProjectLifecycle } from "@/lib/project-lifecycle"
import { cn } from "@/lib/utils"

/**
 * Chip nhỏ hiển thị giai đoạn hiện tại của vòng đời nghiên cứu (vd. «Thu thập dữ liệu · 2/6»).
 * Không hiển thị gì khi dự án chưa bắt đầu giai đoạn nào.
 */
export function ProjectLifecycleChip({
  lifecycle,
  className,
}: {
  lifecycle?: ProjectLifecycle | null
  className?: string
}) {
  const { t } = useLanguage()
  const s = summarizeLifecycle(lifecycle)
  if (!s.started) return null
  const def = STAGE_DEFS[s.currentIndex]
  const fullName = t(`lifecycle.stage.${def.id}.name`)
  const label = s.allDone ? t("lifecycle.status.done") : t(`lifecycle.stage.${def.id}.short`)
  const tone = s.allDone
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
    : s.currentStatus === "doing"
      ? "bg-primary/10 text-primary dark:bg-primary/20"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  const Icon = s.allDone ? CheckCircle2 : s.currentStatus === "doing" ? CircleDot : Circle
  const aria = s.allDone
    ? t("lifecycle.allDone")
    : t("lifecycle.chipAria").replace("{name}", fullName).replace("{done}", String(s.doneCount))
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium leading-4",
        tone,
        className
      )}
      title={`${t("lifecycle.current")}: ${fullName} — ${t(`lifecycle.status.${s.currentStatus}`)}`}
      aria-label={aria}
      data-testid="project-lifecycle-chip"
    >
      <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      <span className="shrink-0 opacity-70" aria-hidden="true">
        {s.doneCount}/{STAGE_COUNT}
      </span>
    </span>
  )
}
