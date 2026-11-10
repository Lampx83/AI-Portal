/**
 * Tìm kiếm trong toàn thư mục dự án (0.3.0) — dùng chung cho giao diện («Tìm trong thư mục») và trợ lý
 * (find_files, search_text).
 *
 * - Duyệt theo chiều rộng bằng fs.promises (không chặn tiến trình chính), nhường vòng lặp sự kiện định kỳ.
 * - Bỏ qua tệp/thư mục ẩn, thư mục rác (node_modules, venv, __pycache__…), không đi theo symlink thư mục
 *   (tránh vòng lặp và thoát ra ngoài), symlink tệp chỉ khi đích nằm trong thư mục dự án.
 * - So khớp không phân biệt hoa/thường và DẤU tiếng Việt («bao cao» khớp «Báo cáo»), chuẩn hoá Unicode NFC/NFD
 *   (tên tệp trên macOS có thể ở dạng NFD).
 * - Nội dung: văn bản thô + trích từ .docx/.xlsx/.pptx/.pdf/.odt/.ipynb; có bộ đệm theo (đường dẫn, cỡ, mtime).
 * - Giới hạn: số mục duyệt, số tệp đọc nội dung, kích thước tệp, thời gian; huỷ được bằng AbortSignal.
 *
 * Không phụ thuộc Electron — kiểm thử đơn vị được.
 */
import fs from "fs"
import path from "path"
import type { SearchHit, SearchMatch, SearchOptions, SearchResult } from "../shared/api"
import { extOf, IMAGE_MIME, isIgnoredName, isIgnoredRelPath, isJunkDirName } from "./fileTypes"
import { isInside, resolveInside } from "./pathGuard"
import { readForAgent } from "./agent/extract"
import { EXTRACT_EXTENSIONS, TEXT_EXTENSIONS } from "./agent/writePolicy"

export const SEARCH_LIMITS = {
  /** Số mục (tệp + thư mục) tối đa duyệt mỗi lần tìm. */
  maxEntries: 60_000,
  maxDepth: 20,
  /** Số tệp tối đa đọc nội dung. */
  maxContentFiles: 4000,
  /** Tệp văn bản thô lớn hơn thì bỏ qua khi tìm nội dung. */
  maxTextBytes: 4 * 1024 * 1024,
  /** Tệp docx/xlsx/pptx/pdf lớn hơn thì bỏ qua khi tìm nội dung. */
  maxExtractBytes: 20 * 1024 * 1024,
  timeMs: 12_000,
  defaultHits: 100,
  maxHits: 500,
  maxMatchesPerFile: 5,
  maxLineChars: 240,
}

/** Chuẩn hoá để so khớp: NFC, bỏ dấu tiếng Việt, đ→d, chữ thường. */
export function foldText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
}

export function nfc(s: string): string {
  return s.normalize("NFC")
}

export interface WalkItem {
  name: string
  relPath: string
  absPath: string
  type: "file" | "dir"
  depth: number
  /** Thư mục rác: được liệt kê nhưng không duyệt vào trong. */
  junk?: boolean
}

export interface WalkOptions {
  maxEntries?: number
  maxDepth?: number
  signal?: AbortSignal
  deadline?: number
  /** Đi vào thư mục rác (mặc định không). */
  includeJunk?: boolean
}

export interface WalkStats {
  entries: number
  truncated: boolean
  timedOut: boolean
}

const tick = () => new Promise<void>((r) => setImmediate(r))

/**
 * Duyệt theo chiều rộng thư mục `startAbs` (đã qua pathGuard, nằm trong `rootReal`).
 * Gọi `visit` cho từng mục; `visit` trả về false để dừng.
 */
