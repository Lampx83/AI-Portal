/**
 * Môi trường thực hành (lib/sandbox.ts): danh tính suy ra, client không giả được, không admin, ghi đúng id, tài khoản thật không đổi.
 * Chạy qua mountedAppsDispatcher thật với một app nhúng giả ghi lại những gì nó nhận được.
 */
import { test, after, before } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import http from "http"
import os from "os"
import path from "path"
import express from "express"
import { encode } from "next-auth/jwt"

const backendRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-test-"))
process.env.BACKEND_ROOT = backendRoot
// App giả nằm ngoài cây mã nguồn nhưng cần require("express") của backend.
fs.symlinkSync(path.resolve(__dirname, "..", "node_modules"), path.join(backendRoot, "node_modules"))

const REAL = { id: "5b0c7f3e-2f4a-4e6b-9c1d-111111111abc", email: "lam@neu.edu.vn", name: "Lâm" }
const OTHER = { id: "7c1d8a4f-3a5b-4f7c-8d2e-222222222def", email: "other@neu.edu.vn", name: "Khác" }
const SECRET = "test-secret-for-sandbox"

let server: http.Server
let base = ""
let realCookie = ""
let adminCookie = ""
let guestAccountCookie = ""
const ensured: Array<{ id: string; isGuest: boolean; realUserId: string | null }> = []
let sandboxLib: typeof import("../src/lib/sandbox")

function writeFakeApp(alias: string) {
  const dir = path.join(backendRoot, "data", "apps", alias)
  fs.mkdirSync(path.join(dir, "dist"), { recursive: true })
  fs.mkdirSync(path.join(dir, "public"), { recursive: true })
  fs.writeFileSync(path.join(dir, "public", "index.html"), "<!doctype html><html><head><title>x</title></head><body><div id=root></div></body></html>")
  // Trả lại đúng những gì app nhúng thấy: header danh tính, cookie, thân yêu cầu.
  fs.writeFileSync(
    path.join(dir, "dist", "embed.js"),
    `const express = require("express")
module.exports.createEmbedRouter = () => {
  const r = express.Router()
  r.use(express.raw({ type: () => true, limit: "50mb" }))
  r.use((req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body.toString("latin1") : req.body
    res.json({
      path: req.path, method: req.method,
      id: req.headers["x-user-id"], email: req.headers["x-user-email"], name: req.headers["x-user-name"],
      isAdmin: req.headers["x-user-is-admin"], cookie: req.headers.cookie ?? null, auth: req.headers.authorization ?? null,
      adminSecret: req.headers["x-admin-secret"] ?? null, sig: req.headers["x-proxy-user-sig"] ?? null,
      body,
    })
  })
  return r
}`
  )
}

before(async () => {
  for (const a of ["annota", "writium", "surveylab", "paperreviewer", "plagiarismchecker"]) writeFakeApp(a)
  const settings = await import("../src/lib/settings")
  ;(settings as any).setSettingsCache?.({ NEXTAUTH_SECRET: SECRET })
  sandboxLib = await import("../src/lib/sandbox")
  const mounted = await import("../src/lib/mounted-apps")
  sandboxLib.setSandboxStoreForTests({
    async ensure(i) {
      ensured.push({ id: i.id, isGuest: i.isGuest, realUserId: i.realUserId })
    },
    async surveyOwner(shortId) {
      if (shortId === "realsv") return REAL.id
      if (shortId === "sandsv") return sandboxLib.deriveUserSandboxId(REAL.id)
      return null
    },
  })
  realCookie = `next-auth.session-token=${await encode({ token: { id: REAL.id, email: REAL.email, name: REAL.name }, secret: SECRET })}`
  adminCookie = `next-auth.session-token=${await encode({ token: { id: OTHER.id, email: OTHER.email, is_admin: true }, secret: SECRET })}`
  guestAccountCookie = `next-auth.session-token=${await encode({ token: { id: "11111111-1111-1111-1111-111111111111", email: "guest@portal.local" }, secret: SECRET })}`

  const app = express()
  app.use(sandboxLib.sandboxGate())
  app.use(express.json({ limit: "50mb" }))
  app.post("/api/chat/sessions", (_req, res) => res.json({ reached: "real portal route" }))
  app.post("/api/upload", (req, res) => res.json({ sandbox: sandboxLib.getRequestSandbox(req)?.id ?? null, cookie: req.headers.cookie ?? null }))
  app.get("/api/users/me", (req, res) => res.json({ cookie: req.headers.cookie ?? null }))
  app.use("/embed", mounted.createEmbedStaticRouter())
  for (const a of ["annota", "writium", "surveylab", "paperreviewer", "plagiarismchecker"]) await mounted.mountBundledApp(app, a)
  app.use("/api/apps", mounted.mountedAppsDispatcher())
  server = http.createServer(app)
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  base = `http://127.0.0.1:${(server.address() as any).port}`
})

