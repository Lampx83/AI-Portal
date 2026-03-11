/**
 * POST /api/ai/complete — completion đơn cho tools nhúng (dùng cấu hình Central LLM).
 * Học từ Quantis: tools gọi endpoint này khi chạy trong Portal để có trợ lý AI.
 */
import { Router, Request, Response } from "express"
import OpenAI from "openai"
import { getCentralLlmCredentials } from "../lib/central-agent-config"

const router = Router()

/** POST /api/ai/complete — body: { prompt: string, system?: string, model?: string } */
router.post("/complete", async (req: Request, res: Response) => {
  try {
    const cred = await getCentralLlmCredentials()
    if (!cred) {
      return res.status(503).json({
        error: "Chưa cấu hình LLM",
        message:
          "Vào Admin → Central (Trợ lý chính): chọn provider (Ollama hoặc OpenAI-compatible), nhập Base URL và model.",
      })
    }

    const { prompt, system, model: modelOverride } = req.body ?? {}
    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "prompt là bắt buộc và phải là chuỗi không rỗng" })
    }

    const apiKey = cred.apiKey
    const baseURL = cred.baseUrl
    const model = typeof modelOverride === "string" && modelOverride.trim() ? modelOverride.trim() : cred.model

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
    if (typeof system === "string" && system.trim()) {
      messages.push({ role: "system", content: system.trim() })
    }
    messages.push({ role: "user", content: prompt.trim() })

    const client = new OpenAI(baseURL ? { apiKey, baseURL } : { apiKey })
    const completion = await client.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages,
      max_tokens: 1024,
    })

    const content = (completion.choices?.[0]?.message?.content ?? "").trim()
    res.json({ content: content || "(không có nội dung)" })
  } catch (err: any) {
    const status = Number(err?.status) || 500
    const message = err?.message || "Lỗi gọi LLM"
    res.status(status).json({
      error: "Lỗi AI",
      message: message,
    })
  }
})

export default router
