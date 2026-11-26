/**
 * Lớp chặn lạm dụng các điểm gọi LLM công khai (khách Portal CÓ quyền dùng AI nên không chặn hẳn):
 *  1) Giới hạn tốc độ theo IP cho các đường AI của ứng dụng nhúng (/api/apps/<alias>/…: ollama, ai/complete,
 *     assistant, v1/ask, transcribe, autofill…) và cho các đường hỏi đáp lõi (central_agent, orchestrator, chat/send…).
 *  2) Giới hạn kích thước thân JSON/urlencoded cho các đường AI (mặc định lõi cho phép 50MB — quá lớn cho một lời gọi LLM).
 *
 * Ngưỡng rộng có chủ đích: buổi lễ/lớp học ~50 người dùng chung một IP Wi‑Fi. Chỉnh bằng biến môi trường:
 *   AI_PUBLIC_RATE_LIMIT (mặc định 300/phút/IP, đường AI của app nhúng; 0 = tắt)
 *   AI_CORE_RATE_LIMIT   (mặc định 600/phút/IP, đường hỏi đáp lõi; 0 = tắt)
 *   AI_JSON_BODY_LIMIT   (mặc định 6mb), AI_JSON_BODY_LIMIT_LARGE (16mb, cho đường nhận tệp base64 như paper-match)
 */
import express, { Request, Response, NextFunction, RequestHandler } from "express"
import rateLimit from "express-rate-limit"

export type AiKind = "embed" | "core"

/** Phân đoạn đường dẫn (sau /api/apps/<alias>/) cho thấy lời gọi mô hình ngôn ngữ / dịch vụ AI nặng. */
const EMBED_AI_SEGMENTS = new Set([
  "ollama", // Quantis /api/quantis/ollama/* (proxy thẳng LLM) — tính cả GET
  "llm",
  "ai", // /api/ai/complete, /ai/chat, /classes/:id/ai/test…
  "assistant",
  "assistants",
  "chat",
  "chat-completions",
  "completions",
  "complete",
  "ask", // /v1/ask, /agent/v1/ask, /ask
  "agent",
  "transcribe", // Annota bóc băng (GPU)
  "autofill", // Regulations điền biểu mẫu bằng AI
  "paper-match",
  "review", // /v1/review (PlagiarismChecker, PaperReviewer)
  "summarize",
  "summarise",
  "translate",
  "generate",
  "paraphrase",
])
/** Phân đoạn mà MỌI phương thức (kể cả GET) đều tính, vì proxy chuyển thẳng tới LLM. */
const ANY_METHOD_SEGMENTS = new Set(["ollama"])
/** Các đường nhận tệp mã hoá base64 trong JSON → cho thân lớn hơn. */
const LARGE_BODY_SEGMENTS = new Set(["paper-match"])

const CORE_AI_PATHS: RegExp[] = [
  /^\/api\/(central_agent|orchestrator|hoso_agent|score_advisor_agent)\/v1\/ask\/?$/,
  /^\/api\/chat\/sessions\/[^/]+\/send\/?$/,
  /^\/api\/desktop\/chat\/?$/, // ứng dụng máy tính: còn giới hạn riêng theo người dùng trong routes/desktop.ts
]

function decodePath(p: string): string | null {
  let cur = p
  for (let i = 0; i < 3; i++) {
    let next: string
    try {
      next = decodeURIComponent(cur)
    } catch {
      return null
    }
    if (next === cur) return cur
    cur = next
  }
  return cur
}

export interface AiClassification {
  kind: AiKind
  /** Cho phép thân JSON lớn (đường nhận tệp base64). */
  large: boolean
}

