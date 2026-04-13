#!/usr/bin/env node
/**
 * Đóng gói Writium (pack:basepath) rồi cài vào AI Portal qua API backend — cùng luồng với install-surveylab.mjs.
 *
 * Cách dùng:
 *   cd AI-Portal && node scripts/install-writium.mjs
 *   (Backend phải đang chạy: npm run dev hoặc cd backend && npm run dev)
 *
 * Env:
 *   BACKEND_URL     - mặc định http://localhost:3001
 *   ADMIN_SECRET    - nếu Portal đặt ADMIN_SECRET (header X-Admin-Secret)
 *   WRITIUM_PATH    - đường dẫn tới repo Writium (mặc định ../Tools/NEU/Research/Writium so với AI-Portal)
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORTAL_ROOT = path.resolve(__dirname, "..")
const WRITIUM_PATH = process.env.WRITIUM_PATH || path.join(PORTAL_ROOT, "..", "Tools", "NEU", "Research", "Writium")
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001"
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.AI_PORTAL_ADMIN_SECRET || ""
const INSTALL_URL = `${BACKEND_URL.replace(/\/+$/, "")}/api/admin/tools/install-package`

async function main() {
  if (!fs.existsSync(WRITIUM_PATH)) {
    console.error("Không tìm thấy Writium tại:", WRITIUM_PATH)
    console.error("Đặt WRITIUM_PATH hoặc đặt repo tại Tools/NEU/Research/Writium (so với workspace).")
    process.exit(1)
  }

  const packageJsonPath = path.join(WRITIUM_PATH, "package.json")
  if (!fs.existsSync(packageJsonPath)) {
    console.error("Không có package.json trong", WRITIUM_PATH)
    process.exit(1)
  }

  console.log("==========================================")
  console.log("  Cài đặt Writium vào AI Portal")
  console.log("==========================================")
  console.log("Writium: ", WRITIUM_PATH)
  console.log("Backend: ", BACKEND_URL)
  console.log("")

  const zipName = "writium-package-basepath.zip"
  const packOutDir = path.join(PORTAL_ROOT, "dist")
  fs.mkdirSync(packOutDir, { recursive: true })

  console.log("Bước 1/2: Đóng gói Writium (npm run pack:basepath)…")
  try {
    execSync("npm run pack:basepath", {
      cwd: WRITIUM_PATH,
      stdio: "inherit",
      env: { ...process.env, PACK_BASEPATH: "1", PACK_OUT_DIR: packOutDir },
    })
  } catch {
    console.error("Đóng gói thất bại. Kiểm tra npm install và build trong", WRITIUM_PATH)
    process.exit(1)
  }

  let zipPath = path.join(packOutDir, zipName)
  if (!fs.existsSync(zipPath)) {
    zipPath = path.join(WRITIUM_PATH, "dist", zipName)
  }
  if (!fs.existsSync(zipPath)) {
    console.error("Sau khi pack không tìm thấy file. Đã thử:", path.join(packOutDir, zipName), "và", path.join(WRITIUM_PATH, "dist", zipName))
    process.exit(1)
  }
  console.log("Đã tạo gói:", zipPath)
  console.log("")

  console.log("Bước 2/2: Gửi gói lên backend…")
  try {
    const r = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(`Backend health ${r.status}`)
  } catch {
    console.error("Không kết nối được backend tại", BACKEND_URL)
    console.error("Chạy backend trước: cd AI-Portal && npm run dev (hoặc cd backend && npm run dev)")
    process.exit(1)
  }

  const buf = fs.readFileSync(zipPath)
  const form = new FormData()
  form.append("package", new Blob([buf]), zipName)

  const headers = {}
  if (ADMIN_SECRET) headers["X-Admin-Secret"] = ADMIN_SECRET

  let res
  try {
    res = await fetch(INSTALL_URL, {
      method: "POST",
      body: form,
      headers,
      signal: AbortSignal.timeout(180_000),
    })
  } catch (e) {
    console.error("✗ Gửi gói lên backend thất bại:", e?.message || e)
    process.exit(1)
  }

  const body = await res.text()
  if (res.ok) {
    console.log("✓ Writium đã được cài đặt vào AI Portal.")
    try {
      const data = JSON.parse(body)
      if (data.tool?.alias) console.log("  Alias:", data.tool.alias)
    } catch {
      /* ignore */
    }
    console.log("")
    console.log("Mở Portal → Công cụ → Writium hoặc /tools/writium")
  } else {
    console.error("✗ Cài đặt thất bại. HTTP", res.status)
    console.error(body.slice(0, 2000))
    process.exit(1)
  }
}

main()
