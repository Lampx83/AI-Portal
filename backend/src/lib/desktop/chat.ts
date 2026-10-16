/**
 * Kiểm tra + chuẩn hoá yêu cầu chat của ứng dụng máy tính, và gom kết quả stream của LLM.
 * Hàm thuần — kiểm thử đơn vị được (tests/desktop-chat.test.ts).
 *
 * Mô hình: vLLM Qwen3.5 ngữ cảnh 32k token. Ước lượng token = ký tự / 2.5 (thận trọng cho tiếng Việt + JSON),
 * từ chối (413) nếu đầu vào + max_tokens vượt ngữ cảnh — app sẽ rút gọn lịch sử rồi gửi lại.
 */

function envInt(name: string, def: number, min: number, max: number): number {
  const raw = process.env[name]
  const n = raw == null || raw.trim() === "" ? def : Number(raw)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.round(n)))
}

export interface ChatLimits {
  maxMessages: number
  maxMessageChars: number
  maxInputChars: number
  maxTools: number
  maxToolSchemaChars: number
  maxOutputTokens: number
  contextTokens: number
  charsPerToken: number
}

export function chatLimits(): ChatLimits {
  return {
    maxMessages: envInt("DESKTOP_CHAT_MAX_MESSAGES", 120, 2, 1000),
    maxMessageChars: envInt("DESKTOP_CHAT_MAX_MESSAGE_CHARS", 40_000, 1000, 400_000),
    maxInputChars: envInt("DESKTOP_CHAT_MAX_INPUT_CHARS", 80_000, 2000, 1_000_000),
    maxTools: envInt("DESKTOP_CHAT_MAX_TOOLS", 16, 0, 64),
    maxToolSchemaChars: envInt("DESKTOP_CHAT_MAX_TOOL_SCHEMA_CHARS", 12_000, 500, 100_000),
    maxOutputTokens: envInt("DESKTOP_CHAT_MAX_OUTPUT_TOKENS", 4096, 64, 16_384),
    contextTokens: envInt("DESKTOP_CONTEXT_TOKENS", 32_768, 2048, 1_000_000),
    charsPerToken: 2.5,
  }
}

export class ChatRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
  }
}

export type Role = "system" | "user" | "assistant" | "tool"

