// routes/hoso-agent.ts — Trợ lý "Tra cứu hồ sơ" (nội bộ Portal, thay dịch vụ ngoài của nhóm P.Thảo).
// Nguồn dữ liệu: app nhúng `ho-so` (SQLite candidates.db) qua API tra cứu của chính nó: CCCD + (mã hồ sơ HOẶC số báo danh),
// trả đúng 1 bản ghi, có chống dò. Trợ lý chỉ nhận CCCD/mã/SBD thí sinh nhập trong hội thoại, KHÔNG liệt kê hay tìm theo tên.
// Mô hình chỉ được xem MỘT bản ghi đã xác thực hai yếu tố và diễn giải đúng dữ liệu đó.
import { Router, Request, Response } from "express"
import OpenAI from "openai"
import { getCentralAgentConfig, getCentralLlmCredentials, llmExtraBody } from "../lib/central-agent-config"
import { sanitizeAnswer } from "../lib/llm-guard"

const router = Router()

const SAMPLE_PROMPTS = [
  "Tra hồ sơ: CCCD 001207057465, số báo danh 01014308",
  "Cho em xem điểm quy đổi và các nguyện vọng của hồ sơ này",
  "Hồ sơ của em đã được duyệt chưa và lệ phí đã nộp chưa?",
]

const ASK_FOR_IDS =
  "Để tra cứu hồ sơ, bạn vui lòng nhập **đủ hai thông tin**:\n\n" +
  "1. **Số CCCD** (12 chữ số) của thí sinh;\n" +
  "2. **Mã hồ sơ** *hoặc* **số báo danh** (chỉ cần một trong hai).\n\n" +
  "Ví dụ: *Tra hồ sơ CCCD 001207057465, số báo danh 01014308*.\n\n" +
  "Vì lý do bảo mật, hệ thống chỉ trả thông tin khi khớp cả hai yếu tố và không tra cứu theo họ tên."

const NOT_FOUND =
  "Không tìm thấy hồ sơ phù hợp. Bạn kiểm tra lại **số CCCD** và **mã hồ sơ / số báo danh** đã nhập (cần khớp cả hai) rồi thử lại nhé."

const SYSTEM_PROMPT =
  "Bạn là trợ lý TRA CỨU HỒ SƠ xét tuyển đại học chính quy 2026 của Đại học Kinh tế Quốc dân (NEU). " +
  "Người dùng đã xác thực hồ sơ bằng CCCD + mã hồ sơ/số báo danh; dữ liệu JSON của ĐÚNG MỘT thí sinh nằm ở tin nhắn người dùng.\n" +
  "QUY TẮC: (1) Chỉ trả lời dựa trên JSON đó, không suy đoán, không bịa; trường null/thiếu thì nói là chưa có dữ liệu. " +
  "(2) Không nhắc tới thí sinh khác và không tiết lộ cấu trúc JSON/tên trường kỹ thuật. " +
  "(3) Nếu người dùng chỉ đưa định danh mà chưa hỏi gì cụ thể, hãy TÓM TẮT hồ sơ: họ tên, số báo danh, mã hồ sơ, trạng thái hồ sơ, lệ phí, ưu tiên (khu vực/đối tượng/điểm ưu tiên), điểm THPT đã có, điểm quy đổi các phương thức (kèm phân vị), các tổ hợp xét tuyển và danh sách nguyện vọng theo thứ tự. " +
  "(4) Chú giải trường: diem_list = điểm xét tuyển quy đổi theo từng phương thức (value) kèm top_pct = nằm trong top bao nhiêu % trong pool_n thí sinh cùng nhóm; " +
  "to_hop = các tổ hợp THPT (total = tổng 3 môn, uu_tien = điểm ưu tiên, admit = điểm xét tuyển của tổ hợp, valid = tổ hợp có đủ điểm); " +
  "nguyen_vong = nguyện vọng đã đăng ký theo thu_tu_nv, is_neu = true nếu là ngành của NEU; quydoi_input = dữ liệu đầu vào dùng để quy đổi; trang_thai_ho_so, le_phi = trạng thái duyệt và lệ phí. " +
  "(5) Không hứa chắc đỗ/trượt; muốn biết khả năng trúng tuyển thì hướng dẫn dùng công cụ Dự đoán điểm chuẩn. " +
  "(6) Khi nêu nguyện vọng, điểm quy đổi hoặc tổ hợp thì liệt kê ĐẦY ĐỦ mọi mục có trong dữ liệu, đúng thứ tự, không gộp, không rút gọn, không viết 'v.v.'. " +
  "(7) Trả lời tiếng Việt, rõ ràng, dùng bảng hoặc gạch đầu dòng cho điểm và nguyện vọng, không dài dòng."

