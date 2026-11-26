// Chạy: npm test (node --import tsx --test tests/*.test.ts)
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeNextSteps, toolForChecklistItem } from "../lib/next-steps"

const TODAY = "2026-10-15"
const ALL_TOOLS = ["expertfinder", "paperfinder", "bibliomap", "surveylab", "quantis", "annota", "writium", "paperreviewer", "plagiarismchecker", "journal-conference", "funds", "regulations"]

function lc(stages: Record<string, unknown>[]) {
  return { version: 1, stages }
}
const brief = (steps: ReturnType<typeof computeNextSteps>) =>
  steps.map((s) => `${s.kind}:${s.action.type === "tool" ? s.action.alias : s.action.type}`)

test("dự án chưa có vòng đời: chủ dự án được gợi ý bắt đầu + hỏi Trợ lý chính + công cụ giai đoạn đầu", () => {
  const owner = computeNextSteps(null, { today: TODAY, isOwner: true, availableTools: ALL_TOOLS })
  assert.deepEqual(brief(owner), ["start:lifecycle", "central:central", "tool:expertfinder"])
  // thành viên được chia sẻ: không có nút sửa (bắt đầu vòng đời)
  const member = computeNextSteps(null, { today: TODAY, isOwner: false, availableTools: ALL_TOOLS })
  assert.ok(!member.some((s) => s.ownerOnly))
  assert.deepEqual(brief(member), ["central:central", "tool:expertfinder", "tool:paperfinder"])
})

test("giai đoạn Tổng quan đang làm: gợi ý Tra cứu bài báo / BiblioMap", () => {
  const steps = computeNextSteps(lc([{ id: "explore", status: "done" }, { id: "review", status: "doing" }]), { today: TODAY, isOwner: true, availableTools: ALL_TOOLS })
  assert.deepEqual(brief(steps), ["tool:paperfinder", "tool:bibliomap"])
})

test("mỗi giai đoạn mở đúng công cụ", () => {
  const order = ["explore", "review", "design", "analyze", "write", "publish"]
  const expectFirst: Record<string, string> = { design: "surveylab", analyze: "quantis", write: "writium", publish: "journal-conference" }
  for (const [id, alias] of Object.entries(expectFirst)) {
    const idx = order.indexOf(id)
    const stages = order.map((s, i) => ({ id: s, status: i < idx ? "done" : i === idx ? "doing" : "todo" }))
    const steps = computeNextSteps(lc(stages), { today: TODAY, isOwner: true, availableTools: ALL_TOOLS })
    assert.equal(steps[0].action.type === "tool" && steps[0].action.alias, alias, id)
  }
  // Viết và phản biện: có cả Phản biện + Đạo văn
  const w = computeNextSteps(lc(order.map((s, i) => ({ id: s, status: i < 4 ? "done" : i === 4 ? "doing" : "todo" }))), { today: TODAY, isOwner: true, availableTools: ALL_TOOLS })
  assert.deepEqual(brief(w), ["tool:writium", "tool:paperreviewer", "tool:plagiarismchecker"])
})

test("quá hạn được ưu tiên đầu tiên, rồi việc chưa xong (mở công cụ theo từ khoá), tối đa 3", () => {
  const steps = computeNextSteps(
    lc([
      { id: "explore", status: "done" },
      { id: "review", status: "done" },
      {
        id: "design",
        status: "doing",
        dueDate: "2026-10-12",
        checklist: [
          { text: "Thiết kế bảng hỏi khảo sát", done: true },
          { text: "Thử nghiệm bảng hỏi với nhóm nhỏ", done: false },
          { text: "Tìm thêm tài liệu về thang đo", done: false },
        ],
      },
    ]),
    { today: TODAY, isOwner: true, availableTools: ALL_TOOLS }
  )
  assert.deepEqual(brief(steps), ["overdue:lifecycle", "checklist:surveylab", "checklist:paperfinder"])
  assert.equal(steps[0].params?.days, 3)
  assert.equal(steps[0].titleKey, "nextSteps.overdue")
  assert.equal(steps[1].params?.text, "Thử nghiệm bảng hỏi với nhóm nhỏ")
})

test("sắp đến hạn (≤ 3 ngày) và đến hạn hôm nay", () => {
  const soon = computeNextSteps(lc([{ id: "explore", status: "doing", dueDate: "2026-10-18" }]), { today: TODAY, isOwner: true })
  assert.equal(soon[0].kind, "dueSoon")
  assert.equal(soon[0].params?.days, 3)
  const today = computeNextSteps(lc([{ id: "explore", status: "doing", dueDate: TODAY }]), { today: TODAY, isOwner: true })
  assert.equal(today[0].titleKey, "nextSteps.dueToday")
  const far = computeNextSteps(lc([{ id: "explore", status: "doing", dueDate: "2026-10-30" }]), { today: TODAY, isOwner: true })
  assert.ok(!far.some((s) => s.kind === "dueSoon" || s.kind === "overdue"))
})

test("xong hết việc cần làm → gợi ý đánh dấu hoàn thành (chỉ chủ dự án)", () => {
  const data = lc([{ id: "explore", status: "doing", checklist: [{ text: "Xác định câu hỏi nghiên cứu", done: true }] }])
  assert.equal(computeNextSteps(data, { today: TODAY, isOwner: true })[0].kind, "completeStage")
  assert.ok(!computeNextSteps(data, { today: TODAY, isOwner: false }).some((s) => s.kind === "completeStage"))
})

test("giai đoạn kế tiếp chưa bắt đầu → gợi ý bắt đầu giai đoạn (chủ dự án)", () => {
  const steps = computeNextSteps(lc([{ id: "explore", status: "done" }, { id: "review", status: "todo" }]), { today: TODAY, isOwner: true, availableTools: ALL_TOOLS })
  assert.deepEqual(brief(steps), ["startStage:lifecycle", "tool:paperfinder", "tool:bibliomap"])
})

test("hoàn thành cả 6 giai đoạn → gợi ý công bố/tài trợ", () => {
  const steps = computeNextSteps(lc(["explore", "review", "design", "analyze", "write", "publish"].map((id) => ({ id, status: "done" }))), { today: TODAY, isOwner: true, availableTools: ALL_TOOLS })
  assert.deepEqual(brief(steps), ["allDone:journal-conference", "tool:funds", "tool:regulations"])
})

test("công cụ không có trên hệ thống thì không gợi ý", () => {
  const steps = computeNextSteps(lc([{ id: "explore", status: "done" }, { id: "review", status: "doing" }]), { today: TODAY, isOwner: true, availableTools: ["bibliomap"] })
  assert.deepEqual(brief(steps), ["tool:bibliomap"])
  assert.equal(toolForChecklistItem("Kiểm tra đạo văn", 4, ["writium"]), "writium")
  assert.equal(toolForChecklistItem("Chạy hồi quy tuyến tính", 3), "quantis")
})

test("thành viên được chia sẻ: câu nhắc quá hạn dành cho thành viên (nhắc chủ dự án)", () => {
  const steps = computeNextSteps(lc([{ id: "explore", status: "doing", dueDate: "2026-10-10" }]), { today: TODAY, isOwner: false })
  assert.equal(steps[0].titleKey, "nextSteps.overdueMember")
})
