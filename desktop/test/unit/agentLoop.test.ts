import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import { compactMessages, FolderAgent } from "../../src/main/agent/agent"
import { LlmError, type ChatClient, type ChatMsg, type ChatResult } from "../../src/main/agent/llmClient"
import { SessionStore } from "../../src/main/agent/sessions"
import { AgentTools } from "../../src/main/agent/tools"
import { DesktopAuth, type FetchLike } from "../../src/main/auth"
import type { AgentEvent } from "../../src/shared/api"
import { setupProject } from "./helpers"

const PID = "proj-1"

type Step = (msgs: ChatMsg[]) => Partial<ChatResult> | Error
class ScriptedClient implements ChatClient {
  calls: ChatMsg[][] = []
  constructor(private steps: Step[]) {}
  async chat(req: { messages: ChatMsg[] }, opts: { signal?: AbortSignal; onDelta?: (t: string) => void }): Promise<ChatResult> {
    if (opts.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" })
    this.calls.push(JSON.parse(JSON.stringify(req.messages)))
    const step = this.steps.shift()
    if (!step) return { content: "Xong.", toolCalls: [], finishReason: "stop", usage: { promptTokens: 10, completionTokens: 2 } }
    const r = step(req.messages)
    if (r instanceof Error) throw r
    if (r.content) opts.onDelta?.(r.content)
    return { content: r.content ?? "", toolCalls: r.toolCalls ?? [], finishReason: r.finishReason ?? "stop", usage: r.usage ?? { promptTokens: 100, completionTokens: 20 } }
  }
}

const call = (id: string, name: string, args: unknown) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } })

function mkAgent(s: ReturnType<typeof setupProject>, client: ChatClient, limits = {}) {
  const sessions = new SessionStore((pid) => path.join(s.base, "userdata", pid, "sessions"))
  const agent = new FolderAgent({ client, tools: new AgentTools(s.folders, s.changes), sessions, changes: s.changes, folders: s.folders, limits })
  return { agent, sessions }
}

test("vòng lặp: đọc tệp → đề xuất sửa → trả lời; tệp KHÔNG bị ghi; lịch sử phiên lưu cục bộ", async () => {
  const s = setupProject()
  try {
    const client = new ScriptedClient([
      () => ({ content: "", toolCalls: [call("c1", "list_files", {})] }),
      (m) => {
        assert.match(m.at(-1)!.content!, /bao-cao\.md/)
        return { toolCalls: [call("c2", "read_file", { path: "bao-cao.md" })] }
      },
      (m) => {
        assert.match(m.at(-1)!.content!, /lổi chính tả/)
        return { toolCalls: [call("c3", "edit_file", { path: "bao-cao.md", edits: [{ old_text: "lổi", new_text: "lỗi" }], summary: "Sửa chính tả" })] }
      },
      (m) => {
        assert.match(m.at(-1)!.content!, /ĐỀ XUẤT/)
        return { content: "Tôi đã đề xuất sửa 1 lỗi chính tả, mời bạn duyệt." }
      },
    ])
    const { agent, sessions } = mkAgent(s, client)
    const session = sessions.create(PID, "x")
    const events: AgentEvent[] = []
    await agent.run({ runId: "r1", projectId: PID, session, text: "Sửa chính tả bao-cao.md", signal: new AbortController().signal, emit: (e) => events.push(e) })
    const types = events.map((e) => e.type)
    assert.equal(types[0], "run_start")
    assert.equal(types.at(-1), "run_end")
    assert.equal(events.filter((e) => e.type === "tool_start").length, 3)
    const ch = events.find((e) => e.type === "change") as Extract<AgentEvent, { type: "change" }>
    assert.equal(ch.change.relPath, "bao-cao.md")
    assert.equal(ch.change.status, "pending")
    assert.match(fs.readFileSync(path.join(s.proj, "bao-cao.md"), "utf8"), /lổi/, "chưa ghi")
    const end = events.at(-1) as Extract<AgentEvent, { type: "run_end" }>
    assert.equal(end.status, "done")
    assert.equal(end.usage.steps, 4)
    // system prompt đứng đầu và duy nhất
    assert.equal(client.calls[0][0].role, "system")
    assert.equal(client.calls[0].filter((m) => m.role === "system").length, 1)
    const saved = sessions.get(PID, session.id)!
    assert.equal(saved.title, "Sửa chính tả bao-cao.md")
    assert.deepEqual(saved.transcript.map((t) => t.kind), ["user", "tool", "tool", "tool", "change", "assistant"])
    assert.ok(saved.llm.length > 0)
  } finally {
    s.cleanup()
  }
})