/** Rút CCCD (12 số), số báo danh và mã hồ sơ từ một đoạn văn. */
export function extractIdentifiers(text: string): { cccd: string; sbd: string; maHoSo: string } {
  const t = String(text || "")
  const cccd = (t.match(/(?<!\d)\d{12}(?!\d)/) || [""])[0]
  const rest = cccd ? t.replace(cccd, " ") : t
  const maHoSo = (rest.match(/(?<![A-Za-z0-9])[A-Za-z]{1,3}\d{5,9}(?![A-Za-z0-9])/) || [""])[0].toUpperCase()
  let sbd = ""
  const sbdMatches = rest.match(/(?<!\d)\d{7,10}(?!\d)/g)
  if (sbdMatches) sbd = sbdMatches[0]
  return { cccd, sbd, maHoSo }
}

// Hạn mức thử tra cứu theo người dùng/phiên: chống dò CCCD bằng chat (ngoài chống dò theo IP của app ho-so).
const ATTEMPT_WINDOW_MS = 60_000
const ATTEMPT_MAX = 8
const attempts = new Map<string, { count: number; resetAt: number }>()
function tooManyAttempts(key: string): boolean {
  const now = Date.now()
  const e = attempts.get(key)
  if (!e || now > e.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS })
    return false
  }
  e.count += 1
  return e.count > ATTEMPT_MAX
}
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k)
}, 5 * ATTEMPT_WINDOW_MS).unref?.()

function backendBase(): string {
  // Cùng tiến trình: gọi loopback để đi qua mount /api/apps/ho-so như mọi request thường (giống Central gọi hàm app).
  return `http://127.0.0.1:${process.env.PORT || "3001"}`
}

type LookupResult = { status: "ok"; record: any } | { status: "not_found" } | { status: "limited" } | { status: "error"; message: string }

