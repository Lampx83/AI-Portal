/**
 * API cho ứng dụng máy tính NEU Research (Electron) — giai đoạn 2.
 *
 *   POST   /api/desktop/token           (cookie đăng nhập web + header X-NEU-Desktop-Client) → cấp token cho app
 *   POST   /api/desktop/token/refresh   { refresh_token } → xoay vòng cặp token
 *   POST   /api/desktop/token/revoke    Bearer access token, hoặc { refresh_token } → app tự ngắt kết nối
 *   GET    /api/desktop/devices         (cookie) → danh sách thiết bị đang kết nối của chính người dùng
 *   DELETE /api/desktop/devices/:id     (cookie) → thu hồi một thiết bị
 *   GET    /api/desktop/me              Bearer → thông tin tài khoản + giới hạn
 *   POST   /api/desktop/chat            Bearer → stream SSE tới LLM của Central (vLLM), có tool-calling
 *
 * Máy chủ KHÔNG lưu nội dung hội thoại hay nội dung tệp — chỉ ghi nhật ký số lượng (desktop_usage).
 */
import express, { type Request, type Response, type Router } from "express"
import OpenAI from "openai"
import { getCaller } from "../lib/chat/access"
import { getCentralLlmCredentials, llmExtraBody, type CentralLlmCredentials } from "../lib/central-agent-config"
import {
  chatLimits,
  ChatRequestError,
  ContentGate,
  extractInlineToolCalls,
  PerUserLimiter,
  stripThink,
  ToolCallCollector,
  validateChatRequest,
  type ToolCall,
  type ValidChatRequest,
} from "../lib/desktop/chat"
import { PgDesktopTokenStore, PgDesktopUsageLog, type DesktopUsageLog } from "../lib/desktop/pg-store"
import { DesktopTokenError, DesktopTokenService, type DesktopTokenRow, type DesktopUser } from "../lib/desktop/tokens"

export interface LlmStreamChunk {
  choices?: { delta?: { content?: string | null; tool_calls?: unknown }; finish_reason?: string | null }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
}

export interface DesktopRouterDeps {
  tokens: DesktopTokenService
  usage: DesktopUsageLog
  getCaller: (req: Request) => Promise<{ id: string | null; email: string | null }>
  getLlm: () => Promise<CentralLlmCredentials | null>
  streamLlm: (cred: CentralLlmCredentials, req: ValidChatRequest, signal: AbortSignal) => Promise<AsyncIterable<LlmStreamChunk>>
  limiter?: PerUserLimiter
}

function envInt(name: string, def: number): number {
  const raw = process.env[name]
  const n = raw == null || raw.trim() === "" ? def : Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : def
}

export function defaultStreamLlm(cred: CentralLlmCredentials, r: ValidChatRequest, signal: AbortSignal): Promise<AsyncIterable<LlmStreamChunk>> {
  const headers = cred.extraHeaders && Object.keys(cred.extraHeaders).length ? cred.extraHeaders : undefined
  const client = new OpenAI({ apiKey: cred.apiKey, ...(cred.baseUrl ? { baseURL: cred.baseUrl } : {}), ...(headers ? { defaultHeaders: headers } : {}), timeout: 180_000, maxRetries: 0 })
  return client.chat.completions.create(
    {
      model: cred.model,
      messages: r.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      ...(r.tools.length ? { tools: r.tools as OpenAI.Chat.Completions.ChatCompletionTool[], tool_choice: "auto" as const } : {}),
      max_tokens: r.max_tokens,
      temperature: r.temperature,
      stream: true,
      stream_options: { include_usage: true },
      ...llmExtraBody(cred),
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
    { signal },
  ) as unknown as Promise<AsyncIterable<LlmStreamChunk>>
}

function sendError(res: Response, e: unknown): void {
  if (e instanceof DesktopTokenError || e instanceof ChatRequestError) {
    res.status(e.status).json({ error: e.message, code: e.code })
    return
  }
  console.error("[desktop]", (e as Error)?.message ?? e)
  res.status(500).json({ error: "Lỗi máy chủ", code: "server_error" })
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization
  if (typeof h !== "string") return null
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim())
  return m ? m[1] : null
}

type AuthedRequest = Request & { desktop?: { row: DesktopTokenRow; user: DesktopUser } }

