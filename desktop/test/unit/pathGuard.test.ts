import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import os from "os"
import path from "path"
import { forbiddenRootReason, isInside, parseRelativePath, PathAccessError, resolveInside } from "../../src/main/pathGuard"

function sandbox() {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "neu-pg-")))
  const root = path.join(base, "project")
  const outside = path.join(base, "secret")
  fs.mkdirSync(path.join(root, "data", "raw"), { recursive: true })
  fs.mkdirSync(outside)
  fs.writeFileSync(path.join(root, "data", "survey.csv"), "a,b\n1,2\n")
  fs.writeFileSync(path.join(outside, "passwords.txt"), "top secret")
  return { base, root, outside, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) }
}

const rejects = (fn: () => unknown, code?: string) =>
  assert.throws(fn, (e: unknown) => e instanceof PathAccessError && (!code || e.code === code))

test("parseRelativePath: chấp nhận đường dẫn tương đối bình thường", () => {
  assert.deepEqual(parseRelativePath("data/survey.csv"), ["data", "survey.csv"])
  assert.deepEqual(parseRelativePath("data\\raw\\x.txt"), ["data", "raw", "x.txt"])
  assert.deepEqual(parseRelativePath("./data//survey.csv"), ["data", "survey.csv"])
  assert.deepEqual(parseRelativePath(""), [])
  assert.deepEqual(parseRelativePath(undefined), [])
  assert.deepEqual(parseRelativePath("Dữ liệu/khảo sát 2026.xlsx"), ["Dữ liệu", "khảo sát 2026.xlsx"])
})

test("parseRelativePath: chặn .., đường dẫn tuyệt đối, ổ đĩa, UNC, NUL, ~", () => {
  rejects(() => parseRelativePath("../secret/passwords.txt"), "OUTSIDE_ROOT")
  rejects(() => parseRelativePath("data/../../secret"), "OUTSIDE_ROOT")
  rejects(() => parseRelativePath("data\\..\\..\\secret"), "OUTSIDE_ROOT")
  rejects(() => parseRelativePath("/etc/passwd"), "INVALID_PATH")
  rejects(() => parseRelativePath("C:\\Windows\\win.ini"), "INVALID_PATH")
  rejects(() => parseRelativePath("c:/Windows"), "INVALID_PATH")
  rejects(() => parseRelativePath("\\\\server\\share\\x"), "INVALID_PATH")
  rejects(() => parseRelativePath("~/Documents"), "INVALID_PATH")
  rejects(() => parseRelativePath("data/a\0.txt"), "INVALID_PATH")
  rejects(() => parseRelativePath("file.txt:stream"), "INVALID_PATH")
  rejects(() => parseRelativePath(42 as unknown), "INVALID_PATH")
  rejects(() => parseRelativePath("a/".repeat(3000)), "INVALID_PATH")
})

test("resolveInside: đọc được tệp trong thư mục dự án", () => {
  const s = sandbox()
  try {
    const r = resolveInside(s.root, "data/survey.csv")
    assert.equal(r.absPath, path.join(s.root, "data", "survey.csv"))
    assert.equal(r.relPath, "data/survey.csv")
    assert.equal(resolveInside(s.root, "").absPath, s.root)
  } finally {
    s.cleanup()
  }
})

test("resolveInside: chặn .. thoát ra ngoài kể cả khi tệp đích tồn tại", () => {
  const s = sandbox()
  try {
    rejects(() => resolveInside(s.root, "../secret/passwords.txt"), "OUTSIDE_ROOT")
    rejects(() => resolveInside(s.root, path.join(s.outside, "passwords.txt")), "INVALID_PATH")
  } finally {
    s.cleanup()
  }
})

test("resolveInside: chặn symlink (tệp và thư mục) trỏ ra ngoài", () => {
  const s = sandbox()
  try {
    fs.symlinkSync(path.join(s.outside, "passwords.txt"), path.join(s.root, "link-file.txt"))
    fs.symlinkSync(s.outside, path.join(s.root, "link-dir"), "dir")
    rejects(() => resolveInside(s.root, "link-file.txt"), "OUTSIDE_ROOT")
    rejects(() => resolveInside(s.root, "link-dir"), "OUTSIDE_ROOT")
    rejects(() => resolveInside(s.root, "link-dir/passwords.txt"), "OUTSIDE_ROOT")
    // Tệp chưa tồn tại bên trong thư mục symlink ra ngoài (giai đoạn 2: ghi tệp mới) cũng bị chặn.
    rejects(() => resolveInside(s.root, "link-dir/new.txt", { mustExist: false }), "OUTSIDE_ROOT")
  } finally {
    s.cleanup()
  }
})

