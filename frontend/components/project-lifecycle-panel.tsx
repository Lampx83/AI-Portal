"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Check, ExternalLink, Plus, X, CalendarDays, AlertTriangle, ListChecks, Wrench, Lightbulb, StickyNote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/contexts/language-context"
import { fetchToolConfigs } from "@/lib/api/tools-api"
import {
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_TEXT,
  MAX_NOTE,
  STAGE_COUNT,
  STAGE_DEFS,
  computeCurrentStage,
  formatDueDate,
  todayIsoDate,
  withStageStatus,
  type LifecycleStage,
  type ProjectLifecycle,
  type StageStatus,
} from "@/lib/project-lifecycle"
import { cn } from "@/lib/utils"

const STATUS_ORDER: StageStatus[] = ["todo", "doing", "done"]

/** Màu theo trạng thái (sáng/tối). */
const NODE_TONE: Record<StageStatus, string> = {
  todo: "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-500",
  doing: "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30",
  done: "border-emerald-500 bg-emerald-500 text-white",
}
const STATUS_TEXT: Record<StageStatus, string> = {
  todo: "text-gray-500 dark:text-gray-400",
  doing: "text-primary",
  done: "text-emerald-600 dark:text-emerald-400",
}

interface ProjectLifecyclePanelProps {
  value: ProjectLifecycle
  onChange: (next: ProjectLifecycle) => void
  /** Thành viên được chia sẻ chỉ xem, không sửa */
  readOnly?: boolean
  /** Mở công cụ theo alias (cha lo lưu dữ liệu/đóng hộp thoại trước khi chuyển trang) */
  onOpenTool: (alias: string) => void
}