export async function walkFolder(
  rootReal: string,
  startAbs: string,
  startRel: string,
  visit: (it: WalkItem) => boolean | void | Promise<boolean | void>,
  opts: WalkOptions = {},
): Promise<WalkStats> {
  const maxEntries = opts.maxEntries ?? SEARCH_LIMITS.maxEntries
  const maxDepth = opts.maxDepth ?? SEARCH_LIMITS.maxDepth
  const stats: WalkStats = { entries: 0, truncated: false, timedOut: false }
  const queue: { abs: string; rel: string; depth: number }[] = [{ abs: startAbs, rel: startRel, depth: 0 }]
  let sinceTick = 0
  while (queue.length) {
    const dir = queue.shift()!
    let dirents: fs.Dirent[]
    try {
      dirents = await fs.promises.readdir(dir.abs, { withFileTypes: true })
    } catch {
      continue
    }
    dirents.sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true }))
    for (const d of dirents) {
      if (opts.signal?.aborted) return stats
      if (opts.deadline && Date.now() > opts.deadline) {
        stats.timedOut = stats.truncated = true
        return stats
      }
      if (isIgnoredName(d.name)) continue
      if (stats.entries >= maxEntries) {
        stats.truncated = true
        return stats
      }
      const abs = path.join(dir.abs, d.name)
      const rel = dir.rel ? `${dir.rel}/${d.name}` : d.name
      let type: "file" | "dir" | null = d.isDirectory() ? "dir" : d.isFile() ? "file" : null
      let followable = type === "dir"
      if (d.isSymbolicLink()) {
        // Symlink: chỉ khi đích trong thư mục dự án; không đi vào thư mục qua symlink (chống vòng lặp).
        try {
          const real = await fs.promises.realpath(abs)
          if (!isInside(rootReal, real)) continue
          const st = await fs.promises.stat(real)
          type = st.isDirectory() ? "dir" : st.isFile() ? "file" : null
          followable = false
        } catch {
          continue
        }
      }
      if (!type) continue
      stats.entries++
      const junk = type === "dir" && isJunkDirName(d.name)
      const r = await visit({ name: d.name, relPath: rel, absPath: abs, type, depth: dir.depth + 1, ...(junk ? { junk } : {}) })
      if (r === false) return stats
      if (type === "dir" && followable && (!junk || opts.includeJunk) && dir.depth + 1 < maxDepth) queue.push({ abs, rel, depth: dir.depth + 1 })
      if (++sinceTick >= 200) {
        sinceTick = 0
        await tick()
      }
    }
  }
  return stats
}

/** Bộ đệm văn bản đã trích (LRU theo tổng số ký tự). Khoá: đường dẫn + cỡ + mtime ⇒ tệp sửa là tự hết hạn. */
export class TextCache {
  private map = new Map<string, { key: string; text: string }>()
  private chars = 0
  constructor(private readonly budgetChars = 40_000_000) {}

  get(abs: string, size: number, mtimeMs: number): string | undefined {
    const hit = this.map.get(abs)
    if (!hit || hit.key !== `${size}:${mtimeMs}`) return undefined
    this.map.delete(abs)
    this.map.set(abs, hit)
    return hit.text
  }

  set(abs: string, size: number, mtimeMs: number, text: string): void {
    this.delete(abs)
    if (text.length > this.budgetChars / 4) return
    this.map.set(abs, { key: `${size}:${mtimeMs}`, text })
    this.chars += text.length
    while (this.chars > this.budgetChars) {
      const first = this.map.keys().next().value as string | undefined
      if (first === undefined) break
      this.delete(first)
    }
  }

  delete(abs: string): void {
    const hit = this.map.get(abs)
    if (!hit) return
    this.chars -= hit.text.length
    this.map.delete(abs)
  }

  /** Xoá mục thuộc thư mục `dirAbs` (khi theo dõi thấy thay đổi). */
  invalidateUnder(dirAbs: string): void {
    for (const k of [...this.map.keys()]) if (k === dirAbs || k.startsWith(dirAbs + path.sep)) this.delete(k)
  }

  get size(): number {
    return this.map.size
  }
}

function globToRegExp(glob: string, flags: string): RegExp {
  let re = ""
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*"
        i++
        if (glob[i + 1] === "/") i++
      } else re += "[^/]*"
    } else if (c === "?") re += "[^/]"
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`^${re}$`, flags)
}