async function lookupRecord(cccd: string, factor: string, clientKey: string): Promise<LookupResult> {
  const qs = new URLSearchParams({ cccd, factor })
  try {
    const r = await fetch(`${backendBase()}/api/apps/ho-so/thi-sinh/lookup?${qs}`, {
      headers: { "X-Internal-Central": "1", "x-forwarded-for": `hoso-agent:${clientKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (r.status === 404) return { status: "not_found" }
    if (r.status === 429) return { status: "limited" }
    if (!r.ok) return { status: "error", message: `HTTP ${r.status}` }
    return { status: "ok", record: await r.json() }
  } catch (e: any) {
    return { status: "error", message: e?.message || "lookup failed" }
  }
}

/** Chọn các trường cần thiết, bỏ trường trùng/nhạy cảm không cần (cmnd lặp lại CCCD). */
function compactRecord(rec: any): any {
  const { cmnd: _cmnd, stt: _stt, ...rest } = rec || {}
  if (Array.isArray(rest.nguyen_vong)) rest.nguyen_vong = rest.nguyen_vong.map(({ cmnd: _c, ...nv }: any) => nv)
  return rest
}

function maskCccd(c: string): string {
  return c ? `${c.slice(0, 3)}******${c.slice(-3)}` : ""
}

router.get("/v1/metadata", async (_req: Request, res: Response) => {
  const config = await getCentralAgentConfig()
  const models = config.ollamaModels?.length ? config.ollamaModels : config.model ? [config.model] : []
  res.json({
    name: "Tra cứu hồ sơ",
    description: "Tra cứu hồ sơ xét tuyển của thí sinh (thông tin nộp hồ sơ, điểm, tổ hợp, nguyện vọng, trạng thái) bằng CCCD và mã hồ sơ hoặc số báo danh.",
    version: "1.0.0",
    developer: "NEU AI Portal",
    capabilities: ["search", "candidate-lookup"],
    supported_models: models.map((model_id) => ({ model_id, name: model_id, description: "Mô hình self-host (vLLM)" })),
    sample_prompts: SAMPLE_PROMPTS,
    provided_data_types: [{ type: "candidate_profile", description: "Hồ sơ xét tuyển của một thí sinh đã xác thực CCCD + mã hồ sơ/SBD" }],
    contact: "ai-portal@neu.edu.vn",
    status: config.provider === "skip" ? "inactive" : "active",
  })
})

router.get("/v1/data", (req: Request, res: Response) => {
  res.json({ status: "success", data_type: (req.query.type as string) || "candidate_profile", items: [], last_updated: new Date().toISOString() })
})

function reply(res: Response, session_id: string, model: string, t0: number, text: string, extra?: { functions?: string[]; tokens?: number }) {
  return res.json({
    session_id,
    status: "success",
    content_markdown: text,
    meta: { model, response_time_ms: Date.now() - t0, tokens_used: extra?.tokens ?? 0, agents: [], functions_called: extra?.functions ?? [] },
    attachments: [],
  })
}

router.post("/v1/ask", async (req: Request, res: Response) => {
  const t0 = Date.now()
  const body = req.body || {}
  const session_id = typeof body.session_id === "string" ? body.session_id : ""
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  if (!session_id || !body.model_id || !prompt) {
    return res.status(400).json({ session_id: session_id || null, status: "error", error_code: "INVALID_REQUEST", error_message: "Thiếu tham số bắt buộc" })
  }
  const userKey = `${typeof body.user === "string" ? body.user : "anon"}|${session_id}`.slice(0, 120)

  // 1) Lấy định danh: ưu tiên tin nhắn hiện tại, bù bằng các tin nhắn người dùng gần nhất trong hội thoại.
  let ids = extractIdentifiers(prompt)
  const history: any[] = Array.isArray(body?.context?.history) ? body.context.history : []
  if (!ids.cccd || (!ids.sbd && !ids.maHoSo)) {
    for (let i = history.length - 1; i >= 0 && (!ids.cccd || (!ids.sbd && !ids.maHoSo)); i--) {
      if (history[i]?.role !== "user" || typeof history[i]?.content !== "string") continue
      const h = extractIdentifiers(history[i].content)
      ids = { cccd: ids.cccd || h.cccd, sbd: ids.sbd || h.sbd, maHoSo: ids.maHoSo || h.maHoSo }
    }
  }
  if (!ids.cccd || (!ids.sbd && !ids.maHoSo)) {
    return reply(res, session_id, String(body.model_id), t0, ASK_FOR_IDS)
  }

  // 2) Tra cứu (thử mã hồ sơ trước rồi tới SBD); đủ hai yếu tố mới trả dữ liệu.
  if (tooManyAttempts(userKey)) {
    return reply(res, session_id, String(body.model_id), t0, "Bạn tra cứu quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau ít phút.")
  }
  const factors = [ids.maHoSo, ids.sbd].filter(Boolean)
  let result: LookupResult = { status: "not_found" }
  for (const f of factors) {
    result = await lookupRecord(ids.cccd, f, userKey)
    if (result.status !== "not_found") break
  }
  console.log(`[hoso-agent] lookup cccd=${maskCccd(ids.cccd)} -> ${result.status}`)
  if (result.status === "not_found") return reply(res, session_id, String(body.model_id), t0, NOT_FOUND)
  if (result.status === "limited") return reply(res, session_id, String(body.model_id), t0, "Hệ thống đang nhận quá nhiều lượt tra cứu không khớp. Vui lòng thử lại sau ít phút.")
  if (result.status === "error") {
    return res.status(502).json({ session_id, status: "error", error_message: "Không tra cứu được hồ sơ lúc này, vui lòng thử lại sau.", error_step: "hoso_lookup" })
  }

  // 3) Diễn giải bằng LLM chỉ từ bản ghi đã xác thực.
  const cred = await getCentralLlmCredentials()
  if (!cred) {
    return res.status(503).json({ session_id, status: "error", error_message: "Chưa cấu hình LLM cho hệ thống.", error_step: "central_llm_config" })
  }
  const model = typeof body.model_id === "string" && body.model_id.trim() && !/[:]|^qwen2/i.test(body.model_id) ? body.model_id.trim() : cred.model
  const asksSomething = prompt.replace(/\d{7,}/g, "").replace(/[A-Za-z]{1,3}\d{5,9}/g, "").replace(/\b(cccd|cmnd|sbd|số báo danh|mã hồ sơ|tra hồ sơ|tra cứu|tra)\b/gi, "").replace(/[\s:,;.\-]+/g, "").length > 12
  const userContent =
    `DỮ LIỆU HỒ SƠ (JSON, một thí sinh đã xác thực):\n${JSON.stringify(compactRecord(result.record))}\n\n` +
    `YÊU CẦU CỦA NGƯỜI DÙNG: ${asksSomething ? prompt : "Tóm tắt hồ sơ của tôi."}`
  try {
    const client = new OpenAI({
      apiKey: cred.apiKey,
      ...(cred.baseUrl ? { baseURL: cred.baseUrl } : {}),
      ...(cred.extraHeaders && Object.keys(cred.extraHeaders).length ? { defaultHeaders: cred.extraHeaders } : {}),
    })
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: 1800,
      ...llmExtraBody(cred),
    } as any)
    const answer = sanitizeAnswer((completion.choices?.[0]?.message?.content ?? "").trim(), prompt)
    return reply(res, session_id, model, t0, answer || "Xin lỗi, tôi chưa tạo được câu trả lời. Bạn thử lại giúp tôi nhé.", {
      functions: ["ho-so/lookup"],
      tokens: (completion.usage as any)?.total_tokens ?? 0,
    })
  } catch (err: any) {
    console.error("[hoso-agent] LLM error:", err?.message ?? err)
    return res.status(502).json({ session_id, status: "error", error_message: `Lỗi gọi mô hình: ${err?.message || err}`, error_step: "hoso_llm" })
  }
})

export default router
