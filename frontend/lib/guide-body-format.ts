import { marked } from "marked"

let markedReady = false
function ensureMarked() {
  if (markedReady) return
  marked.use({ gfm: true, breaks: true })
  markedReady = true
}

/** Heuristic: CKEditor / stored HTML vs legacy Markdown/plain text */
export function looksLikeGuideHtml(s: string): boolean {
  const t = s.trimStart()
  if (!t.startsWith("<")) return false
  return /^<[a-z][\s\S]*>/i.test(t)
}

export function normalizeGuideDescription(input: unknown): string {
  if (typeof input !== "string") return ""
  let s = input.replace(/\r\n/g, "\n").replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n")
  if (looksLikeGuideHtml(s)) return s
  return s.replace(/<br\s*\/?>/gi, "\n")
}

/** Load legacy Markdown into CKEditor (Classic outputs HTML on save). */
export function guideMarkdownToHtml(md: string): string {
  if (!md.trim()) return ""
  ensureMarked()
  return String(marked.parse(md) || "").trim()
}
