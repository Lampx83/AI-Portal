// Tiện ích kiểm thử đầu-cuối: chạy ứng dụng Electron thật qua Playwright (_electron).
import { _electron as electron } from "playwright-core"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
export const SHOTS = process.env.NEU_E2E_SHOTS || path.join(ROOT, "docs", "screenshots")

export function tmpDir(prefix) {
  return fs.realpathSync.native(fs.mkdtempSync(path.join(process.env.NEU_E2E_TMP || os.tmpdir(), prefix)))
}

/**
 * Khởi động ứng dụng (mã nguồn đã biên dịch ở out/). NEU_DESKTOP_E2E=1 bật móc kiểm thử:
 * không mở trình duyệt thật / Finder thật, hộp thoại chọn thư mục đọc từ globalThis.__neuNextPick.
 */
export async function launch({ portalUrl, userData, extraEnv = {} }) {
  const app = await electron.launch({
    args: [path.join(ROOT, "out", "src", "main", "main.js"), `--portal-url=${portalUrl}`],
    cwd: ROOT,
    env: {
      ...process.env,
      NEU_DESKTOP_E2E: "1",
      NEU_DESKTOP_USER_DATA: userData,
      ...extraEnv,
    },
    timeout: 60_000,
  })
  const page = await app.firstWindow()
  return { app, page }
}

export async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true })
  const file = path.join(SHOTS, name)
  await page.screenshot({ path: file })
  return file
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function waitFor(fn, { timeout = 15_000, interval = 200, message = "điều kiện" } = {}) {
  const end = Date.now() + timeout
  let last
  while (Date.now() < end) {
    try {
      last = await fn()
      if (last) return last
    } catch (e) {
      last = e
    }
    await sleep(interval)
  }
  throw new Error(`Hết thời gian chờ: ${message} (giá trị cuối: ${String(last)})`)
}

export async function externalOpened(app) {
  return app.evaluate(() => globalThis.__neuExternalOpened ?? [])
}
