/**
 * Kiểm thử 0.3.0 «làm việc tốt trên các thư mục»: tìm kiếm toàn thư mục, phân trang, xem trước, thư mục gần đây,
 * định dạng mới (.pptx/.odt/.ipynb/ảnh), thao tác thư mục qua đề xuất (tạo/đổi tên/di chuyển/Thùng rác/hoàn tác),
 * theo dõi thay đổi bên ngoài.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import { strToU8, zipSync } from "fflate"
import { ExternalChangeTracker } from "../../src/main/activity"
import { buildSystemPrompt, FolderAgent } from "../../src/main/agent/agent"
import { ChangeService, HISTORY_DIR } from "../../src/main/agent/changes"
import type { ChatClient, ChatMsg, ChatResult } from "../../src/main/agent/llmClient"
import { extractIpynbText, extractOdfText, extractPptxText, imageSize } from "../../src/main/agent/office"
import { readForAgent } from "../../src/main/agent/extract"
import { SessionStore } from "../../src/main/agent/sessions"
import { AgentTools } from "../../src/main/agent/tools"
import { dirBlockedReason } from "../../src/main/agent/writePolicy"
import { buildMatcher, foldText, FolderSearch, TextCache, walkFolder } from "../../src/main/fsSearch"
import { createDocxFromText } from "../../src/main/agent/docx"
import { setupProject } from "./helpers"

const PID = "proj-1"
const SID = "11111111-2222-4333-8444-555555555555"

function pptx(slides: { text: string[]; notes?: string }[]): Uint8Array {
  const files: Record<string, Uint8Array> = { "[Content_Types].xml": strToU8("<Types/>") }
  slides.forEach((s, i) => {
    const paras = s.text.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join("")
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(`<p:sld><p:cSld><p:spTree><p:sp><p:txBody>${paras}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`)
    if (s.notes) files[`ppt/notesSlides/notesSlide${i + 1}.xml`] = strToU8(`<p:notes><a:p><a:r><a:t>${i + 1}</a:t></a:r></a:p><a:p><a:r><a:t>${s.notes}</a:t></a:r></a:p></p:notes>`)
  })
  return zipSync(files)
}

function png(w: number, h: number): Buffer {
  const b = Buffer.alloc(33)
  b.writeUInt32BE(0x89504e47, 0)
  b.writeUInt32BE(0x0d0a1a0a, 4)
  b.writeUInt32BE(13, 8)
  b.write("IHDR", 12, "latin1")
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  return b
}

/** Thư mục nghiên cứu mẫu: tên tiếng Việt (có tên NFD), tệp nhiều định dạng, thư mục rác, symlink. */
function seed(proj: string, base: string) {
  const w = (rel: string, data: string | Uint8Array) => {
    fs.mkdirSync(path.dirname(path.join(proj, rel)), { recursive: true })
    fs.writeFileSync(path.join(proj, rel), data)
  }
  w("Chương 1/Báo cáo tổng quan.md", "# Tổng quan\nMô hình hồi quy logistic cho sinh viên năm nhất.\n")
  w("Chương 2/ket-qua.csv", "bien,he_so\nTuổi,0.12\n")
  w("Chương 2/phu-luc.docx", createDocxFromText("# Phụ lục\nBảng khảo sát độ hài lòng"))
  w("Trình bày/bao-ve.pptx", pptx([{ text: ["Đề tài NCKH", "Phương pháp PLS-SEM"], notes: "Nhấn mạnh cỡ mẫu 412" }, { text: ["Kết luận"] }]))
  w("Hình/so-do.png", png(640, 480))
  w("node_modules/pkg/index.md", "hồi quy logistic trong thư viện")
  w("venv/lib/x.txt", "hồi quy logistic trong venv")
  w(".git/HEAD.txt", "hồi quy logistic ẩn")
  // Tên tệp dạng NFD (thường gặp khi giải nén zip trên macOS).
  w("Ghi chú".normalize("NFD") + "/" + "Phỏng vấn.txt".normalize("NFD"), "Phỏng vấn giảng viên về hồi quy logistic")
  fs.symlinkSync(path.join(base, "outdir"), path.join(proj, "Chương 2", "link-ra-ngoai"))
  fs.writeFileSync(path.join(base, "outdir", "bi-mat.md"), "hồi quy logistic bí mật bên ngoài")
}

