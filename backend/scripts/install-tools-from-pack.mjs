#!/usr/bin/env node
/**
 * Cài đặt tất cả ứng dụng từ Tools/pack vào AI Portal (gọi API backend local).
 * Chạy trên máy đang chạy AI Portal.
 *
 * Cách dùng:
 *   cd AI-Portal/backend && node scripts/install-tools-from-pack.mjs
 *   hoặc: TOOLS_PACK_DIR=/path/to/Tools/pack node scripts/install-tools-from-pack.mjs
 *
 * Env:
 *   BACKEND_URL  - mặc định http://localhost:3001
 *   ADMIN_SECRET - nếu Portal đặt ADMIN_SECRET (header X-Admin-Secret)
 *   TOOLS_PACK_DIR - thư mục chứa file .zip (mặc định ../../Tools/pack từ backend)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const ADMIN_SECRET = process.env.AI_PORTAL_ADMIN_SECRET || process.env.ADMIN_SECRET || "";
const PACK_DIR = process.env.TOOLS_PACK_DIR || path.resolve(__dirname, "../../../Tools/pack");
const INSTALL_URL = `${BACKEND_URL.replace(/\/+$/, "")}/api/admin/tools/install-package`;

async function main() {
  if (!fs.existsSync(PACK_DIR)) {
    console.error("Thư mục không tồn tại:", PACK_DIR);
    console.error("Đặt TOOLS_PACK_DIR hoặc đảm bảo chạy từ AI-Portal/backend và có thư mục Tools/pack.");
    process.exit(1);
  }

  const zips = fs.readdirSync(PACK_DIR)
    .filter((f) => f.endsWith(".zip") && !f.includes("-basepath"))
    .map((f) => path.join(PACK_DIR, f));

  if (zips.length === 0) {
    console.error("Không có file .zip nào trong", PACK_DIR);
    process.exit(1);
  }

  // Kiểm tra backend
  try {
    const r = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(r.status);
  } catch (e) {
    console.error("Không kết nối được backend tại", BACKEND_URL);
    console.error("Đảm bảo AI Portal đang chạy (docker compose up hoặc npm run dev).");
    process.exit(1);
  }

  console.log("==========================================");
  console.log("  Cài đặt ứng dụng vào AI Portal");
  console.log("==========================================");
  console.log("Backend:", BACKEND_URL);
  console.log("Số gói:", zips.length);
  console.log("");

  const passed = [];
  const failed = [];

  for (const zipPath of zips) {
    const name = path.basename(zipPath);
    process.stdout.write(`📥 ${name} ... `);
    try {
      const buf = fs.readFileSync(zipPath);
      const form = new FormData();
      form.append("package", new Blob([buf]), name);

      const headers = {};
      if (ADMIN_SECRET) headers["X-Admin-Secret"] = ADMIN_SECRET;

      const res = await fetch(INSTALL_URL, {
        method: "POST",
        body: form,
        headers,
        signal: AbortSignal.timeout(180_000),
      });

      const body = await res.text();
      if (res.ok) {
        console.log("✓");
        passed.push(name);
      } else {
        console.log("✗ HTTP", res.status);
        console.log("  ", body.slice(0, 200));
        failed.push(name);
      }
    } catch (e) {
      console.log("✗", e.message || e);
      failed.push(name);
    }
  }

  console.log("");
  console.log("==========================================");
  console.log("  KẾT QUẢ");
  console.log("==========================================");
  console.log("Thành công:", passed.length);
  passed.forEach((p) => console.log("  ✓", p));
  console.log("Thất bại:", failed.length);
  failed.forEach((f) => console.log("  ✗", f));

  if (failed.length > 0) {
    console.log("");
    console.log("Gợi ý: Nếu lỗi 403, đặt ADMIN_SECRET trong Portal và chạy với AI_PORTAL_ADMIN_SECRET=...");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
