/**
 * Mục «Nguồn» cho câu trả lời của Trợ lý chính — GẮN BẰNG MÃ từ kết quả công cụ, không phụ thuộc mô hình.
 *
 * Trước đây chỉ dặn trong prompt «nêu rõ nguồn… kèm link»: mô hình lúc nhớ lúc quên, có lần tự đặt đường dẫn
 * không tồn tại. Giờ:
 *   - Mục «Nguồn» do máy chủ tạo từ danh sách công cụ THỰC SỰ được gọi (và trả dữ liệu, không lỗi) ở lượt này,
 *     mỗi công cụ một dòng [Tên](/tools/<alias>) — alias lấy từ danh mục công cụ thật.
 *   - Nếu mô hình tự viết một mục «Nguồn» ở cuối, mục đó bị gỡ; đường dẫn ngoài (http…) trong mục đó chỉ được giữ
 *     lại khi xuất hiện NGUYÊN VĂN trong dữ liệu công cụ trả về (đường dẫn chính thức có trong dữ liệu).
 *   - Không gọi công cụ nào → không thêm gì.
 *
 * Hàm thuần để kiểm thử.
 */

export interface ToolRef {
  alias: string
  name: string
}

export interface ToolResultRef {
  alias: string
  content: string
}

const SOURCE_HEADING_RE =
  /^\s*(?:#{1,6}\s*)?(?:\p{Extended_Pictographic}️?\s*)?(?:\*\*|__)?\s*(?:\p{Extended_Pictographic}️?\s*)?(?:nguồn(?: tham khảo| dữ liệu| thông tin| kiểm chứng)?|sources?|references?)\s*(?:\*\*|__)?\s*(?::|：)?\s*(?:\*\*|__)?(.*)$/iu

const LIST_OR_LINK_LINE_RE = /^\s*(?:[-*•+]\s+|\d+[.)]\s+|\[[^\]]+\]\([^)]+\)|<?https?:\/\/|\/tools\/)/i