export function ProjectLifecyclePanel({ value, onChange, readOnly = false, onOpenTool }: ProjectLifecyclePanelProps) {
  const { t, toolNames } = useLanguage()
  const [selected, setSelected] = useState<number>(() => computeCurrentStage(value.stages))
  const [newItem, setNewItem] = useState("")
  const [available, setAvailable] = useState<Set<string> | null>(null)
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Chỉ gợi ý công cụ có thật trên hệ thống này; nếu không tải được danh sách thì hiện tất cả.
  useEffect(() => {
    let cancelled = false
    fetchToolConfigs()
      .then((list) => {
        if (!cancelled && Array.isArray(list) && list.length > 0) setAvailable(new Set(list.map((x) => x.alias)))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const doneCount = value.stages.filter((s) => s.status === "done").length
  const percent = Math.round((doneCount / STAGE_COUNT) * 100)
  const def = STAGE_DEFS[selected]
  const stage = value.stages[selected]
  const stageName = t(`lifecycle.stage.${def.id}.name`)
  const today = todayIsoDate()
  const overdue = !!stage.dueDate && stage.status !== "done" && stage.dueDate < today

  const updateStage = (idx: number, patch: (s: LifecycleStage) => LifecycleStage) => {
    if (readOnly) return
    const stages = value.stages.map((s, i) => (i === idx ? patch(s) : s))
    onChange({ ...value, stages, currentStage: computeCurrentStage(stages) })
  }

  const toolsForStage = useMemo(
    () => def.tools.filter((alias) => available === null || available.has(alias)),
    [def, available]
  )

  const toolLabel = (alias: string) => toolNames[alias] ?? t(`lifecycle.tool.${alias}`)

  const addChecklistItem = (text: string) => {
    const clean = text.trim().slice(0, MAX_CHECKLIST_TEXT)
    if (!clean || stage.checklist.length >= MAX_CHECKLIST_ITEMS) return
    if (stage.checklist.some((c) => c.text.toLowerCase() === clean.toLowerCase())) return
    updateStage(selected, (s) => ({ ...s, checklist: [...s.checklist, { text: clean, done: false }] }))
  }

  const suggestions = def.suggestionKeys
    .map((k) => t(`lifecycle.stage.${def.id}.${k}`))
    .filter((txt) => !stage.checklist.some((c) => c.text.toLowerCase() === txt.toLowerCase()))

  const onRadioKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (readOnly) return
    let next = -1
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % STATUS_ORDER.length
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i + STATUS_ORDER.length - 1) % STATUS_ORDER.length
    if (next >= 0) {
      e.preventDefault()
      updateStage(selected, (s) => withStageStatus(s, STATUS_ORDER[next]))
      radioRefs.current[next]?.focus()
    }
  }

  return (
    <div className="grid gap-4" data-testid="project-lifecycle-panel">
      {/* Tiêu đề + tiến độ tổng */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t("lifecycle.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("lifecycle.subtitle")}</p>
          </div>
          <span className="text-sm font-semibold text-primary tabular-nums" data-testid="lifecycle-progress-text">
            {t("lifecycle.progress").replace("{done}", String(doneCount))}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t("lifecycle.progressAria")}
          aria-valuemin={0}
          aria-valuemax={STAGE_COUNT}
          aria-valuenow={doneCount}
          aria-valuetext={t("lifecycle.progress").replace("{done}", String(doneCount))}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {readOnly && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {t("lifecycle.readOnly")}
        </p>
      )}

      {/* Stepper 6 giai đoạn */}
      <ol
        aria-label={t("lifecycle.stepperAria")}
        className="grid grid-cols-3 gap-y-3 sm:grid-cols-6 sm:gap-y-0"
      >
        {STAGE_DEFS.map((d, i) => {
          const st = value.stages[i]
          const Icon = d.icon
          const isSel = i === selected
          const isCurrent = i === value.currentStage && !(doneCount === STAGE_COUNT)
          const name = t(`lifecycle.stage.${d.id}.name`)
          const statusText = t(`lifecycle.status.${st.status}`)
          return (
            <li key={d.id} className="relative flex justify-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-5 right-1/2 hidden h-0.5 w-full -translate-y-1/2 sm:block",
                    value.stages[i - 1].status === "done" ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={isSel}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={t("lifecycle.stageAria")
                  .replace("{n}", String(i + 1))
                  .replace("{name}", name)
                  .replace("{status}", statusText)}
                data-testid={`lifecycle-step-${d.id}`}
                className={cn(
                  "group relative z-10 flex w-full max-w-[120px] flex-col items-center gap-1 rounded-lg px-1 pb-1.5 pt-0.5 text-center transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                  isSel ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    NODE_TONE[st.status],
                    isSel && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                  )}
                >
                  {st.status === "done" ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" />}
                </span>
                <span className={cn("text-xs font-semibold leading-tight", isSel ? "text-primary" : "text-gray-800 dark:text-gray-200")}>
                  {t(`lifecycle.stage.${d.id}.short`)}
                </span>
                <span className={cn("text-[10px] leading-tight", STATUS_TEXT[st.status])}>{statusText}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Chi tiết giai đoạn đang chọn */}
      <section
        aria-label={stageName}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/60"
        data-testid="lifecycle-stage-detail"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {selected + 1}. {stageName}
            </h4>
            <p className="text-xs text-muted-foreground">{t(`lifecycle.stage.${def.id}.desc`)}</p>
          </div>
          <div
            role="radiogroup"
            aria-label={t("lifecycle.statusLabel")}
            className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800"
          >
            {STATUS_ORDER.map((s, i) => {
              const checked = stage.status === s
              return (
                <button
                  key={s}
                  ref={(el) => {
                    radioRefs.current[i] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  disabled={readOnly}
                  onClick={() => updateStage(selected, (st) => withStageStatus(st, s))}
                  onKeyDown={(e) => onRadioKey(e, i)}
                  data-testid={`lifecycle-status-${s}`}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                    checked
                      ? s === "done"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : s === "doing"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                      : "text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-700/60"
                  )}
                >
                  {t(`lifecycle.status.${s}`)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Cột trái: ngày dự kiến + ghi chú */}
          <div className="grid content-start gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lifecycle-due" className="flex items-center gap-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {t("lifecycle.dueDate")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="lifecycle-due"
                  type="date"
                  value={stage.dueDate ?? ""}
                  disabled={readOnly}
                  onChange={(e) => updateStage(selected, (s) => ({ ...s, dueDate: e.target.value || null }))}
                  aria-label={t("lifecycle.dueDateAria").replace("{name}", stageName)}
                  className="h-9 w-44"
                />
                {overdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {t("lifecycle.overdue")} ({formatDueDate(stage.dueDate)})
                  </span>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lifecycle-note" className="flex items-center gap-1.5 text-xs">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {t("lifecycle.note")}
              </Label>
              <Textarea
                id="lifecycle-note"
                value={stage.note}
                disabled={readOnly}
                maxLength={MAX_NOTE}
                rows={3}
                placeholder={t("lifecycle.notePlaceholder")}
                aria-label={t("lifecycle.noteAria").replace("{name}", stageName)}
                onChange={(e) => updateStage(selected, (s) => ({ ...s, note: e.target.value }))}
                className="min-h-[72px] resize-none text-sm"
              />
            </div>
          </div>

          {/* Cột phải: checklist + gợi ý */}
          <div className="grid content-start gap-2">
            <Label className="flex items-center gap-1.5 text-xs">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {t("lifecycle.checklist")}
              {stage.checklist.length > 0 && (
                <span className="text-muted-foreground tabular-nums">
                  ({stage.checklist.filter((c) => c.done).length}/{stage.checklist.length})
                </span>
              )}
            </Label>
            {stage.checklist.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-muted-foreground dark:border-gray-600">
                {t("lifecycle.checklistEmpty")}
              </p>
            ) : (
              <ul className="grid gap-1">
                {stage.checklist.map((c, ci) => (
                  <li
                    key={`${ci}-${c.text}`}
                    className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <input
                      type="checkbox"
                      checked={c.done}
                      disabled={readOnly}
                      onChange={() =>
                        updateStage(selected, (s) => ({
                          ...s,
                          checklist: s.checklist.map((x, k) => (k === ci ? { ...x, done: !x.done } : x)),
                        }))
                      }
                      aria-label={t("lifecycle.checkAria").replace("{name}", c.text)}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-emerald-600 disabled:cursor-not-allowed"
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 break-words text-sm",
                        c.done ? "text-muted-foreground line-through" : "text-gray-800 dark:text-gray-200"
                      )}
                    >
                      {c.text}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStage(selected, (s) => ({ ...s, checklist: s.checklist.filter((_, k) => k !== ci) }))
                        }
                        aria-label={t("lifecycle.removeItem").replace("{name}", c.text)}
                        className="rounded p-0.5 text-gray-400 opacity-60 hover:bg-gray-200 hover:text-gray-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!readOnly && (
              <div className="flex items-center gap-2">
                <Input
                  value={newItem}
                  maxLength={MAX_CHECKLIST_TEXT}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addChecklistItem(newItem)
                      setNewItem("")
                    }
                  }}
                  placeholder={t("lifecycle.addItemPlaceholder")}
                  aria-label={t("lifecycle.addItemAria")}
                  className="h-8 text-sm"
                  disabled={stage.checklist.length >= MAX_CHECKLIST_ITEMS}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={!newItem.trim() || stage.checklist.length >= MAX_CHECKLIST_ITEMS}
                  onClick={() => {
                    addChecklistItem(newItem)
                    setNewItem("")
                  }}
                >
                  {t("lifecycle.addItem")}
                </Button>
              </div>
            )}
            {!readOnly && suggestions.length > 0 && stage.checklist.length < MAX_CHECKLIST_ITEMS && (
              <div className="grid gap-1">
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Lightbulb className="h-3 w-3" aria-hidden="true" />
                  {t("lifecycle.suggestions")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((txt) => (
                    <button
                      key={txt}
                      type="button"
                      onClick={() => addChecklistItem(txt)}
                      data-testid="lifecycle-suggestion"
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      {txt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Công cụ gợi ý */}
        {toolsForStage.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="mb-2 flex items-center gap-1.5 text-xs font-medium">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {t("lifecycle.tools")}
            </span>
            <div className="flex flex-wrap gap-2">
              {toolsForStage.map((alias) => (
                <div
                  key={alias}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-1 pl-3 pr-1 dark:border-gray-700 dark:bg-gray-800/60"
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{toolLabel(alias)}</span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 gap-1 px-2.5 text-xs"
                    onClick={() => onOpenTool(alias)}
                    aria-label={t("lifecycle.openToolAria").replace("{name}", toolLabel(alias))}
                    data-testid={`lifecycle-open-tool-${alias}`}
                  >
                    {t("lifecycle.openTool")}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
