// routes/orchestrator.ts
import { Router, Request, Response } from "express"
import OpenAI from "openai"
import { fetchAllDocuments } from "../lib/document-fetcher"
import { getAgentsForOrchestrator } from "../lib/research-assistants"
import { callAgentAsk, getAgentReplyContent } from "../lib/orchestrator/agent-client"

const router = Router()
const ROUTING_MODEL = "gpt-4o-mini"

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

function pickOpenAIModel(modelIdFromClient?: string): string {
  if (!modelIdFromClient) return "gpt-4o-mini"
  return modelIdFromClient
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

// POST /api/orchestrator/v1/ask
router.post("/v1/ask", async (req: Request, res: Response) => {
  const t0 = Date.now()
  const rid = Math.random().toString(36).slice(2, 10)

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      session_id: null,
      status: "error",
      error_message: "Thiếu OPENAI_API_KEY trong biến môi trường.",
    })
  }

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

  // ─── Orchestration: routing tới agents (trừ main), gọi song song, fallback OpenAI nếu không có agent trả lời ───
  try {
    const agents = await getAgentsForOrchestrator()

    if (agents.length > 0) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
      // Gợi ý routing từ DB (config_json.routing_hint), cho phép admin cấu hình qua trang quản trị
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
        model: ROUTING_MODEL,
        messages: routingMessages,
        max_tokens: 150,
      })
      const routingContent = (routingRes.choices?.[0]?.message?.content ?? "").trim()
      const agentAliases = new Set(agents.map((a) => a.alias.toLowerCase()))
      let selectedAliases: string[] = []

      function normalizeAndPickAliases(raw: string): string[] {
        // Lấy đoạn giữa [ và ] cuối cùng
        const from = raw.indexOf("[")
        const to = raw.lastIndexOf("]")
        if (from === -1 || to === -1 || to <= from) return []
        let jsonStr = raw.slice(from, to + 1)
        // Chuẩn hóa mọi loại dấu ngoặc kép/đơn Unicode về ASCII
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
          // Fallback: tách theo dấu phẩy, bỏ dấu ngoặc quanh từng phần (xử lý cả Unicode quote)
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

      // Fallback theo từ khóa: câu hỏi về hội thảo/công bố → luôn gọi agent publish nếu có trong danh sách
      const promptLower = prompt.toLowerCase()
      const publishKeywords = ["hội thảo", "công bố", "publication", "conference", "seminar", "sự kiện khoa học"]
      const needsPublish = publishKeywords.some((k) => promptLower.includes(k))
      const hasPublishAgent = agentAliases.has("publish")
      if (needsPublish && hasPublishAgent && !selectedAliases.includes("publish")) {
        selectedAliases = [...selectedAliases, "publish"]
      }

      if (selectedAliases.length > 0) {
        const replies = await Promise.all(
          selectedAliases.map((alias) => {
            const ag = agents.find((a) => a.alias === alias)!
            // Dùng mô hình đầu tiên mà agent hỗ trợ; không có thì dùng model_id từ client
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
      }
    }
  } catch (e: any) {
    console.warn("[orchestrator] Lỗi khi điều phối/routing, chuyển sang OpenAI (mặc định):", e?.message ?? e)
  }

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

  // Fetch và parse nội dung file từ MinIO để gửi lên OpenAI
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

  const systemContext =
    `Bạn là trợ lý nghiên cứu NEU. Nếu có dự án hoặc tài liệu, hãy dùng như ngữ cảnh:\n` +
    `- project_id: ${projectId ?? "N/A"}\n` +
    (documents.length > 0 ? `- Số file đính kèm: ${documents.length} (đã gửi nội dung bên dưới)\n` : "") +
    `Trả lời ngắn gọn, chính xác và thân thiện. Không trả lời bất kỳ câu hỏi nào không liên quan đến nghiên cứu`

  // Xây dựng user message: prompt + nội dung file (text và/hoặc ảnh)
  const textContent = docTexts.join("\n\n---\n\n")
  const hasFileContent = textContent.length > 0 || docImages.length > 0

  let userContent: string | OpenAI.Chat.Completions.ChatCompletionContentPart[] = prompt

  if (hasFileContent) {
    const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []

    // Phần text: prompt + nội dung file text
    let combinedText = prompt
    if (textContent.length > 0) {
      combinedText += `\n\n---\n[Dữ liệu từ file đính kèm]\n---\n\n${textContent}`
    }
    parts.push({ type: "text", text: combinedText })

    // Phần ảnh: gửi base64 cho Vision API
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

  const calledModel = pickOpenAIModel(model_id)
  const client = new OpenAI({ apiKey })

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
    res.status(status).json({
      session_id,
      status: "error",
      error_message: err?.message || "Gọi OpenAI API thất bại.",
      meta: {
        model: model_id,
        response_time_ms,
      },
      details: err?.response?.data ?? null,
    })
  }
})

export default router
