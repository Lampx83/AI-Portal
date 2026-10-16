/**
 * Gọi POST /api/desktop/chat (SSE) của máy chủ Research bằng token của app.
 */
export interface ChatToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: ChatToolCall[]
  tool_call_id?: string
}

export interface ChatToolDef {
  type: "function"
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface ChatResult {
  content: string
  toolCalls: ChatToolCall[]
  finishReason: string
  usage: { promptTokens: number; completionTokens: number }
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 0,
  ) {
    super(message)
    this.name = "LlmError"
  }
}

export type AuthorizedFetch = (p: string, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<Response>

export interface ChatClient {
  chat(req: { messages: ChatMsg[]; tools: ChatToolDef[]; maxTokens: number; temperature?: number }, opts: { signal?: AbortSignal; onDelta?: (t: string) => void }): Promise<ChatResult>
}

export class HttpChatClient implements ChatClient {
  constructor(private readonly fetchApi: AuthorizedFetch) {}

  async chat(
    req: { messages: ChatMsg[]; tools: ChatToolDef[]; maxTokens: number; temperature?: number },
    opts: { signal?: AbortSignal; onDelta?: (t: string) => void } = {},
  ): Promise<ChatResult> {
    const res = await this.fetchApi("/api/desktop/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ messages: req.messages, tools: req.tools, max_tokens: req.maxTokens, temperature: req.temperature ?? 0.2 }),
      signal: opts.signal,
    })
    if (!res.ok) {
      let body: { error?: string; code?: string } = {}
      try {
        body = (await res.json()) as typeof body
      } catch {
        /* bỏ qua */
      }
      const code = body.code ?? (res.status === 429 ? "rate_limited" : res.status === 401 ? "unauthorized" : "http_error")
      throw new LlmError(body.error ?? `Máy chủ trả lỗi HTTP ${res.status}`, code, res.status)
    }
    if (!res.body) throw new LlmError("Máy chủ không trả dữ liệu", "empty")
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ""
    let streamed = ""
    type DoneEv = { content?: string; tool_calls?: ChatToolCall[]; finish_reason?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    type ErrEv = { code?: string; message?: string }
    let done = null as DoneEv | null
    let err = null as ErrEv | null
    for (;;) {
      const r = await reader.read()
      if (r.done) break
      buf += dec.decode(r.value, { stream: true })
      let i: number
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i)
        buf = buf.slice(i + 2)
        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) continue
          let ev: Record<string, unknown>
          try {
            ev = JSON.parse(line.slice(5).trim())
          } catch {
            continue
          }
          if (ev.type === "delta" && typeof ev.content === "string") {
            streamed += ev.content
            opts.onDelta?.(ev.content)
          } else if (ev.type === "done") done = ev as DoneEv
          else if (ev.type === "error") err = ev as ErrEv
        }
      }
    }
    if (err) throw new LlmError(err.message ?? "Mô hình AI gặp lỗi", err.code ?? "llm_error")
    if (!done) throw new LlmError("Kết nối tới máy chủ bị ngắt giữa chừng", "incomplete")
    return {
      content: typeof done.content === "string" ? done.content : streamed,
      toolCalls: Array.isArray(done.tool_calls) ? done.tool_calls : [],
      finishReason: done.finish_reason ?? "stop",
      usage: { promptTokens: done.usage?.prompt_tokens ?? 0, completionTokens: done.usage?.completion_tokens ?? 0 },
    }
  }
}