export interface ToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export interface ChatMessage {
  role: Role
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolDef {
  type: "function"
  function: { name: string; description?: string; parameters?: Record<string, unknown> }
}

export interface ValidChatRequest {
  messages: ChatMessage[]
  tools: ToolDef[]
  max_tokens: number
  temperature: number
  /** Số ký tự đầu vào (nhật ký, không lưu nội dung). */
  inputChars: number
  estimatedTokens: number
}

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/
const ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

export function validateChatRequest(body: unknown, lim: ChatLimits = chatLimits()): ValidChatRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ChatRequestError("Thân yêu cầu phải là JSON", 400, "bad_request")
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.messages) || b.messages.length === 0) throw new ChatRequestError("Thiếu messages", 400, "bad_request")
  if (b.messages.length > lim.maxMessages) throw new ChatRequestError("Quá nhiều tin nhắn trong một yêu cầu", 413, "too_many_messages")

  let inputChars = 0
  const systemParts: string[] = []
  const rest: ChatMessage[] = []
  for (const raw of b.messages) {
    if (!raw || typeof raw !== "object") throw new ChatRequestError("Tin nhắn không hợp lệ", 400, "bad_request")
    const m = raw as Record<string, unknown>
    const role = m.role
    const content = m.content == null ? null : str(m.content)
    if (m.content != null && content === null) throw new ChatRequestError("content phải là chuỗi", 400, "bad_request")
    if (content && content.length > lim.maxMessageChars) throw new ChatRequestError("Một tin nhắn quá dài", 413, "message_too_large")
    inputChars += content?.length ?? 0
    if (role === "system") {
      if (content) systemParts.push(content)
      continue
    }
    if (role === "user") {
      if (!content) throw new ChatRequestError("Tin nhắn người dùng rỗng", 400, "bad_request")
      rest.push({ role, content })
    } else if (role === "assistant") {
      const msg: ChatMessage = { role, content: content ?? "" }
      if (m.tool_calls != null) {
        if (!Array.isArray(m.tool_calls) || m.tool_calls.length > 16) throw new ChatRequestError("tool_calls không hợp lệ", 400, "bad_request")
        msg.tool_calls = m.tool_calls.map((tc) => {
          const t = tc as Record<string, unknown>
          const fn = (t?.function ?? {}) as Record<string, unknown>
          const id = str(t?.id)
          const name = str(fn.name)
          const args = str(fn.arguments) ?? "{}"
          if (!id || !ID_RE.test(id) || !name || !NAME_RE.test(name)) throw new ChatRequestError("tool_calls không hợp lệ", 400, "bad_request")
          if (args.length > lim.maxMessageChars) throw new ChatRequestError("Tham số công cụ quá dài", 413, "message_too_large")
          inputChars += args.length + name.length
          return { id, type: "function" as const, function: { name, arguments: args } }
        })
        if (msg.tool_calls.length === 0) delete msg.tool_calls
      }
      rest.push(msg)
    } else if (role === "tool") {
      const id = str(m.tool_call_id)
      if (!id || !ID_RE.test(id)) throw new ChatRequestError("tool_call_id không hợp lệ", 400, "bad_request")
      rest.push({ role, content: content ?? "", tool_call_id: id })
    } else {
      throw new ChatRequestError("role không hợp lệ", 400, "bad_request")
    }
  }
  if (!rest.some((m) => m.role === "user")) throw new ChatRequestError("Cần ít nhất một tin nhắn người dùng", 400, "bad_request")

  // Qwen3.5 (vLLM) bắt buộc system đứng đầu và chỉ một: gộp mọi system lên đầu.
  const messages: ChatMessage[] = systemParts.length ? [{ role: "system", content: systemParts.join("\n\n") }, ...rest] : rest

  let tools: ToolDef[] = []
  if (b.tools != null) {
    if (!Array.isArray(b.tools)) throw new ChatRequestError("tools phải là mảng", 400, "bad_request")
    if (b.tools.length > lim.maxTools) throw new ChatRequestError("Quá nhiều công cụ", 413, "too_many_tools")
    tools = b.tools.map((t) => {
      const tt = t as Record<string, unknown>
      const fn = (tt?.function ?? {}) as Record<string, unknown>
      const name = str(fn.name)
      if (tt?.type !== "function" || !name || !NAME_RE.test(name)) throw new ChatRequestError("Định nghĩa công cụ không hợp lệ", 400, "bad_request")
      const params = fn.parameters
      if (params != null && (typeof params !== "object" || Array.isArray(params))) throw new ChatRequestError("parameters phải là object", 400, "bad_request")
      const desc = str(fn.description) ?? undefined
      return { type: "function" as const, function: { name, ...(desc ? { description: desc } : {}), ...(params ? { parameters: params as Record<string, unknown> } : {}) } }
    })
    const schemaChars = JSON.stringify(tools).length
    if (schemaChars > lim.maxToolSchemaChars) throw new ChatRequestError("Định nghĩa công cụ quá lớn", 413, "tools_too_large")
    inputChars += schemaChars
  }

  if (inputChars > lim.maxInputChars) throw new ChatRequestError("Ngữ cảnh quá dài, cần rút gọn", 413, "context_too_large")

  let maxTokens = lim.maxOutputTokens
  if (b.max_tokens != null) {
    const n = Number(b.max_tokens)
    if (!Number.isFinite(n) || n < 1) throw new ChatRequestError("max_tokens không hợp lệ", 400, "bad_request")
    maxTokens = Math.min(lim.maxOutputTokens, Math.floor(n))
  }
  const estimatedTokens = Math.ceil(inputChars / lim.charsPerToken) + 16 * messages.length
  if (estimatedTokens + maxTokens > lim.contextTokens - 256) {
    throw new ChatRequestError("Ngữ cảnh quá dài so với giới hạn mô hình, cần rút gọn", 413, "context_too_large")
  }
  let temperature = 0.2
  if (b.temperature != null) {
    const t = Number(b.temperature)
    if (Number.isFinite(t)) temperature = Math.min(1, Math.max(0, t))
  }
  return { messages, tools, max_tokens: maxTokens, temperature, inputChars, estimatedTokens }
}

/** Gom tool_calls từ các delta stream (theo index). */
export class ToolCallCollector {
  private byIndex = new Map<number, { id: string; name: string; args: string }>()

  add(deltas: unknown): void {
    if (!Array.isArray(deltas)) return
    for (const d of deltas) {
      const x = d as { index?: number; id?: string; function?: { name?: string; arguments?: unknown } }
      const idx = typeof x.index === "number" ? x.index : this.byIndex.size
      const cur = this.byIndex.get(idx) ?? { id: "", name: "", args: "" }
      if (x.id) cur.id = x.id
      if (x.function?.name) cur.name += x.function.name
      const a = x.function?.arguments
      // Một số server (Ollama) trả arguments là object thay vì chuỗi JSON.
      if (typeof a === "string") cur.args += a
      else if (a && typeof a === "object") cur.args = JSON.stringify(a)
      this.byIndex.set(idx, cur)
    }
  }

