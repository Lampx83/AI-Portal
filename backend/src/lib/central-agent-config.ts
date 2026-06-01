/**
 * Central agent config. LLM: provider, model, api_key, base_url (optional).
 * Stored in app_settings, not env vars.
 */
import { query } from "./db"

export type CentralLlmProvider = "openai" | "gemini" | "anthropic" | "openai_compatible" | "ollama" | "skip"

export interface CentralAgentConfig {
  provider: CentralLlmProvider
  /** Model name (e.g. gpt-4o-mini, qwen3:8b) — model đang dùng. */
  model: string
  /** Masked key for display */
  apiKeyMasked: string
  /** Base URL (only used when provider = openai_compatible or ollama) */
  baseUrl: string
  /** System prompt for Central (orchestrator). Admin can edit in Settings/Central. */
  systemPrompt: string
  /** Danh sách model đã chọn từ Ollama (để hiển thị lại khi mở form). */
  ollamaModels: string[]
  /** Header tuỳ biến gửi kèm mỗi request tới LLM (vd Kong gateway: {"x-ollama-seckey":"..."}). */
  extraHeaders: Record<string, string>
  /** Khi true, Central sẽ route sang trợ lý chuyên biệt (agent) phù hợp; khi false chỉ Central trả lời. */
  routingEnabled: boolean
}

const CONFIG_KEYS = [
  "central_llm_provider",
  "central_llm_model",
  "central_llm_api_key",
  "central_llm_base_url",
  "central_system_prompt",
  "central_llm_models",
  "central_llm_extra_headers",
  "central_routing_enabled",
] as const

function parseExtraHeaders(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === "string" && k.trim() && typeof v === "string") out[k.trim()] = v
    }
    return out
  } catch {
    return {}
  }
}

function parseMap(rows: { key: string; value: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.key] = row.value ?? ""
  }
  return map
}

function normalizeProvider(p: string): CentralLlmProvider {
  const v = p.trim().toLowerCase()
  if (v === "openai" || v === "gemini" || v === "anthropic" || v === "openai_compatible" || v === "ollama") return v
  return "skip"
}

/** Get Central config (for Admin GET). API key returned masked. */
export async function getCentralAgentConfig(): Promise<CentralAgentConfig> {
  try {
    const result = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [CONFIG_KEYS as unknown as string[]]
    )
    const map = parseMap(result.rows as { key: string; value: string }[])
    const provider = normalizeProvider(map.central_llm_provider || "skip")
    const model = (map.central_llm_model || "").trim() || (provider === "openai" ? "gpt-4o-mini" : provider === "ollama" ? "qwen3:8b" : "")
    const hasKey = !!(map.central_llm_api_key || "").trim()
    const baseUrl = (map.central_llm_base_url || "").trim()
    const systemPrompt = (map.central_system_prompt || "").trim() || DEFAULT_CENTRAL_SYSTEM_PROMPT
    let ollamaModels: string[] = []
    try {
      const raw = (map as Record<string, string>).central_llm_models
      if (typeof raw === "string" && raw.trim()) {
        const parsed = JSON.parse(raw) as unknown
        ollamaModels = Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === "string") : []
      }
    } catch {
      // ignore
    }
    const extraHeaders = parseExtraHeaders(map.central_llm_extra_headers)
    const routingEnabled = (map.central_routing_enabled || "").trim().toLowerCase() === "true"
    return {
      provider,
      model,
      apiKeyMasked: hasKey ? "••••••••••••" : "",
      baseUrl,
      systemPrompt,
      ollamaModels,
      extraHeaders,
      routingEnabled,
    }
  } catch {
    return { provider: "skip", model: "", apiKeyMasked: "", baseUrl: "", systemPrompt: "", ollamaModels: [], extraHeaders: {}, routingEnabled: false }
  }
}

/** Credentials to call LLM (only openai / openai_compatible supported). */
export interface CentralLlmCredentials {
  provider: "openai" | "openai_compatible"
  model: string
  apiKey: string
  baseUrl?: string
  /** Custom headers to attach to every LLM request (vd Kong: {"x-ollama-seckey":"..."}). */
  extraHeaders?: Record<string, string>
}

/**
 * Return credentials for Central LLM. Ollama and openai_compatible (with baseUrl) supported;
 * for Ollama, apiKey can be empty (we use "ollama" placeholder).
 */
