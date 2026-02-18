export type CitationReference = {
  id?: string
  type: string
  author?: string
  title?: string
  year?: string
  journal?: string
  volume?: string
  pages?: string
  publisher?: string
  doi?: string
  url?: string
  booktitle?: string
  edition?: string
  [key: string]: string | undefined
}

/** Trích giá trị từ chuỗi BibTeX: author = {value} hoặc author = "value" */
function extractBibTeXValue(text: string, key: string): string | undefined {
  const re = new RegExp(`${key}\\s*=\\s*[{"]([^}"]*)["}]`, "i")
  const m = text.match(re)
  return m ? m[1].trim().replace(/\s+/g, " ") : undefined
}

/** Parse chuỗi BibTeX thành CitationReference */
export function parseBibTeX(text: string): CitationReference | null {
  const t = text.trim()
  if (!t) return null
  const match = t.match(/@(\w+)\s*\{[^,]*,\s*([\s\S]*)\}/)
  if (!match) return null
  const typeStr = (match[1] || "misc").toLowerCase()
  const body = match[2] || ""
  const typeMap: Record<string, string> = {
    article: "article",
    jour: "article",
    book: "book",
    inproceedings: "inproceedings",
    conference: "inproceedings",
    misc: "misc",
  }
  const author = extractBibTeXValue(body, "author")
  const title = extractBibTeXValue(body, "title")
  const year = extractBibTeXValue(body, "year")
  const journal = extractBibTeXValue(body, "journal")
  const booktitle = extractBibTeXValue(body, "booktitle")
  const volume = extractBibTeXValue(body, "volume")
  const pages = extractBibTeXValue(body, "pages")
  const publisher = extractBibTeXValue(body, "publisher")
  const doi = extractBibTeXValue(body, "doi")
  const url = extractBibTeXValue(body, "url")
  if (!author && !title) return null
  const normalizedAuthor = author?.replace(/\s+and\s+/gi, ", ")
  return {
    type: typeMap[typeStr] ?? "misc",
    author: normalizedAuthor ?? "",
    title: title ?? "",
    year: year ?? "",
    journal: journal ?? "",
    booktitle: booktitle ?? "",
    volume: volume ?? "",
    pages: pages ?? "",
    publisher: publisher ?? "",
    doi: doi ?? "",
    url: url ?? "",
  }
}

/** Parse chuỗi EndNote (.enw) thành CitationReference */
export function parseEndNote(text: string): CitationReference | null {
  const lines = text.trim().split(/\r?\n/)
  const fields: Record<string, string[]> = {}
  for (const line of lines) {
    const m = line.match(/^%([A-Z0-9])\s+(.+)$/)
    if (m) {
      const tag = m[1]
      const val = m[2].trim()
      if (!fields[tag]) fields[tag] = []
      fields[tag].push(val)
    }
  }
  const getFirst = (tag: string) => fields[tag]?.[0] ?? ""
  const typeStr = (getFirst("0") || "Journal Article").toLowerCase()
  const typeMap: Record<string, string> = {
    "journal article": "article",
    journal: "article",
    book: "book",
    "conference proceedings": "inproceedings",
    generic: "misc",
  }
  const author = fields["A"]?.join(", ") ?? ""
  const title = getFirst("T")
  if (!author && !title) return null
  return {
    type: typeMap[typeStr] ?? "article",
    author,
    title,
    year: getFirst("D"),
    journal: getFirst("J"),
    volume: getFirst("V"),
    pages: getFirst("P"),
    publisher: getFirst("B"),
    doi: getFirst("R"),
    url: getFirst("U"),
    booktitle: getFirst("B") || undefined,
  }
}