test("foldText/buildMatcher: không phân biệt dấu + hoa/thường, NFD, glob, regex", () => {
  assert.equal(foldText("Báo Cáo ĐỀ TÀI"), "bao cao de tai")
  assert.equal(foldText("Phỏng".normalize("NFD")), foldText("Phỏng"))
  const m = buildMatcher("bao cao")
  assert.ok(m.name("Báo cáo tổng quan.md", "Chương 1/Báo cáo tổng quan.md"))
  assert.ok(m.name("cao-bao.md", "cao-bao.md"), "từng từ, không cần đúng thứ tự")
  assert.ok(!m.line("cao bao"), "nội dung: đúng cụm từ")
  assert.ok(m.line("Đây là BÁO CÁO cuối"))
  const g = buildMatcher("*.PDF")
  assert.ok(g.name("bai-bao.pdf", "x/bai-bao.pdf"))
  assert.ok(!g.name("bai-bao.pdf.docx", "bai-bao.pdf.docx"))
  const gp = buildMatcher("chuong*/*.docx")
  assert.ok(gp.name("phu-luc.docx", "Chương 2/phu-luc.docx"))
  assert.ok(!gp.name("phu-luc.docx", "Chương 2/sub/phu-luc.docx"))
  assert.ok(buildMatcher("**/so*.png").name("so-do.png", "a/b/so-do.png"))
  const cs = buildMatcher("Báo", { caseSensitive: true })
  assert.ok(cs.line("Báo cáo") && !cs.line("bao cao"))
  assert.ok(buildMatcher("h[ồo]i quy", { regex: true }).line("Hồi quy"))
  assert.throws(() => buildMatcher("(", { regex: true }), /chính quy/)
  assert.throws(() => buildMatcher("   "), /Cần/)
})

test("tìm kiếm toàn thư mục: tên + nội dung (md/docx/pptx), bỏ thư mục rác/ẩn/symlink ra ngoài, tên NFD", async () => {
  const s = setupProject()
  try {
    seed(s.proj, s.base)
    const fsr = new FolderSearch()
    const root = s.folders.resolveFolder(PID)
    const byName = await fsr.search(root, "bao cao", { mode: "name" })
    assert.deepEqual(byName.hits.map((h) => h.relPath), ["bao-cao.md", "Chương 1/Báo cáo tổng quan.md"])
    const nfd = await fsr.search(root, "phong van", { mode: "name" })
    assert.equal(nfd.hits.length, 1)
    assert.equal(nfd.hits[0].relPath.normalize("NFC"), "Ghi chú/Phỏng vấn.txt")

    const content = await fsr.search(root, "hồi quy logistic", { mode: "content" })
    const paths = content.hits.map((h) => h.relPath.normalize("NFC")).sort()
    assert.deepEqual(paths, ["Chương 1/Báo cáo tổng quan.md", "Ghi chú/Phỏng vấn.txt"])
    assert.ok(!paths.some((p) => p.includes("node_modules") || p.includes("venv") || p.includes(".git") || p.includes("link-ra-ngoai")))
    assert.equal(content.hits.find((h) => h.relPath.startsWith("Chương 1"))!.matches[0].line, 2)

    const docx = await fsr.search(root, "khao sat do hai long", { mode: "content" })
    assert.deepEqual(docx.hits.map((h) => h.relPath), ["Chương 2/phu-luc.docx"])
    const notes = await fsr.search(root, "cỡ mẫu 412")
    assert.deepEqual(notes.hits.map((h) => h.relPath), ["Trình bày/bao-ve.pptx"])
    const onlyCsv = await fsr.search(root, "tuoi", { exts: ["csv"] })
    assert.deepEqual(onlyCsv.hits.map((h) => h.relPath), ["Chương 2/ket-qua.csv"])
    const sub = await fsr.search(root, "logistic", { subPath: "Ghi chú" })
    assert.equal(sub.hits.length, 1)
    await assert.rejects(() => fsr.search(root, "x", { subPath: "../outdir" }), /ngoài thư mục dự án/)
    await assert.rejects(() => fsr.search(root, "x", { subPath: ".git" }), /ẩn/)
    // bộ đệm: lần tìm thứ hai không phải trích lại
    assert.ok(fsr.cache.size >= 4)
  } finally {
    s.cleanup()
  }
})