export async function getCentralLlmCredentials(): Promise<CentralLlmCredentials | null> {
  try {
    const result = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [CONFIG_KEYS as unknown as string[]]
    )
    const map = parseMap(result.rows as { key: string; value: string }[])
    const provider = (map.central_llm_provider || "").trim().toLowerCase()
    const model = (map.central_llm_model || "").trim() || (provider === "ollama" ? "qwen3:8b" : "gpt-4o-mini")
    const apiKey = (map.central_llm_api_key || "").trim()
    const baseUrl = (map.central_llm_base_url || "").trim().replace(/\/+$/, "")
    const extraHeaders = parseExtraHeaders(map.central_llm_extra_headers)

    if (provider === "openai" && apiKey) {
      return { provider: "openai", model, apiKey, extraHeaders }
    }
    if (provider === "ollama") {
      const raw = baseUrl || "https://research.neu.edu.vn/ollama"
      const url = raw.replace(/\/v1\/?$/, "") + "/v1"
      return { provider: "openai_compatible", model, apiKey: apiKey || "ollama", baseUrl: url, extraHeaders }
    }
    if (provider === "openai_compatible" && baseUrl) {
      return { provider: "openai_compatible", model, apiKey: apiKey || "ollama", baseUrl, extraHeaders }
    }
    return null
  } catch {
    return null
  }
}

/** Return OpenAI API key when provider = openai or openai_compatible (for legacy compatibility). */
export async function getOpenAIApiKey(): Promise<string | null> {
  const cred = await getCentralLlmCredentials()
  return cred ? cred.apiKey : null
}

export interface CentralAgentConfigUpdate {
  provider?: CentralLlmProvider
  model?: string
  api_key?: string
  base_url?: string
  system_prompt?: string
  /** Danh sách model đã chọn (Ollama). Lưu để lần sau mở form hiển thị lại. */
  models?: string[]
  /** Header tuỳ biến cho LLM request. Object {name: value} hoặc JSON string. */
  extra_headers?: Record<string, string> | string
  /** Khi true, Central sẽ route sang agent chuyên biệt; khi false chỉ Central trả lời. */
  routing_enabled?: boolean
}

/** Update Central config (for Admin PATCH). */
export async function updateCentralAgentConfig(update: CentralAgentConfigUpdate): Promise<CentralAgentConfig> {
  if (update.provider !== undefined) {
    const p = normalizeProvider(update.provider)
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [p]
    )
  }
  if (update.model !== undefined) {
    const v = typeof update.model === "string" ? update.model.trim() : ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_model', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  if (update.api_key !== undefined) {
    const key = typeof update.api_key === "string" ? update.api_key.trim() : ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_api_key', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key]
    )
  }
  if (update.base_url !== undefined) {
    const v = typeof update.base_url === "string" ? update.base_url.trim() : ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_base_url', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  if (update.system_prompt !== undefined) {
    let v = typeof update.system_prompt === "string" ? update.system_prompt.trim() : ""
    if (v === DEFAULT_CENTRAL_SYSTEM_PROMPT) v = ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_system_prompt', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  if (update.models !== undefined) {
    const arr = Array.isArray(update.models) ? update.models.filter((m): m is string => typeof m === "string") : []
    const v = JSON.stringify(arr)
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_models', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  if (update.routing_enabled !== undefined) {
    const v = update.routing_enabled === true ? "true" : "false"
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_routing_enabled', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  if (update.extra_headers !== undefined) {
    let headersObj: Record<string, string> = {}
    if (typeof update.extra_headers === "string") {
      headersObj = parseExtraHeaders(update.extra_headers)
    } else if (update.extra_headers && typeof update.extra_headers === "object") {
      for (const [k, v] of Object.entries(update.extra_headers)) {
        if (typeof k === "string" && k.trim() && typeof v === "string") headersObj[k.trim()] = v
      }
    }
    const v = Object.keys(headersObj).length === 0 ? "" : JSON.stringify(headersObj)
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_extra_headers', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    )
  }
  return getCentralAgentConfig()
}

/** Returns true if Central should route to specialized agents; false → only Central answers. */
export async function isCentralRoutingEnabled(): Promise<boolean> {
  try {
    const r = await query<{ value: string }>(
      `SELECT value FROM ai_portal.app_settings WHERE key = 'central_routing_enabled' LIMIT 1`
    )
    return (r.rows[0]?.value || "").trim().toLowerCase() === "true"
  } catch {
    return false
  }
}

/** Get custom system prompt for Central (for orchestrator). Returns empty string if not set. */
export async function getCentralSystemPrompt(): Promise<string> {
  try {
    const r = await query<{ value: string }>(
      `SELECT value FROM ai_portal.app_settings WHERE key = 'central_system_prompt' LIMIT 1`
    )
    const v = r.rows[0]?.value
    return typeof v === "string" ? v.trim() : ""
  } catch {
    return ""
  }
}

