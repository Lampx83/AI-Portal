// Kiểm thử đầu-cuối «Trợ lý thư mục» (giai đoạn 2): Electron thật + frontend + backend cục bộ + LLM giả lập.
// Cần chạy trước (xem README → Kiểm thử trợ lý thư mục):
//   Postgres tạm + backend (POST /api/desktop/*) trỏ Central LLM tới test/fixtures/mock-llm.mjs,
//   frontend `next dev` với BACKEND_URL tới backend đó.
// Biến môi trường:
//   NEU_E2E_LOCAL=http://localhost:3000        frontend cục bộ
//   NEU_E2E_SESSION_COOKIE=<JWT NextAuth>      phiên đăng nhập của tài khoản thử (tạo bằng secret tạm của hệ cục bộ)
// Không có hai biến này thì bỏ qua.
import { test, after, before } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { launch, shot, sleep, tmpDir, waitFor } from "./helpers.mjs"

const LOCAL = process.env.NEU_E2E_LOCAL
const COOKIE = process.env.NEU_E2E_SESSION_COOKIE
const skip = (!LOCAL || !COOKIE) && "Đặt NEU_E2E_LOCAL và NEU_E2E_SESSION_COOKIE để chạy"
const PROJECT_ID = "00000000-0000-4000-8000-00000000d351"
const NOTE = "# Ghi chú đề tài\n\nĐây là ghi chú có lổi chính tả về ứng dụng AI trong học tập của sinh viên.\n\nCần khảo sát 300 sinh viên.\n"

let app
let page
let userData
let folder

before(async () => {
  if (skip) return
  userData = tmpDir("neu-e2e-agent-ud-")
  folder = path.join(tmpDir("neu-e2e-agent-"), "De tai AI hoc tap")
  fs.mkdirSync(path.join(folder, "Du lieu"), { recursive: true })
  fs.writeFileSync(path.join(folder, "ghi-chu.md"), NOTE)
  fs.writeFileSync(path.join(folder, "refs.bib"), "@article{lam2026, title={AI trong giáo dục}, author={Phạm, Lâm}, year={2026}}\n")
  fs.writeFileSync(path.join(folder, "Du lieu", "khao-sat.csv"), "id,diem\n1,8\n")
  ;({ app, page } = await launch({ portalUrl: LOCAL, userData }))
  const origin = new URL(LOCAL).origin
  await app.evaluate(async ({ session }, { url, value }) => {
    await session.fromPartition("persist:neu-research").cookies.set({ url, name: "next-auth.session-token", value, httpOnly: true, sameSite: "lax" })
  }, { url: origin, value: COOKIE })
  await page.goto(`${LOCAL}/dev/desktop-folder`)
  await page.waitForLoadState("load")
  await page.evaluate((lang) => {
    localStorage.setItem("neu-locale", lang)
    localStorage.setItem("neu-locale-user-set", "1")
  }, process.env.NEU_E2E_LANG || "vi")
  await page.reload()
  await page.waitForLoadState("load")
  await page.getByTestId("desktop-folder-card").waitFor({ timeout: 120_000 })
  await app.evaluate((_e, p) => {
    globalThis.__neuNextPick = p
  }, folder)
  await page.getByTestId("desktop-folder-card").getByRole("button", { name: /Chọn thư mục|Choose folder/ }).click()
  await page.getByTestId("folder-assistant").waitFor({ timeout: 30_000 })
})

after(async () => {
  await app?.close().catch(() => {})
  if (userData) fs.rmSync(userData, { recursive: true, force: true })
  if (folder) fs.rmSync(path.dirname(folder), { recursive: true, force: true })
})

const panel = () => page.getByTestId("folder-assistant")
const read = (p) => fs.readFileSync(path.join(folder, p), "utf8")

async function ask(text) {
  await panel().getByTestId("agent-input").fill(text)
  await panel().getByTestId("agent-send").click()
}

