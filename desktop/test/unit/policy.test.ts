import { test } from "node:test"
import assert from "node:assert/strict"
import {
  decideNavigation,
  decidePermission,
  decideWindowOpen,
  DEFAULT_AUTH_HOSTS,
  isPortalUrl,
  parsePortalUrl,
} from "../../src/main/policy"
import { openBlockedReason, isIgnoredName, extOf } from "../../src/main/fileTypes"
import { restoreBounds } from "../../src/main/windowState"
import { pickLocale, tr } from "../../src/main/i18n"

const prod = parsePortalUrl("https://research.neu.edu.vn")
const sub = parsePortalUrl("https://ai.neu.edu.vn/research/")

test("parsePortalUrl: https bắt buộc trừ localhost", () => {
  assert.deepEqual(prod, { url: "https://research.neu.edu.vn", origin: "https://research.neu.edu.vn", basePath: "" })
  assert.equal(sub.basePath, "/research")
  assert.equal(parsePortalUrl("http://localhost:3000").origin, "http://localhost:3000")
  assert.equal(parsePortalUrl("http://127.0.0.1:3000/").url, "http://127.0.0.1:3000")
  assert.throws(() => parsePortalUrl("http://research.neu.edu.vn"))
  assert.throws(() => parsePortalUrl("file:///etc/passwd"))
  assert.throws(() => parsePortalUrl("https://user:pass@research.neu.edu.vn"))
  assert.throws(() => parsePortalUrl("không phải url"))
})

test("isPortalUrl: origin + basePath", () => {
  assert.equal(isPortalUrl("https://research.neu.edu.vn/assistants/central?rid=1", prod), true)
  assert.equal(isPortalUrl("https://research.neu.edu.vn.evil.com/", prod), false)
  assert.equal(isPortalUrl("http://research.neu.edu.vn/", prod), false)
  assert.equal(isPortalUrl("https://ai.neu.edu.vn/research/tools/quantis", sub), true)
  assert.equal(isPortalUrl("https://ai.neu.edu.vn/research", sub), true)
  assert.equal(isPortalUrl("https://ai.neu.edu.vn/researchx", sub), false)
  assert.equal(isPortalUrl("https://ai.neu.edu.vn/apps", sub), false)
})

test("decideNavigation: hệ thống + đăng nhập Microsoft/ADFS trong cửa sổ, còn lại ra ngoài/chặn", () => {
  const h = DEFAULT_AUTH_HOSTS
  assert.equal(decideNavigation("https://research.neu.edu.vn/login", prod, h), "allow")
  assert.equal(decideNavigation("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?x=1", prod, h), "allow")
  assert.equal(decideNavigation("https://sso.neu.edu.vn/adfs/ls/?wa=wsignin1.0", prod, h), "allow")
  assert.equal(decideNavigation("http://login.microsoftonline.com/", prod, h), "external")
  assert.equal(decideNavigation("https://example.com/", prod, h), "external")
  assert.equal(decideNavigation("https://neu.edu.vn/", prod, h), "external")
  assert.equal(decideNavigation("mailto:research@neu.edu.vn", prod, h), "external")
  assert.equal(decideNavigation("file:///etc/passwd", prod, h), "block")
  assert.equal(decideNavigation("javascript:alert(1)", prod, h), "block")
  assert.equal(decideNavigation("data:text/html,hi", prod, h), "block")
  assert.equal(decideNavigation("smb://server/share", prod, h), "block")
})

test("decideWindowOpen: trang hệ thống → cửa sổ con; ngoài → trình duyệt; đăng nhập không mở cửa sổ con", () => {
  assert.equal(decideWindowOpen("https://research.neu.edu.vn/huong-dan.html", prod), "child")
  assert.equal(decideWindowOpen("https://example.com", prod), "external")
  assert.equal(decideWindowOpen("https://login.microsoftonline.com/", prod), "external")
  assert.equal(decideWindowOpen("about:blank", prod), "block")
  assert.equal(decideWindowOpen("file:///Users/", prod), "block")
})

test("decidePermission: chỉ clipboard ghi, fullscreen, micro cho trang hệ thống", () => {
  const u = "https://research.neu.edu.vn/assistants/central"
  assert.equal(decidePermission("clipboard-sanitized-write", u, prod), true)
  assert.equal(decidePermission("fullscreen", u, prod), true)
  assert.equal(decidePermission("media", u, prod, { mediaTypes: ["audio"] }), true)
  assert.equal(decidePermission("media", u, prod, { mediaTypes: ["video"] }), false)
  assert.equal(decidePermission("media", u, prod, { mediaTypes: ["audio", "video"] }), false)
  assert.equal(decidePermission("media", u, prod), false)
  for (const p of ["geolocation", "notifications", "midi", "midiSysex", "pointerLock", "openExternal", "clipboard-read", "hid", "serial", "usb", "display-capture"]) {
    assert.equal(decidePermission(p, u, prod), false, p)
  }
  assert.equal(decidePermission("clipboard-sanitized-write", "https://example.com", prod), false)
  assert.equal(decidePermission("media", "https://login.microsoftonline.com/", prod, { mediaTypes: ["audio"] }), false)
})

test("openBlockedReason: chặn tệp thực thi/kịch bản, cho phép tài liệu", () => {
  for (const n of ["setup.exe", "run.BAT", "x.ps1", "a.app", "s.command", "t.sh", "analysis.py", "m.js", "z.jar", "evil.exe.", "evil.exe ", "lnk.LNK", "a.webloc"]) {
    assert.ok(openBlockedReason(n, 0o644, "darwin"), n)
  }
  for (const n of ["bao-cao.docx", "data.xlsx", "khao-sat.csv", "notes.md", "fig.png", "paper.pdf", "model.R", "data.sav", "README"]) {
    assert.equal(openBlockedReason(n, 0o644, "darwin"), null, n)
  }
  assert.ok(openBlockedReason("runme", 0o755, "darwin"))
  assert.equal(openBlockedReason("runme", 0o755, "win32"), null)
  assert.equal(extOf("a.tar.gz"), "gz")
  assert.equal(extOf(".env"), "")
})

test("isIgnoredName", () => {
  for (const n of [".git", ".DS_Store", "node_modules", "__pycache__", "~$bao-cao.docx", "Thumbs.db"]) assert.equal(isIgnoredName(n), true, n)
  for (const n of ["data", "bao-cao.docx", "README.md"]) assert.equal(isIgnoredName(n), false, n)
})

test("restoreBounds: giữ vị trí nếu còn trong màn hình, bỏ vị trí nếu màn hình đã rút", () => {
  const screens = [{ x: 0, y: 0, width: 1440, height: 900 }]
  assert.deepEqual(restoreBounds(undefined, screens), { width: 1320, height: 880 })
  assert.deepEqual(restoreBounds({ x: 100, y: 80, width: 1000, height: 700, isMaximized: false }, screens), {
    x: 100,
    y: 80,
    width: 1000,
    height: 700,
  })
  assert.deepEqual(restoreBounds({ x: 2000, y: 80, width: 1000, height: 700, isMaximized: false }, screens), { width: 1000, height: 700 })
})

test("i18n menu", () => {
  assert.equal(pickLocale(undefined), "vi")
  assert.equal(pickLocale("en"), "en")
  assert.equal(tr("vi", "linkFolder"), "Mở thư mục dự án…")
  assert.match(tr("en", "aboutDetail", { version: "1.2.3" }), /Version: 1\.2\.3/)
})
