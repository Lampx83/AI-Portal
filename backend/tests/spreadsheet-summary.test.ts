// Chạy: npm test (node --import tsx --test tests/*.test.ts)
import { test } from "node:test"
import assert from "node:assert/strict"
import * as XLSX from "xlsx"
import { parseBufferByExt } from "../src/lib/document-fetcher"
import { LARGE_TABLE_MARKER, SAMPLE_ROWS, parseNumeric, summarizeColumn, summarizeSheet } from "../src/lib/spreadsheet-summary"

/** Tệp Excel mẫu: 1 sheet lớn (1.250 dòng, nhiều kiểu cột), 1 sheet nhỏ (8 dòng), 1 sheet trống. */
function buildWorkbook(): Buffer {
  const wb = XLSX.utils.book_new()
  const big: unknown[][] = [["Mã SV", "Họ tên", "Giới tính", "Điểm TB", "Tuổi", "Ngày khảo sát", "Đồng ý", "Ghi chú"]]
  for (let i = 1; i <= 1250; i++) {
    big.push([
      `SV${String(i).padStart(5, "0")}`,
      `Sinh viên ${i}`,
      i % 3 === 0 ? "Nữ" : "Nam",
      Math.round(((i % 40) / 10 + 6) * 100) / 100, // 6.00 .. 9.90
      18 + (i % 7), // 18..24
      new Date(Date.UTC(2026, 8, 1 + (i % 30))),
      i % 4 === 0 ? "Không" : "Có",
      i % 10 === 0 ? "" : `ghi chú ${i % 5}`,
    ])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(big, { cellDates: true }), "Khảo sát")
  const small: unknown[][] = [["Nhóm", "Số lượng"]]
  for (let i = 1; i <= 8; i++) small.push([`Nhóm ${i}`, i * 10])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(small), "Tổng hợp")
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Trống")
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}

test("Excel lớn nhiều sheet: tóm tắt cấu trúc + 20 dòng mẫu, sheet nhỏ giữ nguyên", async () => {
  const parsed = await parseBufferByExt(buildWorkbook(), "du-lieu-khao-sat.xlsx")
  assert.equal(parsed.type, "text")
  const text = (parsed as { content: string }).content
  assert.ok(text.startsWith(LARGE_TABLE_MARKER), "có dấu hiệu bảng lớn ở đầu")
  assert.match(text, /\[Sheet: Khảo sát\] 1250 dòng dữ liệu × 8 cột/)
  // cột số có thống kê đúng
  assert.match(text, /- Điểm TB \| số \| 1250\/0 \| \d+ \| min 6, max 9\.9, trung bình [\d.]+, trung vị [\d.]+/)
  assert.match(text, /- Tuổi \| số \| 1250\/0 \| 7 \| min 18, max 24/)
  assert.match(text, /- Giới tính \| chữ \| 1250\/0 \| 2 \| hay gặp: Nam \(834\), Nữ \(416\)/)
  assert.match(text, /- Ngày khảo sát \| ngày \|/)
  assert.match(text, /- Đồng ý \| đúng\/sai \|/)
  assert.match(text, /- Ghi chú \| chữ \| 1125\/125 \|/)
  // đúng 20 dòng mẫu (+ 1 dòng tiêu đề) sau câu dẫn
  const after = text.split(`${SAMPLE_ROWS} dòng mẫu đầu tiên (trên tổng 1250 dòng):`)[1]
  assert.ok(after, "có phần dòng mẫu")
  const sampleBlock = after.split("\n\n")[0].trim().split("\n")
  assert.equal(sampleBlock.length, SAMPLE_ROWS + 1)
  assert.ok(!text.includes("SV00021"), "không đổ dòng thứ 21 trở đi")
  // sheet nhỏ: đầy đủ
  assert.match(text, /\[Sheet: Tổng hợp\] \(8 dòng dữ liệu × 2 cột — đầy đủ\)/)
  assert.ok(text.includes("Nhóm 8\t80"))
  // sheet trống bị bỏ qua
  assert.ok(!text.includes("[Sheet: Trống]"))
  // gọn hơn nhiều so với đổ nguyên bảng
  assert.ok(text.length < 6000, `độ dài ${text.length}`)
})

test("Excel nhỏ: không có dấu hiệu bảng lớn", async () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["A", "B"], [1, 2], [3, 4]]), "S1")
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
  const parsed = await parseBufferByExt(buf, "nho.xlsx")
  const text = (parsed as { content: string }).content
  assert.ok(!text.includes(LARGE_TABLE_MARKER))
  assert.match(text, /\(2 dòng dữ liệu × 2 cột — đầy đủ\)/)
})

test("CSV lớn (dấu chấm phẩy) cũng được tóm tắt", async () => {
  const lines = ["nhom;diem;thu_nhap"]
  for (let i = 0; i < 300; i++) lines.push(`${i % 2 ? "A" : "B"};${(i % 10) + 1};${1000 + i}`)
  const parsed = await parseBufferByExt(Buffer.from(lines.join("\n"), "utf-8"), "data.csv")
  const text = (parsed as { content: string }).content
  assert.ok(text.startsWith(LARGE_TABLE_MARKER))
  assert.match(text, /300 dòng dữ liệu × 3 cột/)
  assert.match(text, /- thu_nhap \| số \| 300\/0 \| 300 \| min 1000, max 1299/)
})

test("parseNumeric hiểu định dạng số kiểu Việt/Anh", () => {
  assert.equal(parseNumeric("1.234,5"), 1234.5)
  assert.equal(parseNumeric("1,234.5"), 1234.5)
  assert.equal(parseNumeric("3,5"), 3.5)
  assert.equal(parseNumeric("1.234.567"), 1234567)
  assert.equal(parseNumeric("12%"), 0.12)
  assert.equal(parseNumeric("abc"), null)
  assert.equal(parseNumeric(""), null)
})

test("summarizeColumn chịu được vài ô ghi chú lẫn trong cột số", () => {
  const vals: unknown[] = Array.from({ length: 50 }, (_, i) => i)
  vals.push("không rõ")
  const c = summarizeColumn("x", vals)
  assert.equal(c.type, "số")
  assert.equal(c.min, 0)
  assert.equal(c.max, 49)
})

test("summarizeSheet: tiêu đề thiếu → đặt tên Cột n", () => {
  const s = summarizeSheet("S", [["A", ""], [1, 2], [3, 4]])
  assert.equal(s.columns[1].name, "Cột 2")
  assert.equal(s.rowCount, 2)
})

test("cột mã/định danh (mọi giá trị khác nhau) chỉ hiện ví dụ, không liệt kê tần suất", () => {
  const rows: unknown[][] = [["Mã"]]
  for (let i = 1; i <= 100; i++) rows.push([`SV${i}`])
  const c = summarizeSheet("S", rows).columns[0]
  assert.equal(c.unique, true)
  assert.deepEqual(c.top, ["SV1", "SV2", "SV3"])
})
