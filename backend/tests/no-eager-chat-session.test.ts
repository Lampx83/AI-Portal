import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

/**
 * Chặn lỗi «phiên chat rỗng» quay lại (22/10/2026: 94% phiên chat không có tin nhắn vì giao diện gọi POST /api/chat/sessions
 * ngay khi mở trang). Phiên chỉ được tạo khi gửi tin đầu tiên (createSessionIfMissing ở backend), nên frontend KHÔNG được gọi
 * createChatSession từ mã chạy lúc tải trang. Cần tạo phiên sớm vì lý do mới thì thêm tên tệp vào ALLOWED kèm lý do.
 */
const FRONTEND = path.resolve(__dirname, "../../frontend")
const ALLOWED = new Set<string>([
  path.join("lib", "chat.ts"), // định nghĩa hàm
])

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

test("frontend không gọi createChatSession (không tạo phiên chat khi mở trang)", () => {
  if (!fs.existsSync(FRONTEND)) return // chạy riêng backend, không có mã frontend
  const callers = walk(FRONTEND)
    .map((f) => ({ f, rel: path.relative(FRONTEND, f) }))
    .filter(({ rel }) => !ALLOWED.has(rel))
    .filter(({ f }) => /\bcreateChatSession\s*\(/.test(fs.readFileSync(f, "utf8")))
    .map(({ rel }) => rel)
  assert.deepEqual(callers, [], `Các tệp sau gọi createChatSession (tạo phiên rỗng khi mở trang): ${callers.join(", ")}`)
})
