"use client"

import Link from "next/link"
import { useMemo } from "react"
import { AlarmClock, ArrowRight, CheckCircle2, Flag, ListTodo, MessageSquare, PlayCircle, Sparkles, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useTools } from "@/hooks/use-tools"
import { computeNextSteps, type NextStep, type NextStepKind } from "@/lib/next-steps"
import { formatDueDate, todayIsoDate } from "@/lib/project-lifecycle"
import type { Project } from "@/types"
import { cn } from "@/lib/utils"

const KIND_ICON: Record<NextStepKind, typeof Sparkles> = {
  start: PlayCircle,
  overdue: AlarmClock,
  dueSoon: AlarmClock,
  startStage: PlayCircle,
  completeStage: CheckCircle2,
  checklist: ListTodo,
  tool: Wrench,
  central: MessageSquare,
  allDone: Flag,
}

/**
 * Thẻ «Bước tiếp theo» ở trang chủ dự án: 1–3 việc cụ thể theo giai đoạn hiện tại, việc chưa xong và hạn sắp tới,
 * mỗi việc có nút mở đúng công cụ. Nút sửa vòng đời (bắt đầu / hoàn thành giai đoạn) chỉ hiện với chủ dự án.
 */
export function ProjectNextSteps({ project }: { project: Project }) {
  const { t, toolNames } = useLanguage()
  const { tools } = useTools()
  const isOwner = !project.is_shared
  const projectId = project?.id != null ? String(project.id) : ""
  const availableTools = useMemo(() => (tools.length ? tools.map((x) => x.alias) : undefined), [tools])
  const steps = useMemo(
    () => computeNextSteps(project.lifecycle, { today: todayIsoDate(), isOwner, availableTools }),
    [project.lifecycle, isOwner, availableTools]
  )
  if (steps.length === 0) return null

  const toolLabel = (alias: string) => toolNames[alias] ?? t(`lifecycle.tool.${alias}`)
  const fill = (s: NextStep) => {
    let text = t(s.titleKey)
    for (const [k, v] of Object.entries(s.params ?? {})) {
      const value = typeof v === "string" && v.startsWith("lifecycle.stage.") ? t(v) : k === "date" ? formatDueDate(String(v)) : String(v)
      text = text.split(`{${k}}`).join(value)
    }
    return text
  }
  const openLifecycle = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("open-project-lifecycle", { detail: project }))
  }

  const renderAction = (s: NextStep) => {
    const cls = "h-9 shrink-0 gap-1 px-3 text-xs sm:h-8"
    if (s.action.type === "tool") {
      const alias = s.action.alias
      return (
        <Button variant="secondary" size="sm" className={cls} asChild>
          <Link href={`/tools/${encodeURIComponent(alias)}${projectId ? `?rid=${encodeURIComponent(projectId)}` : ""}`} aria-label={t("lifecycle.openToolAria").replace("{name}", toolLabel(alias))}>
            {toolLabel(alias)}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      )
    }
    if (s.action.type === "central") {
      const q = t(s.action.promptKey)
      const href = `/assistants/central?${projectId ? `rid=${encodeURIComponent(projectId)}&` : ""}q=${encodeURIComponent(q)}`
      return (
        <Button variant="secondary" size="sm" className={cls} asChild>
          <Link href={href}>
            {t("nextSteps.askCentral")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      )
    }
    return (
      <Button variant={s.ownerOnly ? "default" : "outline"} size="sm" className={cls} onClick={openLifecycle}>
        {!isOwner
          ? t("nextSteps.viewLifecycle")
          : s.kind === "start" || s.kind === "startStage"
            ? t("nextSteps.begin")
            : s.kind === "completeStage"
              ? t("nextSteps.markDone")
              : t("nextSteps.updateProgress")}
      </Button>
    )
  }

  return (
    <section
      aria-label={t("nextSteps.title")}
      className="mb-5 w-full rounded-xl border border-primary/25 bg-primary/[0.04] p-3 text-left shadow-sm sm:p-4 dark:border-primary/30 dark:bg-primary/10"
      data-testid="project-next-steps"
    >
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        {t("nextSteps.title")}
      </h2>
      <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
        {steps.map((s) => {
          const Icon = KIND_ICON[s.kind] ?? Sparkles
          const urgent = s.kind === "overdue"
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-1 last:pb-0">
              <Icon
                className={cn("h-4 w-4 shrink-0", urgent ? "text-red-600 dark:text-red-400" : s.kind === "dueSoon" ? "text-amber-600 dark:text-amber-400" : "text-primary")}
                aria-hidden="true"
              />
              <p className={cn("min-w-0 flex-1 basis-48 text-sm leading-snug text-gray-800 dark:text-gray-200", urgent && "font-medium text-red-700 dark:text-red-300")}>
                {fill(s)}
              </p>
              {renderAction(s)}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
