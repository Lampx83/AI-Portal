/**
 * Gợi ý câu hỏi tiếp theo sau mỗi câu trả lời của Trợ lý chính.
 *
 * Hai cách (cấu hình app_settings.central_followups_mode = "llm" | "rules" | "off", mặc định "llm"):
 *   - "llm": một lời gọi mô hình NGẮN (max_tokens nhỏ, hết giờ 8 giây) dựa trên câu hỏi + câu trả lời vừa rồi;
 *            lỗi/hết giờ/kết quả hỏng → rơi về luật.
 *   - "rules": gợi ý soạn sẵn theo công cụ vừa dùng + giai đoạn vòng đời của dự án đang mở.
 * Gọi SAU khi câu trả lời chính đã xong (điểm cuối riêng) nên không làm chậm câu trả lời.
 *
 * Phần thuần (không I/O) để kiểm thử: ruleFollowups, parseLlmFollowups, buildFollowupMessages.
 */

export type FollowupLang = "vi" | "en"

const TOOL_FOLLOWUPS: Record<string, { vi: string[]; en: string[] }> = {
  funds: {
    vi: ["Quỹ nào còn hạn nộp trong 2 tháng tới?", "Hồ sơ xin tài trợ nghiên cứu thường cần những gì?", "Có quỹ nào tài trợ cho nghiên cứu sinh không?"],
    en: ["Which funds are still open in the next two months?", "What does a typical grant application need?", "Are there funds for PhD students?"],
  },
  "journal-conference": {
    vi: ["Hội thảo nào sắp hết hạn nộp bài?", "Gợi ý tạp chí Scopus phù hợp với chủ đề của tôi", "Hội thảo nào do NEU tổ chức?"],
    en: ["Which conferences have deadlines coming up soon?", "Suggest Scopus journals that fit my topic", "Which conferences are organised by NEU?"],
  },
  regulations: {
    vi: ["Quy trình nghiệm thu đề tài cấp cơ sở gồm những bước nào?", "Có biểu mẫu thuyết minh đề tài không?", "Thủ tục thanh toán đề tài cần giấy tờ gì?"],
    en: ["What are the steps to close a university-level project?", "Is there a project proposal form?", "What documents are needed to settle project expenses?"],
  },
  paperfinder: {
    vi: ["Tìm thêm bài báo cùng chủ đề bằng tiếng Anh", "Bài nào mới nhất trong các kết quả trên?", "Làm sao tổng hợp tài liệu thành phần tổng quan nghiên cứu?"],
    en: ["Find more papers on the same topic in Vietnamese", "Which of these results is the most recent?", "How do I turn these papers into a literature review?"],
  },
  bibliomap: {
    vi: ["Trắc lượng thư mục giúp tìm khoảng trống nghiên cứu thế nào?", "Tôi cần dữ liệu gì để dựng bản đồ tri thức?"],
    en: ["How can bibliometrics reveal research gaps?", "What data do I need to build a knowledge map?"],
  },
  surveylab: {
    vi: ["Thang đo Likert nên dùng 5 hay 7 mức?", "Cỡ mẫu khảo sát bao nhiêu là đủ?", "Làm sao thử nghiệm bảng hỏi trước khi khảo sát chính thức?"],
    en: ["Should I use a 5- or 7-point Likert scale?", "How large should my survey sample be?", "How do I pilot a questionnaire?"],
  },
  quantis: {
    vi: ["Kiểm định độ tin cậy thang đo thế nào?", "Khi nào nên dùng hồi quy tuyến tính bội?", "Cách đọc kết quả phân tích nhân tố khám phá EFA?"],
    en: ["How do I test scale reliability?", "When should I use multiple linear regression?", "How do I read exploratory factor analysis results?"],
  },
  annota: {
    vi: ["Mã hoá dữ liệu phỏng vấn theo chủ đề thế nào?", "Bao nhiêu cuộc phỏng vấn là đủ bão hoà?"],
    en: ["How do I code interview data thematically?", "How many interviews reach saturation?"],
  },
  writium: {
    vi: ["Cấu trúc một bài báo khoa học gồm những phần nào?", "Viết phần tổng quan nghiên cứu sao cho chặt chẽ?"],
    en: ["What sections does a research article need?", "How do I write a strong literature review?"],
  },
  paperreviewer: {
    vi: ["Người phản biện thường chú ý điều gì nhất?", "Trả lời ý kiến phản biện thế nào cho thuyết phục?"],
    en: ["What do reviewers focus on most?", "How do I respond to reviewer comments convincingly?"],
  },
  plagiarismchecker: {
    vi: ["Tỷ lệ trùng lặp bao nhiêu là chấp nhận được?", "Trích dẫn thế nào để tránh đạo văn?"],
    en: ["What similarity rate is acceptable?", "How do I cite properly to avoid plagiarism?"],
  },
  expertfinder: {
    vi: ["Tìm chuyên gia về chuyển đổi số ở NEU", "Làm sao mời chuyên gia góp ý đề cương?"],
    en: ["Find NEU experts in digital transformation", "How do I invite an expert to review my proposal?"],
  },
}