export function createDesktopRouter(deps: DesktopRouterDeps): Router {
  const router = express.Router()
  const limiter =
    deps.limiter ??
    new PerUserLimiter(
      () => envInt("DESKTOP_CHAT_RATE_PER_MIN", 30),
      () => envInt("DESKTOP_CHAT_MAX_CONCURRENT", 2),
    )

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store")
    next()
  })

  const requireToken = async (req: AuthedRequest, res: Response, next: express.NextFunction) => {
    try {
      req.desktop = await deps.tokens.verifyAccess(bearer(req))
      next()
    } catch (e) {
      sendError(res, e)
    }
  }

  // ── Cấp token: cần phiên đăng nhập web (cookie) + header riêng của app (chặn form/CSRF khác origin: header lạ buộc preflight).
  router.post("/token", async (req, res) => {
    try {
      if (req.headers["x-neu-desktop-client"] !== "1") {
        return res.status(400).json({ error: "Chỉ ứng dụng máy tính NEU Research mới xin được token", code: "not_desktop" })
      }
      const caller = await deps.getCaller(req)
      if (!caller.id) return res.status(401).json({ error: "Bạn cần đăng nhập trước", code: "login_required" })
      const b = (req.body ?? {}) as Record<string, unknown>
      const out = await deps.tokens.issue({ id: caller.id, email: caller.email }, b)
      const user = await deps.tokens.verifyAccess(out.access_token)
      res.status(201).json({ ...out, user: { id: user.user.id, email: user.user.email, name: user.user.name } })
    } catch (e) {
      sendError(res, e)
    }
  })

  router.post("/token/refresh", async (req, res) => {
    try {
      const out = await deps.tokens.refresh((req.body ?? {}).refresh_token)
      res.json(out)
    } catch (e) {
      sendError(res, e)
    }
  })

  router.post("/token/revoke", async (req, res) => {
    try {
      const tok = bearer(req) ?? (req.body ?? {}).refresh_token
      const ok = await deps.tokens.revokeByToken(tok)
      res.json({ ok })
    } catch (e) {
      sendError(res, e)
    }
  })

  router.get("/devices", async (req, res) => {
    try {
      const caller = await deps.getCaller(req)
      if (!caller.id) return res.status(401).json({ error: "Bạn cần đăng nhập trước", code: "login_required" })
      res.json({ devices: await deps.tokens.listForUser(caller.id) })
    } catch (e) {
      sendError(res, e)
    }
  })

  router.delete("/devices/:id", async (req, res) => {
    try {
      const caller = await deps.getCaller(req)
      if (!caller.id) return res.status(401).json({ error: "Bạn cần đăng nhập trước", code: "login_required" })
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Mã thiết bị không hợp lệ", code: "bad_request" })
      const ok = await deps.tokens.revokeForUser(caller.id, req.params.id)
      res.status(ok ? 200 : 404).json({ ok })
    } catch (e) {
      sendError(res, e)
    }
  })

  router.get("/me", requireToken, async (req: AuthedRequest, res) => {
    const lim = chatLimits()
    const daily = envInt("DESKTOP_DAILY_TOKEN_LIMIT", 1_500_000)
    let used = 0
    try {
      used = await deps.usage.tokensLast24h(req.desktop!.user.id)
    } catch {
      /* bỏ qua */
    }
    const cred = await deps.getLlm().catch(() => null)
    res.json({
      user: { id: req.desktop!.user.id, email: req.desktop!.user.email, name: req.desktop!.user.name },
      token_id: req.desktop!.row.id,
      llm: { available: !!cred, model: cred?.model ?? null, context_tokens: lim.contextTokens },
      limits: {
        max_input_chars: lim.maxInputChars,
        max_output_tokens: lim.maxOutputTokens,
        max_tools: lim.maxTools,
        rate_per_min: envInt("DESKTOP_CHAT_RATE_PER_MIN", 30),
        daily_tokens: daily,
        daily_tokens_used: used,
      },
    })
  })

  router.post("/chat", requireToken, async (req: AuthedRequest, res) => {
    const t0 = Date.now()
    const user = req.desktop!.user
    const tokenId = req.desktop!.row.id
    const maxBody = envInt("DESKTOP_CHAT_MAX_BODY_BYTES", 1_500_000)
    const len = Number(req.headers["content-length"] ?? 0)
    if (len > maxBody) return res.status(413).json({ error: "Yêu cầu quá lớn", code: "body_too_large" })

    let valid: ValidChatRequest
    try {
      valid = validateChatRequest(req.body)
    } catch (e) {
      return sendError(res, e)
    }

    const daily = envInt("DESKTOP_DAILY_TOKEN_LIMIT", 1_500_000)
    if (daily > 0) {
      try {
        const used = await deps.usage.tokensLast24h(user.id)
        if (used >= daily) return res.status(429).json({ error: "Bạn đã dùng hết hạn mức AI trong 24 giờ. Vui lòng thử lại sau.", code: "daily_quota" })
      } catch {
        /* nhật ký lỗi: không chặn người dùng */
      }
    }

    const lim = limiter.acquire(user.id)
    if (lim) {
      res.setHeader("Retry-After", "20")
      return res.status(429).json({
        error: lim === "rate" ? "Quá nhiều yêu cầu AI trong một phút, vui lòng chờ giây lát." : "Đang có yêu cầu khác của bạn chạy, vui lòng chờ.",
        code: lim === "rate" ? "rate_limited" : "too_many_concurrent",
      })
    }

    let released = false
    const release = () => {
      if (!released) {
        released = true
        limiter.release(user.id)
      }
    }

    const cred = await deps.getLlm().catch(() => null)
    if (!cred) {
      release()
      return res.status(503).json({ error: "Máy chủ chưa cấu hình mô hình AI (Central).", code: "llm_unavailable" })
    }

    const ctrl = new AbortController()
    let clientGone = false
    res.on("close", () => {
      if (!res.writableEnded) {
        clientGone = true
        ctrl.abort()
      }
    })

    let content = ""
    let finish: string | null = null
    let promptTokens = 0
    let completionTokens = 0
    let calls: ToolCall[] = []
    let status = "ok"
    let started = false
    const write = (payload: unknown) => {
      if (!clientGone && !res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    try {
      const stream = await deps.streamLlm(cred, valid, ctrl.signal)
      res.status(200)
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
      res.setHeader("Cache-Control", "no-cache, no-transform")
      res.setHeader("Connection", "keep-alive")
      res.setHeader("X-Accel-Buffering", "no")
      res.flushHeaders?.()
      started = true
      write({ type: "start", model: cred.model })
      const collector = new ToolCallCollector()
      const gate = new ContentGate()
      for await (const chunk of stream) {
        if (clientGone) break
        const ch = chunk?.choices?.[0]
        const d = ch?.delta
        if (d?.tool_calls) collector.add(d.tool_calls)
        if (typeof d?.content === "string" && d.content) {
          content += d.content
          const out = gate.push(d.content)
          if (out) write({ type: "delta", content: out })
        }
        if (ch?.finish_reason) finish = ch.finish_reason
        if (chunk?.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? promptTokens
          completionTokens = chunk.usage.completion_tokens ?? completionTokens
        }
      }
      const tail = gate.flush()
      if (tail) write({ type: "delta", content: tail })
      calls = collector.toCalls()
      let finalContent = stripThink(content)
      if (calls.length === 0) {
        const inline = extractInlineToolCalls(finalContent)
        if (inline.calls.length) {
          calls = inline.calls
          finalContent = inline.content
          finish = "tool_calls"
        }
      }
      if (!promptTokens) promptTokens = valid.estimatedTokens
      if (!completionTokens) completionTokens = Math.ceil(content.length / 2.5)
      if (clientGone) status = "aborted"
      write({
        type: "done",
        content: finalContent,
        tool_calls: calls,
        finish_reason: finish ?? (calls.length ? "tool_calls" : "stop"),
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
      })
      res.end()
    } catch (e) {
      const err = e as { status?: number; message?: string; name?: string }
      status = clientGone || err?.name === "AbortError" ? "aborted" : "error"
      const tooLong = err?.status === 400 && /context|maximum|too long|token/i.test(String(err?.message ?? ""))
      if (status === "error") console.warn("[desktop] LLM lỗi:", err?.status ?? "", String(err?.message ?? e).slice(0, 300))
      if (!started) {
        if (!clientGone) {
          if (tooLong) res.status(413).json({ error: "Ngữ cảnh quá dài so với giới hạn mô hình, cần rút gọn", code: "context_too_large" })
          else res.status(502).json({ error: "Không gọi được mô hình AI trên máy chủ", code: "llm_error" })
        }
      } else {
        write({ type: "error", code: tooLong ? "context_too_large" : "llm_error", message: "Mô hình AI gặp lỗi khi trả lời" })
        res.end()
      }
    } finally {
      release()
      void deps.usage
        .record({
          user_id: user.id,
          token_id: tokenId,
          model: cred.model,
          status,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          input_chars: valid.inputChars,
          tool_calls: calls.length,
          duration_ms: Date.now() - t0,
        })
        .catch((e) => console.warn("[desktop] không ghi được nhật ký sử dụng:", (e as Error)?.message ?? e))
    }
  })

  return router
}

export default createDesktopRouter({
  tokens: new DesktopTokenService(new PgDesktopTokenStore()),
  usage: new PgDesktopUsageLog(),
  getCaller: async (req) => {
    const c = await getCaller(req)
    return { id: c.id, email: c.email }
  },
  getLlm: getCentralLlmCredentials,
  streamLlm: defaultStreamLlm,
})