test("giới hạn số bước mỗi lượt; công cụ lạ / chạy lệnh bị từ chối", async () => {
  const s = setupProject()
  try {
    const loop: () => Partial<ChatResult> = () => ({ toolCalls: [call(`c${Math.random()}`.replace(".", ""), "run_shell", { cmd: "rm -rf /" })] })
    const client = new ScriptedClient(Array.from({ length: 10 }, () => loop))
    const { agent, sessions } = mkAgent(s, client, { maxSteps: 3 })
    const events: AgentEvent[] = []
    await agent.run({ runId: "r", projectId: PID, session: sessions.create(PID, "x"), text: "chạy lệnh", signal: new AbortController().signal, emit: (e) => events.push(e) })
    const end = events.at(-1) as Extract<AgentEvent, { type: "run_end" }>
    assert.equal(end.status, "limit")
    assert.equal(client.calls.length, 3)
    const toolEnds = events.filter((e) => e.type === "tool_end") as Extract<AgentEvent, { type: "tool_end" }>[]
    assert.ok(toolEnds.every((e) => !e.ok))
    assert.match(client.calls[1].at(-1)!.content!, /không có công cụ/)
  } finally {
    s.cleanup()
  }
})

test("giới hạn số đề xuất mỗi lượt và token mỗi lượt", async () => {
  const s = setupProject()
  try {
    const client = new ScriptedClient([
      () => ({ toolCalls: [call("a", "write_file", { path: "a.md", content: "a" }), call("b", "write_file", { path: "b.md", content: "b" }), call("c", "write_file", { path: "c.md", content: "c" })] }),
      () => ({ content: "ok", usage: { promptTokens: 5000, completionTokens: 0 } }),
    ])
    const { agent, sessions } = mkAgent(s, client, { maxProposalsPerRun: 2 })
    const events: AgentEvent[] = []
    await agent.run({ runId: "r", projectId: PID, session: sessions.create(PID, "x"), text: "tạo 3 tệp", signal: new AbortController().signal, emit: (e) => events.push(e) })
    assert.equal(events.filter((e) => e.type === "change").length, 2)
    assert.match(client.calls[1].at(-1)!.content!, /giới hạn 2 đề xuất/)

    const c2 = new ScriptedClient([() => ({ toolCalls: [call("x", "list_files", {})], usage: { promptTokens: 900, completionTokens: 200 } })])
    const m2 = mkAgent(s, c2, { maxTokensPerRun: 1000 })
    const ev2: AgentEvent[] = []
    await m2.agent.run({ runId: "r2", projectId: PID, session: m2.sessions.create(PID, "y"), text: "liệt kê", signal: new AbortController().signal, emit: (e) => ev2.push(e) })
    assert.equal((ev2.at(-1) as Extract<AgentEvent, { type: "run_end" }>).status, "limit")
  } finally {
    s.cleanup()
  }
})