/** Lấy mọi URL http(s) trong văn bản (cả dạng markdown [x](url) lẫn URL trần). */
export function extractHttpUrls(text: string): string[] {
  const out = new Set<string>()
  const re = /https?:\/\/[^\s<>()"'`\]]+/gi
  for (const m of (text || "").matchAll(re)) {
    out.add(m[0].replace(/[.,;:!?]+$/, ""))
  }
  return [...out]
}

/**
 * Gỡ mục «Nguồn» mô hình tự viết ở CUỐI câu trả lời (tiêu đề «Nguồn»/«Sources» + các dòng danh sách/liên kết).
 * Chỉ gỡ khi khối nằm ở cuối và gồm toàn dòng danh sách/liên kết (tối đa 12 dòng) để không cắt nhầm nội dung.
 */
export function stripModelSourcesBlock(answer: string): { body: string; urls: string[] } {
  const lines = (answer || "").split("\n")
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 14; i--) {
    const line = lines[i]
    if (/^\s*[-*•+]\s/.test(line)) continue // dòng danh sách bình thường — tiêu đề phải nằm phía trên
    const m = line.match(SOURCE_HEADING_RE)
    if (!m) continue
    const rest = lines.slice(i + 1)
    const nonEmpty = rest.filter((l) => l.trim())
    if (nonEmpty.length > 12) return { body: answer, urls: [] }
    if (!nonEmpty.every((l) => LIST_OR_LINK_LINE_RE.test(l) || /\]\(|https?:\/\//.test(l))) return { body: answer, urls: [] }
    const inline = (m[1] || "").trim()
    if (!inline && nonEmpty.length === 0) return { body: answer, urls: [] }
    const removed = [line, ...rest].join("\n")
    let body = lines.slice(0, i).join("\n").replace(/\s+$/, "")
    // bỏ đường kẻ ngang thừa ngay trước khối nguồn
    body = body.replace(/\n\s*(?:-{3,}|\*{3,}|_{3,})\s*$/, "").replace(/\s+$/, "")
    return { body, urls: extractHttpUrls(removed) }
  }
  return { body: answer, urls: [] }
}

/** Kết quả công cụ có phải lỗi không (JSON có trường error ở cấp đầu). */
export function isToolErrorResult(content: string): boolean {
  try {
    const d = JSON.parse(content)
    return !!d && typeof d === "object" && !Array.isArray(d) && "error" in d && !("data" in d) && !("items" in d)
  } catch {
    return false
  }
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Dựng mục «Nguồn». Trả "" khi không có công cụ hợp lệ nào.
 * @param results  kết quả công cụ ở lượt này (alias + nội dung)
 * @param tools    danh mục công cụ thật (alias → tên hiển thị); alias không có trong danh mục thì bỏ qua
 * @param modelUrls đường dẫn ngoài mô hình đã viết trong mục nguồn của nó (chỉ giữ cái có trong dữ liệu công cụ)
 */
export function buildSourcesSection(opts: {
  results: ToolResultRef[]
  tools: ToolRef[]
  modelUrls?: string[]
  lang?: "vi" | "en"
}): string {
  const { results, tools, modelUrls = [], lang = "vi" } = opts
  const okAliases: string[] = []
  for (const r of results) {
    if (!r?.alias || isToolErrorResult(r.content)) continue
    if (!okAliases.includes(r.alias)) okAliases.push(r.alias)
  }
  const lines: string[] = []
  for (const alias of okAliases) {
    const t = tools.find((x) => x.alias.toLowerCase() === alias.toLowerCase())
    if (!t) continue
    lines.push(`- [${t.name}](/tools/${t.alias})`)
  }
  if (!lines.length) return ""
  const allData = results.map((r) => r.content).join("\n")
  const official = modelUrls.filter((u) => u && allData.includes(u)).slice(0, 5)
  for (const u of official) lines.push(`- [${hostLabel(u)}](${u})`)
  const heading = lang === "en" ? "**Sources**" : "**Nguồn**"
  return `${heading}\n${lines.join("\n")}`
}

/** Gợi ý mở Quantis khi tệp bảng tính lớn chỉ được xem ở dạng tóm tắt. */
export function quantisTip(lang: "vi" | "en" = "vi"): string {
  return lang === "en"
    ? "💡 This spreadsheet is large, so I only looked at its structure summary and sample rows. For a full analysis (descriptive statistics, tests, regression…), open [Quantitative analysis](/tools/quantis)."
    : "💡 Tệp bảng tính khá lớn nên tôi mới xem phần tóm tắt cấu trúc và các dòng mẫu. Để phân tích đầy đủ (thống kê mô tả, kiểm định, hồi quy…), hãy mở [Phân tích định lượng](/tools/quantis)."
}

/**
 * Hoàn thiện câu trả lời cuối: gỡ mục nguồn mô hình tự viết (nếu có công cụ để thay), thêm mục «Nguồn» dựng bằng mã,
 * thêm gợi ý Quantis cho tệp lớn. Không gọi công cụ nào → giữ nguyên câu trả lời (chỉ có thể thêm gợi ý Quantis).
 */
export function finalizeCentralAnswer(
  answer: string,
  opts: { results: ToolResultRef[]; tools: ToolRef[]; lang?: "vi" | "en"; largeTable?: boolean }
): string {
  let text = answer || ""
  const lang = opts.lang ?? "vi"
  const hasTools = opts.results.some((r) => r?.alias && !isToolErrorResult(r.content))
  if (hasTools) {
    const stripped = stripModelSourcesBlock(text)
    const section = buildSourcesSection({ results: opts.results, tools: opts.tools, modelUrls: stripped.urls, lang })
    if (section) text = `${stripped.body}\n\n${section}`
  }
  if (opts.largeTable && opts.tools.some((t) => t.alias === "quantis") && !/\/tools\/quantis\b/.test(text)) {
    const tip = quantisTip(lang)
    // đặt gợi ý trước mục nguồn (nếu có) cho dễ thấy
    const idx = text.lastIndexOf(lang === "en" ? "\n\n**Sources**\n" : "\n\n**Nguồn**\n")
    text = idx >= 0 ? `${text.slice(0, idx)}\n\n${tip}${text.slice(idx)}` : `${text.replace(/\s+$/, "")}\n\n${tip}`
  }
  return text
}
