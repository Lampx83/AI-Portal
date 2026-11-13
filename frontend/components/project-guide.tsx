"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PROJECT_SETUP_GUIDE, STAGE_GUIDES, type StageGuide } from "@/lib/project-stage-guide"
import { useTeamText } from "@/lib/team-text"

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="ml-4 list-disc space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  )
}

/** Hướng dẫn chi tiết cho một giai đoạn: mục tiêu, các bước, sản phẩm, điều kiện sang giai đoạn sau, lỗi thường gặp, mẹo nhóm. */
export function StageGuideView({ stageId }: { stageId: string }) {
  const tt = useTeamText()
  const g: StageGuide | undefined = (STAGE_GUIDES as Record<string, StageGuide>)[stageId]
  if (!g) return null
  return (
    <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm" data-testid="stage-guide">
      <div>
        <div className="text-xs font-semibold uppercase text-primary">{tt("guide.goal")}</div>
        <p>{g.goal}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {tt("guide.duration")}: <b>{g.duration}</b>
        </p>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase text-primary">{tt("guide.steps")}</div>
        <ol className="grid gap-2">
          {g.steps.map((s, i) => (
            <li key={s.title} className="rounded-md bg-white/70 p-2 dark:bg-gray-900/50">
              <div className="font-medium">
                {i + 1}. {s.title}
              </div>
              <p className="text-gray-700 dark:text-gray-300">{s.detail}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {s.output && (
                  <span>
                    {tt("guide.output")}: {s.output}
                  </span>
                )}
                {s.who && (
                  <span>
                    {s.output ? " · " : ""}
                    {tt("guide.who")}: {s.who}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-primary">{tt("guide.outputs")}</div>
        <Bullets items={g.outputs} />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-primary">{tt("guide.doneWhen")}</div>
        <Bullets items={g.doneWhen} />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-primary">{tt("guide.mistakes")}</div>
        <Bullets items={g.mistakes} />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-primary">{tt("guide.teamTips")}</div>
        <Bullets items={g.teamTips} />
      </div>
    </div>
  )
}

/** Hộp thoại «Hướng dẫn thiết lập dự án» (tạo dự án, vai trò, đặt tên tệp, nhịp họp). */
export function ProjectSetupGuideDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const tt = useTeamText()
  const g = PROJECT_SETUP_GUIDE
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{g.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <ol className="grid gap-2">
            {g.steps.map((s, i) => (
              <li key={s.title} className="rounded-md border border-gray-200 p-2.5 dark:border-gray-700">
                <div className="font-medium">
                  {i + 1}. {s.title}
                </div>
                <p className="text-gray-700 dark:text-gray-300">{s.detail}</p>
              </li>
            ))}
          </ol>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-primary">{tt("guide.setupRoles")}</div>
            <ul className="grid gap-1.5">
              {g.roles.map((r) => (
                <li key={r.role}>
                  <b>{r.label}:</b> {r.can}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-primary">{tt("guide.setupNaming")}</div>
            <Bullets items={g.fileNaming} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-primary">{tt("guide.setupRhythm")}</div>
            <Bullets items={g.weeklyRhythm} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
