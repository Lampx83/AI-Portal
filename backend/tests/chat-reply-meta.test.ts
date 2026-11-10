import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildReplyRefs,
  errorReplyText,
  isTimeoutError,
  resolveAgentTimeoutMs,
  timeoutMessage,
  DEFAULT_AGENT_TIMEOUT_MS,
} from "../src/lib/chat/reply-meta"
import { describeProjectStage } from "../src/lib/project-lifecycle"

test("refs gom agents (object hoặc chuỗi), tools_used, functions_called; bỏ trùng và giá trị rác", () => {
  const refs = buildReplyRefs({
    stream: true,
    meta: {
      agents: [{ alias: "publish", name: "Tạp chí" }, "funds", "publish", 3],
      tools_used: ["funds", "", null],
      functions_called: ["funds__search", "funds__search"],
    },
  })
  assert.deepEqual(refs, { v: 1, stream: true, agents: ["publish", "funds"], tools_used: ["funds"], functions_called: ["funds__search"] })
})

test("refs có lỗi: cắt ngắn thông điệp, giữ step + http_status", () => {
  const refs = buildReplyRefs({ error: { code: "upstream_http", http_status: 502, step: "central_llm", message: "x\n".repeat(600) } })
  assert.equal(refs.error?.code, "upstream_http")
  assert.equal(refs.error?.http_status, 502)
  assert.equal(refs.error?.step, "central_llm")
  assert.ok((refs.error?.message ?? "").length <= 500)
  assert.ok(!(refs.error?.message ?? "").includes("\n"))
})

test("refs luôn là object (node-postgres đổi mảng JS thành mảng PG, không phải JSON)", () => {
  const refs = buildReplyRefs({ meta: null })
  assert.equal(Array.isArray(refs), false)
  assert.deepEqual(refs, { v: 1 })
})

test("timeout: publish mặc định 90 s, trợ lý khác 110 s (< 120 s của giao diện), config_json ghi đè có chặn biên", () => {
  assert.equal(resolveAgentTimeoutMs("publish"), 90_000)
  assert.equal(resolveAgentTimeoutMs("funds"), DEFAULT_AGENT_TIMEOUT_MS)
  assert.ok(DEFAULT_AGENT_TIMEOUT_MS < 120_000)
  assert.equal(resolveAgentTimeoutMs("publish", { request_timeout_ms: 60000 }), 60_000)
  assert.equal(resolveAgentTimeoutMs("publish", { request_timeout_ms: "75000" }), 75_000)
  assert.equal(resolveAgentTimeoutMs("publish", { request_timeout_ms: 10 }), 5_000)
  assert.equal(resolveAgentTimeoutMs("publish", { request_timeout_ms: "abc" }), 90_000)
})

test("thông báo hết giờ thân thiện, gợi ý thu hẹp câu hỏi; theo ngôn ngữ", () => {
  const vi = timeoutMessage("publish", 90_000, "vi")
  assert.match(vi, /Tạp chí, hội thảo/)
  assert.match(vi, /90 giây/)
  assert.match(vi, /thu hẹp/)
  assert.match(timeoutMessage("publish", 90_000, "en"), /narrow/)
  assert.match(timeoutMessage("funds", 110_000, undefined), /110 giây/)
  assert.equal(errorReplyText("aborted", "vi"), "(Đã dừng trả lời)")
})

test("nhận diện lỗi hết giờ", () => {
  assert.equal(isTimeoutError(new Error("x"), true), true)
  const e = new Error("The operation was aborted due to timeout")
  e.name = "TimeoutError"
  assert.equal(isTimeoutError(e), true)
  const a = new Error("aborted")
  a.name = "AbortError"
  assert.equal(isTimeoutError(a), false)
})

test("giai đoạn dự án dạng ngắn cho project_info", () => {
  assert.equal(describeProjectStage(null), "")
  assert.equal(describeProjectStage({ stages: [] }), "")
  assert.equal(
    describeProjectStage({ stages: [{ id: "explore", status: "done" }, { id: "review", status: "doing" }] }),
    "Tổng quan (đang thực hiện, 2/6)"
  )
})

test("chat.ts: mọi nhánh lỗi của /send đều lưu tin trả lời (không còn return im lặng)", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../src/routes/chat.ts"), "utf8")
  const sendStart = src.indexOf('router.post("/sessions/:sessionId/send"')
  const sendEnd = src.indexOf("// PATCH /api/chat/sessions/:sessionId")
  const body = src.slice(sendStart, sendEnd)
  assert.ok(body.includes("persistFailedTurn"), "thiếu persistFailedTurn")
  // upstreamError (luồng) phải đi qua persistFailedTurn trước khi trả sự kiện lỗi
  const errIdx = body.indexOf('type: "error"')
  assert.ok(errIdx > 0 && body.lastIndexOf("persistFailedTurn(", errIdx) > 0)
  // nhánh không luồng có thời gian chờ
  assert.ok(body.includes("resolveAgentTimeoutMs("))
  assert.ok(body.includes("signal: ac.signal"))
})