test("thư mục lớn: tìm nhanh, bỏ node_modules, giới hạn số mục, huỷ được; phân trang listFiles", async () => {
  const s = setupProject()
  try {
    const big = path.join(s.proj, "du-lieu-tho")
    fs.mkdirSync(big)
    for (let i = 0; i < 3000; i++) fs.writeFileSync(path.join(big, `phieu-${String(i).padStart(4, "0")}.txt`), i === 2999 ? "câu trả lời đặc biệt" : "trống")
    const nm = path.join(s.proj, "node_modules")
    for (let i = 0; i < 40; i++) {
      fs.mkdirSync(path.join(nm, `p${i}`), { recursive: true })
      for (let j = 0; j < 50; j++) fs.writeFileSync(path.join(nm, `p${i}`, `f${j}.md`), "câu trả lời đặc biệt")
    }
    const root = s.folders.resolveFolder(PID)
    const fsr = new FolderSearch()
    const t0 = Date.now()
    const r = await fsr.search(root, "câu trả lời đặc biệt", { mode: "content" })
    assert.deepEqual(r.hits.map((h) => h.relPath), ["du-lieu-tho/phieu-2999.txt"])
    assert.ok(Date.now() - t0 < 10_000, `tìm 3000 tệp mất ${Date.now() - t0} ms`)
    assert.ok(r.scannedEntries < 3100, "không duyệt vào node_modules")

    const capped = await fsr.search(root, "phieu", { mode: "name", maxEntries: 500 })
    assert.equal(capped.truncated, true)
    const limited = await fsr.search(root, "phieu", { mode: "name", limit: 25 })
    assert.equal(limited.hits.length, 25)
    assert.equal(limited.truncated, true)
    const ctrl = new AbortController()
    ctrl.abort()
    const aborted = await fsr.search(root, "phieu", { signal: ctrl.signal })
    assert.equal(aborted.cancelled, true)

    const p1 = s.folders.listFiles(PID, "du-lieu-tho", { limit: 1000 })
    assert.equal(p1.entries.length, 1000)
    assert.equal(p1.total, 3000)
    assert.equal(p1.truncated, true)
    assert.equal(p1.entries[0].name, "phieu-0000.txt")
    const p3 = s.folders.listFiles(PID, "du-lieu-tho", { offset: 2000, limit: 5000 })
    assert.equal(p3.entries.length, 1000)
    assert.equal(p3.truncated, false)
    assert.equal(p3.entries.at(-1)!.name, "phieu-2999.txt")
    // mặc định như 0.2.0: 2000 mục + truncated
    const d = s.folders.listFiles(PID, "du-lieu-tho")
    assert.equal(d.entries.length, 2000)
    assert.equal(d.truncated, true)
  } finally {
    s.cleanup()
  }
})

test("walkFolder không đi vào symlink thư mục (chống vòng lặp)", async () => {
  const s = setupProject()
  try {
    fs.mkdirSync(path.join(s.proj, "a"))
    fs.symlinkSync(path.join(s.proj), path.join(s.proj, "a", "vong-lap"))
    const seen: string[] = []
    await walkFolder(s.proj, s.proj, "", (it) => {
      seen.push(it.relPath)
    })
    assert.ok(seen.includes("a/vong-lap"))
    assert.ok(!seen.some((p) => p.startsWith("a/vong-lap/")))
    assert.ok(!seen.includes("linkdir") && !seen.includes("leak.md"), "symlink ra ngoài bị bỏ")
  } finally {
    s.cleanup()
  }
})

test("TextCache: hết hạn khi tệp đổi cỡ/mtime, LRU theo ngân sách", () => {
  const c = new TextCache(100)
  c.set("/a", 1, 1, "x".repeat(20))
  assert.equal(c.get("/a", 1, 1), "x".repeat(20))
  assert.equal(c.get("/a", 2, 1), undefined)
  for (let i = 0; i < 10; i++) c.set(`/f${i}`, 1, 1, "y".repeat(20))
  assert.ok(c.size <= 5)
  c.invalidateUnder("/f9")
  assert.equal(c.get("/f9", 1, 1), undefined)
})

