import { test, after, before } from "node:test"
import assert from "node:assert/strict"
import http from "http"
import express from "express"
import { createDesktopRouter, type LlmStreamChunk } from "../src/routes/desktop"
import { DesktopTokenService, MemoryDesktopTokenStore } from "../src/lib/desktop/tokens"
import { MemoryDesktopUsageLog } from "../src/lib/desktop/pg-store"
import { PerUserLimiter, validateChatRequest, extractInlineToolCalls, ContentGate, chatLimits } from "../src/lib/desktop/chat"
import { GUEST_USER_ID } from "../src/lib/chat/constants"

const USER = { id: "5b0c7f3e-2f4a-4e6b-9c1d-111111111abc", email: "lam@neu.edu.vn", name: "Lâm" }

const store = new MemoryDesktopTokenStore()
store.users.set(USER.id, USER)
store.users.set(GUEST_USER_ID, { id: GUEST_USER_ID, email: "guest@portal.local", name: "Khách" })
const usage = new MemoryDesktopUsageLog()
const tokens = new DesktopTokenService(store)
let lastLlmMessages: unknown = null
let script: LlmStreamChunk[] = []

async function* gen(chunks: LlmStreamChunk[]) {
  for (const c of chunks) yield c
}

const app = express()
app.use(express.json({ limit: "6mb" }))
app.use(
  "/api/desktop",
  createDesktopRouter({
    tokens,
    usage,
    // Giả lập phiên đăng nhập web: header x-test-user (chỉ trong kiểm thử).
    getCaller: async (req) => {
      const u = req.headers["x-test-user"]
      if (u === "lam") return { id: USER.id, email: USER.email }
      if (u === "guest") return { id: GUEST_USER_ID, email: "guest@portal.local" }
      return { id: null, email: null }
    },
    getLlm: async () => ({ provider: "openai_compatible", model: "qwen-test", apiKey: "x", baseUrl: "http://127.0.0.1:1/v1" }),
    streamLlm: async (_cred, r) => {
      lastLlmMessages = r.messages
      return gen(script)
    },
    limiter: new PerUserLimiter(() => 3, () => 1),
  }),
)
const server = http.createServer(app)
let base = ""
before(async () => {
  base = await new Promise<string>((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server.address() as any).port}`)))
})
after(() => server.close())

async function issue(): Promise<{ access_token: string; refresh_token: string }> {
  const r = await fetch(`${base}/api/desktop/token`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-neu-desktop-client": "1", "x-test-user": "lam" },
    body: JSON.stringify({ device_name: "test" }),
  })
  assert.equal(r.status, 201)
  return (await r.json()) as any
}

function parseSse(text: string): any[] {
  return text
    .split("\n\n")
    .map((b) => b.trim())
    .filter((b) => b.startsWith("data: "))
    .map((b) => JSON.parse(b.slice(6)))
}

test("cấp token: thiếu header app → 400; chưa đăng nhập → 401; khách → 403", async () => {
  let r = await fetch(`${base}/api/desktop/token`, { method: "POST", headers: { "x-test-user": "lam" } })
  assert.equal(r.status, 400)
  r = await fetch(`${base}/api/desktop/token`, { method: "POST", headers: { "x-neu-desktop-client": "1" } })
  assert.equal(r.status, 401)
  r = await fetch(`${base}/api/desktop/token`, { method: "POST", headers: { "x-neu-desktop-client": "1", "x-test-user": "guest" } })
  assert.equal(r.status, 403)
  assert.equal(((await r.json()) as any).code, "guest_not_allowed")
  const ok = await issue()
  assert.ok(ok.access_token && ok.refresh_token)
  assert.equal((ok as any).user.email, USER.email)
})

test("endpoint chat từ chối khi thiếu/sai/hết hiệu lực token", async () => {
  const body = JSON.stringify({ messages: [{ role: "user", content: "xin chào" }] })
  let r = await fetch(`${base}/api/desktop/chat`, { method: "POST", headers: { "content-type": "application/json" }, body })
  assert.equal(r.status, 401)
  r = await fetch(`${base}/api/desktop/chat`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer neuda_sai" }, body })
  assert.equal(r.status, 401)
  const t = await issue()
  r = await fetch(`${base}/api/desktop/chat`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${t.refresh_token}` }, body })
  assert.equal(r.status, 401, "refresh token không dùng để gọi chat")
  // thu hồi rồi gọi
  const rv = await fetch(`${base}/api/desktop/token/revoke`, { method: "POST", headers: { authorization: `Bearer ${t.access_token}` } })
  assert.equal(rv.status, 200)
  r = await fetch(`${base}/api/desktop/chat`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${t.access_token}` }, body })
  assert.equal(r.status, 401)
  assert.equal(((await r.json()) as any).code, "revoked")
})

test("chat stream: nội dung + tool_calls gom từ delta, system gộp lên đầu, ghi nhật ký không có nội dung", async () => {
  const t = await issue()
  script = [
    { choices: [{ delta: { content: "Để tôi " } }] },
    { choices: [{ delta: { content: "xem tệp." } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "read_file", arguments: '{"path":' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"a.md"}' } }] }, finish_reason: "tool_calls" }] },
    { usage: { prompt_tokens: 120, completion_tokens: 30 } },
  ]
  const before = usage.records.length
  const r = await fetch(`${base}/api/desktop/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${t.access_token}` },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "A" },
        { role: "user", content: "BÍ MẬT-trong-tệp" },
        { role: "system", content: "B" },
      ],
      tools: [{ type: "function", function: { name: "read_file", parameters: { type: "object" } } }],
    }),
  })
  assert.equal(r.status, 200)
  assert.match(r.headers.get("content-type") || "", /text\/event-stream/)
  const ev = parseSse(await r.text())
  assert.equal(ev[0].type, "start")
  assert.equal(ev.filter((e) => e.type === "delta").map((e) => e.content).join(""), "Để tôi xem tệp.")
  const done = ev.find((e) => e.type === "done")
  assert.equal(done.tool_calls[0].function.name, "read_file")
  assert.equal(done.tool_calls[0].function.arguments, '{"path":"a.md"}')
  assert.deepEqual(done.usage, { prompt_tokens: 120, completion_tokens: 30 })
  assert.deepEqual((lastLlmMessages as any[]).map((m) => m.role), ["system", "user"])
  assert.equal((lastLlmMessages as any[])[0].content, "A\n\nB")
  await new Promise((res) => setTimeout(res, 20))
  assert.equal(usage.records.length, before + 1)
  const rec = usage.records.at(-1)!
  assert.equal(rec.tool_calls, 1)
  assert.equal(rec.prompt_tokens, 120)
  assert.ok(!JSON.stringify(rec).includes("BÍ MẬT"), "nhật ký không chứa nội dung")
})

test("Qwen không bật tool parser: <tool_call> trong nội dung được tách thành tool_calls và không phát ra", async () => {
  const t = await issue()
  script = [
    { choices: [{ delta: { content: "Đang đọc " } }] },
    { choices: [{ delta: { content: '<tool_' } }] },
    { choices: [{ delta: { content: 'call>\n{"name": "list_files", "arguments": {"path": ""}}\n</tool_call>' } }] },
  ]
  const r = await fetch(`${base}/api/desktop/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${t.access_token}` },
    body: JSON.stringify({ messages: [{ role: "user", content: "liệt kê" }] }),
  })
  const ev = parseSse(await r.text())
  const shown = ev.filter((e) => e.type === "delta").map((e) => e.content).join("")
  assert.equal(shown, "Đang đọc ")
  const done = ev.find((e) => e.type === "done")
  assert.equal(done.tool_calls[0].function.name, "list_files")
  assert.equal(done.content, "Đang đọc")
  assert.equal(done.finish_reason, "tool_calls")
})

test("giới hạn kích thước: quá nhiều ký tự → 413 context_too_large", async () => {
  const t = await issue()
  const r = await fetch(`${base}/api/desktop/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${t.access_token}` },
    body: JSON.stringify({ messages: [{ role: "user", content: "x".repeat(39_000) }, { role: "user", content: "y".repeat(39_000) }, { role: "user", content: "z".repeat(5_000) }] }),
  })
  assert.equal(r.status, 413)
})

test("giới hạn tốc độ theo người dùng → 429", async () => {
  const fresh = new PerUserLimiter(() => 2, () => 5)
  assert.equal(fresh.acquire("u"), null)
  fresh.release("u")
  assert.equal(fresh.acquire("u"), null)
  fresh.release("u")
  assert.equal(fresh.acquire("u"), "rate")
  assert.equal(fresh.acquire("v"), null, "người khác không bị ảnh hưởng")
  const conc = new PerUserLimiter(() => 100, () => 1)
  assert.equal(conc.acquire("u"), null)
  assert.equal(conc.acquire("u"), "concurrency")
  conc.release("u")
  assert.equal(conc.acquire("u"), null)

  // Qua HTTP: router dùng limiter 3/phút → các lượt sau bị 429.
  const t = await issue()
  script = [{ choices: [{ delta: { content: "ok" } }] }]
  const codes: number[] = []
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${base}/api/desktop/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${t.access_token}` },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    })
    codes.push(r.status)
    await r.text()
  }
  assert.ok(codes.includes(429), `mong có 429, nhận ${codes.join(",")}`)
})