/** Phân loại một yêu cầu: đường AI của app nhúng, đường hỏi đáp lõi, hoặc null (không phải AI). */
export function classifyAiRequest(method: string, rawPath: string): AiClassification | null {
  const m = (method || "").toUpperCase()
  if (m === "OPTIONS" || m === "HEAD") return null
  const decoded = decodePath(rawPath || "/")
  // Đường dẫn mã hoá lạ (sai %xx / lồng nhiều lớp): coi là AI đã có tên miền /api/apps để vẫn bị đếm.
  if (decoded === null) {
    return /^\/api\/apps\//i.test(rawPath || "") ? { kind: "embed", large: false } : null
  }
  const lower = decoded.toLowerCase()

  if (lower.startsWith("/api/apps/")) {
    const segs = lower
      .split("/")
      .slice(4) // ["", "api", "apps", "<alias>", …]
      .map((s) => s.split(";")[0].trim())
      .filter(Boolean)
    let hit = false
    let large = false
    for (const s of segs) {
      if (LARGE_BODY_SEGMENTS.has(s)) large = true
      if (!EMBED_AI_SEGMENTS.has(s)) continue
      if (ANY_METHOD_SEGMENTS.has(s) || m === "POST" || m === "PUT" || m === "PATCH") hit = true
    }
    return hit ? { kind: "embed", large } : null
  }

  if (m === "POST" && CORE_AI_PATHS.some((re) => re.test(lower))) return { kind: "core", large: false }
  return null
}

function envLimit(name: string, def: number): number {
  const raw = process.env[name]
  if (raw == null || raw.trim() === "") return def
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : def
}

const lastLogged = new Map<string, number>()
function logThrottled(kind: AiKind, req: Request): void {
  const key = `${kind}:${req.ip}`
  const now = Date.now()
  const prev = lastLogged.get(key) ?? 0
  if (now - prev < 60_000) return
  lastLogged.set(key, now)
  if (lastLogged.size > 5000) lastLogged.clear()
  console.warn(`[ai-guard] 429 ${kind} ip=${req.ip} ${req.method} ${String(req.originalUrl).split("?")[0].slice(0, 160)}`)
}

function makeLimiter(kind: AiKind, limit: number): RequestHandler {
  if (limit <= 0) return (_req, _res, next) => next()
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => classifyAiRequest(req.method, req.path)?.kind !== kind,
    handler: (req: Request, res: Response) => {
      logThrottled(kind, req)
      res.status(429).json({
        success: false,
        error: "Quá nhiều yêu cầu AI trong thời gian ngắn, vui lòng thử lại sau ít phút.",
        message: "Quá nhiều yêu cầu AI trong thời gian ngắn, vui lòng thử lại sau ít phút.",
      })
    },
  })
}

/** Bộ giới hạn tốc độ (đặt TRƯỚC bộ đọc body). */
export function createAiRateLimiters(): RequestHandler[] {
  const dev = process.env.NODE_ENV === "development"
  const embedLimit = dev ? 100000 : envLimit("AI_PUBLIC_RATE_LIMIT", 300)
  const coreLimit = dev ? 100000 : envLimit("AI_CORE_RATE_LIMIT", 600)
  return [makeLimiter("embed", embedLimit), makeLimiter("core", coreLimit)]
}

/**
 * Thay cho `express.json({limit:"50mb"})` + `express.urlencoded(...)`: đường AI dùng giới hạn nhỏ hơn,
 * các đường khác giữ nguyên 50MB.
 */
export function createBodyParsers(defaultLimit = "50mb"): RequestHandler[] {
  const aiLimit = process.env.AI_JSON_BODY_LIMIT?.trim() || "6mb"
  const aiLargeLimit = process.env.AI_JSON_BODY_LIMIT_LARGE?.trim() || "16mb"
  const mk = (limit: string) => ({
    json: express.json({ limit }),
    form: express.urlencoded({ extended: true, limit }),
  })
  const std = mk(defaultLimit)
  const ai = mk(aiLimit)
  const aiLarge = mk(aiLargeLimit)
  const pick = (req: Request) => {
    const c = classifyAiRequest(req.method, req.path)
    return c ? (c.large ? aiLarge : ai) : std
  }
  return [
    (req: Request, res: Response, next: NextFunction) => pick(req).json(req, res, next),
    (req: Request, res: Response, next: NextFunction) => pick(req).form(req, res, next),
  ]
}
