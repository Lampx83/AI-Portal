import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import os from "os"
import path from "path"
import { ConfigStore } from "../../src/main/config"
import { LIMITS, ProjectFolderService } from "../../src/main/projectFolders"
import { CHANNELS } from "../../src/shared/api"
import { watchFolder } from "../../src/main/watcher"

function setup() {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "neu-pf-")))
  const home = path.join(base, "home")
  const proj = path.join(home, "NCKH", "De tai A")
  fs.mkdirSync(path.join(proj, "data"), { recursive: true })
  fs.mkdirSync(path.join(proj, "node_modules", "x"), { recursive: true })
  fs.writeFileSync(path.join(proj, "README.md"), "﻿# Đề tài A\nNội dung")
  fs.writeFileSync(path.join(proj, ".hidden"), "x")
  fs.writeFileSync(path.join(proj, "data", "khao-sat.csv"), "a,b\n1,2\n")
  fs.writeFileSync(path.join(proj, "data", "img.bin"), Buffer.from([1, 2, 0, 3]))
  fs.writeFileSync(path.join(proj, "setup.sh"), "#!/bin/sh\necho hi\n")
  fs.writeFileSync(path.join(base, "outside.txt"), "secret")
  fs.symlinkSync(path.join(base, "outside.txt"), path.join(proj, "leak.txt"))
  const store = new ConfigStore(path.join(base, "cfg", "config.json"))
  let origin = "https://research.neu.edu.vn"
  const svc = new ProjectFolderService(store, () => origin, home)
  return {
    base,
    home,
    proj,
    store,
    svc,
    setOrigin: (o: string) => (origin = o),
    cleanup: () => fs.rmSync(base, { recursive: true, force: true }),
  }
}

test("liên kết, đọc lại từ tệp cấu hình, tách theo origin, bỏ liên kết", () => {
  const s = setup()
  try {
    const info = s.svc.link("3f2a-uuid_1", s.proj)
    assert.equal(info.path, s.proj)
    assert.equal(info.name, "De tai A")
    assert.equal(info.exists, true)
    // Đọc lại từ đĩa (giả lập khởi động lại ứng dụng)
    const again = new ProjectFolderService(new ConfigStore(s.store.file), () => "https://research.neu.edu.vn", s.home)
    assert.equal(again.get("3f2a-uuid_1")?.path, s.proj)
    // Origin khác không thấy liên kết
    s.setOrigin("http://localhost:3000")
    assert.equal(s.svc.get("3f2a-uuid_1"), null)
    s.setOrigin("https://research.neu.edu.vn")
    assert.equal(s.svc.unlink("3f2a-uuid_1"), true)
    assert.equal(s.svc.get("3f2a-uuid_1"), null)
    assert.equal(s.svc.unlink("3f2a-uuid_1"), false)
  } finally {
    s.cleanup()
  }
})

test("không liên kết thư mục người dùng, mã dự án lạ, đường dẫn tương đối", () => {
  const s = setup()
  try {
    assert.throws(() => s.svc.link("p1", s.home), /thư mục người dùng/)
    assert.throws(() => s.svc.link("p1", path.dirname(s.home)), /chứa cả thư mục người dùng/)
    assert.throws(() => s.svc.link("../../x", s.proj), /Mã dự án/)
    assert.throws(() => s.svc.link("p1", "NCKH/De tai A"), /không hợp lệ/)
    assert.throws(() => s.svc.link("p1", path.join(s.proj, "README.md")), /không phải thư mục/)
  } finally {
    s.cleanup()
  }
})

test("listFiles: bỏ tệp ẩn/node_modules/symlink ra ngoài, thư mục trước", () => {
  const s = setup()
  try {
    s.svc.link("p1", s.proj)
    const r = s.svc.listFiles("p1")
    assert.deepEqual(
      r.entries.map((e) => `${e.type}:${e.relPath}`),
      ["dir:data", "file:README.md", "file:setup.sh"],
    )
    const sub = s.svc.listFiles("p1", "data")
    assert.deepEqual(sub.entries.map((e) => e.relPath), ["data/img.bin", "data/khao-sat.csv"])
    assert.equal(sub.entries[1].ext, "csv")
    assert.throws(() => s.svc.listFiles("p1", ".."), /ngoài/)
    assert.throws(() => s.svc.listFiles("p2"), /chưa liên kết/)
  } finally {
    s.cleanup()
  }
})