const STAGE_FOLLOWUPS: Record<string, { vi: string[]; en: string[] }> = {
  explore: {
    vi: ["Giúp tôi viết câu hỏi nghiên cứu cho dự án này", "Chủ đề của tôi đã có ai nghiên cứu chưa?"],
    en: ["Help me phrase the research questions for this project", "Has anyone already studied my topic?"],
  },
  review: {
    vi: ["Tìm bài báo liên quan đến chủ đề dự án của tôi", "Khoảng trống nghiên cứu thường được xác định thế nào?"],
    en: ["Find papers related to my project's topic", "How are research gaps usually identified?"],
  },
  design: {
    vi: ["Gợi ý cấu trúc bảng hỏi cho dự án của tôi", "Cỡ mẫu khảo sát bao nhiêu là đủ?"],
    en: ["Suggest a questionnaire structure for my project", "How large should my survey sample be?"],
  },
  analyze: {
    vi: ["Tôi nên dùng phương pháp phân tích nào cho dữ liệu của mình?", "Kiểm định độ tin cậy thang đo thế nào?"],
    en: ["Which analysis method suits my data?", "How do I test scale reliability?"],
  },
  write: {
    vi: ["Cấu trúc một bài báo khoa học gồm những phần nào?", "Kiểm tra đạo văn trước khi nộp bài thế nào?"],
    en: ["What sections does a research article need?", "How do I check plagiarism before submitting?"],
  },
  publish: {
    vi: ["Gợi ý tạp chí phù hợp để công bố kết quả", "Có quỹ nào tài trợ cho chủ đề của tôi không?"],
    en: ["Suggest journals to publish my results", "Are there funds for my topic?"],
  },
}

const GENERIC_FOLLOWUPS: { vi: string[]; en: string[] } = {
  vi: ["Có quỹ nào tài trợ nghiên cứu đang mở không?", "Hội thảo nào sắp diễn ra?", "Tôi nên bắt đầu một dự án nghiên cứu từ đâu?"],
  en: ["Are there any open research funds?", "Which conferences are coming up?", "Where should I start a research project?"],
}

