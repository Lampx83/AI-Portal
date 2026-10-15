import { test } from "node:test"
import assert from "node:assert/strict"
import { addDays, listDays, parseDateRange, vnDateOf, vnHourOf } from "../time"
import {
  aggregateLikert,
  computeNextDayRetention,
  countActiveByDay,
  errorRate,
  isLikertQuestion,
  type SurveyQuestionRow,
} from "../usage-stats"

test("vnDateOf / vnHourOf dùng giờ Việt Nam (UTC+7)", () => {
  // 2026-10-14T18:30Z = 01:30 ngày 15/10 giờ VN
  const d = new Date("2026-10-14T18:30:00Z")
  assert.equal(vnDateOf(d), "2026-10-15")
  assert.equal(vnHourOf(d), 1)
  assert.equal(vnDateOf(new Date("2026-10-14T16:59:59Z")), "2026-10-14")
})

test("parseDateRange: mặc định 7 ngày tính cả hôm nay", () => {
  const r = parseDateRange({}, "2026-10-15")
  assert.deepEqual(r, { from: "2026-10-09", to: "2026-10-15", days: 7 })
})

test("parseDateRange: from/to, đảo chiều, chặn tương lai, chặn tối đa", () => {
  assert.deepEqual(parseDateRange({ from: "2026-10-01", to: "2026-10-03" }, "2026-10-15"), { from: "2026-10-01", to: "2026-10-03", days: 3 })
  assert.deepEqual(parseDateRange({ from: "2026-10-03", to: "2026-10-01" }, "2026-10-15"), { from: "2026-10-01", to: "2026-10-03", days: 3 })
  assert.equal(parseDateRange({ to: "2027-01-01" }, "2026-10-15").to, "2026-10-15")
  assert.equal(parseDateRange({ from: "2020-01-01", to: "2026-10-15" }, "2026-10-15").days, 366)
  assert.equal(parseDateRange({ days: "30" }, "2026-10-15").from, "2026-09-16")
  assert.equal(parseDateRange({ days: "abc", from: "2026-13-40" }, "2026-10-15").days, 7)
  // from ở tương lai → co về hôm nay
  assert.deepEqual(parseDateRange({ from: "2027-01-05", to: "2027-01-01" }, "2026-10-15"), { from: "2026-10-15", to: "2026-10-15", days: 1 })
})

test("listDays / addDays qua ranh giới tháng", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01")
  assert.deepEqual(listDays("2026-09-29", "2026-10-02"), ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"])
})

test("computeNextDayRetention: chỉ tính ngày có ngày hôm sau đã trọn", () => {
  const pairs = [
    { k: "a", d: "2026-10-10" },
    { k: "b", d: "2026-10-10" },
    { k: "c", d: "2026-10-10" },
    { k: "a", d: "2026-10-11" }, // a quay lại
    { k: "c", d: "2026-10-11" }, // c quay lại
    { k: "d", d: "2026-10-11" },
    { k: "d", d: "2026-10-12" }, // d quay lại (nhưng 12 là "hôm nay" → 11 không được xét)
  ]
  const r = computeNextDayRetention(pairs, "2026-10-10", "2026-10-12", "2026-10-12")
  assert.equal(r.cohort, 3)
  assert.equal(r.returned, 2)
  assert.ok(Math.abs((r.rate ?? 0) - 2 / 3) < 1e-9)
  assert.equal(r.series[0].rate, 2 / 3)
  assert.equal(r.series[1].rate, null) // 11 → 12 = hôm nay, chưa trọn
  assert.equal(r.series[2].rate, null)
})

test("computeNextDayRetention: không có dữ liệu → rate null", () => {
  const r = computeNextDayRetention([], "2026-10-01", "2026-10-03", "2026-10-15")
  assert.equal(r.rate, null)
  assert.equal(r.cohort, 0)
  assert.equal(r.series.length, 3)
})

test("countActiveByDay: đếm khoá khác nhau, bỏ ngày ngoài khoảng", () => {
  const { perDay, distinct } = countActiveByDay(
    [
      { k: "a", d: "2026-10-10" },
      { k: "a", d: "2026-10-10" },
      { k: "b", d: "2026-10-10" },
      { k: "a", d: "2026-10-11" },
      { k: "z", d: "2026-10-12" }, // ngoài khoảng
    ],
    "2026-10-10",
    "2026-10-11"
  )
  assert.equal(perDay.get("2026-10-10"), 2)
  assert.equal(perDay.get("2026-10-11"), 1)
  assert.equal(perDay.get("2026-10-12"), undefined)
  assert.equal(distinct, 2)
})

const opts = (ids: string[]) => ids.map((id) => ({ id, label: id }))

test("isLikertQuestion: nhận đúng câu 1–5, kể cả thứ tự đảo", () => {
  assert.equal(isLikertQuestion({ type: "single_choice", options: opts(["1", "2", "3", "4", "5"]) }), true)
  assert.equal(isLikertQuestion({ type: "single_choice", options: opts(["5", "4", "3", "2", "1"]) }), true)
  assert.equal(isLikertQuestion({ type: "multi_choice", options: opts(["1", "2", "3", "4", "5"]) }), false)
  assert.equal(isLikertQuestion({ type: "single_choice", options: opts(["gv", "sv"]) }), false)
  assert.equal(isLikertQuestion({ type: "single_choice", options: opts(["1", "2", "3", "4", "5", "6"]) }), false)
  // phương án "Tôi chưa sử dụng" (na) được phép, không tính điểm
  assert.equal(isLikertQuestion({ type: "single_choice", options: opts(["1", "2", "3", "4", "5", "na"]) }), true)
  assert.equal(isLikertQuestion({ type: "single_choice", options: opts(["1", "2", "3", "4"]) }), false)
})

test("aggregateLikert: trung bình + phân bố, bỏ câu trả lời không hợp lệ", () => {
  const qs: SurveyQuestionRow[] = [
    { id: "q1", survey_id: "s", title: "Hữu ích", type: "single_choice", order_index: 2, options: opts(["1", "2", "3", "4", "5"]) },
    { id: "q0", survey_id: "s", title: "Đối tượng", type: "single_choice", order_index: 0, options: opts(["gv", "sv"]) },
  ]
  const answers = [{ q1: { option: "5" }, q0: { option: "sv" } }, { q1: { option: "4" } }, { q1: { option: "na" } }, { q1: "3" }, null, {}]
  const r = aggregateLikert(qs, answers)
  assert.equal(r.length, 1)
  assert.equal(r[0].n, 3)
  assert.equal(r[0].avg, 4)
  assert.deepEqual(r[0].dist, [0, 0, 1, 1, 1])
})

test("errorRate", () => {
  assert.equal(errorRate(0, 0, 0), null)
  assert.equal(errorRate(10, 1, 1), 0.2)
  assert.equal(errorRate(2, 5, 0), 1) // chặn trên 100%
})