test("validateChatRequest: chặn role lạ, tool lạ, tool_call_id sai, kẹp max_tokens", () => {
  const lim = chatLimits()
  assert.throws(() => validateChatRequest({ messages: [{ role: "developer", content: "x" }] }, lim), /role/)
  assert.throws(() => validateChatRequest({ messages: [{ role: "assistant", content: "x" }] }, lim), /người dùng/)
  assert.throws(() => validateChatRequest({ messages: [{ role: "user", content: "x" }, { role: "tool", content: "r", tool_call_id: "bad id!" }] }, lim))
  assert.throws(() => validateChatRequest({ messages: [{ role: "user", content: "x" }], tools: [{ type: "function", function: { name: "rm -rf" } }] }, lim))
  const v = validateChatRequest({ messages: [{ role: "user", content: "x" }], max_tokens: 999_999, temperature: 7 }, lim)
  assert.equal(v.max_tokens, lim.maxOutputTokens)
  assert.equal(v.temperature, 1)
})

test("ContentGate + extractInlineToolCalls", () => {
  const g = new ContentGate()
  assert.equal(g.push("a <b> c"), "a <b> c")
  assert.equal(g.push(" <thi"), " ")
  assert.equal(g.push("nk>suy nghĩ</think>xong"), "xong")
  assert.equal(g.push(" <tool_call>{"), " ")
  assert.equal(g.push("...}"), "")
  assert.equal(g.flush(), "")
  const x = extractInlineToolCalls('Trước <tool_call>{"name":"read_file","arguments":{"path":"a"}}</tool_call>')
  assert.equal(x.calls.length, 1)
  assert.equal(x.calls[0].function.arguments, '{"path":"a"}')
  assert.equal(x.content, "Trước")
  assert.equal(extractInlineToolCalls("<tool_call>không phải json</tool_call>").calls.length, 0)
})