test("resolveInside: symlink trỏ vào trong thư mục dự án thì được phép", () => {
  const s = sandbox()
  try {
    fs.symlinkSync(path.join(s.root, "data"), path.join(s.root, "alias"), "dir")
    const r = resolveInside(s.root, "alias/survey.csv")
    assert.equal(r.absPath, path.join(s.root, "data", "survey.csv"))
  } finally {
    s.cleanup()
  }
})

test("resolveInside: thư mục gốc là symlink vẫn hoạt động; tiền tố trùng tên không lọt", () => {
  const s = sandbox()
  try {
    const rootLink = path.join(s.base, "root-link")
    fs.symlinkSync(s.root, rootLink, "dir")
    assert.equal(resolveInside(rootLink, "data/survey.csv").absPath, path.join(s.root, "data", "survey.csv"))
    // "project-evil" có tiền tố "project" nhưng không nằm trong "project".
    fs.mkdirSync(path.join(s.base, "project-evil"))
    fs.symlinkSync(path.join(s.base, "project-evil"), path.join(s.root, "evil"), "dir")
    rejects(() => resolveInside(s.root, "evil"), "OUTSIDE_ROOT")
  } finally {
    s.cleanup()
  }
})

test("resolveInside: tệp không tồn tại và thư mục gốc đã mất", () => {
  const s = sandbox()
  try {
    rejects(() => resolveInside(s.root, "khong-co.txt"), "NOT_FOUND")
    const r = resolveInside(s.root, "data/moi.txt", { mustExist: false })
    assert.equal(r.exists, false)
    assert.equal(r.absPath, path.join(s.root, "data", "moi.txt"))
    rejects(() => resolveInside(path.join(s.base, "da-xoa"), "x"), "ROOT_MISSING")
  } finally {
    s.cleanup()
  }
})

test("isInside: so sánh theo nền tảng", () => {
  assert.equal(isInside("/a/b", "/a/b/c", "linux"), true)
  assert.equal(isInside("/a/b", "/a/bc", "linux"), false)
  assert.equal(isInside("/a/b", "/a/B/c", "linux"), false)
  assert.equal(isInside("/a/b", "/a/B/c", "darwin"), true)
  assert.equal(isInside("C:\\Du an", "c:\\du an\\data", "win32"), true)
  assert.equal(isInside("C:\\Du an", "C:\\Du an 2", "win32"), false)
})

test("forbiddenRootReason: chặn gốc ổ đĩa, thư mục người dùng, thư mục hệ thống", () => {
  assert.ok(forbiddenRootReason("/", "/Users/lam", "darwin"))
  assert.ok(forbiddenRootReason("/Users/lam", "/Users/lam", "darwin"))
  assert.ok(forbiddenRootReason("/Users", "/Users/lam", "darwin"))
  assert.ok(forbiddenRootReason("/System/Library", "/Users/lam", "darwin"))
  assert.ok(forbiddenRootReason("/Users/lam/Library/Keychains", "/Users/lam", "darwin"))
  assert.ok(forbiddenRootReason("/Volumes/USB", "/Users/lam", "darwin"))
  assert.equal(forbiddenRootReason("/Volumes/USB/DuAn", "/Users/lam", "darwin"), null)
  assert.equal(forbiddenRootReason("/Users/lam/Documents/NCKH/De tai 1", "/Users/lam", "darwin"), null)
  assert.ok(forbiddenRootReason("C:\\", "C:\\Users\\lam", "win32"))
  assert.ok(forbiddenRootReason("D:\\", "C:\\Users\\lam", "win32"))
  assert.ok(forbiddenRootReason("C:\\Windows\\System32", "C:\\Users\\lam", "win32"))
  assert.ok(forbiddenRootReason("c:\\users\\LAM", "C:\\Users\\lam", "win32"))
  assert.equal(forbiddenRootReason("D:\\NCKH\\De tai", "C:\\Users\\lam", "win32"), null)
})
