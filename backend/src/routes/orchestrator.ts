// routes/orchestrator.ts
import { Router, Request, Response } from "express"
import OpenAI from "openai"
import { query } from "../lib/db"
import { fetchAllDocuments } from "../lib/document-fetcher"
import { getAgentsForOrchestrator } from "../lib/assistants"
import { callAgentAsk, getAgentReplyContent } from "../lib/orchestrator/agent-client"
import { getCentralLlmCredentials, getCentralSystemPrompt, DEFAULT_CENTRAL_SYSTEM_PROMPT, isCentralRoutingEnabled } from "../lib/central-agent-config"
import { getToolsManifestsForCentral, ToolManifestForCentral, ToolFunctionSpec } from "../lib/tools"
import { getBootstrapEnv } from "../lib/settings"

const router = Router()

function isValidUrl(u?: string) {
  if (!u) return false
  try {
    new URL(u)
    return true
  } catch {
    return false
  }
}

function extractLastPathSegment(u?: string | null) {
  if (!u || !isValidUrl(u)) return null
  const url = new URL(u)
  const parts = url.pathname.split("/").filter(Boolean)
  return parts.at(-1) ?? null
}

type ChatRole = "user" | "assistant" | "system"
type HistTurn = { role: "user" | "assistant" | "system"; content: string }
type AskRequest = {
  session_id: string
  model_id: string
  user: string
  prompt: string
  /** If true, central fallback path streams response via SSE (text/event-stream). */
  stream?: boolean
  context?: {
    project?: string
    extra_data?: {
      document?: string[]
      [k: string]: unknown
    }
    history?: HistTurn[]
    [k: string]: unknown
  }
}

