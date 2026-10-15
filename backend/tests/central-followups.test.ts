import { test } from "node:test"
import assert from "node:assert/strict"
import { buildFollowupMessages, detectLang, parseLlmFollowups, ruleFollowups } from "../src/lib/central-followups"

test("luật: ưu tiên công cụ vừa dùng, rồi giai đoạn dự án, tối đa 3, không trùng câu vừa hỏi", () => {
  const out = ruleFollowups({ toolsUsed: ["funds"], stageId: "analyze", lang: "vi", question: "Quỹ nào còn hạn nộp trong 2 tháng tới?" })
  assert.equal(out.length, 3)
  assert.ok(!out.includes("Quỹ nào còn hạn nộp trong 2 tháng tới?"))
  assert.equal(out[0], "Hồ sơ xin tài trợ nghiên cứu thường cần những gì?")
  assert.ok(out.includes("Tôi nên dùng phương pháp phân tích nào cho dữ liệu của mình?"))
})

test("luật: bỏ gợi ý của công cụ không có trên hệ thống; tiếng Anh", () => {
  const out = ruleFollowups({ toolsUsed: ["funds"], lang: "en", availableAliases: ["quantis"] })
  assert.equal(out.length, 3)
  assert.ok(out.every((q) => !/fund/i.test(q) || q === "Are there any open research funds?"))
})

test("đọc JSON mảng (kể cả bọc ```json), lọc câu chứa link/quá ngắn", () => {
  const txt = '```json\n["Quỹ nào hạn gần nhất?", "ok", "Xem tại https://x.vn", "Hồ sơ cần những gì?", "Quỹ nào hạn gần nhất?"]\n```'
  assert.deepEqual(parseLlmFollowups(txt), ["Quỹ nào hạn gần nhất?", "Hồ sơ cần những gì?"])
})

test("đọc danh sách đánh số khi mô hình không trả JSON", () => {
  const txt = "1. Cỡ mẫu bao nhiêu là đủ?\n2. Thang Likert mấy mức?\n3. Làm sao thử nghiệm bảng hỏi?"
  assert.equal(parseLlmFollowups(txt).length, 3)
})

test("bỏ câu trùng câu vừa hỏi (không phân biệt dấu/hoa thường)", () => {
  assert.deepEqual(parseLlmFollowups('["co quy nao dang mo khong?", "Hạn nộp khi nào?"]', "Có quỹ nào đang mở không?"), ["Hạn nộp khi nào?"])
})

test("lời nhắc ngắn, đúng ngôn ngữ", () => {
  const m = buildFollowupMessages({ question: "Which funds?", answer: "x".repeat(5000), lang: "en" })
  assert.match(m[0].content, /JSON array of exactly 3/)
  assert.ok(m[1].content.length < 1700)
  assert.equal(detectLang("Có quỹ nào không?"), "vi")
  assert.equal(detectLang("Which funds are open for PhD students?"), "en")
  assert.equal(detectLang("SAT 1400", "en"), "en")
})
