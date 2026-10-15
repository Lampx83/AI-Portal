import { test } from "node:test"
import assert from "node:assert/strict"
import { buildSourcesSection, finalizeCentralAnswer, stripModelSourcesBlock } from "../src/lib/central-sources"

const TOOLS = [
  { alias: "funds", name: "Tra cứu quỹ tài trợ" },
  { alias: "journal-conference", name: "Hội thảo tạp chí" },
  { alias: "quantis", name: "Phân tích định lượng" },
]
const FUNDS_RESULT = JSON.stringify({ data: [{ title: "Quỹ A", url: "https://nafosted.gov.vn/quy-a" }] })

test("thêm mục Nguồn từ công cụ đã gọi, đúng alias /tools/<alias>", () => {
  const out = finalizeCentralAnswer("Có 1 quỹ đang mở: **Quỹ A**.", { results: [{ alias: "funds", content: FUNDS_RESULT }], tools: TOOLS })
  assert.match(out, /\*\*Nguồn\*\*\n- \[Tra cứu quỹ tài trợ\]\(\/tools\/funds\)$/)
})

test("không gọi công cụ → giữ nguyên câu trả lời", () => {
  const ans = "Cronbach's alpha ≥ 0,7 là đạt."
  assert.equal(finalizeCentralAnswer(ans, { results: [], tools: TOOLS }), ans)
})

test("công cụ trả lỗi → không trích dẫn công cụ đó", () => {
  const out = finalizeCentralAnswer("Chưa tra được.", { results: [{ alias: "funds", content: '{"error":"timeout"}' }], tools: TOOLS })
  assert.equal(out, "Chưa tra được.")
})

test("alias không có trong danh mục công cụ → không tạo đường dẫn", () => {
  const s = buildSourcesSection({ results: [{ alias: "ho-so", content: "{}" }], tools: TOOLS })
  assert.equal(s, "")
})

test("gỡ mục Nguồn mô hình tự viết; chỉ giữ URL ngoài có trong dữ liệu", () => {
  const ans = [
    "Có 1 quỹ đang mở.",
    "",
    "---",
    "📚 **Nguồn:**",
    "- [Tra cứu quỹ](/tools/quy-sai)",
    "- [Trang quỹ](https://nafosted.gov.vn/quy-a)",
    "- [Bịa](https://example.com/khong-co)",
  ].join("\n")
  const out = finalizeCentralAnswer(ans, { results: [{ alias: "funds", content: FUNDS_RESULT }], tools: TOOLS })
  assert.ok(!out.includes("quy-sai"))
  assert.ok(!out.includes("example.com"))
  assert.ok(out.includes("[nafosted.gov.vn](https://nafosted.gov.vn/quy-a)"))
  assert.equal((out.match(/Nguồn/g) || []).length, 1)
  assert.ok(out.startsWith("Có 1 quỹ đang mở.\n\n**Nguồn**"))
})

test("không gỡ nhầm dòng có chữ «Nguồn» trong nội dung", () => {
  const ans = "Các quỹ:\n- Nguồn vốn: ngân sách nhà nước\n- Hạn nộp: 30/11"
  assert.equal(stripModelSourcesBlock(ans).body, ans)
  const ans2 = "Nguồn tài trợ chính là Quỹ A.\nThêm chi tiết ở đây."
  assert.equal(stripModelSourcesBlock(ans2).body, ans2)
})

test("mục nguồn một dòng «Nguồn: [..](..)» ở cuối cũng được thay", () => {
  const ans = "Hội thảo X diễn ra 20/11.\n\nNguồn: [Hội thảo tạp chí](/tools/journal-conference)"
  const out = finalizeCentralAnswer(ans, { results: [{ alias: "journal-conference", content: '{"data":[]}' }], tools: TOOLS })
  assert.equal(out, "Hội thảo X diễn ra 20/11.\n\n**Nguồn**\n- [Hội thảo tạp chí](/tools/journal-conference)")
})

test("tệp bảng tính lớn → gợi ý Quantis (một lần), đặt trước mục Nguồn; tiếng Anh dùng Sources", () => {
  const out = finalizeCentralAnswer("Tệp có 1.250 dòng.", { results: [], tools: TOOLS, largeTable: true })
  assert.match(out, /\[Phân tích định lượng\]\(\/tools\/quantis\)/)
  const out2 = finalizeCentralAnswer("Mở [Phân tích định lượng](/tools/quantis) nhé.", { results: [], tools: TOOLS, largeTable: true })
  assert.equal((out2.match(/\/tools\/quantis/g) || []).length, 1)
  const out3 = finalizeCentralAnswer("Found one fund.", { results: [{ alias: "funds", content: FUNDS_RESULT }], tools: TOOLS, lang: "en", largeTable: true })
  assert.ok(out3.indexOf("💡") < out3.indexOf("**Sources**"))
  // không có công cụ quantis trên hệ thống → không gợi ý
  const out4 = finalizeCentralAnswer("Tệp lớn.", { results: [], tools: TOOLS.filter((t) => t.alias !== "quantis"), largeTable: true })
  assert.equal(out4, "Tệp lớn.")
})