async function waitIdle() {
  await waitFor(async () => (await panel().getByTestId("agent-send").count()) > 0, { timeout: 60_000, message: "trợ lý trả lời xong" })
}

test("kết nối: tiến trình chính xin token bằng phiên đăng nhập web; trang không thấy token", { skip }, async () => {
  assert.match(await panel().innerText(), /Bật trợ lý thư mục|Turn on folder assistant/)
  await shot(page, "08-tro-ly-chua-ket-noi.png")
  await panel().getByTestId("agent-connect").click()
  await panel().getByTestId("agent-input").waitFor({ timeout: 30_000 })
  const leaked = await page.evaluate(() => JSON.stringify({ c: document.cookie, l: { ...localStorage }, s: { ...sessionStorage } }))
  assert.doesNotMatch(leaked, /neuda_|neudr_/)
  const st = await page.evaluate(() => window.neuDesktop.agentGetStatus())
  assert.equal(st.connected, true)
  assert.equal(st.user.email, "e2e-tester@example.test")
  assert.equal(JSON.stringify(st).includes("neuda_"), false)
  const authFile = fs.readFileSync(path.join(userData, "neu-desktop-auth.json"), "utf8")
  assert.doesNotMatch(authFile, /neuda_|neudr_|e2e-tester/, "token được mã hoá bằng safeStorage")
})

test("đề xuất sửa chính tả: diff hiện ra, tệp CHƯA bị ghi; Chấp nhận ghi đúng; Hoàn tác khôi phục", { skip }, async () => {
  await ask("Sửa chính tả tệp ghi-chu.md giúp tôi")
  const card = panel().getByTestId("agent-change").first()
  await card.waitFor({ timeout: 60_000 })
  await waitIdle()
  assert.equal(await card.getAttribute("data-status"), "pending")
  assert.equal(read("ghi-chu.md"), NOTE, "chưa ghi khi mới đề xuất")
  const del = await card.locator('[data-diff-line="del"]').allInnerTexts()
  const add = await card.locator('[data-diff-line="add"]').allInnerTexts()
  assert.ok(del.some((l) => l.includes("lổi chính tả")), JSON.stringify(del))
  assert.ok(add.some((l) => l.includes("lỗi chính tả")), JSON.stringify(add))
  const tools = await panel().getByTestId("agent-tool").allInnerTexts()
  assert.ok(tools.some((t) => t.includes("ghi-chu.md")), JSON.stringify(tools))
  await shot(page, "09-tro-ly-de-xuat-diff.png")

  // Mã chạy trên trang (vd mã độc) gọi thẳng API ghi khi người dùng KHÔNG vừa bấm gì (trạng thái «user activation»
  // của trình duyệt chỉ kéo dài vài giây sau một thao tác thật) → bị từ chối, không hỏi xác nhận, không ghi.
  const changeId = await card.getAttribute("data-change-id")
  const before = (await app.evaluate(() => globalThis.__neuConfirmCalls.length))
  const err = await page.evaluate(({ pid, id }) => new Promise((resolve) => {
    setTimeout(() => {
      window.neuDesktop.agentAcceptChange(pid, id).then(() => resolve("OK"), (e) => resolve(e.message))
    }, 7000)
  }), { pid: PROJECT_ID, id: changeId })
  assert.match(err, /bấm nút/)
  assert.equal(await app.evaluate(() => globalThis.__neuConfirmCalls.length), before)
  assert.equal(read("ghi-chu.md"), NOTE)

  // Người dùng huỷ ở hộp thoại xác nhận → không ghi.
  await app.evaluate(() => {
    globalThis.__neuConfirm = { ok: false, trust: false }
  })
  await card.getByTestId("agent-accept").click()
  await sleep(800)
  assert.equal(read("ghi-chu.md"), NOTE)
  assert.equal(await card.getAttribute("data-status"), "pending")

  await app.evaluate(() => {
    globalThis.__neuConfirm = { ok: true, trust: false }
  })
  await card.getByTestId("agent-accept").click()
  await waitFor(async () => (await card.getAttribute("data-status")) === "accepted", { message: "đã ghi" })
  assert.equal(read("ghi-chu.md"), NOTE.replace("lổi", "lỗi"))
  assert.equal(fs.readFileSync(path.join(folder, ".neu-research", "history", changeId, "before"), "utf8"), NOTE)
  const calls = await app.evaluate(() => globalThis.__neuConfirmCalls)
  assert.equal(calls.length, 2, "hỏi xác nhận 2 lần (lần huỷ + lần đồng ý)")
  assert.equal(calls[1].kind, "accept")
  assert.equal(calls[1].change.relPath, "ghi-chu.md")
  await shot(page, "10-tro-ly-da-ghi.png")

  await card.getByTestId("agent-undo").click()
  await waitFor(async () => (await card.getAttribute("data-status")) === "undone", { message: "đã hoàn tác" })
  assert.equal(read("ghi-chu.md"), NOTE)
  // Thẻ «Thư mục trên máy» không hiện thư mục ẩn .neu-research
  assert.doesNotMatch(await page.getByTestId("desktop-folder-card").innerText(), /neu-research/)
})