export interface Matcher {
  name: (name: string, relPath: string) => boolean
  line: (line: string) => boolean
}

/** Tạo bộ so khớp tên + dòng nội dung từ truy vấn người dùng/trợ lý. */
export function buildMatcher(query: string, opts: { regex?: boolean; caseSensitive?: boolean } = {}): Matcher {
  const q = nfc(query.trim())
  if (!q) throw new Error("Cần nội dung tìm kiếm")
  if (q.length > 300) throw new Error("Truy vấn quá dài")
  const cs = opts.caseSensitive === true
  const prep = (s: string) => (cs ? nfc(s) : foldText(s))
  if (opts.regex) {
    let re: RegExp
    try {
      re = new RegExp(q, cs ? "u" : "iu")
    } catch {
      throw new Error("Biểu thức chính quy không hợp lệ")
    }
    return { name: (n) => re.test(nfc(n)), line: (l) => re.test(nfc(l)) }
  }
  if (/[*?]/.test(q)) {
    // Mẫu kiểu glob («*.pdf», «chuong-?/*.docx», «**/hinh*.png») — chỉ áp cho tên/đường dẫn.
    const g = globToRegExp(prep(q), "")
    const byPath = q.includes("/")
    const plain = prep(q.replace(/[*?]/g, " ")).split(/\s+/).filter(Boolean)
    return {
      name: (n, rel) => g.test(prep(byPath ? rel : n)),
      line: (l) => plain.length > 0 && plain.every((p) => prep(l).includes(p)),
    }
  }
  const phrase = prep(q)
  const tokens = phrase.split(/\s+/).filter(Boolean)
  return {
    // Tên: mọi từ đều xuất hiện (không cần đúng thứ tự). Có «/» thì so trên cả đường dẫn.
    name: (n, rel) => {
      const target = prep(q.includes("/") ? rel : n)
      return tokens.every((t) => target.includes(t))
    },
    // Nội dung: đúng cụm từ.
    line: (l) => prep(l).includes(phrase),
  }
}

export function canSearchContent(ext: string, size: number): boolean {
  if (IMAGE_MIME[ext]) return false
  if (TEXT_EXTENSIONS.has(ext)) return size <= SEARCH_LIMITS.maxTextBytes
  if (EXTRACT_EXTENSIONS.has(ext)) return size <= SEARCH_LIMITS.maxExtractBytes
  return false
}

export interface SearchRunOptions extends SearchOptions {
  signal?: AbortSignal
  timeMs?: number
  maxEntries?: number
  maxContentFiles?: number
  maxMatchesPerFile?: number
}

export class FolderSearch {
  constructor(readonly cache: TextCache = new TextCache()) {}

  private async contentOf(abs: string, relPath: string, size: number, mtimeMs: number): Promise<string> {
    const hit = this.cache.get(abs, size, mtimeMs)
    if (hit !== undefined) return hit
    const c = await readForAgent(abs, relPath)
    this.cache.set(abs, size, mtimeMs, c.text)
    return c.text
  }

