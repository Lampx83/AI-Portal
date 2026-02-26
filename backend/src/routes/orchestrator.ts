// routes/orchestrator.ts
import { Router, Request, Response } from "express"
import OpenAI from "openai"
import { query } from "../lib/db"
import { fetchAllDocuments } from "../lib/document-fetcher"
import { getAgentsForOrchestrator } from "../lib/assistants"
import { callAgentAsk, getAgentReplyContent } from "../lib/orchestrator/agent-client"
import { getCentralLlmCredentials, getCentralSystemPrompt, DEFAULT_CENTRAL_SYSTEM_PROMPT } from "../lib/central-agent-config"
import { getToolsManifestsForCentral } from "../lib/tools"

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
    out.unshift(turns[i])
    used += c.length
  }
  return out
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
              `- **${t.name}** — Link: /tools/${t.alias} — ${t.description || "(không mô tả)"}${t.keywords?.length ? ` — Keywords: ${t.keywords.join(", ")}` : ""}`
          )
          .join("\n")
    )
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
  try {
    const agents = await getAgentsForOrchestrator()

    if (agents.length > 0) {
      const openai = new OpenAI(baseURL ? { apiKey, baseURL } : { apiKey })
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
            "Bạn là router. Cho danh sách agents và câu hỏi người dùng. Trả lời ĐÚNG MỘT dòng JSON là mảng alias của các agent có thể trả lời câu hỏi. Ví dụ: [\"publish\"], [\"experts\",\"papers\"] hoặc []. Quan trọng: câu hỏi về hội thảo, công bố, publication, conference, seminar, AI liên quan hội thảo → chọn agent 'publish'. Không giải thích, chỉ output JSON.",
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
        // Đã chọn trợ lý nhưng không nhận được phản hồi — trả lỗi rõ ràng, không fallback sang Central trả lời
        const names = selectedAliases.map((a) => agents.find((ag) => ag.alias === a)?.name || a).join(", ")
        return res.status(502).json({
          session_id,
          status: "error",
          error_message: `Lỗi ở bước trợ lý chuyên biệt (agent): đã chuyển câu hỏi đến (${names}) nhưng không nhận được phản hồi. Vui lòng thử lại hoặc kiểm tra kết nối.`,
          error_step: "agent",
          meta: { model: model_id, response_time_ms: Date.now() - t0 },
          details: replies.map((r) => ({ alias: r.alias, name: agents.find((ag) => ag.alias === r.alias)?.name ?? r.alias, ok: r.ok, error: r.error })),
        })
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
  const client = new OpenAI(baseURL ? { apiKey, baseURL } : { apiKey })

  try {
    const completion = await client.chat.completions.create({
      model: calledModel,
      messages,
    })

    const choice = completion.choices?.[0]
    const answer = (choice?.message?.content ?? "").trim()

    const response_time_ms = Date.now() - t0
    const tokens_used =
      (completion.usage as any)?.total_tokens ??
      (typeof (completion as any)?.usage?.total_tokens === "number"
        ? (completion as any).usage.total_tokens
        : 0)

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