test("định dạng mới: .pptx (chữ + ghi chú), .odt, .ipynb, kích thước ảnh; read_file báo ảnh", async () => {
  const p = extractPptxText(pptx([{ text: ["Tiêu đề &amp; mở đầu"], notes: "ghi chú A" }, { text: [] }]))
  assert.match(p, /--- Trang chiếu 1 ---\nTiêu đề & mở đầu\nGhi chú:\nghi chú A/)
  assert.match(p, /--- Trang chiếu 2 ---\n\(không có chữ\)/)
  assert.throws(() => extractPptxText(strToU8("không phải zip")), /hỏng/)
  const odt = zipSync({ "content.xml": strToU8('<office:document-content><text:h text:outline-level="1">Mở đầu</text:h><text:p>Đoạn<text:s text:c="2"/>một</text:p></office:document-content>') })
  assert.equal(extractOdfText(odt), "# Mở đầu\nĐoạn  một")
  const nb = JSON.stringify({ metadata: { kernelspec: { language: "python" } }, cells: [{ cell_type: "markdown", source: ["# Phân tích\n"] }, { cell_type: "code", source: "import pandas as pd" }] })
  assert.match(extractIpynbText(nb), /--- Ô 2 \(code\) ---\n```python\nimport pandas as pd\n```/)
  assert.deepEqual(imageSize(png(640, 480)), { type: "png", width: 640, height: 480 })
  const gif = Buffer.from("GIF89a\x10\x00\x20\x00", "latin1")
  assert.deepEqual(imageSize(gif), { type: "gif", width: 16, height: 32 })
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x02, 0x58, 0x03])
  assert.deepEqual(imageSize(jpg), { type: "jpeg", width: 600, height: 300 })
  const s = setupProject()
  try {
    fs.writeFileSync(path.join(s.proj, "anh.png"), png(10, 20))
    const r = await readForAgent(path.join(s.proj, "anh.png"), "anh.png")
    assert.equal(r.format, "image")
    assert.match(r.text, /10×20 px/)
  } finally {
    s.cleanup()
  }
})

test("xem trước: văn bản/markdown/csv/tài liệu/ảnh; chặn tệp ẩn, symlink ra ngoài; tệp kịch bản không mở được", async () => {
  const s = setupProject()
  try {
    seed(s.proj, s.base)
    fs.writeFileSync(path.join(s.proj, "chay.sh"), "#!/bin/sh\necho hi\n")
    fs.writeFileSync(path.join(s.proj, "du-lieu.sav"), Buffer.from([0, 1, 2, 3]))
    const md = await s.folders.previewFile(PID, "Chương 1/Báo cáo tổng quan.md")
    assert.equal(md.kind, "markdown")
    assert.match(md.text!, /hồi quy logistic/)
    assert.equal(md.openable, true)
    assert.equal((await s.folders.previewFile(PID, "Chương 2/ket-qua.csv")).kind, "csv")
    const docx = await s.folders.previewFile(PID, "Chương 2/phu-luc.docx")
    assert.equal(docx.kind, "document")
    assert.match(docx.text!, /Bảng khảo sát/)
    const pp = await s.folders.previewFile(PID, "Trình bày/bao-ve.pptx")
    assert.match(pp.text!, /PLS-SEM/)
    const img = await s.folders.previewFile(PID, "Hình/so-do.png")
    assert.equal(img.kind, "image")
    assert.match(img.dataUrl!, /^data:image\/png;base64,/)
    assert.equal(img.width, 640)
    const sh = await s.folders.previewFile(PID, "chay.sh")
    assert.equal(sh.kind, "text")
    assert.equal(sh.openable, false)
    const bin = await s.folders.previewFile(PID, "du-lieu.sav")
    assert.equal(bin.kind, "unsupported")
    await assert.rejects(() => s.folders.previewFile(PID, ".git/HEAD.txt"), /ẩn/)
    await assert.rejects(() => s.folders.previewFile(PID, "leak.md"), /symlink/)
    await assert.rejects(() => s.folders.previewFile(PID, "../outside.md"), /ngoài/)
  } finally {
    s.cleanup()
  }
})

