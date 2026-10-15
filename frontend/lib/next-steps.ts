// Gợi ý «Bước tiếp theo» cho trang chủ dự án — hàm thuần, dựa trên vòng đời nghiên cứu (giai đoạn hiện tại,
// việc chưa xong trong checklist, hạn sắp tới/quá hạn) để gợi ý 1–3 việc cụ thể kèm nút mở đúng công cụ.
import { STAGE_DEFS, computeCurrentStage, normalizeLifecycle } from "./project-lifecycle"

export type NextStepAction =
  | { type: "tool"; alias: string }
  /** mở hộp Vòng đời nghiên cứu (chủ dự án: sửa; thành viên: chỉ xem) */
  | { type: "lifecycle" }
  /** hỏi Trợ lý chính với câu điền sẵn (khoá i18n của câu hỏi) */
  | { type: "central"; promptKey: string }

export type NextStepKind =
  | "start"
  | "overdue"
  | "dueSoon"
  | "startStage"
  | "completeStage"
  | "checklist"
  | "tool"
  | "central"
  | "allDone"

export interface NextStep {
  id: string
  kind: NextStepKind
  /** khoá i18n của câu gợi ý; tham số thay vào {name}, {days}, {date}, {text} */
  titleKey: string
  params?: Record<string, string | number>
  action: NextStepAction
  /** chỉ chủ dự án mới thấy (thao tác sửa vòng đời) */
  ownerOnly?: boolean
}

export interface NextStepsOptions {
  /** hôm nay YYYY-MM-DD (giờ địa phương) */
  today: string
  isOwner: boolean
  /** alias công cụ đang có trên hệ thống; không truyền = coi như có đủ */
  availableTools?: string[]
  /** số gợi ý tối đa (mặc định 3) */
  max?: number
  /** số ngày coi là «sắp đến hạn» (mặc định 3) */
  dueSoonDays?: number
}

/** Từ khoá trong việc cần làm → công cụ phù hợp nhất. */
const TOOL_KEYWORDS: { alias: string; re: RegExp }[] = [
  { alias: "plagiarismchecker", re: /đạo văn|trùng lặp|plagiar/i },
  { alias: "paperreviewer", re: /phản biện|review/i },
  { alias: "surveylab", re: /khảo sát|bảng hỏi|phiếu hỏi|thu thập|survey|questionnaire/i },
  { alias: "annota", re: /định tính|phỏng vấn|mã hóa chủ đề|mã hoá chủ đề|qualitative|interview/i },
  { alias: "quantis", re: /định lượng|thống kê|hồi quy|kiểm định|làm sạch|phân tích dữ liệu|spss|cronbach|regression|statistic/i },
  { alias: "bibliomap", re: /bản đồ|trắc lượng|bibliometr|khoảng trống/i },
  { alias: "paperfinder", re: /bài báo|tài liệu|tổng quan|literature|paper/i },
  { alias: "funds", re: /quỹ|tài trợ|kinh phí|grant|fund/i },
  { alias: "journal-conference", re: /tạp chí|hội thảo|công bố|journal|conference/i },
  { alias: "regulations", re: /biểu mẫu|quy trình|thủ tục|hồ sơ|nghiệm thu|form/i },
  { alias: "writium", re: /viết|bản thảo|draft|manuscript/i },
  { alias: "expertfinder", re: /chuyên gia|expert/i },
]

/** Số ngày từ a đến b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

function isAvailable(alias: string, avail?: Set<string>): boolean {
  return !avail || avail.has(alias)
}

/** Công cụ hợp với một việc cần làm: theo từ khoá, nếu không thì công cụ đầu tiên của giai đoạn. */
export function toolForChecklistItem(text: string, stageIndex: number, availableTools?: string[]): string | null {
  const avail = availableTools ? new Set(availableTools) : undefined
  for (const k of TOOL_KEYWORDS) {
    if (k.re.test(text) && isAvailable(k.alias, avail)) return k.alias
  }
  const def = STAGE_DEFS[stageIndex]
  return def?.tools.find((a) => isAvailable(a, avail)) ?? null
}