/** Parse chuỗi RefMan/RIS (.ris) thành CitationReference */
export function parseRefMan(text: string): CitationReference | null {
  const lines = text.trim().split(/\r?\n/)
  const fields: Record<string, string[]> = {}
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9]{2})\s+-\s+(.+)$/)
    if (m) {
      const tag = m[1]
      const val = m[2].trim()
      if (!fields[tag]) fields[tag] = []
      fields[tag].push(val)
    }
  }
  const getFirst = (tag: string) => fields[tag]?.[0] ?? ""
  const typeStr = (getFirst("TY") || "JOUR").toUpperCase()
  const typeMap: Record<string, string> = {
    JOUR: "article",
    ARTICLE: "article",
    BOOK: "book",
    CONF: "inproceedings",
    CPAPER: "inproceedings",
    GEN: "misc",
  }
  const author = fields["AU"]?.join(", ") ?? ""
  const title = getFirst("TI")
  if (!author && !title) return null
  const sp = getFirst("SP")
  const ep = getFirst("EP")
  const pages = sp && ep ? `${sp}-${ep}` : sp || ep || ""
  return {
    type: typeMap[typeStr] ?? "article",
    author,
    title,
    year: getFirst("PY"),
    journal: getFirst("JO"),
    volume: getFirst("VL"),
    pages,
    publisher: getFirst("PB"),
    doi: getFirst("DO"),
    url: getFirst("UR"),
    booktitle: getFirst("T3") || undefined,
  }
}

/** Parse chuỗi RefWorks thành CitationReference */
export function parseRefWorks(text: string): CitationReference | null {
  const lines = text.trim().split(/\r?\n/)
  const fields: Record<string, string[]> = {}
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9]{2})\s+(.+)$/)
    if (m) {
      const tag = m[1]
      const val = m[2].trim()
      if (!fields[tag]) fields[tag] = []
      fields[tag].push(val)
    }
  }
  const getFirst = (tag: string) => fields[tag]?.[0] ?? ""
  const typeStr = (getFirst("RT") || "Journal Article").toLowerCase()
  const typeMap: Record<string, string> = {
    "journal article": "article",
    book: "book",
    "conference paper": "inproceedings",
    generic: "misc",
  }
  const author = fields["A1"]?.join(", ") ?? ""
  const title = getFirst("T1")
  if (!author && !title) return null
  const sp = getFirst("SP")
  const ep = getFirst("EP")
  const pages = sp && ep ? `${sp}-${ep}` : sp || ep || ""
  return {
    type: typeMap[typeStr] ?? "article",
    author,
    title,
    year: getFirst("Y1")?.slice(0, 4) ?? "",
    journal: getFirst("JF"),
    volume: getFirst("VL"),
    pages,
    publisher: getFirst("PB"),
    doi: getFirst("DO"),
    url: getFirst("UR"),
    booktitle: getFirst("T2") || undefined,
  }
}

