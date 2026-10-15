import { test } from "node:test"
import assert from "node:assert/strict"
import { daysBetween, noticeText, selectDueNotices, vnNow } from "../src/lib/lifecycle-due-notifier"

function project(id: string, stages: Record<string, unknown>[]) {
  return { id, name: `Dự án ${id}`, user_id: "u-" + id, lifecycle: { version: 1, stages } }
}

const TODAY = "2026-10-15"

test("chọn mốc: sắp đến hạn trong 0..3 ngày, quá hạn; bỏ giai đoạn đã xong / không có hạn / còn xa", () => {
  const p = project("p1", [
    { id: "explore", status: "done", dueDate: "2026-10-10" }, // xong → bỏ
    { id: "review", status: "doing", dueDate: "2026-10-12" }, // quá hạn 3 ngày
    { id: "design", status: "todo", dueDate: "2026-10-18" }, // còn 3 ngày → sắp đến hạn
    { id: "analyze", status: "todo", dueDate: "2026-10-19" }, // còn 4 ngày → chưa
    { id: "write", status: "doing", dueDate: "2026-10-15" }, // hôm nay → sắp đến hạn (0)
    { id: "publish", status: "todo", dueDate: null }, // không hạn
  ])
  const out = selectDueNotices([p], TODAY)
  const brief = out.map((n) => `${n.stageId}:${n.kind}:${n.days}`)
  assert.deepEqual(brief, ["review:overdue:3", "design:soon:3", "write:soon:0"])
  assert.equal(out[0].userId, "u-p1")
  assert.equal(out[0].dedupeKey, "lifecycle_due:p1:review:2026-10-12:overdue")
})

test("khoá chống trùng: cùng mốc → cùng khoá ở các lần chạy; đổi hạn → khoá mới", () => {
  const a = selectDueNotices([project("p2", [{ id: "review", status: "doing", dueDate: "2026-10-17" }])], "2026-10-15")
  const b = selectDueNotices([project("p2", [{ id: "review", status: "doing", dueDate: "2026-10-17" }])], "2026-10-16")
  assert.equal(a[0].dedupeKey, b[0].dedupeKey)
  const overdue = selectDueNotices([project("p2", [{ id: "review", status: "doing", dueDate: "2026-10-17" }])], "2026-10-18")
  assert.notEqual(overdue[0].dedupeKey, a[0].dedupeKey) // mốc «quá hạn» là mốc riêng
  const moved = selectDueNotices([project("p2", [{ id: "review", status: "doing", dueDate: "2026-10-16" }])], "2026-10-15")
  assert.notEqual(moved[0].dedupeKey, a[0].dedupeKey)
})

test("dự án chưa có vòng đời / dữ liệu hỏng → không lỗi, không thông báo", () => {
  assert.deepEqual(selectDueNotices([{ id: "x", name: "x", user_id: "u", lifecycle: null }], TODAY), [])
  assert.deepEqual(selectDueNotices([{ id: "x", name: "x", user_id: "u", lifecycle: { stages: "hỏng" } }], TODAY), [])
  assert.deepEqual(selectDueNotices([project("p3", [{ id: "review", status: "doing", dueDate: "2026-13-45" }])], TODAY), [])
})

test("nội dung thông báo tiếng Việt, ngày dd/mm/yyyy", () => {
  const [n] = selectDueNotices([project("p4", [{ id: "analyze", status: "doing", dueDate: "2026-10-10" }])], TODAY)
  const t = noticeText(n)
  assert.equal(t.title, "Giai đoạn «Phân tích» đã quá hạn")
  assert.match(t.body, /quá hạn 5 ngày \(hạn 10\/10\/2026\)/)
  const [s] = selectDueNotices([project("p5", [{ id: "analyze", status: "doing", dueDate: "2026-10-15" }])], TODAY)
  assert.match(noticeText(s).body, /\(hôm nay\)/)
})

test("giờ Việt Nam: 00:30 UTC = 07:30 cùng ngày; 18:00 UTC = 01:00 ngày hôm sau", () => {
  assert.deepEqual(vnNow(new Date("2026-10-15T00:30:00Z")), { date: "2026-10-15", hour: 7 })
  assert.deepEqual(vnNow(new Date("2026-10-15T18:00:00Z")), { date: "2026-10-16", hour: 1 })
  assert.equal(daysBetween("2026-10-15", "2026-11-01"), 17)
})
