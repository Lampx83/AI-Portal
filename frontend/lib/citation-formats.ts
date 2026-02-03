import type { CitationReference } from "@/lib/api/write-articles"

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

/** Trích họ (họ cuối) từ chuỗi tác giả - dùng cho trích dẫn in-text APA */
function getAuthorLastName(authorStr: string): string {
  if (!authorStr?.trim()) return "n.d."
  const parts = authorStr.split(/[,;]|\s+and\s+/).map((s) => s.trim()).filter(Boolean)
  const last = parts[parts.length - 1]
  if (!last) return "n.d."
  const words = last.split(/\s+/)
  return words[words.length - 1] || last
}

/** Trích dẫn in-text APA: (Tác giả, Năm) */
export function formatInTextAPA(ref: CitationReference): string {
  const author = getAuthorLastName(ref.author || "")
  const year = ref.year?.trim() || "n.d."
  return `(${author}, ${year})`
}

/** Trích dẫn in-text IEEE: [số] - số do vị trí trong danh sách quyết định */
export function formatInTextIEEE(_ref: CitationReference, index: number): string {
  return `[${index + 1}]`
}

/** Định dạng tài liệu tham khảo theo chuẩn APA 7 */
export function formatReferenceAPA(ref: CitationReference): string {
  const authors = (ref.author || "")
    .split(/\s+and\s+|;|,/)
    .map((s) => s.trim())
    .filter(Boolean)
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
    const vol = ref.volume?.trim()
    const pages = ref.pages?.trim()
    let rest = ""
    if (journal) rest += ` *${journal}*`
    if (vol) rest += `, *${vol}*`
    if (pages) rest += `, ${pages}`
    if (rest) rest += "."
    const doi = ref.doi?.trim()
    const url = ref.url?.trim()
    if (doi) rest += ` https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    else if (url) rest += ` ${url}`
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