after(() => {
  server?.close()
  fs.rmSync(backendRoot, { recursive: true, force: true })
})

const SANDBOX = { "x-portal-sandbox": "1" }

async function call(p: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const res = await fetch(base + p, init)
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* HTML */
  }
  return { status: res.status, json, text, headers: res.headers }
}

// ───────────────────────── Id suy ra ─────────────────────────

test("id suy ra: ổn định, UUID v5, không bao giờ trùng id thật", () => {
  const { deriveUserSandboxId, deriveGuestSandboxId, uuidv5 } = sandboxLib
  assert.equal(deriveUserSandboxId(REAL.id), deriveUserSandboxId(REAL.id))
  assert.equal(deriveUserSandboxId(REAL.id), deriveUserSandboxId(REAL.id.toUpperCase()))
  assert.notEqual(deriveUserSandboxId(REAL.id), REAL.id)
  assert.notEqual(deriveUserSandboxId(REAL.id), deriveUserSandboxId(OTHER.id))
  // Cùng một chuỗi ở nhánh Khách và nhánh người dùng phải ra id khác nhau.
  assert.notEqual(deriveUserSandboxId(REAL.id), deriveGuestSandboxId(REAL.id))
  assert.match(deriveUserSandboxId(REAL.id), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  // Véc-tơ chuẩn RFC 9562 (không gian DNS, "www.example.com").
  assert.equal(uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"), "2ed6657d-e927-568b-95e1-2665a8aea6a2")
})

test("email thực hành: người đăng nhập @sandbox.local, Khách @local", () => {
  const id = sandboxLib.deriveUserSandboxId(REAL.id)
  assert.equal(sandboxLib.sandboxEmail(id, false), `sandbox-${id.slice(0, 8)}@sandbox.local`)
  assert.equal(sandboxLib.sandboxEmail(id, true), `sandbox-${id.slice(0, 8)}@local`)
})

// ───────────────────────── Danh tính khi gọi app ─────────────────────────

test("có header sandbox: app nhận id thực hành, không thấy cookie phiên", async () => {
  const r = await call("/api/apps/annota/api/annota/data", { method: "POST", headers: { ...SANDBOX, cookie: realCookie, "content-type": "application/json" }, body: "{}" })
  assert.equal(r.status, 200)
  assert.equal(r.json.id, sandboxLib.deriveUserSandboxId(REAL.id))
  assert.notEqual(r.json.id, REAL.id)
  assert.match(r.json.email, /^sandbox-[0-9a-f]{8}@sandbox\.local$/)
  // Header phải là Latin-1: Reviewer/Plagiarism đưa nó vào fetch Headers, ký tự như «ự» làm yêu cầu treo.
  assert.equal(r.json.name, "Thuc hanh")
  assert.equal(r.json.isAdmin, "0")
  // Annota tự giải mã JWT từ cookie: cookie còn đó là ghi vào tài khoản thật.
  assert.equal(r.json.cookie, null)
})

test("không có dấu hiệu sandbox: danh tính thật giữ nguyên", async () => {
  const r = await call("/api/apps/annota/api/annota/data", { method: "POST", headers: { cookie: realCookie, "content-type": "application/json" }, body: "{}" })
  assert.equal(r.json.id, REAL.id)
  assert.equal(r.json.email, REAL.email)
  assert.ok(r.json.cookie?.includes("next-auth.session-token"))
})

test("dự phòng Referer: thiếu header vẫn là thực hành, kể cả khi điều hướng/form", async () => {
  const r = await call("/api/apps/annota/api/annota/data", {
    method: "POST",
    headers: { cookie: realCookie, referer: `${base}/embed/annota?theme=light&sandbox=1`, "content-type": "application/json" },
    body: "{}",
  })
  assert.equal(r.json.id, sandboxLib.deriveUserSandboxId(REAL.id))
  assert.equal(r.json.cookie, null)
})

test("dự phòng Referer: router đổi đường dẫn trong khung về «/» vẫn nhận ra", async () => {
  const r = await call("/api/apps/writium/api/write-articles", { method: "POST", headers: { cookie: realCookie, referer: `${base}/?sandbox=1`, "content-type": "application/json" }, body: "{}" })
  assert.equal(r.json.id, sandboxLib.deriveUserSandboxId(REAL.id))
})

test("Referer của trang thường không kích hoạt sandbox", async () => {
  const r = await call("/api/apps/annota/api/annota/data", { method: "POST", headers: { cookie: realCookie, referer: `${base}/embed/annota?theme=light`, "content-type": "application/json" }, body: "{}" })
  assert.equal(r.json.id, REAL.id)
})

test("client không giả được: mọi header danh tính gửi kèm đều bị bỏ", async () => {
  const r = await call("/api/apps/annota/x", {
    method: "POST",
    headers: {
      ...SANDBOX,
      cookie: `${realCookie}; admin_secret=abc`,
      "x-user-id": OTHER.id,
      "x-user-email": OTHER.email,
      "x-user-name": OTHER.name,
      "x-user-is-admin": "1",
      "x-proxy-user-sig": "deadbeef",
      "x-guest-id": OTHER.id,
      "x-admin-secret": "abc",
      authorization: "Bearer abc",
      "content-type": "application/json",
    },
    body: "{}",
  })
  assert.equal(r.json.id, sandboxLib.deriveUserSandboxId(REAL.id))
  assert.equal(r.json.isAdmin, "0")
  assert.equal(r.json.cookie, null)
  assert.equal(r.json.auth, null)
  assert.equal(r.json.adminSecret, null)
  assert.equal(r.json.sig, null)
})

test("không có admin trong sandbox dù phiên là admin", async () => {
  const r = await call("/api/apps/annota/x", { method: "POST", headers: { ...SANDBOX, cookie: adminCookie, "content-type": "application/json" }, body: "{}" })
  assert.equal(r.json.id, sandboxLib.deriveUserSandboxId(OTHER.id))
  assert.equal(r.json.isAdmin, "0")
})

test("ghi sổ đúng id thực hành và id thật tương ứng; không bao giờ ghi id thật làm id thực hành", async () => {
  await call("/api/apps/surveylab/api/data", { method: "POST", headers: { ...SANDBOX, cookie: realCookie, "content-type": "application/json" }, body: "{}" })
  const row = ensured.find((e) => e.realUserId === REAL.id)
  assert.ok(row)
  assert.equal(row!.id, sandboxLib.deriveUserSandboxId(REAL.id))
  assert.ok(!ensured.some((e) => e.id === REAL.id || e.id === OTHER.id))
})

// ───────────────────────── Khách ─────────────────────────

test("Khách: trang sandbox cấp cookie mã trình duyệt, id ổn định theo cookie, khách dùng chung không vào chung một id", async () => {
  const page = await call("/embed/annota?sandbox=1", { headers: { cookie: guestAccountCookie } })
  assert.equal(page.status, 200)
  const setCookie = page.headers.get("set-cookie") ?? ""
  const m = /portal_sandbox_gid=([0-9a-f-]{36})/.exec(setCookie)
  assert.ok(m, "phải cấp cookie mã trình duyệt")
  assert.match(setCookie, /HttpOnly/i)
  const expected = sandboxLib.deriveGuestSandboxId(m![1])
  const again = await call("/api/apps/annota/x", { method: "POST", headers: { ...SANDBOX, cookie: `${guestAccountCookie}; portal_sandbox_gid=${m![1]}`, "content-type": "application/json" }, body: "{}" })
  assert.equal(again.json.id, expected)
  assert.match(again.json.email, /^sandbox-[0-9a-f]{8}@local$/)
  assert.equal(again.json.cookie, null)
  const other = await call("/api/apps/annota/x", { method: "POST", headers: { ...SANDBOX, cookie: `portal_sandbox_gid=${"a".repeat(8)}-aaaa-4aaa-8aaa-${"a".repeat(12)}`, "content-type": "application/json" }, body: "{}" })
  assert.notEqual(other.json.id, expected)
})

test("Khách không có mã trình duyệt: đọc được, ghi bị từ chối chứ không rơi về đâu cả", async () => {
  const read = await call("/api/apps/annota/x", { headers: SANDBOX })
  assert.equal(read.status, 200)
  const write = await call("/api/apps/annota/x", { method: "POST", headers: { ...SANDBOX, "content-type": "application/json" }, body: "{}" })
  assert.equal(write.status, 403)
  assert.equal(write.json.code, "SANDBOX_NO_BROWSER_ID")
  // Mã rác cũng không được dùng làm đích lưu.
  const bad = await call("/api/apps/annota/x", { method: "POST", headers: { ...SANDBOX, cookie: "portal_sandbox_gid=' OR 1=1", "content-type": "application/json" }, body: "{}" })
  assert.equal(bad.status, 403)
})

// ───────────────────────── Đường ghi ngoài app ─────────────────────────

test("lệnh ghi vào route Portal bị chặn; đọc đi tiếp nhưng ở dạng ẩn danh", async () => {
  const w = await call("/api/chat/sessions", { method: "POST", headers: { ...SANDBOX, cookie: realCookie } })
  assert.equal(w.status, 403)
  assert.equal(w.json.code, "SANDBOX_BLOCKED")
  const viaReferer = await call("/api/chat/sessions", { method: "POST", headers: { cookie: realCookie, referer: `${base}/embed/writium?sandbox=1` } })
  assert.equal(viaReferer.status, 403)
  const r = await call("/api/users/me", { headers: { ...SANDBOX, cookie: realCookie } })
  assert.equal(r.status, 200)
  assert.equal(r.json.cookie, null)
})

test("/api/upload: được phép, gắn id thực hành, không thấy cookie phiên", async () => {
  const r = await call("/api/upload", { method: "POST", headers: { ...SANDBOX, cookie: realCookie, "content-type": "application/json" }, body: "{}" })
  assert.equal(r.status, 200)
  assert.equal(r.json.sandbox, sandboxLib.deriveUserSandboxId(REAL.id))
  assert.equal(r.json.cookie, null)
})

// ───────────────────────── Chính sách từng công cụ ─────────────────────────

test("Writium: chặn merge-guest, sửa qua mã chia sẻ, cộng tác viên; bài của mình vẫn ghi được", async () => {
  const h = { ...SANDBOX, cookie: realCookie, "content-type": "application/json" }
  for (const [method, p] of [
    ["POST", "/api/write-articles/merge-guest"],
    ["PATCH", "/api/write-articles/shared/abc"],
    ["POST", "/api/write-articles/some-id/collaborators"],
    ["DELETE", "/api/write-articles/some-id/collaborators/9"],
  ]) {
    const r = await call(`/api/apps/writium${p}`, { method, headers: h, body: "{}" })
    assert.equal(r.status, 403, `${method} ${p}`)
  }
  const ok = await call("/api/apps/writium/api/write-articles", { method: "POST", headers: h, body: "{}" })
  assert.equal(ok.status, 200)
})

test("đăng nhập riêng của app bị chặn trong sandbox", async () => {
  const r = await call("/api/apps/annota/api/auth/register", { method: "POST", headers: { ...SANDBOX, cookie: realCookie, "content-type": "application/json" }, body: "{}" })
  assert.equal(r.status, 403)
})

test("Surveylab: không gửi được trả lời vào khảo sát thật, khảo sát thực hành thì được", async () => {
  const h = { ...SANDBOX, cookie: realCookie, "content-type": "application/json" }
  assert.equal((await call("/api/apps/surveylab/api/respond/realsv/response", { method: "POST", headers: h, body: "{}" })).status, 403)
  assert.equal((await call("/api/apps/surveylab/api/respond/sandsv/response", { method: "POST", headers: h, body: "{}" })).status, 200)
})

test("Reviewer: bỏ mọi địa chỉ nhận thư trong JSON", async () => {
  const body = { session_id: "s", user: "that@neu.edu.vn", email: "that@neu.edu.vn", cc_emails: ["cc@neu.edu.vn"], context: { user_profile: { email: "that@neu.edu.vn" }, user_url: "http://x", language: "vi" } }
  const r = await call("/api/apps/paperreviewer/v1/review", { method: "POST", headers: { ...SANDBOX, cookie: realCookie, "content-type": "application/json" }, body: JSON.stringify(body) })
  assert.equal(r.status, 200)
  // App giả đọc body sau khi express.raw bỏ qua vì đã có req.body từ lớp trước; ở đây chỉ cần không còn địa chỉ thật.
  assert.ok(!JSON.stringify(r.json).includes("that@neu.edu.vn"))
  assert.ok(!JSON.stringify(r.json).includes("cc@neu.edu.vn"))
  assert.equal(r.json.body.session_id, "s")
  assert.equal(r.json.body.context.language, "vi")
})

test("Reviewer: làm rỗng trường email trong multipart, giữ nguyên tệp nhị phân", async () => {
  const boundary = "----testboundary"
  const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x0d, 0x0a, 0x2d, 0x2d, 0x01])
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="session_id"\r\n\r\ns1\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="email"\r\n\r\nthat@neu.edu.vn\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdf,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  const out = sandboxLib.blankMultipartField(multipart, `multipart/form-data; boundary=${boundary}`, "email")
  assert.ok(!out.includes("that@neu.edu.vn"))
  assert.ok(out.includes(pdf))
  assert.ok(out.includes('name="session_id"\r\n\r\ns1\r\n'))
  assert.ok(out.includes(`name="email"\r\n\r\n\r\n--${boundary}`))
  // Qua cả đường thật.
  const r = await call("/api/apps/paperreviewer/v1/upload", { method: "POST", headers: { ...SANDBOX, cookie: realCookie, "content-type": `multipart/form-data; boundary=${boundary}` }, body: multipart })
  assert.equal(r.status, 200)
  assert.ok(!String(r.json.body).includes("that@neu.edu.vn"))
  assert.ok(String(r.json.body).includes('name="file"'))
})