test("phiên mới: đề xuất tạo tệp dàn ý → Từ chối thì không có tệp", { skip }, async () => {
  await panel().getByTestId("agent-new").click()
  await panel().getByTestId("agent-suggestion").nth(3).click()
  const card = panel().getByTestId("agent-change").first()
  await card.waitFor({ timeout: 60_000 })
  await waitIdle()
  assert.match(await card.innerText(), /dan-y\.md/)
  await card.getByTestId("agent-reject").click()
  await waitFor(async () => (await card.getAttribute("data-status")) === "rejected", { message: "đã từ chối" })
  assert.equal(fs.existsSync(path.join(folder, "dan-y.md")), false)
})

test("tóm tắt thư mục; lịch sử phiên lưu cục bộ, mở lại được sau khi tải lại trang", { skip }, async () => {
  await panel().getByTestId("agent-new").click()
  await ask("Tóm tắt các tài liệu trong thư mục này")
  await panel().getByTestId("agent-answer").last().waitFor({ timeout: 60_000 })
  await waitIdle()
  assert.match(await panel().getByTestId("agent-transcript").innerText(), /ghi-chu\.md/)
  await shot(page, "11-tro-ly-tom-tat.png")
  await page.reload()
  await page.waitForLoadState("load")
  await panel().getByTestId("agent-input").waitFor({ timeout: 60_000 })
  await panel().getByRole("button", { name: /Lịch sử|History/ }).click()
  const items = page.getByRole("menuitem")
  await items.first().waitFor()
  const titles = await items.allInnerTexts()
  assert.ok(titles.some((t) => t.includes("Sửa chính tả")), JSON.stringify(titles))
  assert.ok(titles.some((t) => t.includes("Tóm tắt")), JSON.stringify(titles))
  await items.filter({ hasText: "Sửa chính tả" }).first().click()
  await waitFor(async () => (await panel().getByTestId("agent-change").count()) > 0, { message: "mở lại phiên cũ" })
  assert.equal(await panel().getByTestId("agent-change").first().getAttribute("data-status"), "undone")
  // Lịch sử nằm trong userData của app, không nằm trong thư mục dự án.
  assert.ok(fs.readdirSync(path.join(userData, "agent")).length > 0)
  assert.equal(fs.existsSync(path.join(folder, ".neu-research", "sessions")), false)
})

test("ngắt kết nối thiết bị: xoá token, quay về trạng thái chưa kết nối", { skip }, async () => {
  await panel().getByRole("button", { name: "…" }).click()
  await page.getByRole("menuitem", { name: /Ngắt kết nối|Disconnect/ }).click()
  await panel().getByTestId("agent-connect").waitFor({ timeout: 15_000 })
  const st = await page.evaluate(() => window.neuDesktop.agentGetStatus())
  assert.equal(st.connected, false)
})
