/**
 * Công cụ của trợ lý thư mục — chạy trong tiến trình chính, chỉ trong thư mục dự án đã liên kết.
 * Đọc: list_files, read_file, search_text. Ghi (CHỈ ĐỀ XUẤT): write_file, edit_file, rename_file, delete_file.
 * Không có công cụ chạy lệnh/chương trình.
 */
import path from "path"
import { extOf } from "../fileTypes"
import { resolveInside } from "../pathGuard"
import type { ProjectFolderService } from "../projectFolders"
import type { ChangeView, FileEntry } from "../../shared/api"
import { ChangeError, type ChangeService } from "./changes"
import { formatOf, readForAgent } from "./extract"
import type { ChatToolDef } from "./llmClient"
import { AGENT_LIMITS, readBlockedReason, TEXT_EXTENSIONS } from "./writePolicy"

export interface ToolContext {
  projectId: string
  sessionId: string
  signal?: AbortSignal
}

export interface ToolResult {
  ok: boolean
  /** Nội dung trả cho mô hình. */
  content: string
  /** Tóm tắt ngắn cho giao diện. */
  summary: string
  /** Đối tượng chính (đường dẫn) để hiển thị. */
  label: string
  change?: ChangeView
}

const WRITE_TOOLS = new Set(["write_file", "edit_file", "rename_file", "delete_file"])
export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name)
}

export const TOOL_DEFS: ChatToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and sub-folders of the linked project folder (relative paths). Hidden files are not shown.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Sub-folder relative to the project root; empty for the root" },
          depth: { type: "integer", minimum: 1, maximum: 4, description: "How many folder levels to expand (default 2)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a file as text. Supports plain text (.txt .md .csv .json .tex .bib .py .R …) and extracts text from .docx (one line per paragraph), .xlsx (CSV per sheet) and .pdf. Long files are returned in parts: use start_line/end_line.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the project root" },
          start_line: { type: "integer", minimum: 1 },
          end_line: { type: "integer", minimum: 1 },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_text",
      description: "Search text in the project's text files and .docx files. Returns matching lines as path:line: text.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to search for (plain text unless regex=true)" },
          path: { type: "string", description: "Limit to this sub-folder (optional)" },
          regex: { type: "boolean" },
          case_sensitive: { type: "boolean" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "PROPOSE creating a new file or replacing the whole content of a text file. The user reviews a diff and must accept before anything is written. Allowed types: .txt .md .csv .tsv .json .yaml .xml .tex .bib .ris .log and new .docx (lines starting with #, ##, ### become headings). For small changes to an existing file prefer edit_file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string", description: "Full new file content" },
          summary: { type: "string", description: "One short sentence describing the change, in the user's language" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "PROPOSE targeted edits to an existing text or .docx file: each old_text must be copied exactly from read_file output and match exactly one place; it is replaced by new_text. For .docx each old_text/new_text must stay within one paragraph (no newlines); formatting of untouched text is preserved. The user reviews a diff before anything is written.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: { old_text: { type: "string" }, new_text: { type: "string" } },
              required: ["old_text", "new_text"],
            },
          },
          summary: { type: "string", description: "One short sentence describing the change, in the user's language" },
        },
        required: ["path", "edits"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_file",
      description: "PROPOSE renaming or moving a file inside the project folder (user must accept).",
      parameters: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" }, summary: { type: "string" } },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "PROPOSE deleting a file (user must accept; a backup is kept for undo). Only when the user clearly asks.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, summary: { type: "string" } },
        required: ["path"],
      },
    },
  },
]

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function str(v: unknown, def = ""): string {
  return typeof v === "string" ? v : def
}

function int(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? Math.floor(n) : undefined
}

const KIND_VI: Record<string, string> = { create: "tạo tệp", modify: "sửa", delete: "xoá", rename: "đổi tên" }

export class AgentTools {
  constructor(
    private readonly folders: ProjectFolderService,
    private readonly changes: ChangeService,
  ) {}

