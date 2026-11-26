// Kiểm thử đầu-cuối với hệ thống thật (mặc định https://research.neu.edu.vn).
// KHÔNG đăng nhập: chỉ kiểm tra tới khi trang đăng nhập Microsoft hiện ra.
// Chạy: npm run test:e2e   (NEU_E2E_PORTAL=... để đổi máy chủ)
import { test, after, before } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { externalOpened, launch, shot, sleep, tmpDir, waitFor } from "./helpers.mjs"

const PORTAL = process.env.NEU_E2E_PORTAL || "https://research.neu.edu.vn"
const ORIGIN = new URL(PORTAL).origin
const userData = tmpDir("neu-e2e-ud-")
let app
let page

before(async () => {
  ;({ app, page } = await launch({ portalUrl: PORTAL, userData }))
  await waitFor(() => page.url().startsWith(ORIGIN), { timeout: 30_000, message: "mở trang hệ thống" })
  await page.waitForLoadState("load", { timeout: 60_000 })
})

after(async () => {
  await app?.close().catch(() => {})
  fs.rmSync(userData, { recursive: true, force: true })
})

test("cửa sổ mở trang chào của hệ thống, an toàn (sandbox, không có Node)", async () => {
  const info = await waitFor(
    () =>
      page.evaluate(() => {
        const t = document.body?.innerText ?? ""
        return t.length > 50 ? { title: document.title, len: t.length } : null
      }),
    { timeout: 30_000, message: "nội dung trang chào" },
  )
  assert.ok(info.title.length > 0)
  const env = await page.evaluate(() => ({
    require: typeof globalThis.require,
    process: typeof globalThis.process,
    module: typeof globalThis.module,
    ua: navigator.userAgent,
  }))
  assert.equal(env.require, "undefined")
  assert.equal(env.process, "undefined")
  assert.equal(env.module, "undefined")
  assert.match(env.ua, /NEUResearchDesktop\//)
  assert.doesNotMatch(env.ua, /Electron\//)
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    const p = w.webContents.getLastWebPreferences()
    return { contextIsolation: p.contextIsolation, sandbox: p.sandbox, nodeIntegration: p.nodeIntegration, webSecurity: p.webSecurity }
  })
  assert.deepEqual(prefs, { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true })
  await shot(page, "01-trang-chao.png")
})

test("window.neuDesktop có trên origin hệ thống, đủ hàm", async () => {
  const api = await page.evaluate(() => ({
    isDesktop: window.neuDesktop?.isDesktop,
    version: window.neuDesktop?.version,
    keys: Object.keys(window.neuDesktop ?? {}).sort(),
  }))
  assert.equal(api.isDesktop, true)
  assert.match(api.version, /^\d+\.\d+\.\d+/)
  for (const k of ["pickProjectFolder", "linkProjectFolder", "getLinkedFolder", "unlinkProjectFolder", "listFiles", "readTextFile", "revealInFolder", "openFile", "onFolderChange"]) {
    assert.ok(api.keys.includes(k), k)
  }
  // Giai đoạn 2: có trợ lý thư mục, nhưng KHÔNG có hàm ghi tệp trực tiếp — chỉ duyệt đề xuất (agentAccept…).
  for (const k of ["agentGetStatus", "agentConnect", "agentSend", "agentStop", "onAgentEvent", "agentAcceptChange", "agentRejectChange", "agentUndoChange"]) {
    assert.ok(api.keys.includes(k), k)
  }
  assert.ok(!api.keys.some((k) => /^(write|patch|apply|save|delete|remove|rename)/i.test(k)), api.keys.join(","))
})

test("cầu nối từ chối liên kết đường dẫn không qua hộp thoại, dự án chưa liên kết, mã dự án lạ", async () => {
  const r = await page.evaluate(async () => {
    const out = {}
    const tryIt = async (k, fn) => {
      try {
        await fn()
        out[k] = "OK"
      } catch (e) {
        out[k] = String(e.message)
      }
    }
    await tryIt("linkNoPick", () => window.neuDesktop.linkProjectFolder("p1", "/etc"))
    await tryIt("listUnlinked", () => window.neuDesktop.listFiles("p1"))
    await tryIt("badId", () => window.neuDesktop.listFiles("../../etc"))
    await tryIt("readTraversal", () => window.neuDesktop.readTextFile("p1", "../../../etc/passwd"))
    out.getLinked = await window.neuDesktop.getLinkedFolder("p1")
    return out
  })
  assert.match(r.linkNoPick, /vừa chọn trong hộp thoại/)
  assert.match(r.listUnlinked, /chưa liên kết/)
  assert.match(r.badId, /Mã dự án không hợp lệ/)
  assert.notEqual(r.readTraversal, "OK")
  assert.equal(r.getLinked, null)
})

