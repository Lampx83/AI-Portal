import { test } from "node:test"
import assert from "node:assert/strict"
import { compareRuns, findNumericClaims, gradeCase, normalizeText, summarizeGrades } from "../regression-grader"
import { REGRESSION_CASES, type RegressionCase } from "../regression-cases"

const ok = (answer: string, functionsCalled: string[] = [], latencyMs = 1000) => ({ ok: true, answer, functionsCalled, latencyMs })

test("bộ câu hỏi: ~50 câu, id duy nhất, regex hợp lệ, đủ các nhóm", () => {
  assert.ok(REGRESSION_CASES.length >= 45 && REGRESSION_CASES.length <= 60, `có ${REGRESSION_CASES.length} câu`)
  const ids = new Set(REGRESSION_CASES.map((c) => c.id))
  assert.equal(ids.size, REGRESSION_CASES.length)
  for (const c of REGRESSION_CASES) {
    for (const re of c.expect.notMatch ?? []) assert.doesNotThrow(() => new RegExp(re, "i"), `${c.id}: ${re}`)
    assert.ok(c.question.trim().length > 5)
    // Không chứa email/số điện thoại (không có thông tin cá nhân trong câu hỏi)
    assert.ok(!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(c.question), c.id)
    assert.ok(!/\b0\d{9}\b/.test(c.question), c.id)
  }
  const cats = new Set(REGRESSION_CASES.map((c) => c.category))
  for (const need of ["regulations", "funds", "journals", "conferences", "papers", "experts", "methods", "out_of_scope", "numbers"]) {
    assert.ok(cats.has(need as any), `thiếu nhóm ${need}`)
  }
})

test("normalizeText bỏ dấu tiếng Việt", () => {
  assert.equal(normalizeText("  Định   LƯỢNG đồng "), "dinh luong dong")
})

test("findNumericClaims: bắt tiền, %, ngày, chỉ số; bỏ qua năm và Q1", () => {
  assert.deepEqual(findNumericClaims("Năm 2026, tạp chí xếp hạng Q1."), [])
  assert.ok(findNumericClaims("Tài trợ tối đa 500 triệu đồng").length > 0)
  assert.ok(findNumericClaims("Mức hỗ trợ 20.000 USD").length > 0)
  assert.ok(findNumericClaims("Tỷ lệ chấp nhận khoảng 8%").length > 0)
  assert.ok(findNumericClaims("Hạn nộp: 15/11/2026").length > 0)
  assert.ok(findNumericClaims("Hạn nộp ngày 15 tháng 11").length > 0)
  assert.ok(findNumericClaims("Impact factor: 7,55").length > 0)
  assert.ok(findNumericClaims("H-index là 250").length > 0)
  // không nhầm "dòng", "đồng ý", "ngân hàng", "tỷ lệ"
  assert.deepEqual(findNumericClaims("Xem 1 dòng gợi ý; bước 2 đồng ý; 5 ngân hàng; có 2 tỷ lệ khác nhau"), [])
})

const caseOf = (expect: RegressionCase["expect"], id = "t-1"): RegressionCase => ({ id, category: "funds", question: "?", expect })

test("gradeCase: đạt khi gọi đúng hàm và chứa cụm cần có", () => {
  const g = gradeCase(caseOf({ callAny: ["funds/search_funds"], containsAny: ["/tools/funds"] }), ok("Một số quỹ tiêu biểu... Xem thêm tại [Funds](/tools/funds).", ["funds/search_funds"]))
  assert.equal(g.passed, true)
  assert.equal(g.score, 100)
})

test("gradeCase: trượt khi không gọi hàm bắt buộc", () => {
  const g = gradeCase(caseOf({ callAny: ["funds/search_funds"] }), ok("Theo tôi biết có quỹ NAFOSTED tài trợ nhiều lĩnh vực."))
  assert.equal(g.passed, false)
  const c = g.checks.find((x) => x.name === "callAny")!
  assert.equal(c.passed, false)
  assert.ok(g.score > 0 && g.score < 100)
})

test("gradeCase: số liệu không nguồn khi không gọi hàm → trượt; có gọi hàm → không xét", () => {
  const e = { noNumbersWithoutTool: true }
  assert.equal(gradeCase(caseOf(e), ok("Quỹ này cấp tối đa 2 tỷ đồng cho mỗi đề tài.")).passed, false)
  assert.equal(gradeCase(caseOf(e), ok("Quỹ này cấp tối đa 2 tỷ đồng cho mỗi đề tài.", ["funds/search_funds"])).passed, true)
  assert.equal(gradeCase(caseOf(e), ok("Tôi chưa có dữ liệu về mức tài trợ; hãy mở công cụ Funds.")).passed, true)
})

test("gradeCase: noCall, containsAll, notMatch, maxChars, maxMs, CJK", () => {
  assert.equal(gradeCase(caseOf({ noCall: true }), ok("Câu hỏi nằm ngoài phạm vi hỗ trợ.", ["funds/search_funds"])).passed, false)
  assert.equal(gradeCase(caseOf({ containsAll: ["định tính", "định lượng"] }), ok("Nghiên cứu dinh tinh và định lượng khác nhau ở...")).passed, true)
  assert.equal(gradeCase(caseOf({ notMatch: ["\\d+\\s*%"] }), ok("Tỷ lệ chấp nhận khoảng 10 % mỗi năm theo thống kê.")).passed, false)
  assert.equal(gradeCase(caseOf({ maxChars: 30 }), ok("x".repeat(31))).passed, false)
  assert.equal(gradeCase(caseOf({ maxMs: 500 }), ok("Câu trả lời đủ dài để hợp lệ.", [], 900)).passed, false)
  assert.equal(gradeCase(caseOf({}), ok("Câu trả lời có lẫn chữ 中文 không mong muốn.")).passed, false)
})

test("gradeCase: lỗi/không phản hồi → mọi tiêu chí trượt, điểm 0", () => {
  const g = gradeCase(caseOf({ noCall: true, notMatch: ["xyz"] }), { ok: false, answer: "", functionsCalled: [], latencyMs: 90000, error: "Hết thời gian chờ" })
  assert.equal(g.passed, false)
  assert.equal(g.score, 0)
  assert.ok(g.checks.every((c) => !c.passed))
})

test("summarizeGrades + compareRuns", () => {
  const s = summarizeGrades([
    { passed: true, score: 100, latencyMs: 1000 },
    { passed: false, score: 50, latencyMs: 3000 },
  ])
  assert.deepEqual(s, { total: 2, passed: 1, score: 75, avgLatencyMs: 2000 })
  assert.deepEqual(summarizeGrades([]), { total: 0, passed: 0, score: null, avgLatencyMs: null })
  const cmp = compareRuns(
    [
      { case_id: "a", passed: true },
      { case_id: "b", passed: false },
      { case_id: "c", passed: true },
    ],
    [
      { case_id: "a", passed: false },
      { case_id: "b", passed: true },
      { case_id: "d", passed: true },
    ]
  )
  assert.equal(cmp.regressed, 1)
  assert.equal(cmp.fixed, 1)
  assert.equal(cmp.diffs.find((d) => d.case_id === "c")?.change, "removed")
  assert.equal(cmp.diffs.find((d) => d.case_id === "d")?.change, "new")
})
