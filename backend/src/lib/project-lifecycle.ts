/**
 * Vòng đời nghiên cứu của một dự án (6 giai đoạn) — lưu ở ai_portal.projects.lifecycle (JSONB).
 *
 * Cấu trúc:
 *   {
 *     version: 1,
 *     currentStage: 0..5,            // do server tự suy ra từ trạng thái các giai đoạn
 *     stages: [{                     // luôn đủ 6 phần tử, đúng thứ tự STAGES
 *       id, status: "todo"|"doing"|"done",
 *       startedAt, doneAt,           // ISO 8601 hoặc null
 *       dueDate,                     // YYYY-MM-DD hoặc null
 *       note,                        // <= 500 ký tự
 *       checklist: [{ text, done }]  // <= 20 mục, mỗi mục <= 200 ký tự
 *     }]
 *   }
 *
 * Dự án cũ có lifecycle = NULL → coi như 6 giai đoạn «chưa bắt đầu» (không cần backfill).
 */
import { query } from "./db"

export type StageStatus = "todo" | "doing" | "done"

export interface LifecycleStageDef {
  id: string
  name: string
  /** alias các công cụ nhúng gợi ý ở giai đoạn này */
  tools: { alias: string; name: string }[]
}

export const LIFECYCLE_STAGES: LifecycleStageDef[] = [
  { id: "explore", name: "Tìm hiểu", tools: [{ alias: "expertfinder", name: "Tìm kiếm chuyên gia" }] },
  {
    id: "review",
    name: "Tổng quan",
    tools: [
      { alias: "paperfinder", name: "Tra cứu bài báo" },
      { alias: "bibliomap", name: "Trắc lượng thư mục" },
    ],
  },
  { id: "design", name: "Thiết kế và thu thập dữ liệu", tools: [{ alias: "surveylab", name: "Thiết kế khảo sát" }] },
  {
    id: "analyze",
    name: "Phân tích",
    tools: [
      { alias: "quantis", name: "Phân tích định lượng" },
      { alias: "annota", name: "Phân tích định tính" },
    ],
  },
  {
    id: "write",
    name: "Viết và phản biện",
    tools: [
      { alias: "writium", name: "Viết nghiên cứu" },
      { alias: "paperreviewer", name: "Phản biện bài báo" },
      { alias: "plagiarismchecker", name: "Kiểm tra đạo văn" },
    ],
  },
  {
    id: "publish",
    name: "Công bố và tài trợ",
    tools: [
      { alias: "journal-conference", name: "Hội thảo tạp chí" },
      { alias: "funds", name: "Tra cứu quỹ tài trợ" },
      { alias: "regulations", name: "Quy trình, biểu mẫu" },
    ],
  },
]

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

const MAX_NOTE = 500
const MAX_CHECK_ITEMS = 20
const MAX_CHECK_TEXT = 200
const MAX_JSON_BYTES = 24 * 1024
const STATUSES: StageStatus[] = ["todo", "doing", "done"]

export class LifecycleValidationError extends Error {}

function emptyStage(id: string): LifecycleStage {
  return { id, status: "todo", startedAt: null, doneAt: null, dueDate: null, note: "", checklist: [] }
}

export function defaultLifecycle(): ProjectLifecycle {
  return { version: 1, currentStage: 0, stages: LIFECYCLE_STAGES.map((s) => emptyStage(s.id)) }
}

function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return ""
  // bỏ ký tự điều khiển (trừ xuống dòng/tab), cắt độ dài
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max)
}

