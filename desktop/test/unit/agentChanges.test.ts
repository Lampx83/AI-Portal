import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import os from "os"
import path from "path"
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import { applyTextEdits, HISTORY_DIR } from "../../src/main/agent/changes"
import { minimalPdf, setupProject } from "./helpers"
import { applyDocxEdits, createDocxFromText, extractDocxText, extractXlsxText } from "../../src/main/agent/docx"
import { readForAgent } from "../../src/main/agent/extract"
import { writeBlockedReason } from "../../src/main/agent/writePolicy"

const PID = "proj-1"
const SID = "11111111-2222-4333-8444-555555555555"

test("chính sách ghi: chặn tệp thực thi/kịch bản/ẩn, cho phép tài liệu", () => {
  for (const p of ["a.sh", "b.py", "c.exe", "d.R", "e.js", "f.command", "g.app", "noext", ".git/config.md", ".neu-research/x.md", "x.md.", "node_modules/a.md", "~$tmp.docx", "aux.txt", "a|b.md"]) {
    assert.ok(writeBlockedReason(p), `phải chặn ${p}`)
  }
  for (const p of ["a.md", "thu muc/b.txt", "data.csv", "refs.bib", "bai.tex", "bao-cao.docx", "x.json"]) {
    assert.equal(writeBlockedReason(p), null, `phải cho phép ${p}`)
  }
})