export const MAX_FOLLOWUPS = 3
const MAX_LEN = 120

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function pushUnique(out: string[], items: string[], avoid: string[]): void {
  const seen = new Set([...out, ...avoid].map(norm))
  for (const it of items) {
    if (out.length >= MAX_FOLLOWUPS) return
    const k = norm(it)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
}

/**
 * Gợi ý theo luật: công cụ vừa dùng → giai đoạn dự án → gợi ý chung. Bỏ câu trùng câu vừa hỏi.
 * @param availableAliases công cụ đang có trên hệ thống (lọc gợi ý của công cụ không tồn tại)
 */
export function ruleFollowups(opts: {
  toolsUsed?: string[]
  stageId?: string | null
  lang?: FollowupLang
  question?: string
  availableAliases?: string[]
}): string[] {
  const lang = opts.lang ?? "vi"
  const avail = opts.availableAliases ? new Set(opts.availableAliases) : null
  const out: string[] = []
  const avoid = opts.question ? [opts.question] : []
  for (const a of opts.toolsUsed ?? []) {
    if (avail && !avail.has(a)) continue
    const f = TOOL_FOLLOWUPS[a]
    if (f) pushUnique(out, f[lang].slice(0, 2), avoid)
  }
  if (opts.stageId && STAGE_FOLLOWUPS[opts.stageId]) pushUnique(out, STAGE_FOLLOWUPS[opts.stageId][lang], avoid)
  pushUnique(out, GENERIC_FOLLOWUPS[lang], avoid)
  return out.slice(0, MAX_FOLLOWUPS)
}

/** Đọc mảng câu hỏi từ phản hồi của mô hình (JSON mảng, có thể kèm ```json…``` hoặc danh sách đánh số). */
export function parseLlmFollowups(text: string, question?: string): string[] {
  let raw = (text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
  let items: unknown[] = []
  const arrMatch = raw.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0])
      if (Array.isArray(parsed)) items = parsed
    } catch {
      /* thử dạng danh sách bên dưới */
    }
  }
  if (!items.length) {
    items = raw
      .split("\n")
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter((l) => l.length > 0)
  }
  const out: string[] = []
  const cleaned = items
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^["'“”\s]+|["'“”\s]+$/g, "").replace(/\s+/g, " ").trim())
    // câu hỏi hợp lệ: đủ dài, không chứa đường dẫn/mã, không phải câu của trợ lý
    .filter((x) => x.length >= 8 && x.length <= MAX_LEN && !/https?:\/\/|[<>{}`]|\/tools\//i.test(x))
  pushUnique(out, cleaned, question ? [question] : [])
  return out
}

/** Lời nhắc ngắn cho mô hình (≈ 600 token vào, ≤ 160 token ra). */
export function buildFollowupMessages(opts: {
  question: string
  answer: string
  lang: FollowupLang
  toolNames?: string[]
  stageName?: string | null
}): { role: "system" | "user"; content: string }[] {
  const answer = (opts.answer || "").replace(/\s+/g, " ").slice(0, 1500)
  const question = (opts.question || "").replace(/\s+/g, " ").slice(0, 400)
  const scope = opts.toolNames?.length ? opts.toolNames.slice(0, 15).join(", ") : ""
  const system =
    opts.lang === "en"
      ? "You suggest follow-up questions for a research-support assistant at the National Economics University (Vietnam). " +
        "Return ONLY a JSON array of exactly 3 short questions (max 90 characters each) the USER could ask next, in English, " +
        "written from the user's point of view, specific to the conversation, not repeating the last question. No numbering, no extra text." +
        (scope ? ` The system offers these tools: ${scope}.` : "")
      : "Bạn gợi ý câu hỏi tiếp theo cho trợ lý hỗ trợ nghiên cứu khoa học của Đại học Kinh tế Quốc dân. " +
        "CHỈ trả về một mảng JSON gồm đúng 3 câu hỏi ngắn (mỗi câu tối đa 90 ký tự) mà NGƯỜI DÙNG có thể hỏi tiếp, bằng tiếng Việt tự nhiên, " +
        "xưng hô từ phía người dùng, bám sát nội dung vừa trao đổi, không lặp lại câu vừa hỏi. Không đánh số, không thêm lời nào khác." +
        (scope ? ` Hệ thống có các công cụ: ${scope}.` : "")
  const user =
    (opts.lang === "en" ? "Last question: " : "Câu vừa hỏi: ") +
    question +
    "\n" +
    (opts.lang === "en" ? "Assistant's answer (shortened): " : "Trả lời của trợ lý (rút gọn): ") +
    answer +
    (opts.stageName ? `\n${opts.lang === "en" ? "Current project stage" : "Giai đoạn dự án hiện tại"}: ${opts.stageName}` : "")
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
}

/** Câu có phải tiếng Anh (không dấu tiếng Việt + có từ chức năng tiếng Anh). */
export function detectLang(text: string, uiLocale?: string): FollowupLang {
  const t = (text || "").trim()
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(t)) return "vi"
  const hits = t.toLowerCase().match(/\b(the|how|what|which|where|when|why|can|could|should|do|does|is|are|i|my|for|of|and|to|in|about|find)\b/g)
  if ((hits?.length ?? 0) >= 2) return "en"
  return uiLocale === "en" ? "en" : "vi"
}