/** Tự động phát hiện format và parse. Trả về { format, ref } hoặc null */
export function parseCitationFormat(
  text: string
): { format: "bibtex" | "endnote" | "refman" | "refworks"; ref: CitationReference } | null {
  const t = text.trim()
  if (!t) return null
  // BibTeX: có thể có nhiều entry, thử từng entry
  if (/@\w+\s*\{/.test(t)) {
    const entries = t.split(/(?=@\w+\s*\{)/).filter((s) => s.trim())
    for (const entry of entries) {
      const ref = parseBibTeX(entry.trim())
      if (ref) return { format: "bibtex", ref }
    }
    return null
  }
  if (/^%[A-Z0-9]\s+/m.test(t) || /%0\s+/.test(t)) {
    const ref = parseEndNote(t)
    if (ref) return { format: "endnote", ref }
  }
  if (/^TY\s+-\s+/m.test(t) || /^[A-Z]{2}\s+-\s+/m.test(t)) {
    const ref = parseRefMan(t)
    if (ref) return { format: "refman", ref }
  }
  if (/^RT\s+/m.test(t) && !t.includes("  - ")) {
    const ref = parseRefWorks(t)
    if (ref) return { format: "refworks", ref }
  }
  return null
}

function escapeBibTeX(str: string): string {
  return str.replace(/[{}"\\]/g, (c) => (c === "\\" ? "\\\\" : `\\${c}`))
}

export function toBibTeX(refs: CitationReference[]): string {
  return refs
    .map((r, i) => {
      const type = (r.type || "misc").toLowerCase()
      const key = `ref${i + 1}${(r.year ?? "").slice(-2)}`
      const fields: string[] = []
      if (r.author) fields.push(`  author = {${escapeBibTeX(r.author)}}`)
      if (r.title) fields.push(`  title = {${escapeBibTeX(r.title)}}`)
      if (r.year) fields.push(`  year = {${r.year}}`)
      if (r.journal) fields.push(`  journal = {${escapeBibTeX(r.journal)}}`)
      if (r.volume) fields.push(`  volume = {${r.volume}}`)
      if (r.pages) fields.push(`  pages = {${r.pages}}`)
      if (r.publisher) fields.push(`  publisher = {${escapeBibTeX(r.publisher)}}`)
      if (r.doi) fields.push(`  doi = {${r.doi}}`)
      if (r.url) fields.push(`  url = {${r.url}}`)
      if (r.booktitle) fields.push(`  booktitle = {${escapeBibTeX(r.booktitle)}}`)
      if (r.edition) fields.push(`  edition = {${r.edition}}`)
      const body = fields.join(",\n")
      return `@${type}{${key},\n${body}\n}`
    })
    .join("\n\n")
}

export function toEndNote(refs: CitationReference[]): string {
  const map: Record<string, string> = {
    author: "A",
    title: "T",
    year: "D",
    journal: "J",
    volume: "V",
    pages: "P",
    publisher: "B",
    doi: "R",
    url: "U",
    booktitle: "B",
  }
  return refs
    .map((r) => {
      const ty = (r.type || "article").toLowerCase()
      const typeMap: Record<string, string> = {
        article: "Journal Article",
        jour: "Journal Article",
        book: "Book",
        inproceedings: "Conference Proceedings",
        misc: "Generic",
      }
      const typeStr = typeMap[ty] ?? "Journal Article"
      let out = `%0 ${typeStr}\n`
      if (r.author)
        r.author
          .split(/\s+and\s+|;|,/)
          .filter(Boolean)
          .forEach((a) => (out += `%A ${a.trim()}\n`))
      if (r.title) out += `%T ${r.title}\n`
      if (r.year) out += `%D ${r.year}\n`
      if (r.journal) out += `%J ${r.journal}\n`
      if (r.volume) out += `%V ${r.volume}\n`
      if (r.pages) out += `%P ${r.pages}\n`
      if (r.publisher) out += `%B ${r.publisher}\n`
      if (r.doi) out += `%R ${r.doi}\n`
      if (r.url) out += `%U ${r.url}\n`
      if (r.booktitle && !r.journal) out += `%B ${r.booktitle}\n`
      return out + "\n"
    })
    .join("")
}

export function toRefMan(refs: CitationReference[]): string {
  const typeMap: Record<string, string> = {
    article: "JOUR",
    jour: "JOUR",
    book: "BOOK",
    inproceedings: "CONF",
    misc: "GEN",
  }
  return refs
    .map((r) => {
      const ty = (r.type || "JOUR").toLowerCase()
      let out = `TY  - ${typeMap[ty] ?? "JOUR"}\n`
      if (r.author)
        r.author
          .split(/\s+and\s+|;|,/)
          .filter(Boolean)
          .forEach((a) => (out += `AU  - ${a.trim()}\n`))
      if (r.title) out += `TI  - ${r.title}\n`
      if (r.year) out += `PY  - ${r.year}\n`
      if (r.journal) out += `JO  - ${r.journal}\n`
      if (r.volume) out += `VL  - ${r.volume}\n`
      if (r.pages) {
        const [sp, ep] = r.pages.replace(/\s/g, "").split("-")
        if (sp) out += `SP  - ${sp}\n`
        if (ep) out += `EP  - ${ep}\n`
      }
      if (r.publisher) out += `PB  - ${r.publisher}\n`
      if (r.doi) out += `DO  - ${r.doi}\n`
      if (r.url) out += `UR  - ${r.url}\n`
      if (r.booktitle) out += `T3  - ${r.booktitle}\n`
      return out + "ER  - \n"
    })
    .join("\n")
}

/** Trích họ (họ cuối) từ chuỗi tác giả - dùng cho trích dẫn in-text APA. "Abrams, Zsuzsanna I" -> "Abrams". */
function getAuthorLastName(authorStr: string): string {
  if (!authorStr?.trim()) return "n.d."
  const parts = authorStr.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean)
  const one = parts[0]!
  const commaIdx = one.indexOf(",")
  if (commaIdx >= 0) {
    const lastName = one.slice(0, commaIdx).trim()
    return lastName || one
  }
  const words = one.split(/\s+/).filter(Boolean)
  return words.length > 0 ? words[words.length - 1]! : one
}

/** Định dạng một tác giả theo APA: "Abrams, Zsuzsanna I" -> "Abrams, Z. I." */
function formatOneAuthorAPA(name: string): string {
  const s = name.trim()
  if (!s) return ""
  const commaIdx = s.indexOf(",")
  if (commaIdx >= 0) {
    const lastName = s.slice(0, commaIdx).trim()
    const firstPart = s.slice(commaIdx + 1).trim()
    const initials = firstPart
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0] + ".")
      .join(" ")
    return lastName ? `${lastName}, ${initials}`.trim() : firstPart
  }
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return s
  const last = words.pop()!
  const initials = words.map((w) => w[0] + ".").join(" ")
  return `${last}, ${initials}`
}

/** Trích dẫn in-text APA dạng trong ngoặc, đặt cuối câu: (Tác giả, Năm) */
export function formatInTextAPA(ref: CitationReference): string {
  const author = getAuthorLastName(ref.author || "")
  const year = ref.year?.trim() || "n.d."
  return `(${author}, ${year})`
}

/** Trích dẫn in-text APA dạng trong câu, tác giả đứng trước năm: Tác giả (Năm) */
export function formatInTextAPANarrative(ref: CitationReference): string {
  const author = getAuthorLastName(ref.author || "")
  const year = ref.year?.trim() || "n.d."
  return `${author} (${year})`
}

/** Trích dẫn in-text IEEE: [số] - số do vị trí trong danh sách quyết định */
export function formatInTextIEEE(_ref: CitationReference, index: number): string {
  return `[${index + 1}]`
}

/** Định dạng tài liệu tham khảo theo chuẩn APA 7 */
export function formatReferenceAPA(ref: CitationReference): string {
  const rawAuthors = (ref.author || "")
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
  const authors = rawAuthors.map((a) => formatOneAuthorAPA(a))
  const authorStr =
    authors.length === 0
      ? "N.d."
      : authors.length === 1
        ? authors[0]!
        : authors.length <= 7
          ? authors.slice(0, -1).join(", ") + ", & " + authors[authors.length - 1]
          : authors[0] + " et al."
  const year = ref.year?.trim() ? ` (${ref.year}).` : " (n.d.)."
  const title = ref.title?.trim() ? ` ${ref.title}.` : ""
  const ty = (ref.type || "").toLowerCase()

  if (ty === "article" || ty === "jour") {
    const journal = ref.journal?.trim()
    const publisher = ref.publisher?.trim()
    const vol = ref.volume?.trim()
    const pages = ref.pages?.trim()
    let rest = ""
    if (journal) {
      rest += ` *${journal}*`
      if (vol) rest += `, *${vol}*`
      if (pages) rest += `, ${pages}`
      rest += "."
    } else if (publisher) {
      rest += ` ${publisher}.`
    } else {
      if (vol) rest += ` *${vol}*`
      if (pages) rest += (rest ? ", " : " ") + pages
      if (rest) rest += "."
    }
    const doi = ref.doi?.trim()
    const url = ref.url?.trim()
    if (doi) rest += ` https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    else if (url && !publisher) rest += ` ${url}`
    return `${authorStr}${year}${title}${rest}`.trim()
  }

  if (ty === "book") {
    const pub = ref.publisher?.trim()
    const rest = pub ? ` ${pub}.` : ""
    const doi = ref.doi?.trim()
    const url = ref.url?.trim()
    let end = ""
    if (doi) end = ` https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    else if (url) end = ` ${url}`
    return `${authorStr}${year}${title}${rest}${end}`.trim()
  }

  if (ty === "inproceedings") {
    const conf = ref.booktitle || ref.journal || ""
    const rest = conf ? ` In *${conf.trim()}*.` : ""
    const doi = ref.doi?.trim()
    const url = ref.url?.trim()
    let end = ""
    if (doi) end = ` https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    else if (url) end = ` ${url}`
    return `${authorStr}${year}${title}${rest}${end}`.trim()
  }

  return `${authorStr}${year}${title}`.trim()
}

/** Định dạng tài liệu tham khảo theo chuẩn IEEE */
export function formatReferenceIEEE(ref: CitationReference, index: number): string {
  const authors = (ref.author || "")
    .split(/\s+and\s+|;|,/)
    .map((s) => s.trim())
    .filter(Boolean)
  const authorStr =
    authors.length === 0
      ? "N.d."
      : authors
          .map((a) => {
            const words = a.split(/\s+/)
            if (words.length <= 1) return a
            const last = words.pop()!
            const initials = words.map((w) => w[0]).join(". ") + "."
            return `${last}, ${initials}`
          })
          .join(", ")
  const title = ref.title?.trim() ? `"${ref.title}",` : ""
  const ty = (ref.type || "").toLowerCase()
  const year = ref.year?.trim() || "n.d."

  if (ty === "article" || ty === "jour") {
    const journal = ref.journal?.trim()
    const vol = ref.volume?.trim()
    const pages = ref.pages?.trim()
    let rest = journal ? ` *${journal}*` : ""
    if (vol) rest += `, vol. ${vol}`
    if (pages) rest += `, pp. ${pages}`
    rest += `, ${year}.`
    const doi = ref.doi?.trim()
    if (doi) rest += ` doi: ${doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    return `[${index + 1}] ${authorStr}, ${title} ${rest}`.trim()
  }

  if (ty === "book") {
    const pub = ref.publisher?.trim()
    const rest = pub ? ` ${pub}, ${year}.` : ` ${year}.`
    const doi = ref.doi?.trim()
    let end = ""
    if (doi) end = ` doi: ${doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    return `[${index + 1}] ${authorStr}, ${title} ${rest}${end}`.trim()
  }

  if (ty === "inproceedings") {
    const conf = ref.booktitle || ref.journal || ""
    const rest = conf ? ` in *${conf}*, ${year}.` : ` ${year}.`
    const doi = ref.doi?.trim()
    let end = ""
    if (doi) end = ` doi: ${doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    return `[${index + 1}] ${authorStr}, ${title} ${rest}${end}`.trim()
  }

  return `[${index + 1}] ${authorStr}, ${title} ${year}.`.trim()
}

/** Danh sách TLTK định dạng APA (plain text) */
export function toReferenceListAPA(refs: CitationReference[]): string {
  return refs.map((r) => formatReferenceAPA(r)).join("\n\n")
}

/** Danh sách TLTK định dạng IEEE (plain text) */
export function toReferenceListIEEE(refs: CitationReference[]): string {
  return refs.map((r, i) => formatReferenceIEEE(r, i)).join("\n\n")
}

/** Chuyển *text* thành <em>text</em> cho HTML */
export function markdownItalicsToHtml(text: string): string {
  return text.replace(/\*([^*]+)\*/g, "<em>$1</em>")
}

export function toRefWorks(refs: CitationReference[]): string {
  const typeMap: Record<string, string> = {
    article: "Journal Article",
    jour: "Journal Article",
    book: "Book",
    inproceedings: "Conference Paper",
    misc: "Generic",
  }
  return refs
    .map((r) => {
      const ty = (r.type || "Journal Article").toLowerCase()
      let out = `RT ${typeMap[ty] ?? "Journal Article"}\n`
      if (r.author)
        r.author
          .split(/\s+and\s+|;|,/)
          .filter(Boolean)
          .forEach((a) => (out += `A1 ${a.trim()}\n`))
      if (r.title) out += `T1 ${r.title}\n`
      if (r.year) out += `Y1 ${r.year}\n`
      if (r.journal) out += `JF ${r.journal}\n`
      if (r.volume) out += `VL ${r.volume}\n`
      if (r.pages) {
        const [sp, ep] = r.pages.replace(/\s/g, "").split("-")
        if (sp) out += `SP ${sp}\n`
        if (ep) out += `EP ${ep}\n`
      }
      if (r.publisher) out += `PB ${r.publisher}\n`
      if (r.doi) out += `DO ${r.doi}\n`
      if (r.url) out += `UR ${r.url}\n`
      if (r.booktitle) out += `T2 ${r.booktitle}\n`
      return out + "\n"
    })
    .join("")
}

/** Chuẩn hóa chuỗi để so sánh (lowercase, trim, gộp khoảng trắng). */
function norm(s: string | undefined): string {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, " ")
}

/**
 * Tìm các nhóm tài liệu tham khảo trùng lặp (cùng author + year + title sau chuẩn hóa).
 * Trả về danh sách nhóm: mỗi nhóm là mảng chỉ số (indices) của các ref trùng nhau.
 */
export function findDuplicateReferences(refs: CitationReference[]): number[][] {
  const key = (r: CitationReference) => `${norm(r.author)}|${norm(r.year)}|${norm(r.title)}`
  const byKey = new Map<string, number[]>()
  refs.forEach((r, i) => {
    const k = key(r)
    if (!k.replace(/\|/g, "")) return
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(i)
  })
  return Array.from(byKey.values()).filter((group) => group.length > 1)
}
