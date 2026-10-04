// Vòng đời nghiên cứu của dự án (6 giai đoạn) — kiểu dữ liệu, giá trị mặc định và hàm tiện ích dùng ở giao diện.
// Cấu trúc khớp với backend/src/lib/project-lifecycle.ts (cột ai_portal.projects.lifecycle).
import { Search, BookOpen, ClipboardList, BarChart3, PenLine, Send, type LucideIcon } from "lucide-react"

export type StageStatus = "todo" | "doing" | "done"

export interface LifecycleChecklistItem {
  text: string
  done: boolean
}

export interface LifecycleStage {
  id: string
  status: StageStatus
  startedAt: string | null
  doneAt: string | null
  dueDate: string | null
  note: string
  checklist: LifecycleChecklistItem[]
}

export interface ProjectLifecycle {
  version: 1
  currentStage: number
  stages: LifecycleStage[]
}

export interface StageDef {
  id: string
  icon: LucideIcon
  /** alias công cụ nhúng gợi ý (mở bằng /tools/<alias>) */
  tools: string[]
  suggestionKeys: string[]
}

export const STAGE_DEFS: StageDef[] = [
  { id: "explore", icon: Search, tools: ["expertfinder"], suggestionKeys: ["sugg1", "sugg2", "sugg3"] },
  { id: "review", icon: BookOpen, tools: ["paperfinder", "bibliomap"], suggestionKeys: ["sugg1", "sugg2", "sugg3"] },
  { id: "design", icon: ClipboardList, tools: ["surveylab"], suggestionKeys: ["sugg1", "sugg2", "sugg3"] },
  { id: "analyze", icon: BarChart3, tools: ["quantis", "annota"], suggestionKeys: ["sugg1", "sugg2", "sugg3"] },
  { id: "write", icon: PenLine, tools: ["writium", "paperreviewer", "plagiarismchecker"], suggestionKeys: ["sugg1", "sugg2", "sugg3"] },
  { id: "publish", icon: Send, tools: ["journal-conference", "funds", "regulations"], suggestionKeys: ["sugg1", "sugg2", "sugg3"] },
]

export const STAGE_COUNT = STAGE_DEFS.length
export const MAX_CHECKLIST_ITEMS = 20
export const MAX_CHECKLIST_TEXT = 200
export const MAX_NOTE = 500

const STATUSES: StageStatus[] = ["todo", "doing", "done"]

function emptyStage(id: string): LifecycleStage {
  return { id, status: "todo", startedAt: null, doneAt: null, dueDate: null, note: "", checklist: [] }
}

export function defaultLifecycle(): ProjectLifecycle {
  return { version: 1, currentStage: 0, stages: STAGE_DEFS.map((d) => emptyStage(d.id)) }
}

/** Giai đoạn «đang thực hiện» đầu tiên; nếu không có, giai đoạn chưa xong đầu tiên; xong hết → giai đoạn cuối. */
export function computeCurrentStage(stages: LifecycleStage[]): number {
  const doing = stages.findIndex((s) => s.status === "doing")
  if (doing >= 0) return doing
  const notDone = stages.findIndex((s) => s.status !== "done")
  return notDone >= 0 ? notDone : stages.length - 1
}

/** Chuẩn hóa dữ liệu nhận từ API (có thể null/thiếu): luôn trả về đủ 6 giai đoạn. */
export function normalizeLifecycle(raw: unknown): ProjectLifecycle {
  const out = defaultLifecycle()
  if (!raw || typeof raw !== "object") return out
  const stagesIn = Array.isArray((raw as { stages?: unknown }).stages) ? (raw as { stages: unknown[] }).stages : []
  out.stages = STAGE_DEFS.map((def) => {
    const found = stagesIn.find((s) => s && typeof s === "object" && (s as { id?: unknown }).id === def.id) as
      | Record<string, unknown>
      | undefined
    const st = emptyStage(def.id)
    if (!found) return st
    st.status = STATUSES.includes(found.status as StageStatus) ? (found.status as StageStatus) : "todo"
    st.startedAt = typeof found.startedAt === "string" ? found.startedAt : null
    st.doneAt = typeof found.doneAt === "string" ? found.doneAt : null
    st.dueDate = typeof found.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(found.dueDate) ? found.dueDate : null
    st.note = typeof found.note === "string" ? found.note.slice(0, MAX_NOTE) : ""
    st.checklist = (Array.isArray(found.checklist) ? found.checklist : [])
      .slice(0, MAX_CHECKLIST_ITEMS)
      .map((c) => {
        const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>
        return { text: typeof o.text === "string" ? o.text.slice(0, MAX_CHECKLIST_TEXT) : "", done: o.done === true }
      })
      .filter((c) => c.text.trim())
    return st
  })
  out.currentStage = computeCurrentStage(out.stages)
  return out
}

export interface LifecycleSummary {
  doneCount: number
  /** có ít nhất một giai đoạn đã/đang thực hiện */
  started: boolean
  allDone: boolean
  /** chỉ số giai đoạn hiện tại (0..5) */
  currentIndex: number
  currentStatus: StageStatus
}

export function summarizeLifecycle(raw: unknown): LifecycleSummary {
  const lc = normalizeLifecycle(raw)
  const doneCount = lc.stages.filter((s) => s.status === "done").length
  const currentIndex = computeCurrentStage(lc.stages)
  return {
    doneCount,
    started: lc.stages.some((s) => s.status !== "todo"),
    allDone: doneCount === STAGE_COUNT,
    currentIndex,
    currentStatus: lc.stages[currentIndex].status,
  }
}

/** Ngày dạng YYYY-MM-DD của hôm nay theo giờ địa phương. */
export function todayIsoDate(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

/** Định dạng ngày dd/MM/yyyy từ YYYY-MM-DD (không đổi múi giờ). */
export function formatDueDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ""
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

/** Đổi trạng thái một giai đoạn và tự điền mốc thời gian. */
export function withStageStatus(stage: LifecycleStage, status: StageStatus): LifecycleStage {
  const now = new Date().toISOString()
  const next: LifecycleStage = { ...stage, status }
  if (status === "todo") {
    next.startedAt = null
    next.doneAt = null
  } else if (status === "doing") {
    next.startedAt = stage.startedAt ?? now
    next.doneAt = null
  } else {
    next.startedAt = stage.startedAt ?? now
    next.doneAt = now
  }
  return next
}

export function lifecycleEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeLifecycle(a)) === JSON.stringify(normalizeLifecycle(b))
}