test("thư mục gần đây: ghi nhớ khi liên kết, chỉ liên kết nhanh được thư mục đã chọn, quên được", () => {
  const s = setupProject()
  try {
    const other = path.join(path.dirname(s.proj), "DeTai2")
    fs.mkdirSync(other)
    s.folders.link("proj-2", other)
    const list = s.folders.listRecent()
    assert.deepEqual(list.map((r) => r.name), ["DeTai2", "DeTai"])
    assert.equal(list[0].exists, true)
    assert.equal(s.folders.recentMatch(other), other)
    assert.equal(s.folders.recentMatch(path.join(s.base, "outdir")), null, "thư mục chưa từng chọn")
    assert.equal(s.folders.recentMatch("tuong-doi"), null)
    // thư mục gần đây bị thay bằng symlink → không khớp
    fs.rmSync(other, { recursive: true })
    fs.symlinkSync(path.join(s.base, "outdir"), other)
    assert.equal(s.folders.recentMatch(other), null)
    assert.equal(s.folders.forgetRecent(other), true)
    assert.deepEqual(s.folders.listRecent().map((r) => r.name), ["DeTai"])
  } finally {
    s.cleanup()
  }
})

function withTrash(s: ReturnType<typeof setupProject>) {
  const trashed: string[] = []
  const own: string[][] = []
  const changes = new ChangeService({
    resolveRoot: (p) => s.folders.resolveFolder(p),
    storeFile: (p) => path.join(s.base, "userdata2", p, "changes.json"),
    trash: async (abs) => {
      trashed.push(abs)
      fs.rmSync(abs, { recursive: true })
    },
    onWrite: (_p, rels) => own.push(rels),
  })
  return { changes, trashed, own }
}

test("tạo thư mục: là đề xuất; chấp nhận tạo; hoàn tác chỉ khi còn trống; chính sách tên", async () => {
  const s = setupProject()
  try {
    const { changes, own } = withTrash(s)
    const c = changes.proposeMkdir(PID, SID, "Chương 3/Hình vẽ")
    assert.equal(changes.toView(c).isDir, true)
    assert.ok(!fs.existsSync(path.join(s.proj, "Chương 3")), "chưa tạo khi mới đề xuất")
    await changes.accept(PID, c.id)
    assert.ok(fs.statSync(path.join(s.proj, "Chương 3", "Hình vẽ")).isDirectory())
    assert.deepEqual(own.at(-1), ["Chương 3/Hình vẽ"])
    fs.writeFileSync(path.join(s.proj, "Chương 3", "Hình vẽ", "a.png"), "x")
    await assert.rejects(() => changes.undo(PID, c.id), /đã có tệp bên trong/)
    fs.rmSync(path.join(s.proj, "Chương 3", "Hình vẽ", "a.png"))
    await changes.undo(PID, c.id)
    assert.ok(!fs.existsSync(path.join(s.proj, "Chương 3", "Hình vẽ")))
    for (const bad of ["../ngoai", "/tuyet-doi", ".an", "a/.git", "node_modules", "x.", "Tool.app", "con", "a|b", "linkdir/moi", "notes"]) {
      assert.throws(() => changes.proposeMkdir(PID, SID, bad), Error, `phải chặn ${bad}`)
    }
    assert.ok(dirBlockedReason("Chương 1/Hình") === null)
    // Chuyển tệp vào thư mục ĐANG CHỜ tạo (trợ lý hay đề xuất liền nhau): hiểu là «vào trong», duyệt theo thứ tự nào cũng được.
    const mk2 = changes.proposeMkdir(PID, SID, "Bang")
    const mv2 = changes.proposeRename(PID, SID, "bao-cao.md", "Bang")
    assert.equal(mv2.newRelPath, "Bang/bao-cao.md")
    assert.equal(changes.proposeRename(PID, SID, "notes/windows.txt", "Khac/").newRelPath, "Khac/windows.txt")
    await changes.accept(PID, mv2.id)
    const acc = await changes.accept(PID, mk2.id)
    assert.equal(acc.status, "accepted")
    await changes.undo(PID, mv2.id)
    await changes.undo(PID, mk2.id)
    assert.ok(fs.existsSync(path.join(s.proj, "bao-cao.md")))
  } finally {
    s.cleanup()
  }
})