test("Plagiarism: bỏ additional_notify_email; thân không phải JSON thì không chuyển đi", async () => {
  const body = { user_id: "x", context: { extra_data: { additional_notify_email: "that@neu.edu.vn", document: [{ url: "u" }] } } }
  const h = { ...SANDBOX, cookie: realCookie }
  const r = await call("/api/apps/plagiarismchecker/ask", { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify(body) })
  assert.equal(r.status, 200)
  assert.ok(!JSON.stringify(r.json).includes("that@neu.edu.vn"))
  assert.equal(r.json.body.context.extra_data.document[0].url, "u")
  const raw = await call("/api/apps/plagiarismchecker/ask", { method: "POST", headers: { ...h, "content-type": "text/plain" }, body: JSON.stringify(body) })
  assert.equal(raw.status, 415)
})

// ───────────────────────── Trang HTML ─────────────────────────

test("trang sandbox: script đứng đầu <head>, __PORTAL_USER__ là id thực hành, không lộ id thật", async () => {
  const r = await call("/embed/annota?sandbox=1&theme=light", { headers: { cookie: adminCookie } })
  assert.equal(r.status, 200)
  const sandboxId = sandboxLib.deriveUserSandboxId(OTHER.id)
  assert.ok(r.text.includes(sandboxId))
  assert.ok(!r.text.includes(OTHER.id))
  assert.ok(!r.text.includes(OTHER.email))
  assert.ok(r.text.indexOf("__PORTAL_SANDBOX__") < r.text.indexOf('window.__WRITE_API_BASE__'))
  assert.ok(r.text.indexOf("__PORTAL_SANDBOX__") < r.text.indexOf("<title>"))
  assert.match(r.text, /"isAdmin":false/)
  assert.ok(!/"isAdmin":true/.test(r.text))
  assert.equal(r.headers.get("referrer-policy"), "same-origin")
  assert.equal(r.headers.get("cache-control"), "no-store")
})

