import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { servedFromMeta } from "../src/lib/chat/message"

/**
 * AR-2 (dữ liệu phân tích): tin nhắn phải gán được cho người dùng và ghi model THỰC SỰ phục vụ ở phía máy chủ.
 * Test hành vi trên Postgres thật chạy tay (xem commit); ở đây giữ phần thuần và chốt chặn tĩnh.
 */
const ROOT = path.resolve(__dirname, "..")
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8")

test("servedFromMeta: lấy model thật từ meta do máy chủ báo, không lấy nhãn client", () => {
  const r = servedFromMeta(
    { model: "gpt-4o-mini", model_served: "qwen3.5-35b", model_provider: "openai_compatible", profile_injected: true },
    true
  )
  assert.equal(r.model_id_served, "qwen3.5-35b")
  assert.equal(r.model_provider, "openai_compatible")
  assert.equal(r.served_status, "ok")
  assert.equal(r.profile_injected, true)
})

test("servedFromMeta: trợ lý ngoài không báo thì để null, không đoán từ nhãn client", () => {
  const r = servedFromMeta({ model: "gpt-4o-mini", tokens_used: 5 }, true)
  assert.deepEqual(r, { model_id_served: null, model_provider: null, served_status: null, profile_injected: null })
  assert.deepEqual(servedFromMeta(undefined, true), r)
})

test("servedFromMeta: giữ fallback/error do máy chủ báo, bỏ giá trị lạ, profile_injected=false được giữ", () => {
  assert.equal(servedFromMeta({ model_served: "m", served_status: "fallback" }, true).served_status, "fallback")
  assert.equal(servedFromMeta({ model_served: "m", served_status: "error" }, true).served_status, "error")
  assert.equal(servedFromMeta({ model_served: "m", served_status: "weird" }, false).served_status, "error")
  assert.equal(servedFromMeta({ model_served: "m", profile_injected: false }, true).profile_injected, false)
  assert.equal(servedFromMeta({ model_served: 123 as any }, true).model_id_served, null)
})

test("mọi appendMessage trong chat.ts truyền user_id; hai lượt assistant ghi served*", () => {
  const src = read("src/routes/chat.ts")
  const calls = [...src.matchAll(/appendMessage\(\s*sessionId,\s*\{([\s\S]*?)\n\s*\},\s*client/g)].map((m) => m[1])
  assert.equal(calls.length, 6)
  for (const c of calls) assert.match(c, /user_id: resolvedUserId/)
  const assistant = calls.filter((c) => /role: "assistant"/.test(c) && /response_time_ms: responseTimeMs/.test(c))
  assert.equal(assistant.length, 2)
  for (const c of assistant) assert.match(c, /\.\.\.servedFromMeta\(/)
})

test("POST /messages thủ công lấy chủ từ phiên, không nhận user_id từ client", () => {
  const src = read("src/routes/chat.ts")
  assert.match(src, /SELECT user_id FROM ai_portal\.chat_sessions WHERE id = \$1/)
})

test("orchestrator ghi model_served = model cấu hình Central và profile_injected, ở cả stream lẫn không stream", () => {
  const src = read("src/routes/orchestrator.ts")
  assert.match(src, /model_served: centralModel/)
  assert.match(src, /profile_injected: userProfileBlock\.trim\(\)\.length > 0/)
  assert.equal((src.match(/\.\.\.servedMeta/g) || []).length, 2)
})

test("migration 027 thêm đủ cột, điền ngược user_id, không ghi đè và không xoá dữ liệu", () => {
  const sql = read("migrations/027_messages_research_columns.sql").replace(/--.*$/gm, "")
  for (const col of ["user_id", "model_id_served", "model_provider", "served_status", "profile_injected", "experiment_id", "arm"]) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`))
  }
  assert.match(sql, /m\.user_id IS NULL/)
  assert.match(sql, /'ok', 'fallback', 'error'/)
  assert.doesNotMatch(sql, /DROP|DELETE\s+FROM|TRUNCATE/i)
})