test("đổi tên/di chuyển: thư mục và tệp, chuyển vào thư mục có sẵn, chặn vào chính nó, đổi hoa/thường; hoàn tác", async () => {
  const s = setupProject()
  try {
    const { changes } = withTrash(s)
    fs.mkdirSync(path.join(s.proj, "Luu tru"))
    // tệp → thư mục có sẵn
    const mv = changes.proposeRename(PID, SID, "bao-cao.md", "Luu tru")
    assert.equal(mv.newRelPath, "Luu tru/bao-cao.md")
    // thư mục
    const rd = changes.proposeRename(PID, SID, "notes", "Ghi chép/2026")
    assert.equal(changes.toView(rd).isDir, true)
    assert.throws(() => changes.proposeRename(PID, SID, "notes", "notes/con"), /đề xuất khác|bên trong chính nó/)
    assert.throws(() => changes.proposeRename(PID, SID, "Luu tru", "Luu tru/con"), /bên trong chính nó/)
    assert.throws(() => changes.proposeRename(PID, SID, "Luu tru", ".an"), /ẩn/)
    assert.throws(() => changes.proposeRename(PID, SID, "Luu tru", "../ra-ngoai"), /ngoài/)
    assert.throws(() => changes.proposeRename(PID, SID, "Luu tru", "linkdir/x"), /symlink|ngoài/)
    assert.throws(() => changes.proposeRename(PID, SID, "", "x"), /chính thư mục dự án|ngoài|Không/)
    await changes.accept(PID, mv.id)
    await changes.accept(PID, rd.id)
    assert.ok(fs.existsSync(path.join(s.proj, "Luu tru", "bao-cao.md")))
    assert.ok(fs.existsSync(path.join(s.proj, "Ghi chép", "2026", "windows.txt")))
    assert.ok(!fs.existsSync(path.join(s.proj, "notes")))
    await changes.undo(PID, rd.id)
    await changes.undo(PID, mv.id)
    assert.ok(fs.existsSync(path.join(s.proj, "notes", "windows.txt")))
    assert.ok(fs.existsSync(path.join(s.proj, "bao-cao.md")))
    // hoàn tác bị chặn khi đường cũ đã có thứ khác
    const r2 = changes.proposeRename(PID, SID, "notes", "notes-cu")
    await changes.accept(PID, r2.id)
    fs.mkdirSync(path.join(s.proj, "notes"))
    await assert.rejects(() => changes.undo(PID, r2.id), /Đường dẫn cũ/)
    // đổi hoa/thường (macOS/Windows không phân biệt hoa/thường)
    const caseInsensitive = fs.existsSync(path.join(s.proj, "BAO-CAO.MD"))
    if (caseInsensitive) {
      const cc = changes.proposeRename(PID, SID, "bao-cao.md", "Bao-Cao.md")
      await changes.accept(PID, cc.id)
      assert.ok(fs.readdirSync(s.proj).includes("Bao-Cao.md"))
      await changes.undo(PID, cc.id)
      assert.ok(fs.readdirSync(s.proj).includes("bao-cao.md"))
    }
  } finally {
    s.cleanup()
  }
})

test("xoá → Thùng rác: tệp và thư mục có sao lưu, hoàn tác khôi phục; xung đột khi thư mục đổi; thư mục quá lớn bị từ chối", async () => {
  const s = setupProject()
  try {
    const { changes, trashed } = withTrash(s)
    const del = changes.proposeDelete(PID, SID, "bao-cao.md")
    assert.equal(changes.toView(del).trash, true)
    await changes.accept(PID, del.id)
    assert.deepEqual(trashed, [path.join(s.proj, "bao-cao.md")])
    assert.ok(fs.existsSync(path.join(s.proj, HISTORY_DIR, del.id, "before")))
    await changes.undo(PID, del.id)
    assert.match(fs.readFileSync(path.join(s.proj, "bao-cao.md"), "utf8"), /Báo cáo/)

    fs.mkdirSync(path.join(s.proj, "notes", "sub"))
    fs.writeFileSync(path.join(s.proj, "notes", "sub", "a.md"), "A")
    const dd = changes.proposeDelete(PID, SID, "notes")
    const v = changes.toView(dd)
    assert.equal(v.isDir, true)
    assert.equal(v.fileCount, 2)
    assert.equal(v.binary, false)
    await changes.accept(PID, dd.id)
    assert.ok(!fs.existsSync(path.join(s.proj, "notes")))
    await changes.undo(PID, dd.id)
    assert.equal(fs.readFileSync(path.join(s.proj, "notes", "sub", "a.md"), "utf8"), "A")
    assert.equal(fs.readFileSync(path.join(s.proj, "notes", "windows.txt"), "utf8"), "dòng 1\r\ndòng 2\r\n")

    // thư mục đổi sau khi đề xuất → xung đột, không xoá
    const d2 = changes.proposeDelete(PID, SID, "notes")
    fs.writeFileSync(path.join(s.proj, "notes", "moi.md"), "mới")
    await assert.rejects(() => changes.accept(PID, d2.id), /đã thay đổi/)
    assert.ok(fs.existsSync(path.join(s.proj, "notes", "moi.md")))
    assert.equal(changes.get(PID, d2.id).status, "conflict")

    // Thùng rác lỗi → không xoá gì
    const failing = new ChangeService({
      resolveRoot: (p) => s.folders.resolveFolder(p),
      storeFile: (p) => path.join(s.base, "userdata3", p, "changes.json"),
      trash: async () => {
        throw new Error("ổ mạng không có Thùng rác")
      },
    })
    const d3 = failing.proposeDelete(PID, SID, "bao-cao.md")
    await assert.rejects(() => failing.accept(PID, d3.id), /Thùng rác/)
    assert.ok(fs.existsSync(path.join(s.proj, "bao-cao.md")))

    const big = path.join(s.proj, "lon")
    fs.mkdirSync(big)
    for (let i = 0; i < 1005; i++) fs.writeFileSync(path.join(big, `${i}.txt`), "x")
    assert.throws(() => changes.proposeDelete(PID, SID, "lon"), /quá lớn/)
    assert.throws(() => changes.proposeDelete(PID, SID, ""), /chính thư mục dự án/)
    assert.throws(() => changes.proposeDelete(PID, SID, "linkdir"), /symlink|ngoài/)
    // đề xuất trong thư mục đang chờ → không đề xuất xoá cả thư mục
    changes.proposeWrite(PID, SID, "notes/ghi.md", "x")
    assert.throws(() => changes.proposeDelete(PID, SID, "notes"), /đề xuất khác/)
  } finally {
    s.cleanup()
  }
})

