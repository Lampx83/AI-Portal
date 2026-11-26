import { test } from "node:test"
import assert from "node:assert/strict"
import { clipHistory, shrinkText } from "../src/lib/history-clip"

const T = (role: string, n: number, ch = "a") => ({ role, content: ch.repeat(n) })

test("câu trả lời gần nhất dài hơn ngân sách cũ (6.000) KHÔNG làm lịch sử rỗng", () => {
  const h = [T("user", 200), T("assistant", 7000), T("user", 100)]
  const out = clipHistory(h)
  assert.equal(out.length, 3)
  assert.ok(out[1].content.length <= 4500)
  assert.ok(out[1].content.includes("đã rút gọn"))
})

test("giữ thứ tự và nội dung gốc khi ngắn", () => {
  const h = [{ role: "user", content: "Xin chào" }, { role: "assistant", content: "Chào bạn" }]
  assert.deepEqual(clipHistory(h), h)
})

test("loại lượt cũ khi hết ngân sách nhưng luôn giữ 2 lượt gần nhất", () => {
  const h = [T("user", 3000), T("assistant", 4500), T("user", 3000), T("assistant", 4500), T("user", 3000), T("assistant", 4500)]
  const out = clipHistory(h, { maxChars: 9000 })
  assert.ok(out.length >= 2 && out.length < 6)
  assert.equal(out[out.length - 1].role, "assistant")
  assert.equal(out[out.length - 1].content.length, 4500)
})

test("rút gọn giữ đầu và cuối", () => {
  const s = "ĐẦU" + "x".repeat(5000) + "CUỐI"
  const r = shrinkText(s, 1000)
  assert.ok(r.length <= 1000)
  assert.ok(r.startsWith("ĐẦU") && r.endsWith("CUỐI"))
})

test("không sửa mảng gốc, lượt không đổi giữ nguyên tham chiếu", () => {
  const h = [T("user", 10), T("assistant", 10)]
  const out = clipHistory(h)
  assert.equal(out[0], h[0])
})