test("chặn cửa sổ mới tới domain lạ (mở bằng trình duyệt), cho phép trang của hệ thống", async () => {
  const before = app.windows().length
  await page.evaluate(() => window.open("https://example.com/la", "_blank"))
  await sleep(1200)
  assert.equal(app.windows().length, before, "không tạo cửa sổ cho domain lạ")
  assert.ok((await externalOpened(app)).includes("https://example.com/la"))

  const childPromise = app.waitForEvent("window", { timeout: 15_000 })
  await page.evaluate((o) => window.open(`${o}/huong-dan.html`, "_blank"), ORIGIN)
  const child = await childPromise
  await child.waitForLoadState("domcontentloaded")
  assert.ok(child.url().startsWith(ORIGIN))
  const childPrefs = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => {
      const p = w.webContents.getLastWebPreferences()
      return p.sandbox === true && p.contextIsolation === true && p.nodeIntegration === false
    }),
  )
  assert.ok(childPrefs.every(Boolean), "cửa sổ con cũng sandbox")
  await child.close()
})

test("chặn điều hướng trong cửa sổ tới domain lạ và file://", async () => {
  const start = page.url()
  await page.evaluate(() => {
    location.href = "https://example.org/dieu-huong"
  })
  await sleep(1500)
  assert.ok(page.url().startsWith(ORIGIN), `vẫn ở hệ thống (đang ở ${page.url()})`)
  assert.ok((await externalOpened(app)).includes("https://example.org/dieu-huong"))
  await page.evaluate(() => {
    location.href = "file:///etc/hosts"
  })
  await sleep(1000)
  assert.ok(page.url().startsWith(ORIGIN))
  assert.ok(!(await externalOpened(app)).some((u) => u.startsWith("file:")))
  assert.equal(new URL(page.url()).origin, new URL(start).origin)
})

test("từ chối quyền không cần (vị trí, camera, thông báo)", async () => {
  const r = await page.evaluate(async () => {
    const geo = await new Promise((res) =>
      navigator.geolocation.getCurrentPosition(
        () => res("granted"),
        (e) => res(`denied:${e.code}`),
        { timeout: 5000 },
      ),
    )
    let cam = "?"
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      s.getTracks().forEach((t) => t.stop())
      cam = "granted"
    } catch (e) {
      cam = e.name
    }
    const notif = await Notification.requestPermission()
    return { geo, cam, notif }
  })
  assert.equal(r.geo, "denied:1")
  assert.equal(r.cam, "NotAllowedError")
  assert.equal(r.notif, "denied")
})

test("đăng nhập Microsoft: chuyển hướng OAuth ngay trong cửa sổ, cầu nối KHÔNG có ở trang Microsoft", async () => {
  await page.goto(`${ORIGIN}/login`)
  await page.waitForLoadState("load")
  const btn = page.getByRole("button", { name: /Microsoft/i })
  await btn.first().waitFor({ timeout: 30_000 })
  await shot(page, "02-trang-dang-nhap.png")
  await btn.first().click()
  await waitFor(() => /login\.microsoftonline\.com|login\.live\.com/.test(page.url()), {
    timeout: 30_000,
    message: "chuyển tới trang đăng nhập Microsoft",
  })
  await page.waitForLoadState("load")
  // Chờ ô nhập email của Microsoft hiện (không nhập gì).
  await page.locator('input[name="loginfmt"], input[type="email"]').first().waitFor({ state: "visible", timeout: 30_000 })
  await sleep(800)
  const onMs = await page.evaluate(() => ({ has: typeof window.neuDesktop, host: location.host }))
  assert.equal(onMs.has, "undefined")
  assert.match(onMs.host, /microsoft|live/)
  assert.equal(app.windows().length, 1, "không mở cửa sổ phụ")
  assert.ok(!(await externalOpened(app)).some((u) => /microsoft/.test(u)), "không đẩy ra trình duyệt ngoài")
  await shot(page, "03-dang-nhap-microsoft.png")
  // Quay lại hệ thống: cầu nối có lại.
  await page.goto(PORTAL)
  await page.waitForLoadState("domcontentloaded")
  assert.equal(await page.evaluate(() => window.neuDesktop?.isDesktop), true)
})

test("phiên (cookie) lưu bền qua lần mở lại ứng dụng", async () => {
  await app.evaluate(async ({ session }, origin) => {
    const ses = session.fromPartition("persist:neu-research")
    await ses.cookies.set({ url: origin, name: "neu_e2e_persist", value: "1", expirationDate: Math.floor(Date.now() / 1000) + 3600, secure: origin.startsWith("https") })
    await ses.cookies.flushStore()
  }, ORIGIN)
  // Ghi nhớ kích thước cửa sổ
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 60, y: 60, width: 1111, height: 777 }))
  await sleep(800)
  await app.close()
  ;({ app, page } = await launch({ portalUrl: PORTAL, userData }))
  const found = await app.evaluate(async ({ session }, origin) => {
    const ses = session.fromPartition("persist:neu-research")
    return (await ses.cookies.get({ url: origin, name: "neu_e2e_persist" })).length
  }, ORIGIN)
  assert.equal(found, 1)
  const b = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())
  assert.equal(b.width, 1111)
  assert.equal(b.height, 777)
  assert.ok(fs.existsSync(path.join(userData, "Partitions", "neu-research")))
})