function cleanIso(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function cleanDate(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null
  return v
}

/** Giai đoạn hiện tại: giai đoạn «đang thực hiện» đầu tiên; nếu không có, giai đoạn chưa xong đầu tiên; xong hết → 5. */
export function computeCurrentStage(stages: LifecycleStage[]): number {
  const doing = stages.findIndex((s) => s.status === "doing")
  if (doing >= 0) return doing
  const notDone = stages.findIndex((s) => s.status !== "done")
  return notDone >= 0 ? notDone : stages.length - 1
}

/**
 * Chuẩn hóa dữ liệu đọc từ DB (không ném lỗi): luôn trả về đủ 6 giai đoạn.
 * Dùng cho dữ liệu đã lưu; đầu vào từ client đi qua parseLifecycleInput (kiểm tra chặt).
 */
export function normalizeLifecycle(raw: unknown): ProjectLifecycle {
  const out = defaultLifecycle()
  if (!raw || typeof raw !== "object") return out
  const stagesIn = Array.isArray((raw as { stages?: unknown }).stages) ? ((raw as { stages: unknown[] }).stages) : []
  out.stages = LIFECYCLE_STAGES.map((def) => {
    const found = stagesIn.find((s) => s && typeof s === "object" && (s as { id?: unknown }).id === def.id) as
      | Record<string, unknown>
      | undefined
    const st = emptyStage(def.id)
    if (!found) return st
    st.status = STATUSES.includes(found.status as StageStatus) ? (found.status as StageStatus) : "todo"
    st.startedAt = cleanIso(found.startedAt)
    st.doneAt = cleanIso(found.doneAt)
    st.dueDate = cleanDate(found.dueDate)
    st.note = cleanText(found.note, MAX_NOTE)
    const cl = Array.isArray(found.checklist) ? found.checklist : []
    st.checklist = cl
      .slice(0, MAX_CHECK_ITEMS)
      .map((c) => {
        const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>
        return { text: cleanText(o.text, MAX_CHECK_TEXT), done: o.done === true }
      })
      .filter((c) => c.text)
    if (st.status === "todo") {
      st.startedAt = null
      st.doneAt = null
    }
    if (st.status === "doing") st.doneAt = null
    return st
  })
  out.currentStage = computeCurrentStage(out.stages)
  return out
}

/**
 * Kiểm tra chặt dữ liệu từ client. Ném LifecycleValidationError (400) nếu sai cấu trúc/quá giới hạn.
 * Trả về bản đã chuẩn hóa, tự điền startedAt/doneAt khi đổi trạng thái, và tính lại currentStage.
 */
export function parseLifecycleInput(raw: unknown, previous?: unknown): ProjectLifecycle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LifecycleValidationError("lifecycle phải là một đối tượng")
  }
  let size = 0
  try {
    size = Buffer.byteLength(JSON.stringify(raw), "utf8")
  } catch {
    throw new LifecycleValidationError("lifecycle không hợp lệ")
  }
  if (size > MAX_JSON_BYTES * 2) throw new LifecycleValidationError("lifecycle quá lớn")
  const stagesIn = (raw as { stages?: unknown }).stages
  if (!Array.isArray(stagesIn) || stagesIn.length > LIFECYCLE_STAGES.length) {
    throw new LifecycleValidationError("lifecycle.stages phải là mảng tối đa 6 giai đoạn")
  }
  const ids = new Set<string>()
  for (const s of stagesIn) {
    const o = s as { id?: unknown; status?: unknown; checklist?: unknown }
    if (!o || typeof o !== "object") throw new LifecycleValidationError("Giai đoạn không hợp lệ")
    if (typeof o.id !== "string" || !LIFECYCLE_STAGES.some((d) => d.id === o.id)) {
      throw new LifecycleValidationError("Mã giai đoạn không hợp lệ")
    }
    if (ids.has(o.id)) throw new LifecycleValidationError("Giai đoạn bị trùng")
    ids.add(o.id)
    if (o.status !== undefined && !STATUSES.includes(o.status as StageStatus)) {
      throw new LifecycleValidationError("Trạng thái giai đoạn không hợp lệ")
    }
    if (o.checklist !== undefined) {
      if (!Array.isArray(o.checklist) || o.checklist.length > MAX_CHECK_ITEMS) {
        throw new LifecycleValidationError(`Mỗi giai đoạn tối đa ${MAX_CHECK_ITEMS} việc cần làm`)
      }
    }
  }
  const next = normalizeLifecycle(raw)
  const prev = previous ? normalizeLifecycle(previous) : null
  const nowIso = new Date().toISOString()
  next.stages.forEach((st, i) => {
    const p = prev?.stages[i]
    if (st.status === "doing" && !st.startedAt) st.startedAt = p?.status === "doing" && p.startedAt ? p.startedAt : nowIso
    if (st.status === "done") {
      if (!st.startedAt) st.startedAt = p?.startedAt ?? nowIso
      if (!st.doneAt) st.doneAt = p?.status === "done" && p.doneAt ? p.doneAt : nowIso
    }
  })
  next.currentStage = computeCurrentStage(next.stages)
  if (Buffer.byteLength(JSON.stringify(next), "utf8") > MAX_JSON_BYTES) {
    throw new LifecycleValidationError("lifecycle quá lớn")
  }
  return next
}

