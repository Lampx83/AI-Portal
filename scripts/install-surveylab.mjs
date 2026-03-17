#!/usr/bin/env node
/**
 * Đóng gói Surveylab (pack:basepath) rồi cài vào AI Portal qua API backend.
 *
 * Cách dùng:
 *   cd AI-Portal && node scripts/install-surveylab.mjs
 *   (Backend phải đang chạy: npm run dev hoặc cd backend && npm run dev)
 *
 * Env:
 *   BACKEND_URL     - mặc định http://localhost:3001
 *   ADMIN_SECRET    - nếu Portal đặt ADMIN_SECRET (header X-Admin-Secret)
 *   SURVEYLAB_PATH  - đường dẫn tới repo Surveylab (mặc định ../Tools/NEU/Research/Surveylab so với AI-Portal)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = path.resolve(__dirname, "..");
const SURVEYLAB_PATH = process.env.SURVEYLAB_PATH || path.join(PORTAL_ROOT, "..", "Tools", "NEU", "Research", "Surveylab");
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.AI_PORTAL_ADMIN_SECRET || "";
const INSTALL_URL = `${BACKEND_URL.replace(/\/+$/, "")}/api/admin/tools/install-package`;

async function main() {
  if (!fs.existsSync(SURVEYLAB_PATH)) {
    console.error("Không tìm thấy Surveylab tại:", SURVEYLAB_PATH);
    console.error("Đặt SURVEYLAB_PATH hoặc đặt repo tại Tools/NEU/Research/Surveylab (so với workspace).");
    process.exit(1);
  }

  const packageJsonPath = path.join(SURVEYLAB_PATH, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.error("Không có package.json trong", SURVEYLAB_PATH);
    process.exit(1);
  }

  console.log("==========================================");
  console.log("  Cài đặt Surveylab vào AI Portal");
  console.log("==========================================");
  console.log("Surveylab:", SURVEYLAB_PATH);
  console.log("Backend:  ", BACKEND_URL);
  console.log("");

  console.log("Bước 1/2: Đóng gói Surveylab (npm run pack:basepath)...");
  try {
    execSync("npm run pack:basepath", {
      cwd: SURVEYLAB_PATH,
      stdio: "inherit",
      env: { ...process.env, PACK_BASEPATH: "1" },
    });
  } catch (e) {
    console.error("Đóng gói thất bại. Kiểm tra npm install và build trong", SURVEYLAB_PATH);
    process.exit(1);
  }

  const zipName = "surveylab-app-package-basepath.zip";
  const zipPath = path.join(SURVEYLAB_PATH, "dist", zipName);
  if (!fs.existsSync(zipPath)) {
    console.error("Sau khi pack không tìm thấy file:", zipPath);
    process.exit(1);
  }
  console.log("Đã tạo gói:", zipPath);
  console.log("");

  console.log("Bước 2/2: Gửi gói lên backend...");
  try {
    const r = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`Backend health ${r.status}`);
  } catch (e) {
    console.error("Không kết nối được backend tại", BACKEND_URL);
    console.error("Chạy backend trước: cd AI-Portal && npm run dev (hoặc cd backend && npm run dev)");
    process.exit(1);
  }

  const buf = fs.readFileSync(zipPath);
  const form = new FormData();
  form.append("package", new Blob([buf]), zipName);

  const headers = {};
  if (ADMIN_SECRET) headers["X-Admin-Secret"] = ADMIN_SECRET;

  let res;
  try {
    res = await fetch(INSTALL_URL, {
      method: "POST",
      body: form,
      headers,
      signal: AbortSignal.timeout(180_000),
    });
  } catch (e) {
    console.error("✗ Gửi gói lên backend thất bại:", e?.message || e);
    console.error("");
    console.error("Backend có thể chưa chạy hoặc đóng kết nối. Bạn có thể:");
    console.error("  1. Chạy backend: cd AI-Portal && npm run dev (hoặc cd backend && npm run dev)");
    console.error("  2. Chạy lại script: node scripts/install-surveylab.mjs");
    console.error("  3. Hoặc cài thủ công: mở Admin → Công cụ → Cài đặt từ gói, chọn file:");
    console.error("     " + zipPath);
    process.exit(1);
  }

  const body = await res.text();
  if (res.ok) {
    console.log("✓ Surveylab đã được cài đặt vào AI Portal.");
    try {
      const data = JSON.parse(body);
      if (data.tool?.alias) console.log("  Alias:", data.tool.alias);
    } catch (_) {}
    console.log("");
    console.log("Mở Portal → Công cụ → Surveylab hoặc /tools/surveylab");
  } else {
    console.error("✗ Cài đặt thất bại. HTTP", res.status);
    console.error(body.slice(0, 500));
    if (res.status === 403) {
      console.error("");
      console.error("Gợi ý: Nếu Portal đặt ADMIN_SECRET, chạy với ADMIN_SECRET=... hoặc đăng nhập Admin trong trình duyệt rồi cài từ giao diện.");
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