  /**
   * @param rootReal thư mục dự án (realpath)
   */
  async search(rootReal: string, query: string, o: SearchRunOptions = {}): Promise<SearchResult> {
    const t0 = Date.now()
    const mode = o.mode ?? "all"
    const matcher = buildMatcher(query, o)
    const limit = Math.max(1, Math.min(SEARCH_LIMITS.maxHits, Math.floor(o.limit ?? SEARCH_LIMITS.defaultHits)))
    const maxContentFiles = o.maxContentFiles ?? SEARCH_LIMITS.maxContentFiles
    const maxMatches = o.maxMatchesPerFile ?? SEARCH_LIMITS.maxMatchesPerFile
    const exts = o.exts?.length ? new Set(o.exts.map((e) => String(e).toLowerCase().replace(/^\./, ""))) : null
    const start = resolveInside(rootReal, o.subPath ?? "")
    if (start.relPath && isIgnoredRelPath(start.relPath)) throw new Error("Không tìm trong tệp/thư mục ẩn")
    if (!fs.statSync(start.absPath).isDirectory()) throw new Error("Phạm vi tìm phải là thư mục")
    const deadline = t0 + (o.timeMs ?? SEARCH_LIMITS.timeMs)
    const nameHits: SearchHit[] = []
    const contentHits: SearchHit[] = []
    let scannedFiles = 0
    let skippedFiles = 0
    let contentStopped = false
    const total = () => nameHits.length + contentHits.length

    const stats = await walkFolder(
      rootReal,
      start.absPath,
      start.relPath,
      async (it) => {
        if (total() >= limit) return false
        const ext = it.type === "file" ? extOf(it.name) : ""
        if (exts && (it.type === "dir" || !exts.has(ext))) return
        const nameMatch = mode !== "content" && matcher.name(it.name, it.relPath)
        let matches: SearchMatch[] = []
        let st: fs.Stats | null = null
        const statOnce = async () => (st ??= await fs.promises.stat(it.absPath).catch(() => null))
        if (mode !== "name" && it.type === "file" && !contentStopped) {
          const s = await statOnce()
          if (s && canSearchContent(ext, s.size)) {
            if (scannedFiles >= maxContentFiles) contentStopped = true
            else {
              scannedFiles++
              try {
                const text = await this.contentOf(it.absPath, it.relPath, s.size, Math.round(s.mtimeMs))
                const lines = text.split("\n")
                for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
                  const line = lines[i].length > 4000 ? lines[i].slice(0, 4000) : lines[i]
                  if (matcher.line(line)) matches.push({ line: i + 1, text: nfc(line.trim()).slice(0, SEARCH_LIMITS.maxLineChars) })
                }
              } catch {
                skippedFiles++
              }
            }
          } else if (s && !IMAGE_MIME[ext] && (TEXT_EXTENSIONS.has(ext) || EXTRACT_EXTENSIONS.has(ext))) skippedFiles++
        }
        if (!nameMatch && matches.length === 0) return
        const s = await statOnce()
        const hit: SearchHit = {
          name: it.name,
          relPath: it.relPath,
          type: it.type,
          size: it.type === "file" ? (s?.size ?? 0) : 0,
          mtimeMs: Math.round(s?.mtimeMs ?? 0),
          ext,
          nameMatch,
          matches,
        }
        ;(nameMatch ? nameHits : contentHits).push(hit)
        if (total() >= limit) return false
      },
      { signal: o.signal, deadline, maxEntries: o.maxEntries },
    )
    return {
      query,
      hits: [...nameHits, ...contentHits],
      scannedEntries: stats.entries,
      scannedFiles,
      truncated: stats.truncated || total() >= limit || contentStopped,
      timedOut: stats.timedOut,
      skippedFiles,
      elapsedMs: Date.now() - t0,
      ...(o.signal?.aborted ? { cancelled: true } : {}),
    }
  }

  /** Thống kê nhanh thư mục (cho phần tổng quan của trợ lý). */
  async stats(rootReal: string, opts: { maxEntries?: number; timeMs?: number } = {}): Promise<{ files: number; dirs: number; byExt: [string, number][]; truncated: boolean; junkDirs: string[] }> {
    let files = 0
    let dirs = 0
    const byExt = new Map<string, number>()
    const junkDirs: string[] = []
    const st = await walkFolder(
      rootReal,
      rootReal,
      "",
      (it) => {
        if (it.type === "dir") {
          dirs++
          if (it.junk && junkDirs.length < 10) junkDirs.push(it.relPath)
        } else {
          files++
          const e = extOf(it.name) || "(không đuôi)"
          byExt.set(e, (byExt.get(e) ?? 0) + 1)
        }
      },
      { maxEntries: opts.maxEntries ?? 20_000, deadline: Date.now() + (opts.timeMs ?? 1500) },
    )
    return { files, dirs, byExt: [...byExt.entries()].sort((a, b) => b[1] - a[1]), truncated: st.truncated, junkDirs }
  }
}
