/**
 * Thông báo hạn giai đoạn vòng đời nghiên cứu (tác vụ nền, KHÔNG gửi email).
 *
 * Mỗi giờ kiểm tra một lần, chỉ tạo thông báo từ 07:00 giờ Việt Nam trở đi (để người dùng nhận vào đầu ngày):
 *   - «sắp đến hạn»: giai đoạn chưa hoàn thành có dueDate trong 0..3 ngày tới;
 *   - «quá hạn»: giai đoạn chưa hoàn thành có dueDate đã qua.
 * Mỗi (dự án, giai đoạn, ngày hạn, loại mốc) tối đa 1 thông báo — khoá payload.dedupe_key + chỉ mục UNIQUE
 * (migration 021) và INSERT … ON CONFLICT DO NOTHING; nhiều bản sao backend chạy cùng lúc dùng khoá advisory.
 * Đổi ngày hạn → mốc mới → có thể nhận thông báo mới (đúng ý: hạn mới).
 *
 * Tắt: app_settings.lifecycle_due_notifications_enabled = 'false' hoặc biến môi trường LIFECYCLE_DUE_NOTIFY=off.
 * Người nhận: chủ dự án (projects.user_id).
 */
import { query, withTransaction } from "./db"
import { LIFECYCLE_STAGES, normalizeLifecycle } from "./project-lifecycle"
import { getBootstrapEnv } from "./settings"

export const NOTIFICATION_TYPE = "lifecycle_due"
export const DUE_SOON_DAYS = 3
/** Giờ (giờ Việt Nam) bắt đầu gửi thông báo trong ngày. */
export const NOTIFY_FROM_HOUR_VN = 7
const CHECK_INTERVAL_MS = 60 * 60 * 1000
const ADVISORY_LOCK_KEY = 2026101501

export type DueKind = "soon" | "overdue"

export interface DueNotice {
  userId: string
  projectId: string
  projectName: string
  stageId: string
  stageName: string
  dueDate: string
  kind: DueKind
  /** số ngày còn lại (soon, ≥ 0) hoặc số ngày đã quá (overdue, > 0) */
  days: number
  dedupeKey: string
}

export interface ProjectRowForDue {
  id: string
  name: string
  user_id: string
  lifecycle: unknown
}

/** Số ngày giữa hai ngày YYYY-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Ngày + giờ hiện tại theo giờ Việt Nam. */
export function vnNow(now: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 }
}

export function dueDedupeKey(projectId: string, stageId: string, dueDate: string, kind: DueKind): string {
  return `${NOTIFICATION_TYPE}:${projectId}:${stageId}:${dueDate}:${kind}`
}

/** Chọn các mốc cần thông báo hôm nay (hàm thuần). Giai đoạn đã hoàn thành hoặc không có ngày hạn thì bỏ qua. */
export function selectDueNotices(projects: ProjectRowForDue[], today: string, windowDays: number = DUE_SOON_DAYS): DueNotice[] {
  const out: DueNotice[] = []
  for (const p of projects) {
    if (!p?.id || !p.user_id || !p.lifecycle) continue
    const lc = normalizeLifecycle(p.lifecycle)
    lc.stages.forEach((st, i) => {
      if (st.status === "done" || !st.dueDate) return
      const diff = daysBetween(today, st.dueDate)
      let kind: DueKind | null = null
      if (diff < 0) kind = "overdue"
      else if (diff <= windowDays) kind = "soon"
      if (!kind) return
      out.push({
        userId: p.user_id,
        projectId: p.id,
        projectName: p.name || "",
        stageId: st.id,
        stageName: LIFECYCLE_STAGES[i]?.name ?? st.id,
        dueDate: st.dueDate,
        kind,
        days: Math.abs(diff),
        dedupeKey: dueDedupeKey(p.id, st.id, st.dueDate, kind),
      })
    })
  }
  return out
}

function viDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

/** Tiêu đề + nội dung tiếng Việt (giao diện dịch lại theo payload khi người dùng chọn ngôn ngữ khác). */
export function noticeText(n: DueNotice): { title: string; body: string } {
  const proj = n.projectName ? `Dự án «${n.projectName}»: ` : ""
  if (n.kind === "soon") {
    const when = n.days === 0 ? "hôm nay" : `còn ${n.days} ngày`
    return {
      title: `Giai đoạn «${n.stageName}» sắp đến hạn`,
      body: `${proj}giai đoạn «${n.stageName}» đến hạn ngày ${viDate(n.dueDate)} (${when}). Cập nhật tiến độ hoặc dời hạn trong Vòng đời nghiên cứu.`,
    }
  }
  return {
    title: `Giai đoạn «${n.stageName}» đã quá hạn`,
    body: `${proj}giai đoạn «${n.stageName}» đã quá hạn ${n.days} ngày (hạn ${viDate(n.dueDate)}) mà chưa hoàn thành. Cập nhật tiến độ hoặc đặt hạn mới trong Vòng đời nghiên cứu.`,
  }
}