let ensurePromise: Promise<void> | null = null

/**
 * Đảm bảo cột lifecycle tồn tại (migration 020 làm việc này lúc khởi động; hàm này là lưới an toàn
 * để không làm hỏng danh sách dự án nếu migration chưa chạy kịp). Idempotent, an toàn khi nhiều bản sao backend chạy cùng lúc.
 */
export function ensureProjectLifecycleColumn(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = query(`ALTER TABLE ai_portal.projects ADD COLUMN IF NOT EXISTS lifecycle JSONB`)
      .then(() => undefined)
      .catch(async (e) => {
        // Chạy song song có thể lỗi trùng; kiểm tra lại cột đã có chưa trước khi báo lỗi.
        try {
          const r = await query(
            `SELECT 1 FROM information_schema.columns WHERE table_schema='ai_portal' AND table_name='projects' AND column_name='lifecycle'`
          )
          if (r.rows.length > 0) return
        } catch {
          /* bỏ qua */
        }
        ensurePromise = null
        throw e
      })
  }
  return ensurePromise
}

/** Đoạn mô tả ngắn cho Central: giai đoạn hiện tại, đã hoàn thành, việc đang làm, công cụ gợi ý. Trả "" nếu chưa bắt đầu. */
export function describeLifecycleForCentral(raw: unknown): string {
  if (!raw || typeof raw !== "object") return ""
  const lc = normalizeLifecycle(raw)
  const anyProgress = lc.stages.some((s) => s.status !== "todo")
  if (!anyProgress) return ""
  const doneNames = lc.stages.map((s, i) => (s.status === "done" ? LIFECYCLE_STAGES[i].name : null)).filter(Boolean) as string[]
  const allDone = doneNames.length === LIFECYCLE_STAGES.length
  const cur = lc.currentStage
  const def = LIFECYCLE_STAGES[cur]
  const st = lc.stages[cur]
  const lines: string[] = []
  if (allDone) {
    lines.push(`- Vòng đời nghiên cứu: đã hoàn thành cả 6 giai đoạn (${doneNames.join(", ")}).`)
    return lines.join("\n")
  }
  const statusVi = st.status === "doing" ? "đang thực hiện" : "chưa bắt đầu"
  lines.push(`- Giai đoạn hiện tại: ${def.name} (${statusVi}, giai đoạn ${cur + 1}/6); đã hoàn thành: ${doneNames.length ? doneNames.join(", ") : "chưa có"}.`)
  const open = st.checklist.filter((c) => !c.done).map((c) => c.text)
  const done = st.checklist.filter((c) => c.done).map((c) => c.text)
  if (open.length) lines.push(`- Việc đang làm ở giai đoạn này: ${open.slice(0, 8).join("; ")}.`)
  if (done.length) lines.push(`- Việc đã xong ở giai đoạn này: ${done.slice(0, 8).join("; ")}.`)
  if (st.dueDate) lines.push(`- Ngày dự kiến hoàn thành giai đoạn: ${st.dueDate}.`)
  if (st.note) lines.push(`- Ghi chú giai đoạn: ${st.note.slice(0, 300)}`)
  lines.push(
    `- Công cụ phù hợp ở giai đoạn này trong hệ thống: ${def.tools.map((t) => `${t.name} (/tools/${t.alias})`).join("; ")}. ` +
      `Khi gợi ý bước tiếp theo, ưu tiên các công cụ này.`
  )
  return lines.join("\n")
}
