"use client"

import Link from "next/link"
import { Check, ExternalLink, Route } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { STAGE_COUNT, STAGE_DEFS, normalizeLifecycle, summarizeLifecycle } from "@/lib/project-lifecycle"
import type { Project } from "@/types"
import { cn } from "@/lib/utils"

/**
 * Tóm tắt vòng đời nghiên cứu ở màn hình chính của dự án: 6 giai đoạn, tiến độ,
 * các công cụ gợi ý của giai đoạn hiện tại (nút «Mở công cụ») và lối vào «Quản lý vòng đời».
 */
export function ProjectLifecycleSummary({ project }: { project: Project }) {
  const { t, toolNames } = useLanguage()
  const lc = normalizeLifecycle(project.lifecycle)
  const s = summarizeLifecycle(project.lifecycle)
  const def = STAGE_DEFS[s.currentIndex]
  const openLifecycle = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-project-lifecycle", { detail: project }))
    }
  }
  const toolLabel = (alias: string) => toolNames[alias] ?? t(`lifecycle.tool.${alias}`)

  return (
    <section
      aria-label={t("lifecycle.title")}
      className="mb-6 w-full rounded-xl border border-gray-200 bg-white/60 p-4 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800/30"
      data-testid="project-lifecycle-summary"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          <Route className="h-4 w-4" aria-hidden="true" />
          {t("lifecycle.title")}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tabular-nums text-primary">
            {t("lifecycle.progress").replace("{done}", String(s.doneCount))}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={openLifecycle}
            aria-label={t("lifecycle.manageAria")}
            data-testid="open-project-lifecycle"
          >
            {t("lifecycle.manage")}
          </Button>
        </div>
      </div>

      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={t("lifecycle.stepperAria")}>
        {lc.stages.map((st, i) => {
          const d = STAGE_DEFS[i]
          const Icon = d.icon
          const name = t(`lifecycle.stage.${d.id}.name`)
          const status = t(`lifecycle.status.${st.status}`)
          return (
            <li
              key={d.id}
              aria-label={t("lifecycle.stageAria").replace("{n}", String(i + 1)).replace("{name}", name).replace("{status}", status)}
              aria-current={i === s.currentIndex && s.started && !s.allDone ? "step" : undefined}
              className="flex flex-col items-center gap-1 text-center"
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2",
                  st.status === "done" && "border-emerald-500 bg-emerald-500 text-white",
                  st.status === "doing" && "border-primary bg-primary text-primary-foreground shadow shadow-primary/30",
                  st.status === "todo" && "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-500"
                )}
              >
                {st.status === "done" ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="text-[11px] font-medium leading-tight text-gray-800 dark:text-gray-200">
                {t(`lifecycle.stage.${d.id}.short`)}
              </span>
            </li>
          )
        })}
      </ol>
      <div
        role="progressbar"
        aria-label={t("lifecycle.progressAria")}
        aria-valuemin={0}
        aria-valuemax={STAGE_COUNT}
        aria-valuenow={s.doneCount}
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-500"
          style={{ width: `${Math.round((s.doneCount / STAGE_COUNT) * 100)}%` }}
        />
      </div>

      {!s.allDone && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {s.started ? t("lifecycle.current") : t("lifecycle.notStarted")}
            {s.started && (
              <>
                : <strong className="font-semibold text-gray-800 dark:text-gray-200">{t(`lifecycle.stage.${def.id}.name`)}</strong>
              </>
            )}
          </span>
          <span className="mx-1 hidden h-4 w-px bg-gray-300 dark:bg-gray-600 sm:block" aria-hidden="true" />
          {def.tools.map((alias) => (
            <Button key={alias} variant="secondary" size="sm" className="h-7 gap-1 text-xs" asChild>
              <Link
                href={`/tools/${encodeURIComponent(alias)}`}
                aria-label={t("lifecycle.openToolAria").replace("{name}", toolLabel(alias))}
              >
                {toolLabel(alias)}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      )}
      {s.allDone && <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">{t("lifecycle.allDone")}</p>}
    </section>
  )
}