/** Default system prompt for Central when admin has not set one. */
export const DEFAULT_CENTRAL_SYSTEM_PROMPT = `Bạn là trợ lý AI điều phối (Central) của hệ thống. Nhiệm vụ:
(1) Hướng dẫn người dùng sử dụng hệ thống dựa trên nội dung Hướng dẫn (mục dưới).
(2) Gợi ý hoặc điều hướng người dùng đến đúng Công cụ (Tools) khi họ cần chức năng tương ứng — dựa vào mô tả và từ khóa (keywords) của từng tool.
(3) Gợi ý hoặc chuyển tiếp đến đúng Trợ lý chuyên biệt (Agents) khi câu hỏi thuộc lĩnh vực của agent đó — dựa vào mô tả từ /metadata của từng agent.

QUY TẮC TẬP TRUNG VÀO CÂU HỎI HIỆN TẠI:
- Trả lời TRỰC TIẾP và CHỈ tập trung vào câu hỏi gần nhất của user (last user message).
- KHÔNG nhắc lại, không tóm tắt, không recap câu hỏi/câu trả lời trước đó trừ khi user yêu cầu rõ ràng ("tóm tắt lại", "nhắc lại câu trước", v.v.).
- Lịch sử hội thoại CHỈ dùng để hiểu ngữ cảnh đại từ và tham chiếu (vd "cái đó", "phương pháp vừa nói") — không phải để bổ sung thêm nội dung không được hỏi.
- Nếu câu hỏi mới không liên quan tới câu trước, bỏ qua chủ đề cũ hoàn toàn và chỉ trả lời câu mới.
- Mở đầu trả lời BẰNG nội dung trả lời, không bằng câu kiểu "Trước khi trả lời câu hỏi mới, hãy nhắc lại..." hay "Như đã đề cập ở trên...".

QUY TẮC NGÔN NGỮ — BẮT BUỘC TUÂN THỦ:
- Trả lời DUY NHẤT bằng ngôn ngữ mà người dùng đang dùng trong câu hỏi gần nhất (Việt → Việt, English → English, v.v.).
- Nếu không xác định được ngôn ngữ người dùng (câu quá ngắn, chỉ có ký hiệu/emoji, hoặc trộn lẫn nhiều thứ tiếng), MẶC ĐỊNH dùng tiếng Việt.
- TUYỆT ĐỐI KHÔNG dùng tiếng Trung (chữ Hán giản thể/phồn thể, pinyin) trong bất kỳ phần nào của câu trả lời, kể cả từ đơn lẻ, ví dụ minh hoạ, hay ký tự lẫn vào. Nếu phát hiện mình sắp xuất ký tự Hán, hãy thay bằng từ tương đương trong tiếng Việt (hoặc tiếng Anh nếu người dùng dùng tiếng Anh).
- Không trộn lẫn nhiều ngôn ngữ trong cùng một câu trả lời. Ngoại lệ duy nhất: thuật ngữ kỹ thuật/tên riêng/tên công cụ giữ nguyên gốc.

Quy tắc khi gợi ý công cụ (Tools): luôn dùng **tên công cụ** (không dùng alias kỹ thuật) và đính kèm link Markdown để người dùng bấm chuyển sang công cụ đó, dạng: [Tên công cụ](/tools/alias). Ví dụ: [Tên công cụ](/tools/alias).

Quan trọng — phạm vi trả lời: Chỉ trả lời các câu hỏi thuộc một trong các nhóm sau:
(a) Hướng dẫn sử dụng hệ thống và các tính năng của portal.
(b) Gợi ý/điều hướng đến công cụ (Tools) và trợ lý chuyên biệt (Agents).
(c) **Kiến thức về nghiên cứu khoa học**: định nghĩa, khái niệm, phương pháp luận (định tính/định lượng/hỗn hợp), quy trình nghiên cứu, thiết kế khảo sát, phân tích dữ liệu, viết bài báo khoa học, phản biện, đạo văn, công bố quốc tế, hội thảo/tạp chí khoa học, quỹ tài trợ nghiên cứu, đạo đức nghiên cứu, trích dẫn, và các chủ đề học thuật liên quan.
(d) Câu chào hỏi, hỏi chung về trợ lý/hệ thống.

Nếu câu hỏi nằm ngoài 4 nhóm trên (ví dụ tin tức thời sự, giải bài tập kỹ thuật/toán không liên quan nghiên cứu, soạn văn bản tùy ý, tư vấn cá nhân, lập trình ứng dụng không liên quan nghiên cứu, kiến thức ngoài lĩnh vực nghiên cứu khoa học), hãy trả lời ngắn gọn rằng câu hỏi ngoài phạm vi hỗ trợ và không cung cấp thông tin thêm.

Khi trả lời về kiến thức nghiên cứu, ưu tiên giải thích súc tích, đúng học thuật, dẫn ví dụ ngắn nếu cần. Nếu câu hỏi có công cụ/trợ lý chuyên biệt phù hợp hơn (vd hỏi về tìm chuyên gia → gợi ý agent "Chuyên gia"; hỏi về phát hiện đạo văn → gợi ý tool/agent tương ứng), thì vừa trả lời ngắn vừa gợi ý chuyển sang đúng công cụ.

Trả lời ngắn gọn, thân thiện. Không bịa thông tin ngoài ngữ cảnh dưới đây.`
