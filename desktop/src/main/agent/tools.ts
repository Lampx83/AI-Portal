/**
 * Công cụ của trợ lý thư mục — chạy trong tiến trình chính, chỉ trong thư mục dự án đã liên kết.
 * Đọc: list_files, find_files, read_file, search_text. Ghi (CHỈ ĐỀ XUẤT): write_file, edit_file, create_folder,
 * rename_file (tệp hoặc thư mục, kể cả di chuyển), delete_file (tệp hoặc thư mục → Thùng rác).
 * Không có công cụ chạy lệnh/chương trình.
 */
import path from "path"
import { extOf, isJunkDirName } from "../fileTypes"
import { buildMatcher, FolderSearch } from "../fsSearch"
import { resolveInside } from "../pathGuard"
import type { ProjectFolderService } from "../projectFolders"
import type { ChangeView } from "../../shared/api"
import { ChangeError, type ChangeService } from "./changes"
import { formatOf, readForAgent } from "./extract"
import type { ChatToolDef } from "./llmClient"
import { AGENT_LIMITS, readBlockedReason } from "./writePolicy"

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

const WRITE_TOOLS = new Set(["write_file", "edit_file", "rename_file", "delete_file", "create_folder"])
export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name)
}

export const TOOL_DEFS: ChatToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List files and sub-folders of the linked project folder (relative paths). Hidden files are not shown; library/cache folders (node_modules, venv, __pycache__…) are listed but not expanded. For big folders prefer find_files / search_text.",
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
      name: "find_files",
      description:
        "Find files or folders by NAME anywhere in the project (all sub-folders). Case- and Vietnamese-accent-insensitive (\"bao cao\" matches \"Báo cáo\"). Supports globs: \"*.pdf\", \"chuong*/*.docx\", \"**/hinh*.png\". Use this before list_files when looking for a file.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Words in the name, or a glob pattern" },
          path: { type: "string", description: "Limit to this sub-folder (optional)" },
          type: { type: "string", enum: ["file", "dir", "any"], description: "Default any" },
          limit: { type: "integer", minimum: 1, maximum: 200 },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a file as text. Supports plain text (.txt .md .csv .json .tex .bib .py .R …) and extracts text from .docx (one line per paragraph), .xlsx (CSV per sheet), .pptx (text + speaker notes per slide), .pdf, .odt/.odp and .ipynb. Images: only name/size/dimensions. Long files are returned in parts: use start_line/end_line.",
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
      description:
        "Search INSIDE files of the whole project (text files, .docx, .xlsx, .pptx, .pdf, .odt, .ipynb). Case- and accent-insensitive by default. Returns matching lines as path:line: text, plus files whose name matches.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Phrase to search for (plain text unless regex=true)" },
          path: { type: "string", description: "Limit to this sub-folder (optional)" },
          file_pattern: { type: "string", description: "Only files whose name matches this glob, e.g. \"*.docx\" (optional)" },
          regex: { type: "boolean" },
          case_sensitive: { type: "boolean", description: "Also makes the search accent-sensitive" },
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
      name: "create_folder",
      description: "PROPOSE creating a new folder (missing parent folders are created too). The user must accept. write_file also creates missing parent folders automatically.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, summary: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_file",
      description:
        "PROPOSE renaming or moving a FILE OR FOLDER inside the project (user must accept). If `to` is an existing folder, the item is moved into it. Never overwrites. Use one call per item when organising many files.",
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
      description:
        "PROPOSE deleting a file or a (small) folder: after the user accepts it is moved to the system Trash/Recycle Bin and a backup is kept for undo. Only when the user clearly asks.",
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
    /** Dùng chung bộ đệm văn bản với giao diện tìm kiếm. */
    private readonly search: FolderSearch = new FolderSearch(),
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
    const label = str(args.path ?? args.from ?? args.query ?? args.pattern)
    try {
      switch (name) {
        case "list_files":
          return this.listFiles(ctx, str(args.path), int(args.depth) ?? 2)
        case "read_file":
          return await this.readFile(ctx, str(args.path), int(args.start_line), int(args.end_line))
        case "find_files":
          return await this.findFiles(ctx, str(args.pattern ?? args.query), str(args.path), str(args.type) || "any", int(args.limit) ?? 60)
        case "search_text":
          return await this.searchText(ctx, str(args.query), str(args.path), args.regex === true, args.case_sensitive === true, str(args.file_pattern))
        case "create_folder":
          return this.proposal(this.changes.proposeMkdir(ctx.projectId, ctx.sessionId, str(args.path), str(args.summary) || undefined))
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
    const kindVi = c.isDir ? (c.kind === "create" ? "tạo thư mục" : c.kind === "delete" ? "chuyển vào Thùng rác thư mục" : KIND_VI[c.kind]) : c.kind === "delete" && c.trash ? "chuyển vào Thùng rác" : KIND_VI[c.kind]
    const what = c.kind === "rename" ? `${c.isDir ? "đổi tên/di chuyển thư mục" : "đổi tên/di chuyển"} ${c.relPath} → ${c.newRelPath}` : `${kindVi} ${c.relPath}${c.isDir ? "/" : ""}`
    const stat = c.kind === "rename" || c.isDir ? (c.isDir && c.kind === "delete" ? ` (${c.fileCount ?? 0} tệp)` : "") : ` (+${view.added} −${view.removed} dòng)`
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
        const junk = e.type === "dir" && isJunkDirName(e.name)
        lines.push(e.type === "dir" ? `${indent}${e.name}/${junk ? "  (thư viện/bộ đệm — không mở rộng)" : ""}` : `${indent}${e.name}  (${fmtSize(e.size)})`)
        if (e.type === "dir" && !junk && level + 1 < d) walk(e.relPath, level + 1)
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
        : fmt === "pdf" || fmt === "xlsx" || fmt === "pptx" || fmt === "odf" || fmt === "ipynb"
          ? `Định dạng .${extOf(target.relPath)}: chỉ đọc (văn bản trích ra), trợ lý không sửa được tệp này. Cần kết quả thì tạo tệp mới (.md, .csv, .docx).`
          : fmt === "image"
            ? "Tệp ảnh: trợ lý không xem được nội dung."
            : ""
    const more = to < total ? `\n[… còn tiếp: dòng ${to + 1}–${total}. Gọi read_file với start_line=${to + 1} để đọc tiếp]` : ""
    const header = `Tệp: ${target.relPath} (${fmt}, ${fmtSize(size)}, ${total} dòng; đang xem dòng ${from}–${to})${note}${hint ? "\n" + hint : ""}`
    return { ok: true, content: `${header}\n-----\n${chunk}${more}`, summary: `dòng ${from}–${to}/${total}`, label: target.relPath }
  }

  async findFiles(ctx: ToolContext, pattern: string, sub: string, type: string, limit: number): Promise<ToolResult> {
    if (!pattern.trim()) throw new Error("Cần pattern")
    const blocked = readBlockedReason(sub)
    if (blocked) throw new Error(blocked)
    const want = type === "file" || type === "dir" ? type : "any"
    const max = Math.max(1, Math.min(200, limit))
    const r = await this.search.search(this.root(ctx.projectId), pattern, { mode: "name", subPath: sub, limit: want === "any" ? max : Math.min(500, max * 3), signal: ctx.signal, timeMs: 8000 })
    const hits = r.hits.filter((h) => want === "any" || h.type === want).slice(0, max)
    const lines = hits.map((h) => (h.type === "dir" ? `${h.relPath}/` : `${h.relPath}  (${fmtSize(h.size)})`))
    const head = `Tìm tên "${pattern}"${sub ? ` trong ${sub}` : ""}: ${hits.length} kết quả (đã duyệt ${r.scannedEntries} mục${r.truncated ? ", dừng sớm — thu hẹp phạm vi nếu cần" : ""})`
    return { ok: true, content: lines.length ? `${head}\n${lines.join("\n")}` : head, summary: `${hits.length} kết quả`, label: pattern }
  }

  async searchText(ctx: ToolContext, query: string, sub: string, regex: boolean, caseSensitive: boolean, filePattern = ""): Promise<ToolResult> {
    if (!query.trim()) throw new Error("Cần query")
    if (query.length > 200) throw new Error("query quá dài")
    const blocked = readBlockedReason(sub)
    if (blocked) throw new Error(blocked)
    const root = this.root(ctx.projectId)
    const extOnly = /^\*\.([A-Za-z0-9]{1,10})$/.exec(filePattern.trim())
    const r = await this.search.search(root, query, {
      mode: "all",
      subPath: sub,
      ...(extOnly ? { exts: [extOnly[1]] } : {}),
      regex,
      caseSensitive,
      limit: 120,
      signal: ctx.signal,
      timeMs: 10_000,
      maxMatchesPerFile: 6,
    })
    let hits = r.hits
    if (filePattern.trim()) {
      const m = buildMatcher(filePattern.includes("*") || filePattern.includes("?") ? filePattern : `*${filePattern}*`)
      hits = hits.filter((h) => h.type === "file" && m.name(h.name, h.relPath))
    }
    const lines: string[] = []
    const names: string[] = []
    for (const h of hits) {
      for (const mt of h.matches) {
        if (lines.length >= AGENT_LIMITS.maxSearchResults) break
        lines.push(`${h.relPath}:${mt.line}: ${mt.text}`)
      }
      if (h.nameMatch && h.matches.length === 0 && names.length < 30) names.push(h.type === "dir" ? `${h.relPath}/` : h.relPath)
    }
    const notes = [
      r.truncated || r.timedOut ? "đã dừng sớm — thu hẹp phạm vi (path/file_pattern) nếu cần" : "",
      r.skippedFiles ? `${r.skippedFiles} tệp không đọc được/quá lớn` : "",
    ].filter(Boolean)
    const head = `Tìm "${query}" trong ${r.scannedFiles} tệp: ${lines.length} dòng khớp${notes.length ? ` (${notes.join("; ")})` : ""}`
    const nameBlock = names.length ? `\nTệp/thư mục có TÊN khớp:\n${names.join("\n")}` : ""
    return {
      ok: true,
      content: lines.length || names.length ? `${head}\n${lines.join("\n")}${nameBlock}` : head,
      summary: `${lines.length} kết quả`,
      label: query,
    }
  }
}

/** Tên hiển thị của một tệp cho tiêu đề phiên… */
export function shortName(rel: string): string {
  return path.posix.basename(rel) || rel
}

export { ChangeError, extOf }