function writeSseEvent(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function startSseResponse(res: Response): void {
  res.status(200)
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()
}

function sanitizeHistory(arr: any[]): HistTurn[] {
  const okRole = new Set<ChatRole>(["user", "assistant", "system"])
  return arr
    .map((x) => ({
      role: okRole.has(x?.role) ? (x.role as ChatRole) : "user",
      content: typeof x?.content === "string" ? x.content : "",
    }))
    .filter((t) => t.content.trim().length > 0)
}

function clipHistoryByChars(turns: HistTurn[], maxChars = 6000): HistTurn[] {
  const out: HistTurn[] = []
  let used = 0
  for (let i = turns.length - 1; i >= 0; i--) {
    const c = turns[i].content ?? ""
    if (used + c.length > maxChars) break
    out.push(turns[i])
    used += c.length
  }
  return out.reverse()
}

type GuidePageConfig = { title?: string; subtitle?: string; cards?: { title: string; description: string }[] }

async function getGuidePageConfig(): Promise<GuidePageConfig> {
  try {
    const r = await query<{ value: string }>(
      `SELECT value FROM ai_portal.app_settings WHERE key = 'guide_page_config' LIMIT 1`
    )
    const raw = r.rows[0]?.value
    if (typeof raw !== "string" || !raw.trim()) return { title: "", subtitle: "", cards: [] }
    const data = JSON.parse(raw) as GuidePageConfig
    return {
      title: typeof data.title === "string" ? data.title : "",
      subtitle: typeof data.subtitle === "string" ? data.subtitle : "",
      cards: Array.isArray(data.cards) ? data.cards.filter((c) => c && typeof c.title === "string") : [],
    }
  } catch {
    return { title: "", subtitle: "", cards: [] }
  }
}

/** Build system context string from guide page, tools manifests, and agents for Central. */
async function buildCentralContext(): Promise<string> {
  const [guide, tools, agents] = await Promise.all([
    getGuidePageConfig(),
    getToolsManifestsForCentral(),
    getAgentsForOrchestrator(),
  ])
  const parts: string[] = []

  if (guide.title || guide.subtitle || (guide.cards && guide.cards.length > 0)) {
    parts.push("## Hướng dẫn (Guide)\n" + (guide.title ? `Tiêu đề: ${guide.title}\n` : "") + (guide.subtitle ? `Phụ đề: ${guide.subtitle}\n` : ""))
    if (guide.cards?.length) {
      parts.push(guide.cards.map((c) => `- **${c.title}**: ${c.description || ""}`).join("\n"))
    }
  }

  if (tools.length > 0) {
    parts.push(
      "## Công cụ (Tools) — dùng keywords để điều hướng; khi gợi ý phải dùng **tên** công cụ và link [Tên](/tools/alias)\n" +
        tools
          .map(
            (t) =>
              `- **${t.name}** — Link: /tools/${t.alias} — ${t.description || "(không mô tả)"}${t.keywords?.length ? ` — Keywords: ${t.keywords.join(", ")}` : ""}${t.functions?.length ? ` — Gọi được: ${t.functions.map((f) => f.name).join(", ")}` : ""}`
          )
          .join("\n")
    )
    const callable = tools.filter((t) => t.functions?.length)
    if (callable.length > 0) {
      parts.push(
        "## Tra dữ liệu trực tiếp — QUY TẮC BẮT BUỘC\n" +
          "Một số công cụ có hàm gọi được (xem 'Gọi được' ở trên).\n" +
          "1. **PHẢI GỌI HÀM** khi câu hỏi liên quan tới thông tin/quy chế/số liệu tuyển sinh (số nguyện vọng, " +
          "điểm sàn, điểm chuẩn, chỉ tiêu, ngành, tổ hợp, điểm ưu tiên/cộng, quy đổi điểm, chứng chỉ, mốc thời gian, " +
          "lệ phí, liên hệ...). TUYỆT ĐỐI KHÔNG trả lời những nội dung này từ trí nhớ của bạn — dữ liệu tuyển sinh " +
          "thay đổi theo từng năm, trả lời sai gây hậu quả nghiêm trọng cho thí sinh.\n" +
          "2. **CHỈ dùng dữ liệu hàm trả về** để trả lời. Không thêm số liệu nào không có trong kết quả.\n" +
          "3. Nếu hàm trả về rỗng / không chứa câu trả lời / gọi hàm thất bại: **nói rõ là chưa tra được**, mời người " +
          "dùng xem công cụ tương ứng qua link [Tên](/tools/alias) hoặc liên hệ nhà trường. **KHÔNG được suy đoán, " +
          "không bịa số, không nói 'theo quy định' nếu không có nguồn.**\n" +
          "4. Chỉ truyền tham số người dùng thực sự cung cấp; thiếu dữ liệu bắt buộc thì hỏi lại.\n" +
          "5. Sau khi trả lời bằng số liệu, nêu rõ nguồn là công cụ nào và kèm link [Tên](/tools/alias) để kiểm chứng.\n" +
          "6. **Tra cứu hồ sơ/dữ liệu CÁ NHÂN của thí sinh** (hồ sơ đăng ký, kết quả xét tuyển thẳng, tình trạng " +
          "hồ sơ, điểm cá nhân theo số báo danh/CCCD): bạn KHÔNG có hàm nào làm được việc này. TUYỆT ĐỐI KHÔNG xin " +
          "số báo danh, CCCD hay bất kỳ thông tin cá nhân nào trong khung chat, và KHÔNG hứa sẽ tra giúp. Hãy nói " +
          "thẳng là việc tra cứu cá nhân cần thực hiện trên công cụ chuyên dụng, rồi chỉ tới đúng công cụ qua link " +
          "[Tên](/tools/alias) (ví dụ Tra cứu hồ sơ, Tra cứu kết quả) để thí sinh tự nhập trên đó.\n" +
          "7. **Câu hỏi 'em có được/đủ điều kiện tuyển thẳng không', 'diện tuyển thẳng gồm những ai', 'ưu tiên " +
          "xét tuyển thế nào'**: đây là hỏi về QUY CHẾ, KHÔNG phải tra dữ liệu cá nhân. TUYỆT ĐỐI KHÔNG tự phỏng " +
          "vấn thí sinh (đừng hỏi họ đạt giải gì, điểm bao nhiêu) rồi tự kết luận đủ/không đủ điều kiện. Hãy **GỌI " +
          "HÀM tra thông tin tuyển sinh** để nêu đúng diện đối tượng / điều kiện / tỷ lệ chỉ tiêu tuyển thẳng theo " +
          "quy chế của Trường, rồi mời thí sinh tự đối chiếu. Việc mình CÓ trong danh sách trúng tuyển thẳng hay " +
          "không thì áp dụng quy tắc (6): chỉ tới công cụ tra cứu kết quả hoặc liên hệ nhà trường."
      )
    }
  }

  if (agents.length > 0) {
    parts.push(
      "## Trợ lý chuyên biệt (Agents) — chuyển tiếp khi câu hỏi thuộc lĩnh vực\n" +
        agents.map((a) => `- **${a.name}** (alias: ${a.alias}): ${a.description || ""}`).join("\n")
    )
  }

  if (parts.length === 0) return ""
  return "\n\n---\nNgữ cảnh hệ thống (chỉ tham khảo):\n" + parts.join("\n\n")
}

// ───────────── App functions as LLM tools ─────────────
// Apps declare callable endpoints in manifest.json ("functions"). Central turns them into LLM tools so it
// can answer FROM the app's data instead of only linking to the app.

type AppToolEntry = { alias: string; spec: ToolFunctionSpec }

/**
 * Deterministic by design. Ollama defaults to temperature 0.8, which made Central answer the same
 * admission question differently each time (measured: 1 in 5 skipped the lookup and invented a number).
 * Two candidates asking the same thing must get the same official answer, so keep sampling off.
 */
const CENTRAL_TEMPERATURE = 0

const TOOL_TIMEOUT_MS = 15_000
const TOOL_RESULT_MAX_CHARS = 8000

/**
 * Build OpenAI tool defs from manifests. Functions marked `pii` are NOT exposed: Central would let any
 * user pull someone else's personal record through chat. They stay off until a per-request owner check exists.
 */
function buildAppTools(manifests: ToolManifestForCentral[]): {
  tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  registry: Map<string, AppToolEntry>
} {
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
  const registry = new Map<string, AppToolEntry>()
  for (const m of manifests) {
    for (const spec of m.functions || []) {
      if (spec.pii) continue
      const toolName = `${m.alias.replace(/[^a-zA-Z0-9_]/g, "_")}__${spec.name}`
      if (registry.has(toolName)) continue
      registry.set(toolName, { alias: m.alias, spec })
      tools.push({
        type: "function",
        function: {
          name: toolName,
          description: `[${m.name}] ${spec.description}`,
          parameters: spec.parameters as any,
        },
      })
    }
  }
  return { tools, registry }
}

/**
 * Apply the manifest's `resultTrim` caps, then the hard char cap. Trimmed arrays get a `_trimmed` note so
 * the model says "top N" instead of implying the list is complete. Falls back to the raw text if not JSON
 * (never truncate JSON mid-string — that yields invalid JSON the model can't read).
 */
function trimToolResult(text: string, trim?: Record<string, number>): string {
  if (trim) {
    try {
      const data = JSON.parse(text)
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const obj = data as Record<string, unknown>
        for (const [field, max] of Object.entries(trim)) {
          const arr = obj[field]
          if (Array.isArray(arr) && arr.length > max) {
            obj[field] = arr.slice(0, max)
            obj[`${field}_trimmed`] = `Chỉ hiển thị ${max}/${arr.length} mục đầu (phù hợp nhất).`
          }
        }
        const out = JSON.stringify(obj)
        if (out.length <= TOOL_RESULT_MAX_CHARS) return out
      }
    } catch {
      /* not JSON — fall through to the char cap */
    }
  }
  return text.slice(0, TOOL_RESULT_MAX_CHARS)
}

