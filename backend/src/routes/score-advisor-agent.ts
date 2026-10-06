// routes/score-advisor-agent.ts — Trợ lý "Quy đổi và tư vấn điểm" (nội bộ Portal, không phụ thuộc dịch vụ ngoài).
// Dùng đúng orchestrator của Central nhưng ở chế độ agent_profile="score_advisor": chỉ cấp các hàm quy đổi / dự báo điểm
// và system prompt chuyên biệt. Mọi con số do các công cụ Portal (quy-doi, du-doan) tính, mô hình chỉ diễn giải.
import { Router, Request, Response } from "express"
import { getSetting } from "../lib/settings"
import { getCentralAgentConfig } from "../lib/central-agent-config"

const router = Router()

const SAMPLE_PROMPTS = [
  "Tôi có SAT 1450, IELTS 7.0, Toán 8.5 và muốn biết điểm xét tuyển cùng tư vấn vào ngành Hệ thống thông tin.",
  "Quy đổi điểm HSA 95 sang thang 30.",
  "Em được 26 điểm khối A00, có khả năng đỗ ngành Kinh tế không?",
  "Điểm ưu tiên khu vực 2 nông thôn của thí sinh tốt nghiệp năm 2026 là bao nhiêu?",
]

router.get("/v1/metadata", async (_req: Request, res: Response) => {
  const config = await getCentralAgentConfig()
  const models = config.ollamaModels?.length ? config.ollamaModels : config.model ? [config.model] : []
  res.json({
    name: "Quy đổi và tư vấn điểm",
    description: "Quy đổi điểm các kỳ thi/chứng chỉ (SAT, ACT, HSA, TSA, V-ACT, IELTS…) về thang xét tuyển NEU, tính điểm ưu tiên và tư vấn khả năng trúng tuyển ngành.",
    version: "1.0.0",
    developer: "NEU AI Portal",
    capabilities: ["score-conversion", "priority-calculation", "admission-advice", "natural-language-query"],
    supported_models: models.map((model_id) => ({ model_id, name: model_id, description: "Mô hình self-host (vLLM)" })),
    sample_prompts: SAMPLE_PROMPTS,
    provided_data_types: [{ type: "candidate_scores", description: "Điểm thi, chứng chỉ và điểm ưu tiên do thí sinh nhập trong cuộc trò chuyện" }],
    contact: "ai-portal@neu.edu.vn",
    status: config.provider === "skip" ? "inactive" : "active",
  })
})

router.get("/v1/data", (req: Request, res: Response) => {
  res.json({ status: "success", data_type: (req.query.type as string) || "candidate_scores", items: [], last_updated: new Date().toISOString() })
})

// POST /api/score_advisor_agent/v1/ask — chuyển cho orchestrator với agent_profile
router.post("/v1/ask", async (req: Request, res: Response) => {
  const body = req.body || {}
  if (!body.session_id || !body.model_id || !body.user || !body.prompt) {
    return res.status(400).json({ session_id: body.session_id || null, status: "error", error_code: "INVALID_REQUEST", error_message: "Thiếu tham số bắt buộc" })
  }
  const baseUrl =
    getSetting("BACKEND_URL") ||
    (process.env.NODE_ENV === "development" ? `http://127.0.0.1:${process.env.PORT || "3001"}` : `http://backend:${process.env.PORT || "3001"}`)
  const wantsStream = body.stream === true
  try {
    const upstream = await fetch(`${baseUrl}/api/orchestrator/v1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(wantsStream ? { Accept: "text/event-stream" } : {}) },
      body: JSON.stringify({ ...body, agent_profile: "score_advisor" }),
    })
    const isSse = (upstream.headers.get("content-type") || "").includes("text/event-stream")
    if (isSse && upstream.body) {
      res.status(upstream.status)
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
      res.setHeader("Cache-Control", "no-cache, no-transform")
      res.setHeader("Connection", "keep-alive")
      res.setHeader("X-Accel-Buffering", "no")
      res.flushHeaders?.()
      const reader = (upstream.body as any).getReader()
      const decoder = new TextDecoder()
      req.on("close", () => { try { reader.cancel().catch(() => {}) } catch { /* ignore */ } })
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) res.write(decoder.decode(value, { stream: true }))
      }
      res.end()
      return
    }
    let data: any
    try {
      data = await upstream.json()
    } catch {
      data = { session_id: body.session_id, status: "error", error_message: `Phản hồi từ orchestrator không phải JSON (HTTP ${upstream.status}).`, error_step: "score_advisor_proxy" }
    }
    res.status(upstream.status).json(data)
  } catch (err: any) {
    res.status(502).json({ session_id: body.session_id, status: "error", error_message: `Không kết nối được orchestrator: ${err?.message || err}`, error_step: "score_advisor_proxy" })
  }
})

export default router