test("theo dõi thay đổi bên ngoài: ghi nhận, bỏ qua thay đổi của app, gộp thư mục cha, lấy xong thì xoá", () => {
  let cb: ((p: string[]) => void) | null = null
  let closed = 0
  let t = 1000
  const tr = new ExternalChangeTracker(
    () => "/du-an",
    ((_root: string, onChange: (p: string[]) => void) => {
      cb = onChange
      return { close: () => closed++ }
    }) as never,
    () => t,
  )
  tr.ensure(PID)
  tr.ensure(PID)
  tr.markOwn(PID, ["bao-cao.md", "Hình"])
  cb!(["bao-cao.md", "Hình/a.png", "Chương 1", "Chương 1/ket-luan.docx", "du-lieu.csv"])
  assert.deepEqual(tr.take(PID), ["Chương 1/ket-luan.docx", "du-lieu.csv"])
  assert.deepEqual(tr.take(PID), [])
  t += 10_000
  cb!(["bao-cao.md"])
  assert.deepEqual(tr.take(PID), ["bao-cao.md"], "hết cửa sổ 5 giây thì coi là sửa bên ngoài")
  tr.closeAll()
  assert.equal(closed, 1)
})

class Scripted implements ChatClient {
  calls: ChatMsg[][] = []
  constructor(private steps: ((m: ChatMsg[]) => Partial<ChatResult>)[]) {}
  async chat(req: { messages: ChatMsg[] }): Promise<ChatResult> {
    this.calls.push(JSON.parse(JSON.stringify(req.messages)))
    const st = this.steps.shift()
    const r = st ? st(req.messages) : { content: "Xong." }
    return { content: r.content ?? "", toolCalls: r.toolCalls ?? [], finishReason: "stop", usage: { promptTokens: 10, completionTokens: 2 } }
  }
}
const call = (id: string, name: string, args: unknown) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } })

test("trợ lý: find_files, search_text toàn thư mục, create_folder + rename_file + delete_file là đề xuất; tổng quan + thay đổi bên ngoài trong prompt", async () => {
  const s = setupProject()
  try {
    seed(s.proj, s.base)
    const { changes } = withTrash(s)
    const search = new FolderSearch()
    const tools = new AgentTools(s.folders, changes, search)
    const ctx = { projectId: PID, sessionId: SID }
    const ff = await tools.execute("find_files", JSON.stringify({ pattern: "*.pptx" }), ctx)
    assert.match(ff.content, /Trình bày\/bao-ve\.pptx/)
    const fd = await tools.execute("find_files", JSON.stringify({ pattern: "chuong", type: "dir" }), ctx)
    assert.match(fd.content, /Chương 1\/\n?/)
    assert.doesNotMatch(fd.content, /\.md/)
    const st = await tools.execute("search_text", JSON.stringify({ query: "PLS-SEM" }), ctx)
    assert.match(st.content, /Trình bày\/bao-ve\.pptx:\d+: Phương pháp PLS-SEM/)
    const stf = await tools.execute("search_text", JSON.stringify({ query: "logistic", file_pattern: "*.txt" }), ctx)
    assert.match(stf.content.normalize("NFC"), /Phỏng vấn\.txt/)
    assert.doesNotMatch(stf.content, /Báo cáo tổng quan\.md/)
    const lf = await tools.execute("list_files", JSON.stringify({ depth: 2 }), ctx)
    assert.match(lf.content, /venv\/ {2}\(thư viện\/bộ đệm — không mở rộng\)/)
    assert.doesNotMatch(lf.content, /lib\//)
    const rf = await tools.execute("read_file", JSON.stringify({ path: "Trình bày/bao-ve.pptx" }), ctx)
    assert.match(rf.content, /chỉ đọc/)
    assert.match(rf.content, /Nhấn mạnh cỡ mẫu 412/)

    const mk = await tools.execute("create_folder", JSON.stringify({ path: "Lưu trữ" }), ctx)
    assert.equal(mk.change?.isDir, true)
    assert.match(mk.content, /ĐỀ XUẤT tạo thư mục Lưu trữ\//)
    const mv = await tools.execute("rename_file", JSON.stringify({ from: "Chương 2", to: "Chương 2 (cũ)" }), ctx)
    assert.equal(mv.ok, true, mv.content)
    assert.match(mv.content, /đổi tên\/di chuyển thư mục/)
    const del = await tools.execute("delete_file", JSON.stringify({ path: "Hình" }), ctx)
    assert.match(del.content, /Thùng rác thư mục Hình\/ \(1 tệp\)/)
    assert.ok(fs.existsSync(path.join(s.proj, "Chương 2")) && fs.existsSync(path.join(s.proj, "Hình")), "chưa thay đổi gì trên đĩa")

    const client = new Scripted([() => ({ content: "Đã xem." })])
    const sessions = new SessionStore((pid) => path.join(s.base, "userdata", pid, "sessions"))
    const agent = new FolderAgent({ client, tools, sessions, changes, folders: s.folders, search, takeExternalChanges: () => ["Chương 1/Báo cáo tổng quan.md"] })
    const session = sessions.create(PID, "x")
    await agent.run({ runId: "r1", projectId: PID, session, text: "Có gì mới?", signal: new AbortController().signal, emit: () => {} })
    const sys = client.calls[0][0].content!
    assert.match(sys, /Toàn thư mục: \d+ tệp, \d+ thư mục con/)
    assert.match(sys, /Bỏ qua khi tìm: .*venv/)
    assert.match(sys, /BÊN NGOÀI[\s\S]*- Chương 1\/Báo cáo tổng quan\.md/)
    assert.match(sys, /find_files/)
    assert.doesNotMatch(buildSystemPrompt("x", "y", "2026-11-10"), /BÊN NGOÀI/)
  } finally {
    s.cleanup()
  }
})

test("tham số từ trang web: lọc tuỳ chọn tìm kiếm; đường dẫn kiểu Windows; tên thư mục cấm trên Windows", async () => {
  const { sanitizeSearchOptions } = await import("../../src/main/ipc")
  assert.deepEqual(sanitizeSearchOptions({ mode: "content", regex: "yes", exts: [".pdf", "docx", "../x", 3], limit: 50, subPath: "a", evil: 1 }), {
    mode: "content",
    subPath: "a",
    exts: [".pdf", "docx"],
    limit: 50,
  })
  assert.deepEqual(sanitizeSearchOptions(null), {})
  for (const n of ["CON", "lpt1", "a/aux.txt", "x:y", "tên?"]) assert.ok(dirBlockedReason(n), `phải chặn ${n}`)
  const s = setupProject()
  try {
    seed(s.proj, s.base)
    const r = await new FolderSearch().search(s.folders.resolveFolder(PID), "logistic", { subPath: "Chương 1\\" })
    assert.equal(r.hits.length, 1)
  } finally {
    s.cleanup()
  }
})
