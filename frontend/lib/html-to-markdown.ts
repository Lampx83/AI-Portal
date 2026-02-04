/**
 * Chuyển đổi HTML sang Markdown cho export tài liệu.
 */

function processInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || "").replace(/\n/g, " ")
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ""
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const inner = Array.from(el.childNodes)
    .map((n) => processInline(n))
    .join("")
  if (tag === "b" || tag === "strong") return `**${inner}**`
  if (tag === "i" || tag === "em") return `*${inner}*`
  if (tag === "u") return `<u>${inner}</u>`
  if (tag === "s" || tag === "strike" || tag === "del") return `~~${inner}~~`
  if (tag === "sup") return `<sup>${inner}</sup>`
  if (tag === "sub") return `<sub>${inner}</sub>`
  if (tag === "code") return "`" + inner + "`"
  if (tag === "a") {
    const href = (el as HTMLAnchorElement).getAttribute("href") ?? ""
    return href ? `[${inner}](${href})` : inner
  }
  if (tag === "br") return "\n"
  return inner
}

function getImageSrc(el: HTMLElement): { src: string; alt: string } | null {
  const img = el.querySelector("img") ?? (el.tagName === "IMG" ? el : null)
  if (!img) return null
  const src = (img as HTMLImageElement).getAttribute("src")
  if (!src) return null
  const alt = (img as HTMLImageElement).getAttribute("alt") ?? ""
  return { src, alt }
}

function processBlock(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent || "").trim().replace(/\n+/g, " ")
    if (t) out.push(t)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  if (tag === "h1") {
    const t = processInline(el).trim()
    if (t) out.push(`# ${t}`, "")
  } else if (tag === "h2") {
    const t = processInline(el).trim()
    if (t) out.push(`## ${t}`, "")
  } else if (tag === "h3") {
    const t = processInline(el).trim()
    if (t) out.push(`### ${t}`, "")
  } else if (tag === "p") {
    const parts: string[] = []
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const child = n as HTMLElement
        if (child.classList?.contains("editor-resizable-img")) {
          const img = getImageSrc(child)
          if (img) parts.push(`![${img.alt}](${img.src})`)
        } else {
          parts.push(processInline(n))
        }
      } else if (n.nodeType === Node.TEXT_NODE) {
        const t = (n.textContent || "").replace(/\n+/g, " ")
        if (t) parts.push(t)
      }
    })
    const text = parts.join(" ").trim()
    if (text) out.push(text, "")
  } else if (tag === "blockquote") {
    const sub: string[] = []
    el.childNodes.forEach((n) => processBlock(n, sub))
    sub
      .filter((s) => s?.trim())
      .forEach((line) => {
        out.push(line.split("\n").map((l) => "> " + l).join("\n"))
      })
    out.push("")
  } else if (tag === "ul") {
    Array.from(el.children)
      .filter((c) => c.tagName === "LI")
      .forEach((li) => {
        const inner = Array.from(li.childNodes)
          .map((n) => (n.nodeType === Node.TEXT_NODE ? (n as Text).textContent : processInline(n)))
          .join("")
          .trim()
        out.push(`- ${inner}`)
      })
    out.push("")
  } else if (tag === "ol") {
    Array.from(el.children)
      .filter((c) => c.tagName === "LI")
      .forEach((li, idx) => {
        const inner = Array.from(li.childNodes)
          .map((n) => (n.nodeType === Node.TEXT_NODE ? (n as Text).textContent : processInline(n)))
          .join("")
          .trim()
        out.push(`${idx + 1}. ${inner}`)
      })
    out.push("")
  } else if (tag === "table") {
    const rows = el.querySelectorAll("tr")
    if (rows.length > 0) {
      const cells = Array.from(rows[0]!.querySelectorAll("th, td"))
      const colCount = cells.length
      out.push("| " + Array.from(cells).map((c) => (c as HTMLElement).innerText.replace(/\|/g, "\\|").replace(/\n/g, " ").trim()).join(" | ") + " |")
      out.push("|" + Array(colCount).fill("---").join("|") + "|")
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i]!.querySelectorAll("th, td")
        out.push("| " + Array.from(cells).map((c) => (c as HTMLElement).innerText.replace(/\|/g, "\\|").replace(/\n/g, " ").trim()).join(" | ") + " |")
      }
      out.push("")
    }
  } else if (tag === "hr") {
    out.push("---", "")
  } else if (el.classList?.contains("editor-resizable-img")) {
    const img = getImageSrc(el)
    if (img) {
      out.push(`![${img.alt}](${img.src})`, "")
    }
  } else if (tag === "img") {
    const src = (el as HTMLImageElement).getAttribute("src")
    const alt = (el as HTMLImageElement).getAttribute("alt") ?? ""
    if (src) out.push(`![${alt}](${src})`, "")
  } else {
    el.childNodes.forEach((n) => processBlock(n, out))
  }
}

export function htmlToMarkdown(html: string, title: string): string {
  const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null
  const wrapped = html.trim().startsWith("<") ? html : `<p>${html}</p>`
  const doc = parser ? parser.parseFromString(`<!DOCTYPE html><html><body>${wrapped}</body></html>`, "text/html") : null

  if (!doc?.body) {
    return `# ${title}\n\n${html.replace(/<[^>]+>/g, "")}`
  }

  const out: string[] = []
  out.push(`# ${title.replace(/\n/g, " ")}`, "")

  doc.body.childNodes.forEach((n) => processBlock(n, out))

  // Clean up blockquote - the logic above was wrong. Let me simplify blockquote.
  return out
    .filter((s) => s !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
