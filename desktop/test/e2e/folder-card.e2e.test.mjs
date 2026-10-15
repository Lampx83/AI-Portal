// Kiểm thử thẻ «Thư mục trên máy» với frontend chạy cục bộ (dữ liệu giả, không cần đăng nhập).
// Cần chạy trước:
//   node test/fixtures/mock-backend.mjs 3901
//   (cd ../frontend && BACKEND_URL=http://127.0.0.1:3901 npx next dev -p 3000)
// Rồi: NEU_E2E_LOCAL=http://localhost:3000 node --test test/e2e/folder-card.e2e.test.mjs
// Không có NEU_E2E_LOCAL thì bỏ qua.
import { test, after, before } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { launch, shot, sleep, tmpDir, waitFor } from "./helpers.mjs"

const LOCAL = process.env.NEU_E2E_LOCAL
const skip = !LOCAL && "Đặt NEU_E2E_LOCAL=http://localhost:3000 (frontend cục bộ) để chạy"
const PROJECT_ID = "00000000-0000-4000-8000-00000000d351"

let app
let page
let userData
let folder

before(async () => {
  if (skip) return
  userData = tmpDir("neu-e2e-card-ud-")
  folder = path.join(tmpDir("neu-e2e-card-"), "De tai AI hoc tap")
  fs.mkdirSync(path.join(folder, "Du lieu"), { recursive: true })
  fs.mkdirSync(path.join(folder, "Bai bao"), { recursive: true })
  fs.writeFileSync(path.join(folder, "Du lieu", "khao-sat-sinh-vien.csv"), "id,tuoi,diem\n1,20,8.5\n2,21,7.0\n")
  fs.writeFileSync(path.join(folder, "Du lieu", "phong-van.txt"), "Bản ghi phỏng vấn nhóm 1")
  fs.writeFileSync(path.join(folder, "Bai bao", "ban-thao.md"), "# Bản thảo\n")
  fs.writeFileSync(path.join(folder, "de-cuong.docx"), "giả lập docx")
  fs.writeFileSync(path.join(folder, "chay-thu.sh"), "#!/bin/sh\necho hi\n")
  fs.writeFileSync(path.join(folder, ".an.txt"), "tệp ẩn")
  ;({ app, page } = await launch({ portalUrl: LOCAL, userData }))
  await page.goto(`${LOCAL}/dev/desktop-folder`)
  await page.waitForLoadState("load")
  // Giao diện tiếng Việt cho ảnh chụp (NEU_E2E_LANG=en để chụp bản tiếng Anh).
  await page.evaluate((lang) => {
    localStorage.setItem("neu-locale", lang)
    localStorage.setItem("neu-locale-user-set", "1")
  }, process.env.NEU_E2E_LANG || "vi")
  await page.reload()
  await page.waitForLoadState("load")
})

after(async () => {
  await app?.close().catch(() => {})
  if (userData) fs.rmSync(userData, { recursive: true, force: true })
  if (folder) fs.rmSync(path.dirname(folder), { recursive: true, force: true })
})

const card = () => page.getByTestId("desktop-folder-card")

test("thẻ hiện trong ứng dụng desktop, chưa liên kết", { skip }, async () => {
  await card().waitFor({ timeout: 90_000 })
  const text = await card().innerText()
  assert.match(text, /Thư mục trên máy|Folder on this computer/)
  assert.match(text, /không tải lên máy chủ|not uploaded/)
  await shot(page, "04-the-chua-lien-ket.png")
})

