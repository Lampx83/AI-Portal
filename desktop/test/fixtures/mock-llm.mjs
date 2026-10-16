// Máy chủ LLM giả lập kiểu OpenAI (POST /v1/chat/completions, stream SSE) cho kiểm thử đầu-cuối trợ lý thư mục.
// Trả lời theo kịch bản dựa vào câu hỏi của người dùng và các kết quả công cụ đã có trong lượt hiện tại:
//   - "chính tả" / "proofread": read_file ghi-chu.md → edit_file sửa «lổi»→«lỗi» → trả lời.
//   - "tóm tắt" / "summar":   list_files → read_file ghi-chu.md → trả lời có trích tên tệp.
//   - "dàn ý" / "outline":    read_file ghi-chu.md → write_file dan-y.md → trả lời.
//   - khác: trả lời thẳng.
// Ghi nhật ký từng yêu cầu (vai trò tin nhắn, số công cụ) vào tệp JSONL nếu đặt MOCK_LLM_LOG.
// Chạy: node test/fixtures/mock-llm.mjs [cổng=3950]
import fs from "node:fs"
import http from "node:http"

const port = Number(process.argv[2] || 3950)
const logFile = process.env.MOCK_LLM_LOG

function currentTurn(messages) {
  let i = messages.length - 1
  while (i >= 0 && messages[i].role !== "user") i--
  return { user: messages[i]?.content ?? "", after: messages.slice(i + 1) }
}

function decide(messages) {
  const { user, after } = currentTurn(messages)
  const done = (name) => after.some((m) => m.role === "assistant" && (m.tool_calls ?? []).some((t) => t.function.name === name))
  const lastTool = [...after].reverse().find((m) => m.role === "tool")?.content ?? ""
  const u = user.toLowerCase()
  const call = (name, args) => ({ tool: { name, args } })
  if (/chính tả|proofread/.test(u)) {
    if (!done("read_file")) return { text: "Tôi sẽ đọc tệp ghi chú trước.", ...call("read_file", { path: "ghi-chu.md" }) }
    if (!done("edit_file")) return call("edit_file", { path: "ghi-chu.md", edits: [{ old_text: "có lổi chính tả", new_text: "có lỗi chính tả" }], summary: "Sửa lỗi chính tả «lổi» → «lỗi»" })
    return { text: `Tôi đã đề xuất sửa 1 lỗi chính tả trong **ghi-chu.md** (${lastTool.includes("ĐỀ XUẤT") ? "đang chờ bạn duyệt" : "?"}). Mời bạn xem diff và bấm Chấp nhận hoặc Từ chối.` }
  }
  if (/tóm tắt|summar/.test(u)) {
    if (!done("list_files")) return call("list_files", {})
    if (!done("read_file")) return call("read_file", { path: "ghi-chu.md" })
    return { text: "Thư mục có các tài liệu:\n\n- **ghi-chu.md**: ghi chú về đề tài ứng dụng AI trong học tập.\n- **refs.bib**: danh mục tài liệu tham khảo.\n\nNội dung chính: khảo sát sinh viên về việc dùng AI." }
  }
  if (/dàn ý|outline/.test(u)) {
    if (!done("read_file")) return call("read_file", { path: "ghi-chu.md" })
    if (!done("write_file")) return call("write_file", { path: "dan-y.md", content: "# Dàn ý báo cáo\n\n## 1. Đặt vấn đề\n## 2. Phương pháp\n## 3. Kết quả\n", summary: "Tạo dàn ý báo cáo" })
    return { text: "Đã đề xuất tạo **dan-y.md**, mời bạn duyệt." }
  }
  return { text: `Xin chào! (mock) Bạn hỏi: ${user.slice(0, 80)}` }
}

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`)
}

let n = 0
http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url.startsWith("/v1/models")) {
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(JSON.stringify({ data: [{ id: "mock-qwen" }] }))
    }
    if (req.method !== "POST" || !req.url.startsWith("/v1/chat/completions")) {
      res.writeHead(404)
      return res.end()
    }
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", async () => {
      const b = JSON.parse(body)
      const d = decide(b.messages)
      if (logFile) {
        fs.appendFileSync(
          logFile,
          JSON.stringify({ at: new Date().toISOString(), roles: b.messages.map((m) => m.role), tools: (b.tools ?? []).map((t) => t.function.name), auth: req.headers["authorization"] ? "yes" : "no", seckey: req.headers["x-ollama-seckey"] ?? null, stream: !!b.stream, max_tokens: b.max_tokens, thinking: b.chat_template_kwargs ?? null, decision: d.tool?.name ?? "text" }) + "\n",
        )
      }
      res.writeHead(200, { "content-type": "text/event-stream" })
      const id = `chatcmpl-${++n}`
      const base = { id, object: "chat.completion.chunk", model: b.model, created: Math.floor(Date.now() / 1000) }
      if (d.text) {
        for (const part of d.text.match(/.{1,12}/gsu) ?? []) {
          sse(res, { ...base, choices: [{ index: 0, delta: { content: part } }] })
          await new Promise((r) => setTimeout(r, 15))
        }
      }
      if (d.tool) {
        const args = JSON.stringify(d.tool.args)
        sse(res, { ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: `call_${n}`, type: "function", function: { name: d.tool.name, arguments: "" } }] } }] })
        for (let i = 0; i < args.length; i += 20) {
          sse(res, { ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: args.slice(i, i + 20) } }] } }] })
        }
      }
      sse(res, { ...base, choices: [{ index: 0, delta: {}, finish_reason: d.tool ? "tool_calls" : "stop" }] })
      sse(res, { ...base, choices: [], usage: { prompt_tokens: Math.ceil(body.length / 3), completion_tokens: 40, total_tokens: Math.ceil(body.length / 3) + 40 } })
      res.write("data: [DONE]\n\n")
      res.end()
    })
  })
  .listen(port, "127.0.0.1", () => console.log(`mock LLM http://127.0.0.1:${port}/v1`))