test("đề xuất KHÔNG ghi; Chấp nhận ghi đúng + sao lưu + nhật ký; Hoàn tác khôi phục", () => {
  const s = setupProject()
  try {
    const orig = fs.readFileSync(path.join(s.proj, "bao-cao.md"), "utf8")
    const c = s.changes.proposeEdit(PID, SID, "bao-cao.md", [{ old_text: "lổi chính tả", new_text: "lỗi chính tả" }], "Sửa chính tả")
    assert.equal(c.status, "pending")
    assert.equal(fs.readFileSync(path.join(s.proj, "bao-cao.md"), "utf8"), orig, "chưa ghi khi mới đề xuất")
    const view = s.changes.toView(c)
    assert.equal(view.added, 1)
    assert.equal(view.removed, 1)
    assert.ok(view.hunks[0].lines.some((l) => l === "-Đây là đoạn mở đầu có lổi chính tả."))
    assert.ok(view.hunks[0].lines.some((l) => l === "+Đây là đoạn mở đầu có lỗi chính tả."))

    const acc = s.changes.accept(PID, c.id)
    assert.equal(acc.status, "accepted")
    assert.equal(fs.readFileSync(path.join(s.proj, "bao-cao.md"), "utf8"), orig.replace("lổi", "lỗi"))
    assert.equal(fs.readFileSync(path.join(s.proj, HISTORY_DIR, c.id, "before"), "utf8"), orig, "có bản sao trước khi ghi")
    const journal = fs.readFileSync(path.join(s.proj, HISTORY_DIR, "journal.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l))
    assert.equal(journal.at(-1).action, "accept")
    assert.equal(journal.at(-1).path, "bao-cao.md")
    assert.throws(() => s.changes.accept(PID, c.id), /đã được xử lý/)

    const und = s.changes.undo(PID, c.id)
    assert.equal(und.status, "undone")
    assert.equal(fs.readFileSync(path.join(s.proj, "bao-cao.md"), "utf8"), orig)
    // không có tệp tạm sót lại
    assert.deepEqual(fs.readdirSync(s.proj).filter((n) => n.startsWith(".neu-tmp")), [])
  } finally {
    s.cleanup()
  }
})

test("Từ chối không ghi gì; tạo tệp mới rồi hoàn tác thì tệp biến mất; không có quyền thực thi", () => {
  const s = setupProject()
  try {
    const r = s.changes.proposeWrite(PID, SID, "notes/moi.md", "# Mới\n")
    s.changes.reject(PID, r.id)
    assert.equal(fs.existsSync(path.join(s.proj, "notes", "moi.md")), false)
    assert.throws(() => s.changes.accept(PID, r.id), /đã được xử lý/)

    const c = s.changes.proposeWrite(PID, SID, "ket-qua/dan-y.md", "# Dàn ý\n- Ý 1\n")
    s.changes.accept(PID, c.id)
    const p = path.join(s.proj, "ket-qua", "dan-y.md")
    assert.equal(fs.readFileSync(p, "utf8"), "# Dàn ý\n- Ý 1\n")
    if (process.platform !== "win32") assert.equal(fs.statSync(p).mode & 0o111, 0, "không có quyền thực thi")
    s.changes.undo(PID, c.id)
    assert.equal(fs.existsSync(p), false)
    assert.ok(fs.existsSync(path.join(s.proj, HISTORY_DIR, c.id, "after")), "giữ lại bản trợ lý đã ghi")
  } finally {
    s.cleanup()
  }
})

test("kiểm tra đường dẫn cho công cụ ghi: chặn .., tuyệt đối, symlink ra ngoài, tệp thực thi", () => {
  const s = setupProject()
  try {
    assert.throws(() => s.changes.proposeWrite(PID, SID, "../ngoai.md", "x"), /ra ngoài/)
    assert.throws(() => s.changes.proposeWrite(PID, SID, "/etc/x.md", "x"), /tương đối/)
    assert.throws(() => s.changes.proposeWrite(PID, SID, "C:\\x.md", "x"), /tương đối/)
    assert.throws(() => s.changes.proposeWrite(PID, SID, "leak.md", "x"), /symlink/i)
    assert.throws(() => s.changes.proposeWrite(PID, SID, "linkdir/new.md", "x"), /symlink/i)
    assert.throws(() => s.changes.proposeWrite(PID, SID, "run.sh", "#!/bin/sh\nrm -rf ~"), /không được ghi tệp \.sh/)
    assert.throws(() => s.changes.proposeWrite(PID, SID, "a.py", "print(1)"), /\.py/)
    assert.throws(() => s.changes.proposeWrite(PID, SID, ".neu-research/history/x.md", "x"), /ẩn/)
    assert.throws(() => s.changes.proposeRename(PID, SID, "bao-cao.md", "bao-cao.command"), /\.command|thực thi/)
    assert.throws(() => s.changes.proposeWrite(PID, SID, "notes", "x"), /phần mở rộng|thư mục/)
    assert.equal(fs.readFileSync(path.join(s.base, "outside.md"), "utf8"), "BÍ MẬT")
  } finally {
    s.cleanup()
  }
})

test("giới hạn kích thước ghi", () => {
  const s = setupProject()
  try {
    assert.throws(() => s.changes.proposeWrite(PID, SID, "lon.txt", "x".repeat(1_000_001)), /quá lớn/)
  } finally {
    s.cleanup()
  }
})

test("xung đột: tệp bị sửa sau khi đề xuất → không ghi; sửa sau khi ghi → không hoàn tác đè", () => {
  const s = setupProject()
  try {
    const f = path.join(s.proj, "bao-cao.md")
    const c = s.changes.proposeEdit(PID, SID, "bao-cao.md", [{ old_text: "Kết luận.", new_text: "Kết luận mới." }])
    fs.appendFileSync(f, "Người dùng vừa thêm dòng.\n")
    assert.throws(() => s.changes.accept(PID, c.id), /đã bị sửa/)
    assert.equal(s.changes.get(PID, c.id).status, "conflict")
    assert.match(fs.readFileSync(f, "utf8"), /Người dùng vừa thêm dòng/)

    const d = s.changes.proposeEdit(PID, SID, "bao-cao.md", [{ old_text: "Kết luận.", new_text: "Kết luận mới." }])
    s.changes.accept(PID, d.id)
    fs.appendFileSync(f, "Sửa tiếp của người dùng\n")
    assert.throws(() => s.changes.undo(PID, d.id), /đã thay đổi sau khi trợ lý ghi/)
    assert.match(fs.readFileSync(f, "utf8"), /Sửa tiếp của người dùng/)
  } finally {
    s.cleanup()
  }
})

test("giữ CRLF/BOM của tệp gốc; gộp nhiều đề xuất cho cùng tệp thành một diff", () => {
  const s = setupProject()
  try {
    const a = s.changes.proposeEdit(PID, SID, "notes/windows.txt", [{ old_text: "dòng 1", new_text: "dòng một" }])
    const b = s.changes.proposeEdit(PID, SID, "notes/windows.txt", [{ old_text: "dòng 2", new_text: "dòng hai" }])
    assert.equal(s.changes.get(PID, a.id).status, "superseded")
    assert.equal(s.changes.list(PID).filter((x) => x.status === "pending").length, 1)
    s.changes.accept(PID, b.id)
    assert.equal(fs.readFileSync(path.join(s.proj, "notes", "windows.txt"), "utf8"), "dòng một\r\ndòng hai\r\n")
  } finally {
    s.cleanup()
  }
})

test("applyTextEdits: không khớp / khớp nhiều chỗ báo lỗi rõ ràng", () => {
  assert.throws(() => applyTextEdits("abc", [{ old_text: "x", new_text: "y" }]), /Không tìm thấy/)
  assert.throws(() => applyTextEdits("a a", [{ old_text: "a", new_text: "b" }]), /khớp 2 chỗ/)
  assert.equal(applyTextEdits("giá $1", [{ old_text: "$1", new_text: "$&2" }]), "giá $&2", "không diễn giải mẫu thay thế $")
})

test("xoá + đổi tên là đề xuất; hoàn tác khôi phục", () => {
  const s = setupProject()
  try {
    const del = s.changes.proposeDelete(PID, SID, "bao-cao.md")
    assert.ok(fs.existsSync(path.join(s.proj, "bao-cao.md")))
    s.changes.accept(PID, del.id)
    assert.equal(fs.existsSync(path.join(s.proj, "bao-cao.md")), false)
    s.changes.undo(PID, del.id)
    assert.match(fs.readFileSync(path.join(s.proj, "bao-cao.md"), "utf8"), /Báo cáo/)

    const rn = s.changes.proposeRename(PID, SID, "bao-cao.md", "luu-tru/bao-cao-v1.md")
    s.changes.accept(PID, rn.id)
    assert.ok(fs.existsSync(path.join(s.proj, "luu-tru", "bao-cao-v1.md")))
    s.changes.undo(PID, rn.id)
    assert.ok(fs.existsSync(path.join(s.proj, "bao-cao.md")))
    assert.equal(fs.existsSync(path.join(s.proj, "luu-tru", "bao-cao-v1.md")), false)
  } finally {
    s.cleanup()
  }
})

function makeDocx(paragraphsXml: string): Uint8Array {
  const base = unzipSync(createDocxFromText("x"))
  base["word/document.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphsXml}</w:body></w:document>`,
  )
  return zipSync(base)
}

test(".docx: trích văn bản, sửa trong một đoạn giữ định dạng run khác, tạo mới có tiêu đề", () => {
  const buf = makeDocx(
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t>Chương 1</w:t></w:r></w:p>` +
      `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Kinh tế</w:t></w:r><w:r><w:t xml:space="preserve"> học là môn hoc </w:t></w:r><w:r><w:t>thú vị.</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>Cột A</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Cột B</w:t></w:r></w:p>`,
  )
  assert.equal(extractDocxText(buf), "Chương 1\nKinh tế học là môn hoc thú vị.\nCột A\tCột B")
  const out = applyDocxEdits(buf, [{ old_text: "môn hoc thú", new_text: "môn học rất thú" }])
  assert.equal(out.text.split("\n")[1], "Kinh tế học là môn học rất thú vị.")
  const xml = strFromU8(unzipSync(out.bytes)["word/document.xml"])
  assert.match(xml, /<w:rPr><w:b\/><\/w:rPr><w:t>Kinh tế<\/w:t>/, "run in đậm giữ nguyên")
  assert.match(xml, /<w:pStyle w:val="Heading1"\/>/)
  assert.throws(() => applyDocxEdits(buf, [{ old_text: "A\tCột", new_text: "x" }]), /tab/)
  assert.throws(() => applyDocxEdits(buf, [{ old_text: "Chương 1\nKinh", new_text: "x" }]), /MỘT đoạn/)
  assert.throws(() => applyDocxEdits(buf, [{ old_text: "không có", new_text: "x" }]), /Không tìm thấy/)
  const created = createDocxFromText("# Dàn ý\n## Mục 1\nNội dung & ký tự <đặc biệt>")
  assert.equal(extractDocxText(created), "Dàn ý\nMục 1\nNội dung & ký tự <đặc biệt>")
  assert.match(strFromU8(unzipSync(created)["word/document.xml"]), /Heading2/)
})

test(".docx qua ChangeService: đề xuất sửa, chấp nhận, hoàn tác về đúng bytes gốc", () => {
  const s = setupProject()
  try {
    const buf = makeDocx(`<w:p><w:r><w:t>Văn phong chưa tốt.</w:t></w:r></w:p>`)
    fs.writeFileSync(path.join(s.proj, "bai.docx"), buf)
    assert.throws(() => s.changes.proposeWrite(PID, SID, "bai.docx", "ghi đè"), /edit_file/)
    const c = s.changes.proposeEdit(PID, SID, "bai.docx", [{ old_text: "chưa tốt", new_text: "đã tốt hơn" }])
    s.changes.accept(PID, c.id)
    assert.equal(extractDocxText(fs.readFileSync(path.join(s.proj, "bai.docx"))), "Văn phong đã tốt hơn.")
    s.changes.undo(PID, c.id)
    assert.deepEqual(new Uint8Array(fs.readFileSync(path.join(s.proj, "bai.docx"))), buf)
  } finally {
    s.cleanup()
  }
})

test("trích .xlsx và .pdf", async () => {
  const xlsx = zipSync({
    "xl/workbook.xml": strToU8(`<workbook xmlns:r="r"><sheets><sheet name="Khảo sát" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/sharedStrings.xml": strToU8(`<sst><si><t>Tên</t></si><si><t>Điểm, TB</t></si><si><t>An</t></si></sst>`),
    "xl/worksheets/sheet1.xml": strToU8(
      `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>8.5</v></c></row></sheetData></worksheet>`,
    ),
  })
  assert.equal(extractXlsxText(xlsx), '## Trang tính: Khảo sát\nTên,"Điểm, TB"\nAn,,8.5')

  const pdf = minimalPdf("Hello NEU research")
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neu-pdf-"))
  try {
    fs.writeFileSync(path.join(dir, "a.pdf"), pdf)
    const r = await readForAgent(path.join(dir, "a.pdf"), "a.pdf")
    assert.equal(r.format, "pdf")
    assert.match(r.text, /Hello NEU research/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