test("điều hướng trong khung làm mất ?sandbox=1 vẫn nhận ra nhờ Referer", async () => {
  const r = await call("/embed/annota", { headers: { cookie: realCookie, referer: `${base}/embed/annota?sandbox=1` } })
  assert.ok(r.text.includes("__PORTAL_SANDBOX__"))
  assert.ok(!r.text.includes(REAL.id))
})

test("trang thường không có script sandbox và giữ người dùng thật", async () => {
  const r = await call("/embed/annota?theme=light", { headers: { cookie: realCookie } })
  assert.ok(!r.text.includes("__PORTAL_SANDBOX__"))
  assert.ok(r.text.includes(REAL.id))
})

test("kho không ghi được: lệnh ghi bị từ chối, không đi tiếp", async () => {
  const restore = sandboxLib.setSandboxStoreForTests({
    async ensure() {
      throw new Error("db down")
    },
    async surveyOwner() {
      return null
    },
  })
  try {
    const w = await call("/api/apps/annota/x", { method: "POST", headers: { ...SANDBOX, cookie: realCookie, "content-type": "application/json" }, body: "{}" })
    assert.equal(w.status, 503)
    assert.equal(w.json.code, "SANDBOX_UNAVAILABLE")
  } finally {
    restore()
    sandboxLib.setSandboxStoreForTests({
      async ensure(i) {
        ensured.push({ id: i.id, isGuest: i.isGuest, realUserId: i.realUserId })
      },
      async surveyOwner() {
        return null
      },
    })
  }
})
