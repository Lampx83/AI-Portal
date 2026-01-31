// routes/orchestrator.ts
import { Router, Request, Response } from "express"
import OpenAI from "openai"

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

  const projectUrl = body?.context?.project && isValidUrl(body.context.project)
    ? body.context.project!
    : null
  const projectId = extractLastPathSegment(projectUrl)

  const rawDocs = Array.isArray(body?.context?.extra_data?.document)
    ? (body!.context!.extra_data!.document as string[])
    : []

  const docSet = new Set<string>()
  for (const d of rawDocs) {
    if (isValidUrl(d)) docSet.add(d)
  }
  const documents = Array.from(docSet)

  const attachments = documents
    .filter((u) => /\.pdf($|\?)/i.test(u))
    .map((u) => ({ type: "pdf" as const, url: u }))

  const contextHistory = Array.isArray(body?.context?.history) ? body!.context!.history! : []
  const safeHistory = sanitizeHistory(contextHistory)
  const clippedHistory = clipHistoryByChars(safeHistory, 6000)

  const systemContext =
    `Bạn là trợ lý AI điều phối nghiên cứu NEU. Nếu có dự án hoặc tài liệu, hãy dùng như ngữ cảnh:\n` +
    `- project_id: ${projectId ?? "N/A"}\n` +
    `- documents(${documents.length}): ${documents.length ? documents.join(", ") : "none"}\n` +
    `Trả lời ngắn gọn, chính xác và thân thiện.`

  const messages = [
    { role: "system", content: systemContext },
    ...clippedHistory.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: prompt },
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