/** Call an app endpoint over loopback so it goes through the normal /api/apps mount (same auth/limits). */
async function callAppFunction(entry: AppToolEntry, args: Record<string, unknown>): Promise<string> {
  const port = getBootstrapEnv("PORT", "3001")
  const base = `http://127.0.0.1:${port}/api/apps/${entry.alias}${entry.spec.endpoint}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TOOL_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = { "X-Internal-Central": "1" }
    let res: globalThis.Response
    if (entry.spec.method === "GET") {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(args || {})) {
        if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
      }
      res = await fetch(qs.toString() ? `${base}?${qs}` : base, { signal: ctrl.signal, headers })
    } else {
      res = await fetch(base, {
        method: "POST",
        signal: ctrl.signal,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(args || {}),
      })
    }
    const text = await res.text()
    if (!res.ok) return JSON.stringify({ error: `HTTP ${res.status}`, detail: text.slice(0, 400) })
    return trimToolResult(text, entry.spec.resultTrim)
  } catch (e: any) {
    return JSON.stringify({ error: e?.name === "AbortError" ? "timeout" : e?.message || "call failed" })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Run the tool calls the model asked for and append the assistant + tool messages to `messages`,
 * so the next completion can answer from real data. Returns the names actually called.
 */
async function executeToolCalls(
  assistantMsg: unknown,
  calls: unknown[],
  registry: Map<string, AppToolEntry>,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<string[]> {
  const used: string[] = []
  messages.push(assistantMsg as OpenAI.Chat.Completions.ChatCompletionMessageParam)
  for (const c of calls) {
    const fname = (c as any)?.function?.name || ""
    const entry = registry.get(fname)
    let content: string
    if (!entry) {
      content = JSON.stringify({ error: "unknown tool" })
    } else {
      // OpenAI sends `arguments` as a JSON string; Ollama's OpenAI-compatible endpoint returns a plain
      // object for some models. Accept both, or the call goes out with no arguments at all.
      let args: Record<string, unknown> = {}
      const rawArgs = (c as any)?.function?.arguments
      if (rawArgs && typeof rawArgs === "object") {
        args = rawArgs as Record<string, unknown>
      } else if (typeof rawArgs === "string" && rawArgs.trim()) {
        try {
          args = JSON.parse(rawArgs)
        } catch {
          /* malformed args: call with none and let the app validate */
        }
      }
      content = await callAppFunction(entry, args)
      used.push(`${entry.alias}/${entry.spec.name}`)
    }
    messages.push({
      role: "tool",
      tool_call_id: (c as any).id,
      content,
    } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
  }
  return used
}

/** Accumulate streamed tool_call deltas (arrive piecewise, keyed by index) into whole calls. */
class ToolCallAccumulator {
  private byIndex = new Map<number, { id: string; name: string; args: string }>()
  add(deltaToolCalls: any[]): void {
    for (const d of deltaToolCalls || []) {
      const i = typeof d?.index === "number" ? d.index : 0
      const cur = this.byIndex.get(i) || { id: "", name: "", args: "" }
      if (d?.id) cur.id = d.id
      if (d?.function?.name) cur.name = d.function.name
      const a = d?.function?.arguments
      if (typeof a === "string") cur.args += a
      else if (a && typeof a === "object") cur.args = JSON.stringify(a)
      this.byIndex.set(i, cur)
    }
  }
  /** OpenAI-shaped tool_calls, ready to replay into `messages`. */
  toCalls(): any[] {
    return [...this.byIndex.values()]
      .filter((c) => c.name)
      .map((c, i) => ({
        id: c.id || `call_${i}`,
        type: "function",
        function: { name: c.name, arguments: c.args || "{}" },
      }))
  }
}

// POST /api/orchestrator/v1/ask
router.post("/v1/ask", async (req: Request, res: Response) => {
  const t0 = Date.now()
  const rid = Math.random().toString(36).slice(2, 10)

  let cred: Awaited<ReturnType<typeof getCentralLlmCredentials>>
  try {
    cred = await getCentralLlmCredentials()
  } catch (e: any) {
    console.error("[orchestrator] getCentralLlmCredentials failed:", e?.message ?? e)
    return res.status(500).json({
      session_id: null,
      status: "error",
      error_message: `Lỗi khi tải cấu hình Trợ lý chính (Central): ${e?.message || "Lỗi không xác định"}. Kiểm tra kết nối cơ sở dữ liệu hoặc cấu hình tại Admin → Central (Trợ lý chính).`,
      error_step: "central_llm_config",
      meta: { response_time_ms: Date.now() - t0 },
    })
  }

  if (!cred) {
    return res.status(500).json({
      session_id: null,
      status: "error",
      error_message: "Chưa cấu hình LLM cho Trợ lý chính (Central). Vào Admin → Central (Trợ lý chính): chọn provider (OpenAI, Ollama hoặc OpenAI-compatible), nhập model và API key (nếu dùng OpenAI). Nếu dùng Ollama: đảm bảo Ollama đang chạy, nhập đúng Base URL và tên model.",
      error_step: "central_llm_config",
    })
  }
  const apiKey = cred.apiKey
  const centralModel = cred.model || "gpt-4o-mini"
  const baseURL = cred.baseUrl
  const defaultHeaders = cred.extraHeaders && Object.keys(cred.extraHeaders).length > 0 ? cred.extraHeaders : undefined

  let body: Partial<AskRequest> | null = null
  try {
    body = req.body
  } catch {
    return res.status(400).json({
      session_id: null,
      status: "error",
      error_message: "Body phải là JSON hợp lệ.",
    })
  }

  const session_id = body?.session_id?.trim()
  const model_id = body?.model_id?.trim()
  const user = body?.user?.trim()
  const prompt = body?.prompt

  if (!session_id)
    return res.status(400).json({ session_id, status: "error", error_message: "Thiếu session_id." })
  if (!model_id)
    return res.status(400).json({ session_id, status: "error", error_message: "Thiếu model_id." })
  if (!user)
    return res.status(400).json({ session_id, status: "error", error_message: "Thiếu user." })
  if (typeof prompt !== "string") {
    return res.status(400).json({ session_id, status: "error", error_message: "prompt phải là chuỗi." })
  }

  // ─── Orchestration: route to agents (except main), call in parallel, fallback to OpenAI if no agent responds ───
  const routingEnabled = await isCentralRoutingEnabled()
  try {
    const agents = routingEnabled ? await getAgentsForOrchestrator() : []

    if (agents.length > 0) {
      const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}), ...(defaultHeaders ? { defaultHeaders } : {}) })
      // Routing hint from DB (config_json.routing_hint), configurable by admin
      const agentListText = agents
        .map((a) => {
          const hint = a.routing_hint?.trim() ? ` [Gợi ý: ${a.routing_hint}]` : ""
          return `- ${a.alias}: ${a.description}${hint}`
        })
        .join("\n")
      const routingMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content:
            "Bạn là router. Cho danh sách agents và câu hỏi người dùng. Output ĐÚNG MỘT dòng JSON là mảng alias của agent CẦN gọi để trả lời, hoặc [] nếu không có agent nào phù hợp.\n\n" +
            "QUY TẮC NGHIÊM NGẶT:\n" +
            "1) MẶC ĐỊNH trả về [] — chỉ chọn agent khi câu hỏi RÕ RÀNG yêu cầu THAO TÁC/CHỨC NĂNG mà chỉ agent đó cung cấp (tra cứu, tìm kiếm, phân tích, gửi/nộp dữ liệu cụ thể), KHÔNG phải khi hỏi kiến thức chung.\n" +
            "2) Câu hỏi định nghĩa, khái niệm, phương pháp luận, \"X là gì\", \"liệt kê các X\", \"so sánh X\", hướng dẫn lý thuyết → trả về [] để Trợ lý chính trả lời.\n" +
            "3) Chỉ chọn agent khi user nói rõ muốn DÙNG chức năng cụ thể, ví dụ: \"tìm chuyên gia về NLP\" → experts; \"tra bài báo của tác giả X\" → papers; \"kiểm tra đạo văn file này\" → plagiarism; \"hội thảo nào sắp diễn ra\" → publish; \"có quỹ nào tài trợ NLP\" → funds; \"phản biện bài này\" → review; \"quy chế về phụ cấp\" → regulations.\n" +
            "4) Nếu phân vân, ưu tiên [].\n" +
            "Không giải thích, chỉ output JSON một dòng.",
        },
        {
          role: "user",
          content: `Agents:\n${agentListText}\n\nCâu hỏi: ${prompt}`,
        },
      ]
      const routingRes = await openai.chat.completions.create({
        model: centralModel,
        messages: routingMessages,
        max_tokens: 150,
      })
      const routingContent = (routingRes.choices?.[0]?.message?.content ?? "").trim()
      const agentAliases = new Set(agents.map((a) => a.alias.toLowerCase()))
      let selectedAliases: string[] = []

      function normalizeAndPickAliases(raw: string): string[] {
        // Get segment between last [ and ]
        const from = raw.indexOf("[")
        const to = raw.lastIndexOf("]")
        if (from === -1 || to === -1 || to <= from) return []
        let jsonStr = raw.slice(from, to + 1)
        // Normalize all Unicode quote characters to ASCII
        jsonStr = jsonStr
          .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036"]/g, '"')
          .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "'")
        try {
          const parsed = JSON.parse(jsonStr)
          const flat = Array.isArray(parsed) ? parsed.flat() : []
          return flat
            .filter((a): a is string => typeof a === "string")
            .map((a) => a.trim())
            .filter((a) => a && agentAliases.has(a.toLowerCase()))
            .map((a) => {
              const exact = agents.find((ag) => ag.alias.toLowerCase() === a.toLowerCase())
              return exact ? exact.alias : a
            })
        } catch {
          // Fallback: split by comma, strip quotes around each part (handles Unicode quotes)
          const inner = jsonStr.slice(1, -1).trim()
          const quoteLike = /[\u201C\u201D\u2018\u2019"']/g
          const candidates = inner
            .split(",")
            .map((s) => s.trim().replace(quoteLike, "").trim())
            .filter((s) => s && agentAliases.has(s.toLowerCase()))
          return candidates.map((a) => {
            const exact = agents.find((ag) => ag.alias.toLowerCase() === a.toLowerCase())
            return exact ? exact.alias : a
          })
        }
      }

      selectedAliases = normalizeAndPickAliases(routingContent)

      // Keyword fallback: questions about conference/publish → always call publish agent if in list
      const promptLower = prompt.toLowerCase()
   

      // Keyword fallback from each agent's routing_hint: nếu câu hỏi chứa bất kỳ từ khóa nào trong Gợi ý routing thì chọn agent đó
      for (const ag of agents) {
        const hint = ag.routing_hint?.trim()
        if (!hint || selectedAliases.includes(ag.alias)) continue
        const keywords = hint.split(/[,;]+/).map((k) => k.trim().toLowerCase()).filter(Boolean)
        const match = keywords.some((k) => k.length >= 2 && promptLower.includes(k))
        if (match) {
          selectedAliases = [...selectedAliases, ag.alias]
        }
      }

      if (selectedAliases.length > 0) {
        const replies = await Promise.all(
          selectedAliases.map((alias) => {
            const ag = agents.find((a) => a.alias === alias)!
            // Use first model the agent supports; otherwise use model_id from client
            const agentModelId =
              ag.supported_models?.length && ag.supported_models[0]?.model_id
                ? ag.supported_models[0].model_id
                : model_id
            const payload = {
              session_id,
              model_id: agentModelId,
              user,
              prompt,
              context: body?.context ?? {},
            }
            return callAgentAsk(alias, ag.baseUrl, payload)
          })
        )
        const okReplies = replies.filter((r) => r.ok)
        for (const r of replies) {
          if (!r.ok) console.warn(`[orchestrator] Agent ${r.alias} lỗi:`, r.error || "unknown")
        }
        if (okReplies.length > 0) {
          const response_time_ms = Date.now() - t0
          const metaAgents = okReplies.map((r) => {
            const ag = agents.find((a) => a.alias === r.alias)!
            return { alias: ag.alias, name: ag.name, icon: ag.icon }
          })
          let content_markdown: string
          if (okReplies.length === 1) {
            content_markdown = getAgentReplyContent(okReplies[0].data) || "*(không có nội dung)*"
          } else {
            content_markdown = okReplies
              .map((r) => {
                const ag = agents.find((a) => a.alias === r.alias)!
                const content = getAgentReplyContent(r.data) || "(không có nội dung)"
                return `### ${ag.name}\n\n${content}`
              })
              .join("\n\n")
          }
          const rawDocs = Array.isArray(body?.context?.extra_data?.document) ? body!.context!.extra_data!.document : []
          const docSet = new Set<string>()
          for (const d of rawDocs) {
            const url = typeof d === "string" ? d : (d as any)?.url
            if (typeof url === "string" && isValidUrl(url)) docSet.add(url)
          }
          const attachments = Array.from(docSet)
            .filter((u) => /\.pdf($|\?)/i.test(u))
            .map((u) => ({ type: "pdf" as const, url: u }))

          if (body?.stream === true) {
            startSseResponse(res)
            writeSseEvent(res, { type: "chunk", delta: content_markdown })
            writeSseEvent(res, {
              type: "done",
              session_id,
              status: "success",
              content_markdown,
              meta: { model: model_id, response_time_ms, tokens_used: 0, agents: metaAgents },
              attachments,
            })
            res.end()
            return
          }
          return res.json({
            session_id,
            status: "success",
            content_markdown,
            meta: {
              model: model_id,
              response_time_ms,
              tokens_used: 0,
              agents: metaAgents,
            },
            attachments,
          })
        }
        // Agent được chọn nhưng không phản hồi → fallback xuống Central để vẫn có câu trả lời.
        const names = selectedAliases.map((a) => agents.find((ag) => ag.alias === a)?.name || a).join(", ")
        console.warn(`[orchestrator] Agents (${names}) không phản hồi — fallback sang Central.`)
        // Rơi xuống nhánh Central bên dưới (không return ở đây)
      }
    }
  } catch (e: any) {
    console.warn("[orchestrator] Lỗi khi điều phối/routing, chuyển sang OpenAI (mặc định):", e?.message ?? e)
    const session_id = body?.session_id?.trim() ?? null
    return res.status(500).json({
      session_id,
      status: "error",
      error_message: `Lỗi ở bước điều phối (Central): ${e?.message || "Lỗi không xác định"}`,
      error_step: "central_routing",
      meta: { model: body?.model_id, response_time_ms: Date.now() - t0 },
    })
  }

  try {
  const projectUrl = body?.context?.project && isValidUrl(body.context.project)
    ? body.context.project!
    : null
  const projectId = extractLastPathSegment(projectUrl)

  const rawDocs = Array.isArray(body?.context?.extra_data?.document)
    ? body!.context!.extra_data!.document
    : []

  const docSet = new Set<string>()
  for (const d of rawDocs) {
    const url = typeof d === "string" ? d : (d as any)?.url
    if (typeof url === "string" && isValidUrl(url)) docSet.add(url)
  }
  const documents = Array.from(docSet)

  const attachments = documents
    .filter((u) => /\.pdf($|\?)/i.test(u))
    .map((u) => ({ type: "pdf" as const, url: u }))

  const contextHistory = Array.isArray(body?.context?.history) ? body!.context!.history! : []
  const safeHistory = sanitizeHistory(contextHistory)
  const clippedHistory = clipHistoryByChars(safeHistory, 6000)

  // Fetch and parse file content from MinIO to send to OpenAI
  let docTexts: string[] = []
  let docImages: { base64: string; mimeType: string }[] = []
  let docErrors: string[] = []

  if (documents.length > 0) {
    try {
      const result = await fetchAllDocuments(documents)
      docTexts = result.texts
      docImages = result.images
      docErrors = result.errors
      if (docErrors.length > 0) {
        console.warn(`[orchestrator] Một số file không parse được:`, docErrors)
      }
    } catch (e: any) {
      console.warn(`[orchestrator] Lỗi fetch documents:`, e?.message || e)
    }
  }

  const customPrompt = await getCentralSystemPrompt()
  const baseSystemPrompt = customPrompt.trim() || DEFAULT_CENTRAL_SYSTEM_PROMPT
  const contextBlock = await buildCentralContext()

  const systemContext =
    baseSystemPrompt +
    contextBlock +
    `\n\n---\nNgữ cảnh cuộc trò chuyện:\n` +
    `- project_id: ${projectId ?? "N/A"}\n` +
    (documents.length > 0 ? `- Số file đính kèm: ${documents.length} (đã gửi nội dung bên dưới)\n` : "") +
    `Chỉ trả lời trong phạm vi hỗ trợ. Câu ngoài phạm vi: trả lời ngắn rằng ngoài phạm vi hỗ trợ, không cung cấp thông tin thêm.`

  // Build user message: prompt + file content (text and/or image)
  const textContent = docTexts.join("\n\n---\n\n")
  const hasFileContent = textContent.length > 0 || docImages.length > 0

  let userContent: string | OpenAI.Chat.Completions.ChatCompletionContentPart[] = prompt

  if (hasFileContent) {
    const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []

    // Text part: prompt + text file content
    let combinedText = prompt
    if (textContent.length > 0) {
      combinedText += `\n\n---\n[Dữ liệu từ file đính kèm]\n---\n\n${textContent}`
    }
    parts.push({ type: "text", text: combinedText })

    // Image part: send base64 for Vision API
    for (const img of docImages) {
      parts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "auto" as const },
      })
    }

    userContent = parts
  }

  const messages = [
    { role: "system", content: systemContext },
    ...clippedHistory.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userContent },
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]

  const calledModel = centralModel
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}), ...(defaultHeaders ? { defaultHeaders } : {}) })
  const wantsStream = body?.stream === true

  // Expose the apps' declared functions so Central can answer from their data. Offering tools costs
  // nothing when unused: if the model doesn't call one, its normal answer streams straight through.
  let appTools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
  let appRegistry = new Map<string, AppToolEntry>()
  try {
    const built = buildAppTools(await getToolsManifestsForCentral())
    appTools = built.tools
    appRegistry = built.registry
  } catch (err: any) {
    console.warn("[orchestrator] app tools unavailable:", err?.message ?? err)
  }
  const toolArgs = appTools.length > 0 ? { tools: appTools, tool_choice: "auto" as const } : {}

  if (wantsStream) {
    startSseResponse(res)
    let aborted = false
    req.on("close", () => { aborted = true })
    let fullAnswer = ""
    let usageTotal = 0
    try {
      // Pass 1. When tools are offered the model may narrate its intent ("tôi cần gọi hàm ...") AND ask
      // for a tool in the same turn, so pass-1 text is buffered, never streamed: it's throwaway prose the
      // moment a tool call arrives, and leaking it shows internal function names to candidates.
      // With no tools there is nothing to discard, so stream live for the usual token-by-token feel.
      const hasTools = appTools.length > 0
      const acc = new ToolCallAccumulator()
      let pass1Text = ""
      const stream = await client.chat.completions.create({
        model: calledModel,
        messages,
        ...toolArgs,
        temperature: CENTRAL_TEMPERATURE,
        stream: true,
        stream_options: { include_usage: true },
      } as any)
      for await (const chunk of stream as any) {
        if (aborted) break
        const d = chunk?.choices?.[0]?.delta
        if (d?.tool_calls) acc.add(d.tool_calls)
        const delta = d?.content
        if (typeof delta === "string" && delta.length > 0) {
          if (hasTools) {
            pass1Text += delta
          } else {
            fullAnswer += delta
            writeSseEvent(res, { type: "chunk", delta })
          }
        }
        const u = chunk?.usage?.total_tokens
        if (typeof u === "number" && u > 0) usageTotal = u
      }

      const calls = acc.toCalls()
      if (!aborted && calls.length > 0) {
        // The model wants data: drop pass-1 prose and answer from the tool results instead.
        try {
          await executeToolCalls({ role: "assistant", content: null, tool_calls: calls }, calls, appRegistry, messages)
          const stream2 = await client.chat.completions.create({
            model: calledModel,
            messages,
            temperature: CENTRAL_TEMPERATURE,
            stream: true,
            stream_options: { include_usage: true },
          } as any)
          for await (const chunk of stream2 as any) {
            if (aborted) break
            const delta = chunk?.choices?.[0]?.delta?.content
            if (typeof delta === "string" && delta.length > 0) {
              fullAnswer += delta
              writeSseEvent(res, { type: "chunk", delta })
            }
            const u = chunk?.usage?.total_tokens
            if (typeof u === "number" && u > 0) usageTotal += u
          }
        } catch (toolErr: any) {
          // Tool path failed — keep the reply alive rather than erroring the whole turn.
          console.warn("[orchestrator] tool pass failed:", toolErr?.message ?? toolErr)
        }
      } else if (hasTools && pass1Text && !aborted) {
        // No tool wanted: the buffered pass-1 text is the real answer.
        fullAnswer = pass1Text
        writeSseEvent(res, { type: "chunk", delta: pass1Text })
      }
      const response_time_ms = Date.now() - t0
      writeSseEvent(res, {
        type: "done",
        session_id,
        status: "success",
        content_markdown: fullAnswer || "*(không có nội dung)*",
        meta: { model: model_id, response_time_ms, tokens_used: usageTotal, agents: [] },
        attachments,
      })
      res.end()
      return
    } catch (err: any) {
      const response_time_ms = Date.now() - t0
      const detail = err?.message || "Gọi API thất bại"
      writeSseEvent(res, {
        type: "error",
        session_id,
        status: "error",
        error_message: `Lỗi do cấu hình Trợ lý chính (LLM/Ollama): ${detail}`,
        error_step: "central_llm",
        meta: { model: model_id, response_time_ms },
      })
      res.end()
      return
    }
  }

  try {
    // Pass 1 with tools. If the model answers directly, that answer IS the reply — reuse it rather
    // than paying for a second identical generation.
    let completion = await client.chat.completions.create({
      model: calledModel,
      messages,
      ...toolArgs,
      temperature: CENTRAL_TEMPERATURE,
    } as any)

    let choice = completion.choices?.[0]
    let tokens_used = (completion.usage as any)?.total_tokens ?? 0

    const calls = (choice?.message as any)?.tool_calls
    if (Array.isArray(calls) && calls.length > 0) {
      try {
        await executeToolCalls(choice?.message, calls, appRegistry, messages)
        completion = await client.chat.completions.create({
          model: calledModel,
          messages,
          temperature: CENTRAL_TEMPERATURE,
        } as any)
        choice = completion.choices?.[0]
        tokens_used += (completion.usage as any)?.total_tokens ?? 0
      } catch (toolErr: any) {
        console.warn("[orchestrator] tool pass failed:", toolErr?.message ?? toolErr)
      }
    }

    const answer = (choice?.message?.content ?? "").trim()
    const response_time_ms = Date.now() - t0

    res.json({
      session_id,
      status: "success",
      content_markdown: answer || "*(không có nội dung)*",
      meta: {
        model: model_id,
        response_time_ms,
        tokens_used,
        agents: [],
      },
      attachments,
    })
  } catch (err: any) {
    const response_time_ms = Date.now() - t0
    const status = Number(err?.status) || 500
    const detail = err?.message || "Gọi API thất bại"
    return res.status(status).json({
      session_id,
      status: "error",
      error_message: `Lỗi do cấu hình Trợ lý chính (LLM/Ollama): ${detail} Nguyên nhân thường gặp: (1) Dùng Ollama — Ollama chưa chạy, sai Base URL hoặc sai tên model; (2) Dùng OpenAI — API key sai hoặc hết hạn. Kiểm tra tại Admin → Central (Trợ lý chính).`,
      error_step: "central_llm",
      meta: {
        model: model_id,
        response_time_ms,
      },
      details: err?.response?.data ?? null,
    })
  }
  } catch (outerErr: any) {
    const response_time_ms = Date.now() - t0
    return res.status(500).json({
      session_id: body?.session_id?.trim() ?? null,
      status: "error",
      error_message: `Lỗi ở bước chuẩn bị Trợ lý chính (Central): ${outerErr?.message || "Lỗi không xác định"}. Có thể do cấu hình hoặc dữ liệu hệ thống. Kiểm tra Admin → Central (Trợ lý chính).`,
      error_step: "central_prepare",
      meta: { model: body?.model_id, response_time_ms },
    })
  }
})

export default router