let ensureIndexPromise: Promise<void> | null = null
/** Lưới an toàn khi migration 021 chưa chạy: chỉ mục UNIQUE chống trùng thông báo. */
function ensureDedupeIndex(): Promise<void> {
  if (!ensureIndexPromise) {
    ensureIndexPromise = query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_lifecycle_due
         ON ai_portal.notifications ((payload->>'dedupe_key')) WHERE type = 'lifecycle_due'`
    )
      .then(() => undefined)
      .catch((e) => {
        ensureIndexPromise = null
        throw e
      })
  }
  return ensureIndexPromise
}

async function isEnabled(): Promise<boolean> {
  const env = getBootstrapEnv("LIFECYCLE_DUE_NOTIFY", "").trim().toLowerCase()
  if (env === "off" || env === "false" || env === "0") return false
  try {
    const r = await query<{ value: string }>(
      `SELECT value FROM ai_portal.app_settings WHERE key = 'lifecycle_due_notifications_enabled' LIMIT 1`
    )
    const v = String(r.rows[0]?.value ?? "").trim().toLowerCase()
    return !(v === "false" || v === "0" || v === "off")
  } catch {
    return false
  }
}

/** Chạy một lượt kiểm tra. Trả số thông báo đã tạo (hoặc null nếu bỏ qua). */
export async function runLifecycleDueCheck(now: Date = new Date()): Promise<number | null> {
  if (!(await isEnabled())) return null
  const vn = vnNow(now)
  if (vn.hour < NOTIFY_FROM_HOUR_VN) return null
  await ensureDedupeIndex()
  return withTransaction(async (client) => {
    const lock: { rows: { ok: boolean }[] } = await client.query(`SELECT pg_try_advisory_xact_lock($1) AS ok`, [ADVISORY_LOCK_KEY])
    if (!lock.rows[0]?.ok) return null // bản sao backend khác đang chạy
    const r: { rows: ProjectRowForDue[] } = await client.query(
      `SELECT p.id::text AS id, p.name, p.user_id::text AS user_id, p.lifecycle
         FROM ai_portal.projects p
        WHERE p.lifecycle IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(p.lifecycle->'stages', '[]'::jsonb)) s
             WHERE COALESCE(s->>'dueDate', '') <> '' AND COALESCE(s->>'status', 'todo') <> 'done'
          )`
    )
    const notices = selectDueNotices(r.rows, vn.date)
    let created = 0
    for (const n of notices) {
      const { title, body } = noticeText(n)
      const payload = {
        dedupe_key: n.dedupeKey,
        kind: n.kind,
        project_id: n.projectId,
        project_name: n.projectName,
        stage_id: n.stageId,
        due_date: n.dueDate,
        days: n.days,
      }
      const ins: { rowCount: number | null } = await client.query(
        `INSERT INTO ai_portal.notifications (user_id, type, title, body, payload)
         VALUES ($1::uuid, $2, $3, $4, $5::jsonb)
         ON CONFLICT ((payload->>'dedupe_key')) WHERE type = 'lifecycle_due' DO NOTHING`,
        [n.userId, NOTIFICATION_TYPE, title, body, JSON.stringify(payload)]
      )
      created += ins.rowCount ?? 0
    }
    if (created > 0) console.log(`[lifecycle-due] đã tạo ${created} thông báo hạn giai đoạn`)
    return created
  })
}

let timer: ReturnType<typeof setInterval> | null = null

/** Khởi động tác vụ nền (gọi một lần khi server lắng nghe). */
export function startLifecycleDueNotifier(): void {
  if (timer) return
  const tick = () => {
    runLifecycleDueCheck().catch((e) => console.warn("[lifecycle-due] lỗi:", e?.message ?? e))
  }
  const first = setTimeout(tick, 90_000)
  first.unref?.()
  timer = setInterval(tick, CHECK_INTERVAL_MS)
  timer.unref?.()
}