test("readTextFile: bỏ BOM, chặn nhị phân, chặn symlink ra ngoài, cắt theo giới hạn", () => {
  const s = setup()
  try {
    s.svc.link("p1", s.proj)
    const r = s.svc.readTextFile("p1", "README.md")
    assert.equal(r.content, "# Đề tài A\nNội dung")
    assert.equal(r.truncated, false)
    assert.throws(() => s.svc.readTextFile("p1", "data/img.bin"), /nhị phân/)
    assert.throws(() => s.svc.readTextFile("p1", "leak.txt"), /ngoài/)
    assert.throws(() => s.svc.readTextFile("p1", "../outside.txt"), /ngoài/)
    assert.throws(() => s.svc.readTextFile("p1", path.join(s.base, "outside.txt")), /tương đối/)
    const old = LIMITS.maxReadBytes
    LIMITS.maxReadBytes = 5
    try {
      const t = s.svc.readTextFile("p1", "data/khao-sat.csv")
      assert.equal(t.content, "a,b\n1")
      assert.equal(t.truncated, true)
      assert.equal(t.size, 8)
    } finally {
      LIMITS.maxReadBytes = old
    }
  } finally {
    s.cleanup()
  }
})

test("resolveForOpen: chặn kịch bản và thư mục; resolveForReveal mặc định là gốc", () => {
  const s = setup()
  try {
    s.svc.link("p1", s.proj)
    assert.equal(s.svc.resolveForOpen("p1", "data/khao-sat.csv"), path.join(s.proj, "data", "khao-sat.csv"))
    assert.throws(() => s.svc.resolveForOpen("p1", "setup.sh"), /\.sh/)
    assert.throws(() => s.svc.resolveForOpen("p1", "data"), /Chỉ mở được tệp/)
    assert.throws(() => s.svc.resolveForOpen("p1", "leak.txt"), /ngoài/)
    assert.equal(s.svc.resolveForReveal("p1"), s.proj)
    assert.equal(s.svc.resolveForReveal("p1", "data/khao-sat.csv"), path.join(s.proj, "data", "khao-sat.csv"))
  } finally {
    s.cleanup()
  }
})

test("thư mục bị xoá sau khi liên kết: get báo exists=false, list báo lỗi rõ", () => {
  const s = setup()
  try {
    s.svc.link("p1", s.proj)
    fs.rmSync(s.proj, { recursive: true, force: true })
    assert.equal(s.svc.get("p1")?.exists, false)
    assert.throws(() => s.svc.listFiles("p1"), /không còn tồn tại/)
  } finally {
    s.cleanup()
  }
})

test("watchFolder: báo thay đổi, bỏ qua tệp ẩn", async () => {
  const s = setup()
  try {
    const events: string[][] = []
    const h = watchFolder(s.proj, (p) => events.push(p), { debounceMs: 150 })
    await new Promise((r) => setTimeout(r, 300))
    fs.writeFileSync(path.join(s.proj, ".tmp-hidden"), "x")
    fs.writeFileSync(path.join(s.proj, "data", "moi.csv"), "x")
    await new Promise((r) => setTimeout(r, 1500))
    h.close()
    const all = events.flat()
    assert.ok(all.includes("data/moi.csv"), JSON.stringify(events))
    assert.ok(!all.some((p) => p.includes(".tmp-hidden")))
  } finally {
    s.cleanup()
  }
})

test("tên kênh trong preload khớp CHANNELS (preload sandbox không import được)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "..", "src", "preload", "preload.ts"), "utf8")
  const used = new Set([...src.matchAll(/"(neu:[a-z:-]+)"/g)].map((m) => m[1]))
  const known = new Set<string>(Object.values(CHANNELS))
  for (const c of used) assert.ok(known.has(c), `kênh lạ trong preload: ${c}`)
  for (const c of known) assert.ok(used.has(c), `preload thiếu kênh: ${c}`)
})