  toCalls(): ToolCall[] {
    return [...this.byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([, c]) => c.name)
      .map(([i, c]) => ({ id: c.id || `call_${i}_${Date.now().toString(36)}`, type: "function" as const, function: { name: c.name, arguments: c.args || "{}" } }))
  }
}

const TOOL_TAG_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g

/**
 * Qwen khi server KHÔNG bật tool-call parser: lời gọi công cụ nằm trong nội dung dạng
 * `<tool_call>{"name":..,"arguments":{..}}</tool_call>`. Tách ra thành tool_calls chuẩn.
 */
export function extractInlineToolCalls(content: string): { content: string; calls: ToolCall[] } {
  if (!content.includes("<tool_call>")) return { content, calls: [] }
  const calls: ToolCall[] = []
  let i = 0
  const cleaned = content.replace(TOOL_TAG_RE, (whole, json: string) => {
    try {
      const obj = JSON.parse(json) as { name?: unknown; arguments?: unknown }
      if (typeof obj.name !== "string" || !NAME_RE.test(obj.name)) return whole
      const args = typeof obj.arguments === "string" ? obj.arguments : JSON.stringify(obj.arguments ?? {})
      calls.push({ id: `call_inline_${i++}`, type: "function", function: { name: obj.name, arguments: args } })
      return ""
    } catch {
      return whole
    }
  })
  return { content: cleaned.trim(), calls }
}

export function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").replace(/^[\s\S]*?<\/think>\s*/i, "")
}

/**
 * Cổng phát nội dung trực tiếp: giữ lại phần có thể là đầu thẻ `<tool_call>` / `<think>` để không phát ra
 * cho người dùng. Khi đã thấy thẻ thì ngừng phát (nội dung cuối cùng gửi trong sự kiện done).
 */
export class ContentGate {
  private buf = ""
  private stopped = false
  private inThink = false

  push(delta: string): string {
    if (this.stopped) return ""
    this.buf += delta
    let out = ""
    for (;;) {
      if (this.inThink) {
        const end = this.buf.indexOf("</think>")
        if (end < 0) return out
        this.buf = this.buf.slice(end + 8)
        this.inThink = false
        continue
      }
      const lt = this.buf.indexOf("<")
      if (lt < 0) {
        out += this.buf
        this.buf = ""
        return out
      }
      out += this.buf.slice(0, lt)
      this.buf = this.buf.slice(lt)
      if (this.buf.startsWith("<tool_call>")) {
        this.stopped = true
        return out
      }
      if (this.buf.startsWith("<think>")) {
        this.inThink = true
        this.buf = this.buf.slice(7)
        continue
      }
      // Có thể là đầu thẻ chưa đủ ký tự → giữ lại chờ thêm.
      if ("<tool_call>".startsWith(this.buf) || "<think>".startsWith(this.buf)) return out
      out += "<"
      this.buf = this.buf.slice(1)
    }
  }

  flush(): string {
    if (this.stopped || this.inThink) return ""
    const b = this.buf
    this.buf = ""
    return b
  }
}

/** Bộ giới hạn theo người dùng (bộ nhớ trong tiến trình): số yêu cầu/phút + số luồng đồng thời. */
export class PerUserLimiter {
  private hits = new Map<string, number[]>()
  private running = new Map<string, number>()

  constructor(
    private readonly perMinute: () => number,
    private readonly maxConcurrent: () => number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Trả về null nếu được phép (và đã tính lượt), hoặc mã lỗi. */
  acquire(userId: string): null | "rate" | "concurrency" {
    const t = this.now()
    const arr = (this.hits.get(userId) ?? []).filter((x) => t - x < 60_000)
    const pm = this.perMinute()
    if (pm > 0 && arr.length >= pm) {
      this.hits.set(userId, arr)
      return "rate"
    }
    const run = this.running.get(userId) ?? 0
    const mc = this.maxConcurrent()
    if (mc > 0 && run >= mc) return "concurrency"
    arr.push(t)
    this.hits.set(userId, arr)
    this.running.set(userId, run + 1)
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (!v.some((x) => t - x < 60_000)) this.hits.delete(k)
    }
    return null
  }

  release(userId: string): void {
    const run = (this.running.get(userId) ?? 1) - 1
    if (run <= 0) this.running.delete(userId)
    else this.running.set(userId, run)
  }
}
