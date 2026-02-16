/**
 * Ghi 5 gói ngôn ngữ mặc định (en, vi, zh, ja, fr) vào data/locales/ (tùy chọn, để có file JSON chỉnh sửa).
 * Chuỗi mặc định đã nằm trong locale-packages.ts; chạy script này nếu muốn xuất ra file.
 * Chạy: npx tsx scripts/seed-locales.ts (từ thư mục backend)
 */
import fs from "fs/promises"
import path from "path"
import { DEFAULT_LOCALE_BUNDLES } from "../src/lib/locale-packages"

const LOCALES_DIR = path.join(process.cwd(), "data", "locales")

async function main() {
  await fs.mkdir(LOCALES_DIR, { recursive: true })
  for (const [locale, strings] of Object.entries(DEFAULT_LOCALE_BUNDLES)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    await fs.writeFile(filePath, JSON.stringify(strings, null, 2), "utf-8")
    console.log("Written:", filePath)
  }
  console.log("Done. 5 locale files in", LOCALES_DIR)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