test("người dùng dừng giữa chừng; máy chủ báo ngữ cảnh quá dài thì rút gọn và thử lại", async () => {
  const s = setupProject()
  try {
    const ctrl = new AbortController()
    const client = new ScriptedClient([
      () => {
        ctrl.abort()
        return { toolCalls: [call("a", "read_file", { path: "bao-cao.md" })] }
      },
    ])
    const { agent, sessions } = mkAgent(s, client)
    const events: AgentEvent[] = []
    const sess = sessions.create(PID, "x")
    await agent.run({ runId: "r", projectId: PID, session: sess, text: "đọc", signal: ctrl.signal, emit: (e) => events.push(e) })
    assert.equal((events.at(-1) as Extract<AgentEvent, { type: "run_end" }>).status, "stopped")
    // lịch sử lưu không có assistant tool_calls treo (thiếu kết quả)
    const saved = sessions.get(PID, sess.id)!
    for (const [i, m] of saved.llm.entries()) {
      if (m.role === "assistant" && m.tool_calls?.length) {
        for (const tc of m.tool_calls) assert.ok(saved.llm.slice(i + 1).some((x) => x.role === "tool" && x.tool_call_id === tc.id))
      }
    }

    let sizes: number[] = []
    const c2 = new ScriptedClient([
      (m) => {
        sizes.push(JSON.stringify(m).length)
        return new LlmError("quá dài", "context_too_large", 413)
      },
      (m) => {
        sizes.push(JSON.stringify(m).length)
        return { content: "ok" }
      },
    ])
    const m2 = mkAgent(s, c2)
    const sess2 = sessions.create(PID, "y")
    sess2.llm = Array.from({ length: 12 }, (_, i): ChatMsg[] => [
      { role: "user", content: `câu ${i}` },
      { role: "assistant", content: "", tool_calls: [{ id: `t${i}`, type: "function", function: { name: "read_file", arguments: "{}" } }] },
      { role: "tool", tool_call_id: `t${i}`, content: "x".repeat(3000) },
      { role: "assistant", content: "trả lời" },
    ]).flat()
    const ev2: AgentEvent[] = []
    await m2.agent.run({ runId: "r2", projectId: PID, session: sess2, text: "tiếp", signal: new AbortController().signal, emit: (e) => ev2.push(e) })
    assert.equal((ev2.at(-1) as Extract<AgentEvent, { type: "run_end" }>).status, "done")
    assert.ok(sizes[1] < sizes[0], "lần thử lại gửi ít hơn")
  } finally {
    s.cleanup()
  }
})