export function computeNextSteps(raw: unknown, opts: NextStepsOptions): NextStep[] {
  const max = opts.max ?? 3
  const soonDays = opts.dueSoonDays ?? 3
  const avail = opts.availableTools ? new Set(opts.availableTools) : undefined
  const lc = normalizeLifecycle(raw)
  const steps: NextStep[] = []
  const usedTools = new Set<string>()
  const push = (s: NextStep) => {
    if (s.ownerOnly && !opts.isOwner) return
    if (s.action.type === "tool") {
      if (!isAvailable(s.action.alias, avail) || usedTools.has(s.action.alias)) return
      usedTools.add(s.action.alias)
    }
    if (steps.some((x) => x.id === s.id)) return
    steps.push(s)
  }
  const pushStageTools = (stageIndex: number) => {
    for (const alias of STAGE_DEFS[stageIndex]?.tools ?? []) {
      push({ id: `tool:${alias}`, kind: "tool", titleKey: `nextSteps.tool.${alias}`, action: { type: "tool", alias } })
    }
  }

  const started = lc.stages.some((s) => s.status !== "todo")
  const allDone = lc.stages.every((s) => s.status === "done")

  if (!started) {
    push({ id: "start", kind: "start", titleKey: "nextSteps.start", action: { type: "lifecycle" }, ownerOnly: true })
    push({ id: "central:questions", kind: "central", titleKey: "nextSteps.askResearchQuestion", action: { type: "central", promptKey: "nextSteps.prompt.researchQuestion" } })
    pushStageTools(0)
    pushStageTools(1)
    return steps.slice(0, max)
  }

  if (allDone) {
    push({ id: "allDone", kind: "allDone", titleKey: "nextSteps.allDone", action: { type: "tool", alias: "journal-conference" } })
    pushStageTools(STAGE_DEFS.length - 1)
    return steps.slice(0, max)
  }

  const cur = computeCurrentStage(lc.stages)
  const st = lc.stages[cur]
  const stageName = `lifecycle.stage.${STAGE_DEFS[cur].id}.name`

  // 1) Hạn của giai đoạn hiện tại (và giai đoạn khác chưa xong đã quá hạn)
  if (st.dueDate) {
    const diff = daysBetween(opts.today, st.dueDate)
    if (diff < 0) {
      push({ id: `overdue:${st.id}`, kind: "overdue", titleKey: "nextSteps.overdue", params: { stage: stageName, days: -diff, date: st.dueDate }, action: { type: "lifecycle" } })
    } else if (diff <= soonDays) {
      push({
        id: `dueSoon:${st.id}`,
        kind: "dueSoon",
        titleKey: diff === 0 ? "nextSteps.dueToday" : "nextSteps.dueSoon",
        params: { stage: stageName, days: diff, date: st.dueDate },
        action: { type: "lifecycle" },
      })
    }
  }
  lc.stages.forEach((other, i) => {
    if (i === cur || other.status === "done" || !other.dueDate) return
    const diff = daysBetween(opts.today, other.dueDate)
    if (diff < 0) {
      push({ id: `overdue:${other.id}`, kind: "overdue", titleKey: "nextSteps.overdue", params: { stage: `lifecycle.stage.${other.id}.name`, days: -diff, date: other.dueDate }, action: { type: "lifecycle" } })
    }
  })

  // 2) Chuyển giai đoạn
  if (st.status === "todo") {
    push({ id: `startStage:${st.id}`, kind: "startStage", titleKey: "nextSteps.startStage", params: { stage: stageName }, action: { type: "lifecycle" }, ownerOnly: true })
  } else if (st.status === "doing" && st.checklist.length > 0 && st.checklist.every((c) => c.done)) {
    const next = STAGE_DEFS[cur + 1]
    push({
      id: `completeStage:${st.id}`,
      kind: "completeStage",
      titleKey: next ? "nextSteps.completeStage" : "nextSteps.completeLastStage",
      params: { stage: stageName, ...(next ? { next: `lifecycle.stage.${next.id}.name` } : {}) },
      action: { type: "lifecycle" },
      ownerOnly: true,
    })
  }

  // 3) Việc chưa xong trong checklist → mở công cụ hợp nhất
  for (const item of st.checklist.filter((c) => !c.done).slice(0, 2)) {
    const alias = toolForChecklistItem(item.text, cur, opts.availableTools)
    if (!alias) continue
    const before = steps.length
    push({ id: `check:${item.text}`, kind: "checklist", titleKey: "nextSteps.continueItem", params: { text: item.text }, action: { type: "tool", alias } })
    if (steps.length === before) {
      // công cụ đã được gợi ý ở dòng khác → vẫn nhắc việc, mở vòng đời để đánh dấu xong
      push({ id: `check:${item.text}`, kind: "checklist", titleKey: "nextSteps.continueItem", params: { text: item.text }, action: { type: "lifecycle" } })
    }
  }

  // 4) Công cụ của giai đoạn hiện tại
  pushStageTools(cur)
  return steps.slice(0, max)
}