test("liên kết thư mục (qua hộp thoại giả lập), thấy danh sách tệp, tệp ẩn bị bỏ qua", { skip }, async () => {
  await app.evaluate((_e, p) => {
    globalThis.__neuNextPick = p
  }, folder)
  await card().getByRole("button", { name: /Chọn thư mục|Choose folder/ }).click()
  await waitFor(async () => (await card().innerText()).includes("de-cuong.docx"), { message: "danh sách tệp" })
  const text = await card().innerText()
  assert.ok(text.includes("Du lieu") && text.includes("Bai bao") && text.includes("chay-thu.sh"))
  assert.ok(!text.includes(".an.txt"))
  // Mở thư mục con
  await card().locator('[data-relpath="Du lieu"] button').first().click()
  await waitFor(async () => (await card().innerText()).includes("khao-sat-sinh-vien.csv"), { message: "mở thư mục con" })
  await shot(page, "05-the-da-lien-ket.png")
  // Liên kết lưu trong cấu hình ứng dụng
  const cfg = JSON.parse(fs.readFileSync(path.join(userData, "neu-desktop-config.json"), "utf8"))
  assert.equal(cfg.linkedFolders[new URL(LOCAL).origin][PROJECT_ID].path, folder)
})

test("sửa tệp bên ngoài → danh sách tự cập nhật", { skip }, async () => {
  fs.writeFileSync(path.join(folder, "ket-qua-hoi-quy.xlsx"), "giả lập")
  fs.writeFileSync(path.join(folder, "Du lieu", "khao-sat-dot-2.csv"), "id\n1\n")
  await waitFor(async () => {
    const t = await card().innerText()
    return t.includes("ket-qua-hoi-quy.xlsx") && t.includes("khao-sat-dot-2.csv")
  }, { message: "cập nhật khi thêm tệp" })
  fs.rmSync(path.join(folder, "chay-thu.sh"))
  await waitFor(async () => !(await card().innerText()).includes("chay-thu.sh"), { message: "cập nhật khi xoá tệp" })
  await shot(page, "06-tu-cap-nhat.png")
})

test("mở tệp, hiện trong Finder; tệp kịch bản bị chặn mở", { skip }, async () => {
  await card().locator('[data-relpath="de-cuong.docx"] button').first().click()
  await sleep(500)
  await card().getByRole("button", { name: /Mở trong Finder|Mở trong Explorer|Mở thư mục|Show in/ }).first().click()
  await sleep(500)
  const calls = await app.evaluate(() => globalThis.__neuShellCalls)
  assert.ok(calls.includes(`open:${path.join(folder, "de-cuong.docx")}`), JSON.stringify(calls))
  assert.ok(calls.includes(`open:${folder}`), JSON.stringify(calls))
  fs.writeFileSync(path.join(folder, "cai-dat.command"), "#!/bin/sh\n")
  const err = await page.evaluate(async (id) => {
    try {
      await window.neuDesktop.openFile(id, "cai-dat.command")
      return "OK"
    } catch (e) {
      return e.message
    }
  }, PROJECT_ID)
  assert.match(err, /\.command/)
  const content = await page.evaluate((id) => window.neuDesktop.readTextFile(id, "Du lieu/khao-sat-sinh-vien.csv"), PROJECT_ID)
  assert.match(content.content, /^id,tuoi,diem/)
})

test("menu «Tệp → Mở thư mục dự án…» dùng luồng liên kết của thẻ", { skip }, async () => {
  const other = path.join(path.dirname(folder), "Thu muc khac")
  fs.mkdirSync(other)
  fs.writeFileSync(path.join(other, "ghi-chu.txt"), "x")
  await app.evaluate(({ Menu }, p) => {
    globalThis.__neuNextPick = p
    const find = (items) => {
      for (const it of items) {
        if (it.label === "Mở thư mục dự án…") return it
        const sub = it.submenu && find(it.submenu.items)
        if (sub) return sub
      }
      return null
    }
    find(Menu.getApplicationMenu().items).click()
  }, other)
  await waitFor(async () => (await card().innerText()).includes("ghi-chu.txt"), { message: "liên kết qua menu" })
})

test("bỏ liên kết", { skip }, async () => {
  await card().getByRole("button", { name: /Bỏ liên kết|Unlink/ }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: /Bỏ liên kết|Unlink/ }).click()
  await waitFor(async () => (await card().innerText()).match(/Chọn thư mục|Choose folder/), { message: "về trạng thái chưa liên kết" })
  const cfg = JSON.parse(fs.readFileSync(path.join(userData, "neu-desktop-config.json"), "utf8"))
  assert.equal(cfg.linkedFolders[new URL(LOCAL).origin][PROJECT_ID], undefined)
})