test("compactMessages: giữ system + lượt hiện tại, bỏ lượt cũ, cắt kết quả công cụ lớn", () => {
  const msgs: ChatMsg[] = [
    { role: "system", content: "S" },
    { role: "user", content: "cũ 1" },
    { role: "assistant", content: "", tool_calls: [{ id: "a", type: "function", function: { name: "read_file", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "a", content: "y".repeat(20_000) },
    { role: "user", content: "mới" },
    { role: "assistant", content: "", tool_calls: [{ id: "b", type: "function", function: { name: "read_file", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "b", content: "z".repeat(30_000) },
  ]
  const r = compactMessages(msgs, 10_000, 4)
  assert.equal(r.messages[0].role, "system")
  assert.equal(r.messages[r.keepFrom].content, "mới")
  const total = r.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0)
  assert.ok(total <= 10_000, `tổng ${total}`)
  assert.ok(r.messages.some((m) => m.tool_call_id === "b"))
})

test("read_file cắt theo giới hạn ký tự và chỉ dẫn đọc tiếp; chặn tệp ẩn; search_text", async () => {
  const s = setupProject()
  try {
    const lines = Array.from({ length: 3000 }, (_, i) => `Dòng số ${i + 1} của tài liệu dài để kiểm tra giới hạn.`)
    fs.writeFileSync(path.join(s.proj, "dai.txt"), lines.join("\n"))
    fs.mkdirSync(path.join(s.proj, ".git"))
    fs.writeFileSync(path.join(s.proj, ".git", "config"), "secret")
    const tools = new AgentTools(s.folders, s.changes)
    const ctx = { projectId: PID, sessionId: "11111111-2222-4333-8444-555555555555" }
    const r = await tools.execute("read_file", JSON.stringify({ path: "dai.txt" }), ctx)
    assert.ok(r.ok)
    assert.ok(r.content.length < 17_000)
    assert.match(r.content, /start_line=\d+/)
    const r2 = await tools.execute("read_file", JSON.stringify({ path: "dai.txt", start_line: 2999 }), ctx)
    assert.match(r2.content, /Dòng số 3000/)
    const r3 = await tools.execute("read_file", JSON.stringify({ path: ".git/config" }), ctx)
    assert.equal(r3.ok, false)
    const r4 = await tools.execute("read_file", JSON.stringify({ path: "leak.md" }), ctx)
    assert.equal(r4.ok, false, "symlink ra ngoài bị chặn khi đọc")
    const r5 = await tools.execute("search_text", JSON.stringify({ query: "KẾT LUẬN" }), ctx)
    assert.match(r5.content, /bao-cao\.md:4: Kết luận\./)
    const r6 = await tools.execute("list_files", "{}", ctx)
    assert.doesNotMatch(r6.content, /\.git|leak|linkdir/)
    const bad = await tools.execute("read_file", "không phải json", ctx)
    assert.equal(bad.ok, false)
  } finally {
    s.cleanup()
  }
})

test("DesktopAuth: token mã hoá khi lưu, tự làm mới, 401 thì xoá, ngắt kết nối thu hồi", async () => {
  const s = setupProject()
  try {
    let now = Date.UTC(2026, 9, 16)
    const calls: { url: string; body?: string; auth?: string }[] = []
    let refreshOk = true
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, body: init?.body, auth: init?.headers?.Authorization })
      if (url.endsWith("/api/desktop/token")) {
        assert.equal(init?.headers?.["X-NEU-Desktop-Client"], "1")
        return new Response(JSON.stringify({ token_id: "t", access_token: "neuda_A1", access_expires_at: new Date(now + 3600e3).toISOString(), refresh_token: "neudr_R1", refresh_expires_at: new Date(now + 30 * 86400e3).toISOString(), user: { id: "u1", email: "lam@neu.edu.vn", name: "Lâm" } }), { status: 201 })
      }
      if (url.endsWith("/token/refresh")) {
        if (!refreshOk) return new Response(JSON.stringify({ code: "revoked" }), { status: 401 })
        return new Response(JSON.stringify({ access_token: "neuda_A2", access_expires_at: new Date(now + 3600e3).toISOString(), refresh_token: "neudr_R2", refresh_expires_at: new Date(now + 30 * 86400e3).toISOString() }), { status: 200 })
      }
      if (url.endsWith("/token/revoke")) return new Response("{}", { status: 200 })
      return new Response("{}", { status: 200 })
    }
    const file = path.join(s.base, "userdata", "auth.json")
    const codec = { available: () => true, encrypt: (x: string) => Buffer.from(Buffer.from(x).map((b) => b ^ 0x5a)), decrypt: (b: Buffer) => Buffer.from(b.map((x) => x ^ 0x5a)).toString() }
    const mk = () => new DesktopAuth({ file, codec, getPortal: () => ({ origin: "https://research.neu.edu.vn", url: "https://research.neu.edu.vn" }), cookieFetch: fetchImpl, fetch: fetchImpl, device: { name: "Mac", platform: "darwin", version: "0.2.0" }, now: () => now })
    const auth = mk()
    await auth.connect()
    const raw = fs.readFileSync(file, "utf8")
    assert.doesNotMatch(raw, /neuda_|neudr_|lam@neu/, "không lưu token dạng rõ")
    if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o077, 0)
    const auth2 = mk() // mở lại app
    assert.equal(auth2.user()?.email, "lam@neu.edu.vn")
    assert.equal(await auth2.accessToken(), "neuda_A1")
    now += 3600e3
    assert.equal(await auth2.accessToken(), "neuda_A2", "tự làm mới khi sắp hết hạn")
    await auth2.authorizedFetch("/api/desktop/me")
    assert.equal(calls.at(-1)!.auth, "Bearer neuda_A2")
    now += 3600e3
    refreshOk = false
    await assert.rejects(() => auth2.accessToken(), /hết hạn|thu hồi/)
    assert.equal(auth2.user(), null, "bị thu hồi → xoá token")
    await auth2.connect()
    await auth2.disconnect()
    assert.ok(calls.at(-1)!.url.endsWith("/api/desktop/token/revoke"))
    assert.equal(mk().user(), null)
  } finally {
    s.cleanup()
  }
})
