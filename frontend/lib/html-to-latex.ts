/**
 * Chuyển đổi HTML sang LaTeX cho export tài liệu.
 */

const LATEX_SPECIAL = /[\\{}#$%&_~^]/g

function escapeLatex(text: string): string {
  return text.replace(LATEX_SPECIAL, (c) => {
    if (c === "\\") return "\\textbackslash{}"
    if (c === "{") return "\\{"
    if (c === "}") return "\\}"
    if (c === "#") return "\\#"
    if (c === "$") return "\\$"
    if (c === "%") return "\\%"
    if (c === "&") return "\\&"
    if (c === "_") return "\\_"
    if (c === "~") return "\\textasciitilde{}"
    if (c === "^") return "\\textasciicircum{}"
    return c
  })
}

function processInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeLatex(node.textContent || "")
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ""
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  let inner = Array.from(el.childNodes)
    .map((n) => processInline(n))
    .join("")
  if (tag === "b" || tag === "strong") return `\\textbf{${inner}}`
  if (tag === "i" || tag === "em") return `\\textit{${inner}}`
  if (tag === "u") return `\\underline{${inner}}`
  if (tag === "s" || tag === "strike" || tag === "del") return `\\sout{${inner}}`
  if (tag === "sup") return `\\textsuperscript{${inner}}`
  if (tag === "sub") return `\\textsubscript{${inner}}`
  if (tag === "br") return " \\\\ "
  return inner
}

function getImageSrc(el: HTMLElement): string | null {
  const img = el.querySelector("img") ?? (el.tagName === "IMG" ? el : null)
  if (!img) return null
  return (img as HTMLImageElement).getAttribute("src")
}

function processBlock(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent || "").trim()
    if (t) out.push(escapeLatex(t))
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  if (tag === "h1") {
    const t = processInline(el)
    if (t) out.push(`\\section{${t}}`, "")
  } else if (tag === "h2") {
    const t = processInline(el)
    if (t) out.push(`\\subsection{${t}}`, "")
  } else if (tag === "h3") {
    const t = processInline(el)
    if (t) out.push(`\\subsubsection{${t}}`, "")
  } else if (tag === "p") {
    const parts: string[] = []
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const child = n as HTMLElement
        if (child.classList?.contains("editor-resizable-img")) {
          const src = getImageSrc(child)
          if (src) {
            if (src.startsWith("data:")) {
              parts.push("% [Image - data URL: save separately and add \\includegraphics{filename}]")
            } else {
              const match = src.match(/\/([^/?#]+\.(png|jpg|jpeg|gif|pdf))$/i)
              const fname = match ? match[1] : "image.png"
              parts.push(`% Source: ${src}`)
              parts.push(`\\includegraphics[width=0.8\\linewidth]{${fname}}`)
            }
          }
        } else {
          parts.push(processInline(n))
        }
      } else if (n.nodeType === Node.TEXT_NODE) {
        const t = (n.textContent || "").trim()
        if (t) parts.push(escapeLatex(t))
      }
    })
    const text = parts.join(" ")
    if (text.trim()) out.push(text, "")
  } else if (tag === "blockquote") {
    out.push("\\begin{quote}")
    el.childNodes.forEach((n) => processBlock(n, out))
    out.push("\\end{quote}", "")
  } else if (tag === "ul") {
    out.push("\\begin{itemize}")
    Array.from(el.children)
      .filter((c) => c.tagName === "LI")
      .forEach((li) => {
        const inner = Array.from(li.childNodes)
          .map((n) => (n.nodeType === Node.TEXT_NODE ? escapeLatex((n as Text).textContent || "") : processInline(n)))
          .join("")
        out.push(`  \\item ${inner}`)
      })
    out.push("\\end{itemize}", "")
  } else if (tag === "ol") {
    out.push("\\begin{enumerate}")
    Array.from(el.children)
      .filter((c) => c.tagName === "LI")
      .forEach((li) => {
        const inner = Array.from(li.childNodes)
          .map((n) => (n.nodeType === Node.TEXT_NODE ? escapeLatex((n as Text).textContent || "") : processInline(n)))
          .join("")
        out.push(`  \\item ${inner}`)
      })
    out.push("\\end{enumerate}", "")
  } else if (tag === "table") {
    const rows = el.querySelectorAll("tr")
    const colCount = Math.max(1, rows[0]?.querySelectorAll("th, td").length ?? 1)
    const colSpec = "l".repeat(colCount)
    out.push("\\begin{table}[htbp]")
    out.push("\\centering")
    out.push(`\\begin{tabular}{|${colSpec}|}`)
    out.push("\\hline")
    rows.forEach((tr, i) => {
      const cells = tr.querySelectorAll("th, td")
      const cellTexts = Array.from(cells).map((c) =>
        escapeLatex((c as HTMLElement).innerText.replace(/\s+/g, " ").trim())
      )
      out.push(cellTexts.join(" & ") + " \\\\")
      out.push("\\hline")
    })
    out.push("\\end{tabular}")
    out.push("\\end{table}", "")
  } else if (tag === "hr") {
    out.push("\\noindent\\rule{\\linewidth}{0.4pt}", "")
  } else if (el.classList?.contains("editor-resizable-img")) {
    const src = getImageSrc(el)
    if (src) {
      if (src.startsWith("data:")) {
        out.push("% [Image - data URL: save separately and add \\includegraphics{filename}]")
      } else {
        const match = src.match(/\/([^/?#]+\.(png|jpg|jpeg|gif|pdf))$/i)
        const fname = match ? match[1] : "image.png"
        out.push(`% Source: ${src}`)
        out.push(`\\includegraphics[width=0.8\\linewidth]{${fname}}`)
      }
      out.push("")
    }
  } else if (tag === "img") {
    const src = (el as HTMLImageElement).getAttribute("src")
    if (src) {
      if (src.startsWith("data:")) {
        out.push("% [Image - data URL: save separately]")
      } else {
        const match = src.match(/\/([^/?#]+\.(png|jpg|jpeg|gif|pdf))$/i)
        const fname = match ? match[1] : "image.png"
        out.push(`\\includegraphics[width=0.8\\linewidth]{${fname}}`)
      }
      out.push("")
    }
  } else {
    el.childNodes.forEach((n) => processBlock(n, out))
  }
}

export function htmlToLatex(html: string, title: string): string {
  const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null
  const wrapped = html.trim().startsWith("<") ? html : `<p>${escapeLatex(html)}</p>`
  const doc = parser ? parser.parseFromString(`<!DOCTYPE html><html><body>${wrapped}</body></html>`, "text/html") : null
  if (!doc?.body) {
    return `% Fallback: raw HTML not parsed\n\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T5]{fontenc}\n\\usepackage{vietnam}\n\\usepackage{graphicx}\n\\usepackage{booktabs}\n\\usepackage{ulem}\n\\title{${escapeLatex(title)}}\n\\begin{document}\n\\maketitle\n% Content could not be parsed.\n\\end{document}`
  }

  const out: string[] = []
  out.push("\\documentclass{article}")
  out.push("\\usepackage[utf8]{inputenc}")
  out.push("\\usepackage[T5]{fontenc}")
  out.push("\\usepackage{vietnam}")
  out.push("\\usepackage{graphicx}")
  out.push("\\usepackage{booktabs}")
  out.push("\\usepackage{ulem}")
  out.push("")
  out.push(`\\title{${escapeLatex(title)}}`)
  out.push("\\begin{document}")
  out.push("\\maketitle")
  out.push("")

  doc.body.childNodes.forEach((n) => processBlock(n, out))

  out.push("\\end{document}")
  return out.join("\n")
}