  async execute(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolResult> {
    let args: Record<string, unknown> = {}
    try {
      const parsed = rawArgs && rawArgs.trim() ? JSON.parse(rawArgs) : {}
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>
      else throw new Error("not object")
    } catch {
      return { ok: false, content: "Lỗi: tham số công cụ không phải JSON object hợp lệ", summary: "tham số không hợp lệ", label: name }
    }
    const label = str(args.path ?? args.from ?? args.query)
    try {
      switch (name) {
        case "list_files":
          return this.listFiles(ctx, str(args.path), int(args.depth) ?? 2)
        case "read_file":
          return await this.readFile(ctx, str(args.path), int(args.start_line), int(args.end_line))
        case "search_text":
          return await this.searchText(ctx, str(args.query), str(args.path), args.regex === true, args.case_sensitive === true)
        case "write_file":
          return this.proposal(this.changes.proposeWrite(ctx.projectId, ctx.sessionId, str(args.path), args.content, str(args.summary) || undefined))
        case "edit_file":
          return this.proposal(this.changes.proposeEdit(ctx.projectId, ctx.sessionId, str(args.path), args.edits, str(args.summary) || undefined))
        case "rename_file":
          return this.proposal(this.changes.proposeRename(ctx.projectId, ctx.sessionId, str(args.from), str(args.to), str(args.summary) || undefined))
        case "delete_file":
          return this.proposal(this.changes.proposeDelete(ctx.projectId, ctx.sessionId, str(args.path), str(args.summary) || undefined))
        default:
          return { ok: false, content: `Lỗi: không có công cụ "${name}". Không chạy được lệnh hay chương trình.`, summary: "công cụ không tồn tại", label: name }
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e)
      return { ok: false, content: `Lỗi: ${msg}`, summary: msg.slice(0, 200), label }
    }
  }

  private proposal(c: ReturnType<ChangeService["proposeWrite"]>): ToolResult {
    const view = this.changes.toView(c)
    const what = c.kind === "rename" ? `đổi tên ${c.relPath} → ${c.newRelPath}` : `${KIND_VI[c.kind]} ${c.relPath}`
    const stat = c.kind === "rename" ? "" : ` (+${view.added} −${view.removed} dòng)`
    return {
      ok: true,
      content: `Đã tạo ĐỀ XUẤT ${what}${stat}. Tệp CHƯA được ghi: người dùng sẽ xem diff và bấm Chấp nhận hoặc Từ chối. Đừng nói là đã ghi xong.`,
      summary: `${what}${stat}`,
      label: c.relPath,
      change: view,
    }
  }

  private root(projectId: string): string {
    return this.folders.resolveFolder(projectId)
  }

  listFiles(ctx: ToolContext, sub: string, depth: number): ToolResult {
    const d = Math.min(4, Math.max(1, depth))
    const blocked = readBlockedReason(sub)
    if (blocked) throw new Error(blocked)
    const lines: string[] = []
    let count = 0
    let truncated = false
    const walk = (p: string, level: number) => {
      if (truncated) return
      const r = this.folders.listFiles(ctx.projectId, p)
      if (r.truncated) truncated = true
      for (const e of r.entries) {
        if (count >= AGENT_LIMITS.maxListEntries) {
          truncated = true
          return
        }
        count++
        const indent = "  ".repeat(level)
        lines.push(e.type === "dir" ? `${indent}${e.name}/` : `${indent}${e.name}  (${fmtSize(e.size)})`)
        if (e.type === "dir" && level + 1 < d) walk(e.relPath, level + 1)
      }
    }
    walk(sub, 0)
    const head = `Thư mục: ${sub || "(gốc dự án)"} — ${count} mục${truncated ? " (đã cắt bớt)" : ""}`
    return { ok: true, content: lines.length ? `${head}\n${lines.join("\n")}` : `${head}\n(trống)`, summary: `${count} mục`, label: sub || "/" }
  }

  async readFile(ctx: ToolContext, rel: string, startLine?: number, endLine?: number): Promise<ToolResult> {
    if (!rel) throw new Error("Cần path")
    const blocked = readBlockedReason(rel)
    if (blocked) throw new Error(blocked)
    const root = this.root(ctx.projectId)
    const target = resolveInside(root, rel)
    let text: string
    let note = ""
    let fmt = formatOf(target.relPath)
    let size = 0
    const pend = this.changes.pendingFor(ctx.projectId, target.relPath)
    if (pend && pend.after !== null && pend.relPath === target.relPath) {
      text = pend.after
      note = " — nội dung theo ĐỀ XUẤT đang chờ người dùng duyệt (chưa ghi lên đĩa)"
      fmt = pend.format
      size = Buffer.byteLength(text)
    } else {
      const c = await readForAgent(target.absPath, target.relPath)
      text = c.text
      size = c.size
      if (c.truncated) note = ` — tệp lớn, chỉ đọc ${fmtSize(AGENT_LIMITS.maxReadBytes)} đầu`
    }
    const all = text.split("\n")
    const total = all.length
    const from = Math.max(1, startLine ?? 1)
    let to = Math.min(total, endLine ?? total)
    if (from > total) return { ok: true, content: `Tệp ${target.relPath} chỉ có ${total} dòng.`, summary: `${total} dòng`, label: target.relPath }
    let chunk = all.slice(from - 1, to).join("\n")
    if (chunk.length > AGENT_LIMITS.maxReadChars) {
      let acc = 0
      let i = from - 1
      for (; i < to; i++) {
        acc += all[i].length + 1
        if (acc > AGENT_LIMITS.maxReadChars) break
      }
      to = Math.max(from, i)
      chunk = all.slice(from - 1, to).join("\n").slice(0, AGENT_LIMITS.maxReadChars)
    }
    const hint =
      fmt === "docx"
        ? "Định dạng .docx: mỗi dòng là một đoạn văn. Sửa bằng edit_file (mỗi old_text nằm trong một đoạn) — định dạng được giữ."
        : fmt === "pdf" || fmt === "xlsx"
          ? `Định dạng .${fmt}: chỉ đọc (văn bản trích ra), trợ lý không sửa được tệp này.`
          : ""
    const more = to < total ? `\n[… còn tiếp: dòng ${to + 1}–${total}. Gọi read_file với start_line=${to + 1} để đọc tiếp]` : ""
    const header = `Tệp: ${target.relPath} (${fmt}, ${fmtSize(size)}, ${total} dòng; đang xem dòng ${from}–${to})${note}${hint ? "\n" + hint : ""}`
    return { ok: true, content: `${header}\n-----\n${chunk}${more}`, summary: `dòng ${from}–${to}/${total}`, label: target.relPath }
  }

  async searchText(ctx: ToolContext, query: string, sub: string, regex: boolean, caseSensitive: boolean): Promise<ToolResult> {
    if (!query.trim()) throw new Error("Cần query")
    if (query.length > 200) throw new Error("query quá dài")
    const blocked = readBlockedReason(sub)
    if (blocked) throw new Error(blocked)
    let re: RegExp
    try {
      re = regex ? new RegExp(query, caseSensitive ? "" : "i") : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "" : "i")
    } catch {
      throw new Error("Biểu thức chính quy không hợp lệ")
    }
    const root = this.root(ctx.projectId)
    const results: string[] = []
    let files = 0
    let truncated = false
    const deadline = Date.now() + 8000
    const queue: string[] = [sub]
    const candidates: FileEntry[] = []
    while (queue.length && candidates.length < AGENT_LIMITS.maxSearchFiles) {
      const p = queue.shift()!
      let r
      try {
        r = this.folders.listFiles(ctx.projectId, p)
      } catch {
        continue
      }
      for (const e of r.entries) {
        if (e.type === "dir") queue.push(e.relPath)
        else if ((TEXT_EXTENSIONS.has(e.ext) && e.size <= AGENT_LIMITS.maxReadBytes) || (e.ext === "docx" && e.size <= 5 * 1048576)) candidates.push(e)
      }
    }
    for (const e of candidates) {
      if (results.length >= AGENT_LIMITS.maxSearchResults || Date.now() > deadline || ctx.signal?.aborted) {
        truncated = true
        break
      }
      files++
      let text: string
      try {
        const t = resolveInside(root, e.relPath)
        text = (await readForAgent(t.absPath, e.relPath)).text
      } catch {
        continue
      }
      const lines = text.split("\n")
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].length > 2000 ? lines[i].slice(0, 2000) : lines[i]
        if (re.test(line)) {
          results.push(`${e.relPath}:${i + 1}: ${line.trim().slice(0, 240)}`)
          if (results.length >= AGENT_LIMITS.maxSearchResults) break
        }
      }
    }
    const head = `Tìm "${query}" trong ${files} tệp: ${results.length} kết quả${truncated ? " (đã dừng sớm — thu hẹp phạm vi nếu cần)" : ""}`
    return { ok: true, content: results.length ? `${head}\n${results.join("\n")}` : head, summary: `${results.length} kết quả`, label: query }
  }
}

/** Tên hiển thị của một tệp cho tiêu đề phiên… */
export function shortName(rel: string): string {
  return path.posix.basename(rel) || rel
}

export { ChangeError, extOf }
