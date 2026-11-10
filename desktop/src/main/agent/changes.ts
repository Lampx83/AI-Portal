/**
 * Đề xuất thay đổi tệp của trợ lý — KHÔNG công cụ nào ghi thẳng.
 *
 * Vòng đời: pending → accepted (đã ghi) → undone (đã hoàn tác)
 *                   ↘ rejected (không ghi)        ↘ conflict (tệp đổi sau khi đề xuất — không ghi)
 *
 * Khi Chấp nhận:
 *   1. kiểm tra lại đường dẫn (pathGuard + chính sách ghi) và băm tệp hiện tại phải khớp lúc đề xuất;
 *   2. sao lưu bản gốc vào `<thư mục dự án>/.neu-research/history/<id>/before` (+ meta.json, journal.jsonl);
 *   3. ghi tệp tạm cùng thư mục rồi đổi tên (nguyên tử); không bao giờ đặt quyền thực thi.
 * Hoàn tác chỉ chạy khi tệp vẫn đúng như lúc trợ lý ghi (so băm), tránh đè lên sửa đổi của người dùng.
 *
 * 0.3.0: thêm thao tác THƯ MỤC (tạo thư mục, đổi tên/di chuyển thư mục) và XOÁ = chuyển vào Thùng rác/Recycle Bin
 * của hệ điều hành (`deps.trash`); bản sao trong history vẫn giữ để Hoàn tác. Thư mục bị xoá được sao lưu cả cây
 * (giới hạn số tệp + dung lượng) và so «chữ ký» (danh sách tệp + cỡ + mtime) để phát hiện xung đột.
 *
 * Không phụ thuộc Electron — kiểm thử đơn vị được.
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import { structuredPatch } from "diff"
import { extOf, openBlockedReason } from "../fileTypes"
import { resolveInside } from "../pathGuard"
import { applyDocxEdits, countOccurrences, createDocxFromText, extractDocxText, type TextEdit } from "./docx"
import { decodeText, encodeText } from "./extract"
import { AGENT_LIMITS, assertWritable, dirBlockedReason, WritePolicyError } from "./writePolicy"
import type { ChangeKind, ChangeStatus, ChangeView, DiffHunk } from "../../shared/api"

export const HISTORY_DIR = ".neu-research/history"

export interface ChangeRecord {
  id: string
  projectId: string
  sessionId: string
  kind: ChangeKind
  relPath: string
  newRelPath?: string
  format: "text" | "docx"
  /** Văn bản trước (null: tệp chưa có hoặc không hiển thị được). */
  before: string | null
  /** Văn bản sau (null: xoá / đổi tên). */
  after: string | null
  /** Băm bytes tệp trên đĩa lúc đề xuất (null: chưa tồn tại). */
  baseHash: string | null
  baseSize: number
  textStyle?: { crlf: boolean; bom: boolean }
  /** .docx đã có: các sửa đổi áp lên bytes gốc. */
  docxEdits?: TextEdit[]
  status: ChangeStatus
  summary?: string
  createdAt: string
  decidedAt?: string
  afterHash?: string
  error?: string
  /** 0.3.0: đề xuất áp lên thư mục. */
  isDir?: boolean
  /** 0.3.0: xoá bằng cách chuyển vào Thùng rác. */
  trash?: boolean
  fileCount?: number
  /** Đổi tên chỉ khác hoa/thường trên hệ thống tệp không phân biệt hoa/thường. */
  caseOnly?: boolean
}

export class ChangeError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "BAD_STATE" | "CONFLICT" | "POLICY" | "INVALID" | "IO" = "INVALID",
  ) {
    super(message)
    this.name = "ChangeError"
  }
}

export interface ChangeServiceDeps {
  /** Thư mục gốc (realpath) của dự án. */
  resolveRoot(projectId: string): string
  /** Tệp JSON lưu danh sách thay đổi của dự án (trong userData, tách theo người dùng). */
  storeFile(projectId: string): string
  now?: () => Date
  /** Chuyển vào Thùng rác/Recycle Bin (Electron `shell.trashItem`). Không có ⇒ xoá hẳn (vẫn có bản sao để hoàn tác). */
  trash?: (absPath: string) => Promise<void>
  /** Báo các đường dẫn app vừa ghi (để bộ theo dõi không coi là «sửa bên ngoài»). */
  onWrite?: (projectId: string, relPaths: string[]) => void
}

const MAX_KEEP = 200
const MAX_DIFF_LINES = 3000
const MAX_SHOW_CHARS = 400_000

/** So khớp đường dẫn: không phân biệt hoa/thường, Unicode NFC (macOS có thể trả tên dạng NFD). */
function pathKey(rel: string): string {
  return rel.normalize("NFC").toLowerCase()
}

/** Duyệt mọi mục trong thư mục (đồng bộ, có giới hạn) — dùng cho sao lưu + chữ ký khi xoá thư mục. */
function scanDir(abs: string, limit: number): { files: number; bytes: number; sig: string; over: boolean } {
  const lines: string[] = []
  let files = 0
  let bytes = 0
  let over = false
  const walk = (dir: string, rel: string) => {
    if (over) return
    for (const d of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(dir, d.name)
      const r = rel ? `${rel}/${d.name}` : d.name
      if (d.isDirectory()) {
        lines.push(`d|${r}`)
        walk(p, r)
      } else {
        const st = fs.lstatSync(p)
        files++
        bytes += st.size
        lines.push(`f|${r}|${st.size}|${Math.round(st.mtimeMs)}`)
        if (files > limit || bytes > AGENT_LIMITS.maxBackupBytes) {
          over = true
          return
        }
      }
    }
  }
  walk(abs, "")
  return { files, bytes, sig: sha256(Buffer.from(lines.join("\n"))), over }
}

/** Hai đường dẫn cùng trỏ tới một tệp (đổi tên chỉ khác hoa/thường trên macOS/Windows). */
function sameEntry(a: string, b: string): boolean {
  try {
    const x = fs.statSync(a)
    const y = fs.statSync(b)
    return x.ino === y.ino && x.dev === y.dev
  } catch {
    return false
  }
}

/** Đích của đổi tên chỉ khác hoa/thường: realpath trả về tên CŨ trên đĩa, nên ghép thư mục với tên được yêu cầu. */
function caseTarget(realAbs: string, wantedRel: string): string {
  return path.join(path.dirname(realAbs), path.posix.basename(wantedRel))
}

export function sha256(buf: Uint8Array): string {
  return crypto.createHash("sha256").update(buf).digest("hex")
}

function fileHash(abs: string): string | null {
  try {
    return sha256(fs.readFileSync(abs))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
    throw e
  }
}

function friendlyIo(e: unknown): ChangeError {
  const code = (e as NodeJS.ErrnoException)?.code
  if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
    return new ChangeError("Không ghi được tệp: tệp đang mở trong ứng dụng khác hoặc không có quyền ghi. Hãy đóng tệp rồi thử lại.", "IO")
  }
  if (code === "ENOSPC") return new ChangeError("Ổ đĩa đã đầy", "IO")
  if (e instanceof ChangeError) return e
  return new ChangeError(`Lỗi ghi tệp: ${(e as Error)?.message ?? e}`, "IO")
}

/** Ghi nguyên tử: tệp tạm cùng thư mục → đổi tên. Không bao giờ có quyền thực thi. */
function atomicWrite(abs: string, data: Uint8Array, mode: number): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  const tmp = path.join(path.dirname(abs), `.neu-tmp-${crypto.randomBytes(6).toString("hex")}`)
  fs.writeFileSync(tmp, data, { flag: "wx", mode: mode & 0o666 })
  try {
    fs.chmodSync(tmp, mode & 0o666)
    fs.renameSync(tmp, abs)
  } catch (e) {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* bỏ qua */
    }
    throw e
  }
}

export function diffHunks(before: string, after: string): { hunks: DiffHunk[]; added: number; removed: number; truncated: boolean } {
  const tooBig = before.length > MAX_SHOW_CHARS || after.length > MAX_SHOW_CHARS
  const p = structuredPatch("a", "b", tooBig ? before.slice(0, MAX_SHOW_CHARS) : before, tooBig ? after.slice(0, MAX_SHOW_CHARS) : after, "", "", { context: 3 })
  let added = 0
  let removed = 0
  let lines = 0
  let truncated = tooBig
  const hunks: DiffHunk[] = []
  for (const h of p.hunks) {
    for (const l of h.lines) {
      if (l.startsWith("+")) added++
      else if (l.startsWith("-")) removed++
    }
    if (lines >= MAX_DIFF_LINES) {
      truncated = true
      continue
    }
    const take = h.lines.slice(0, MAX_DIFF_LINES - lines)
    if (take.length < h.lines.length) truncated = true
    lines += take.length
    hunks.push({ oldStart: h.oldStart, oldLines: h.oldLines, newStart: h.newStart, newLines: h.newLines, lines: take.map((l) => (l.length > 2000 ? l.slice(0, 2000) + "…" : l)) })
  }
  return { hunks, added, removed, truncated }
}

/** Áp danh sách {old_text,new_text} lên văn bản thuần — mỗi old_text phải khớp đúng một chỗ. */
export function applyTextEdits(text: string, edits: TextEdit[]): string {
  let out = text
  edits.forEach((e, i) => {
    const label = edits.length > 1 ? ` (sửa #${i + 1})` : ""
    if (typeof e?.old_text !== "string" || typeof e?.new_text !== "string") throw new ChangeError(`Mỗi sửa đổi cần old_text và new_text${label}`)
    const oldT = e.old_text.replace(/\r\n?/g, "\n")
    const newT = e.new_text.replace(/\r\n?/g, "\n")
    if (!oldT) throw new ChangeError(`old_text rỗng${label} — muốn ghi cả tệp thì dùng write_file`)
    const n = countOccurrences(out, oldT)
    if (n === 0) throw new ChangeError(`Không tìm thấy old_text${label} trong tệp. Hãy đọc lại tệp (read_file) và chép đúng nguyên văn, kể cả khoảng trắng.`)
    if (n > 1) throw new ChangeError(`old_text${label} khớp ${n} chỗ. Hãy thêm vài dòng ngữ cảnh để chỉ còn một chỗ.`)
    out = out.replace(oldT, () => newT)
  })
  return out
}

export class ChangeService {
  private cache = new Map<string, ChangeRecord[]>()
  private readonly now: () => Date

  constructor(private readonly deps: ChangeServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  // ───────────── lưu trữ ─────────────
  private load(projectId: string): ChangeRecord[] {
    const hit = this.cache.get(projectId)
    if (hit) return hit
    let list: ChangeRecord[] = []
    try {
      const raw = JSON.parse(fs.readFileSync(this.deps.storeFile(projectId), "utf8")) as { changes?: ChangeRecord[] }
      if (Array.isArray(raw.changes)) list = raw.changes.filter((c) => c && typeof c.id === "string" && c.projectId === projectId)
    } catch {
      list = []
    }
    this.cache.set(projectId, list)
    return list
  }

  private save(projectId: string): void {
    let list = this.load(projectId)
    if (list.length > MAX_KEEP) {
      // Giữ đề xuất đang chờ + các thay đổi mới nhất.
      const pending = list.filter((c) => c.status === "pending")
      const others = list.filter((c) => c.status !== "pending").slice(-(MAX_KEEP - pending.length))
      list = [...others, ...pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      this.cache.set(projectId, list)
    }
    const file = this.deps.storeFile(projectId)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, changes: list }), { encoding: "utf8", mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  get(projectId: string, id: string): ChangeRecord {
    const c = this.load(projectId).find((x) => x.id === id)
    if (!c) throw new ChangeError("Không tìm thấy đề xuất thay đổi", "NOT_FOUND")
    return c
  }

  /** Đề xuất đang chờ chạm tới `relPath` (theo đường dẫn cũ hoặc mới). */
  pendingFor(projectId: string, relPath: string): ChangeRecord | null {
    const k = pathKey(relPath)
    return this.load(projectId).find((c) => c.status === "pending" && (pathKey(c.relPath) === k || (c.newRelPath !== undefined && pathKey(c.newRelPath) === k))) ?? null
  }

  /** Đề xuất đang chờ chạm tới `dirRel` hoặc bất cứ thứ gì bên trong nó (cho thao tác thư mục). */
  pendingUnder(projectId: string, dirRel: string): ChangeRecord | null {
    const k = pathKey(dirRel)
    const hit = (p?: string) => p !== undefined && (pathKey(p) === k || pathKey(p).startsWith(k + "/") || k.startsWith(pathKey(p) + "/"))
    return this.load(projectId).find((c) => c.status === "pending" && (hit(c.relPath) || hit(c.newRelPath))) ?? null
  }

  list(projectId: string, opts: { sessionId?: string } = {}): ChangeView[] {
    return this.load(projectId)
      .filter((c) => c.status !== "superseded" && (!opts.sessionId || c.sessionId === opts.sessionId))
      .map((c) => this.toView(c))
  }

  toView(c: ChangeRecord): ChangeView {
    let hunks: DiffHunk[] = []
    let added = 0
    let removed = 0
    let truncated = false
    if (c.kind !== "rename" && (c.before !== null || c.after !== null)) {
      const d = diffHunks(c.before ?? "", c.after ?? "")
      hunks = d.hunks
      added = d.added
      removed = d.removed
      truncated = d.truncated
    }
    return {
      id: c.id,
      projectId: c.projectId,
      sessionId: c.sessionId,
      kind: c.kind,
      relPath: c.relPath,
      newRelPath: c.newRelPath,
      format: c.format,
      status: c.status,
      summary: c.summary,
      createdAt: c.createdAt,
      decidedAt: c.decidedAt,
      error: c.error,
      size: c.baseSize,
      added,
      removed,
      hunks,
      truncated,
      binary: c.kind === "delete" && c.before === null && !c.isDir,
      ...(c.isDir ? { isDir: true } : {}),
      ...(c.trash ? { trash: true } : {}),
      ...(c.fileCount !== undefined ? { fileCount: c.fileCount } : {}),
    }
  }

  // ───────────── đề xuất ─────────────
  private resolveTarget(projectId: string, rel: string) {
    const root = this.deps.resolveRoot(projectId)
    const target = resolveInside(root, rel, { mustExist: false })
    if (!target.relPath) throw new ChangeError("Cần đường dẫn tệp")
    try {
      assertWritable(target.relPath)
    } catch (e) {
      throw new ChangeError((e as WritePolicyError).message, "POLICY")
    }
    if (target.exists && !fs.statSync(target.absPath).isFile()) throw new ChangeError("Đường dẫn này là thư mục, không phải tệp", "POLICY")
    return { root, ...target }
  }

  private push(rec: ChangeRecord, supersede?: ChangeRecord): ChangeRecord {
    const list = this.load(rec.projectId)
    if (supersede) supersede.status = "superseded"
    list.push(rec)
    this.save(rec.projectId)
    return rec
  }

  private base(projectId: string, sessionId: string, kind: ChangeKind, relPath: string, format: "text" | "docx", summary?: string): ChangeRecord {
    return {
      id: crypto.randomUUID(),
      projectId,
      sessionId,
      kind,
      relPath,
      format,
      before: null,
      after: null,
      baseHash: null,
      baseSize: 0,
      status: "pending",
      summary: typeof summary === "string" ? summary.slice(0, 500) : undefined,
      createdAt: this.now().toISOString(),
    }
  }

  /** Đọc tệp hiện có làm «trước». */
  private readBase(abs: string, format: "text" | "docx"): { before: string; hash: string; size: number; style?: { crlf: boolean; bom: boolean } } {
    const buf = fs.readFileSync(abs)
    if (buf.length > AGENT_LIMITS.maxBackupBytes) throw new ChangeError("Tệp quá lớn để trợ lý sửa an toàn", "POLICY")
    if (format === "docx") return { before: extractDocxText(buf), hash: sha256(buf), size: buf.length }
    const d = decodeText(buf)
    return { before: d.text, hash: sha256(buf), size: buf.length, style: { crlf: d.crlf, bom: d.bom } }
  }

  /** Tạo mới hoặc ghi đè toàn bộ tệp. */
  proposeWrite(projectId: string, sessionId: string, rel: string, content: unknown, summary?: string): ChangeRecord {
    if (typeof content !== "string") throw new ChangeError("content phải là chuỗi")
    if (content.length > AGENT_LIMITS.maxWriteChars) throw new ChangeError("Nội dung quá lớn (tối đa 1 triệu ký tự)", "POLICY")
    const t = this.resolveTarget(projectId, rel)
    const format = extOf(t.relPath) === "docx" ? "docx" : "text"
    const text = content.replace(/\r\n?/g, "\n")
    const pend = this.pendingFor(projectId, t.relPath)
    if (pend && (pend.kind === "rename" || pend.kind === "delete")) throw new ChangeError("Tệp này đang có đề xuất đổi tên/xoá chờ duyệt", "BAD_STATE")
    const rec = this.base(projectId, sessionId, "create", t.relPath, format, summary)
    if (pend) {
      // Gộp vào đề xuất đang chờ: giữ «trước» gốc.
      Object.assign(rec, { kind: pend.kind, before: pend.before, baseHash: pend.baseHash, baseSize: pend.baseSize, textStyle: pend.textStyle })
      if (format === "docx" && pend.kind === "modify") {
        throw new ChangeError("Tệp .docx đang có đề xuất sửa chờ duyệt — hãy dùng edit_file hoặc chờ người dùng duyệt", "BAD_STATE")
      }
    } else if (t.exists) {
      if (format === "docx") {
        throw new ChangeError("Không ghi đè cả tệp .docx đã có (sẽ mất định dạng). Hãy dùng edit_file để sửa từng đoạn, hoặc tạo tệp .docx mới.", "POLICY")
      }
      const b = this.readBase(t.absPath, format)
      Object.assign(rec, { kind: "modify", before: b.before, baseHash: b.hash, baseSize: b.size, textStyle: b.style })
    } else {
      rec.textStyle = { crlf: false, bom: false }
    }
    rec.after = text
    if (rec.before !== null && rec.before === rec.after) throw new ChangeError("Nội dung mới giống hệt nội dung hiện tại — không có gì thay đổi")
    return this.push(rec, pend ?? undefined)
  }

  /** Sửa theo đoạn (tìm-thay thế), cho cả văn bản thô và .docx. */
  proposeEdit(projectId: string, sessionId: string, rel: string, edits: unknown, summary?: string): ChangeRecord {
    if (!Array.isArray(edits) || edits.length === 0) throw new ChangeError("Cần danh sách edits [{old_text, new_text}]")
    if (edits.length > 50) throw new ChangeError("Tối đa 50 sửa đổi mỗi lần")
    const list = edits as TextEdit[]
    for (const e of list) {
      if (typeof e?.old_text !== "string" || typeof e?.new_text !== "string") throw new ChangeError("Mỗi sửa đổi cần old_text và new_text (chuỗi)")
    }
    const t = this.resolveTarget(projectId, rel)
    const format = extOf(t.relPath) === "docx" ? "docx" : "text"
    const pend = this.pendingFor(projectId, t.relPath)
    if (pend && (pend.kind === "rename" || pend.kind === "delete")) throw new ChangeError("Tệp này đang có đề xuất đổi tên/xoá chờ duyệt", "BAD_STATE")
    if (!pend && !t.exists) throw new ChangeError("Tệp chưa tồn tại — dùng write_file để tạo", "NOT_FOUND")
    const rec = this.base(projectId, sessionId, "modify", t.relPath, format, summary)

    if (format === "docx" && !(pend && pend.kind === "create")) {
      const buf = fs.readFileSync(t.absPath)
      if (buf.length > AGENT_LIMITS.maxBackupBytes) throw new ChangeError("Tệp quá lớn để trợ lý sửa an toàn", "POLICY")
      const hash = sha256(buf)
      const prevEdits = pend?.docxEdits ?? []
      if (pend && pend.baseHash !== hash) throw new ChangeError("Tệp đã thay đổi trên đĩa sau đề xuất trước — hãy đọc lại tệp", "CONFLICT")
      const all = [...prevEdits, ...list]
      let res: { text: string }
      try {
        res = applyDocxEdits(buf, all)
      } catch (e) {
        throw new ChangeError((e as Error).message)
      }
      Object.assign(rec, { before: pend?.before ?? extractDocxText(buf), after: res.text, baseHash: hash, baseSize: buf.length, docxEdits: all })
      return this.push(rec, pend ?? undefined)
    }

    let current: string
    if (pend) {
      current = pend.after ?? ""
      Object.assign(rec, { kind: pend.kind, before: pend.before, baseHash: pend.baseHash, baseSize: pend.baseSize, textStyle: pend.textStyle })
    } else {
      const b = this.readBase(t.absPath, "text")
      current = b.before
      Object.assign(rec, { before: b.before, baseHash: b.hash, baseSize: b.size, textStyle: b.style })
    }
    rec.after = applyTextEdits(current, list)
    if (rec.after === rec.before) throw new ChangeError("Sau khi sửa, nội dung giống hệt bản gốc — không có gì thay đổi")
    return this.push(rec, pend ?? undefined)
  }

  /** 0.3.0: tạo thư mục mới (kể cả các thư mục cha còn thiếu). */
  proposeMkdir(projectId: string, sessionId: string, rel: string, summary?: string): ChangeRecord {
    const root = this.deps.resolveRoot(projectId)
    const t = resolveInside(root, typeof rel === "string" ? rel.normalize("NFC") : rel, { mustExist: false })
    const blocked = dirBlockedReason(t.relPath)
    if (blocked) throw new ChangeError(blocked, "POLICY")
    if (t.exists) throw new ChangeError(fs.statSync(t.absPath).isDirectory() ? "Thư mục đã tồn tại" : "Đã có tệp trùng tên", "CONFLICT")
    if (this.pendingFor(projectId, t.relPath)) throw new ChangeError("Đường dẫn này đang có đề xuất khác chờ duyệt", "BAD_STATE")
    const rec = this.base(projectId, sessionId, "create", t.relPath, "text", summary)
    rec.isDir = true
    rec.fileCount = 0
    return this.push(rec)
  }

  /** Đổi tên / di chuyển tệp hoặc thư mục. `toRel` là thư mục đã có ⇒ chuyển vào trong thư mục đó. */
  proposeRename(projectId: string, sessionId: string, fromRel: string, toRel: string, summary?: string): ChangeRecord {
    const root = this.deps.resolveRoot(projectId)
    const from = resolveInside(root, fromRel)
    if (!from.relPath) throw new ChangeError("Không đổi tên chính thư mục dự án", "POLICY")
    const fromSt = fs.statSync(from.absPath)
    const isDir = fromSt.isDirectory()
    if (!isDir && !fromSt.isFile()) throw new ChangeError("Chỉ đổi tên được tệp hoặc thư mục")
    let to = resolveInside(root, typeof toRel === "string" ? toRel.normalize("NFC") : toRel, { mustExist: false })
    if (!to.relPath) throw new ChangeError("Cần đường dẫn mới")
    let caseOnly = false
    if (to.exists && sameEntry(from.absPath, to.absPath)) {
      if (to.relPath === from.relPath) throw new ChangeError("Tên mới giống tên cũ")
      caseOnly = true
    } else if (
      (to.exists && fs.statSync(to.absPath).isDirectory()) ||
      (!to.exists && (/[\\/]$/.test(String(toRel)) || this.load(projectId).some((c) => c.status === "pending" && c.isDir && c.kind === "create" && pathKey(c.relPath) === pathKey(to.relPath))))
    ) {
      // «Di chuyển vào thư mục X» — X đã có, hoặc đang chờ tạo (create_folder), hoặc đích kết thúc bằng «/».
      to = resolveInside(root, `${to.relPath}/${path.posix.basename(from.relPath)}`, { mustExist: false })
    }
    if (to.exists && !caseOnly) throw new ChangeError("Đã có tệp/thư mục ở đường dẫn mới — không ghi đè khi đổi tên", "CONFLICT")
    if (isDir && pathKey(to.relPath).startsWith(pathKey(from.relPath) + "/")) throw new ChangeError("Không chuyển thư mục vào bên trong chính nó", "POLICY")
    if (isDir) {
      const blocked = dirBlockedReason(from.relPath) ?? dirBlockedReason(to.relPath)
      if (blocked) throw new ChangeError(blocked, "POLICY")
      if (this.pendingUnder(projectId, from.relPath) || this.pendingUnder(projectId, to.relPath)) throw new ChangeError("Thư mục đang có đề xuất khác chờ duyệt", "BAD_STATE")
    } else {
      const sameExt = extOf(from.relPath) === extOf(to.relPath)
      try {
        // Tên mới phải an toàn; nếu đổi đuôi thì đuôi mới phải thuộc danh sách được ghi.
        assertWritable(sameExt ? to.relPath.replace(/\.[^./]*$/, ".txt") : to.relPath)
        assertWritable(from.relPath.replace(/\.[^./]*$/, ".txt"))
      } catch (e) {
        throw new ChangeError((e as Error).message, "POLICY")
      }
      if (sameExt && !extOf(to.relPath)) throw new ChangeError("Tên mới cần có phần mở rộng", "POLICY")
      const blocked = openBlockedReason(path.basename(to.relPath), 0o644) ?? openBlockedReason(path.basename(from.relPath), 0o644)
      if (blocked) throw new ChangeError("Trợ lý không đổi tên tệp thực thi/kịch bản", "POLICY")
      const parentBlocked = to.relPath.includes("/") ? dirBlockedReason(path.posix.dirname(to.relPath)) : null
      if (parentBlocked) throw new ChangeError(parentBlocked, "POLICY")
      if (this.pendingFor(projectId, from.relPath) || this.pendingFor(projectId, to.relPath)) throw new ChangeError("Tệp đang có đề xuất khác chờ duyệt", "BAD_STATE")
      if (fromSt.size > AGENT_LIMITS.maxBackupBytes) throw new ChangeError("Tệp quá lớn", "POLICY")
    }
    const rec = this.base(projectId, sessionId, "rename", from.relPath, !isDir && extOf(from.relPath) === "docx" ? "docx" : "text", summary)
    rec.newRelPath = to.relPath
    if (isDir) rec.isDir = true
    if (caseOnly) rec.caseOnly = true
    rec.baseHash = isDir ? null : fileHash(from.absPath)
    rec.baseSize = isDir ? 0 : fromSt.size
    return this.push(rec)
  }

  /** Xoá tệp hoặc thư mục: khi duyệt sẽ chuyển vào Thùng rác (nếu có) và luôn giữ bản sao để Hoàn tác. */
  proposeDelete(projectId: string, sessionId: string, rel: string, summary?: string): ChangeRecord {
    const root = this.deps.resolveRoot(projectId)
    const t = resolveInside(root, rel)
    if (!t.relPath) throw new ChangeError("Không xoá chính thư mục dự án", "POLICY")
    const st = fs.statSync(t.absPath)
    if (st.isDirectory()) {
      const blocked = dirBlockedReason(t.relPath)
      if (blocked) throw new ChangeError(blocked, "POLICY")
      if (this.pendingUnder(projectId, t.relPath)) throw new ChangeError("Thư mục đang có đề xuất khác chờ duyệt", "BAD_STATE")
      const scan = scanDir(t.absPath, AGENT_LIMITS.maxDirFiles)
      if (scan.over) {
        throw new ChangeError(
          `Thư mục quá lớn để trợ lý xoá an toàn (tối đa ${AGENT_LIMITS.maxDirFiles} tệp, ${Math.round(AGENT_LIMITS.maxBackupBytes / 1048576)} MB). Hãy tự xoá trong Finder/Explorer.`,
          "POLICY",
        )
      }
      const rec = this.base(projectId, sessionId, "delete", t.relPath, "text", summary)
      rec.isDir = true
      rec.fileCount = scan.files
      rec.baseHash = scan.sig
      rec.baseSize = scan.bytes
      if (this.deps.trash) rec.trash = true
      return this.push(rec)
    }
    if (!st.isFile()) throw new ChangeError("Chỉ xoá được tệp hoặc thư mục", "POLICY")
    try {
      assertWritable(t.relPath.replace(/\.[^./]*$/, ".txt"))
    } catch (e) {
      throw new ChangeError((e as Error).message, "POLICY")
    }
    if (st.size > AGENT_LIMITS.maxBackupBytes) throw new ChangeError("Tệp quá lớn để xoá an toàn (không sao lưu được)", "POLICY")
    if (this.pendingFor(projectId, t.relPath)) throw new ChangeError("Tệp đang có đề xuất khác chờ duyệt", "BAD_STATE")
    const ext = extOf(t.relPath)
    const rec = this.base(projectId, sessionId, "delete", t.relPath, ext === "docx" ? "docx" : "text", summary)
    const buf = fs.readFileSync(t.absPath)
    rec.baseHash = sha256(buf)
    rec.baseSize = buf.length
    if (this.deps.trash) rec.trash = true
    try {
      if (ext === "docx") rec.before = extractDocxText(buf)
      else if (buf.length <= 200_000 && !buf.subarray(0, 8192).includes(0)) rec.before = decodeText(buf).text
    } catch {
      rec.before = null
    }
    return this.push(rec)
  }

  // ───────────── duyệt ─────────────
  reject(projectId: string, id: string): ChangeView {
    const c = this.get(projectId, id)
    if (c.status !== "pending") throw new ChangeError("Đề xuất này đã được xử lý", "BAD_STATE")
    c.status = "rejected"
    c.decidedAt = this.now().toISOString()
    this.save(projectId)
    this.journal(projectId, c, "reject")
    return this.toView(c)
  }

  private historyPath(root: string, id: string, name: string): string {
    return resolveInside(root, `${HISTORY_DIR}/${id}/${name}`, { mustExist: false }).absPath
  }

  private journal(projectId: string, c: ChangeRecord, action: string): void {
    try {
      const root = this.deps.resolveRoot(projectId)
      const file = resolveInside(root, `${HISTORY_DIR}/journal.jsonl`, { mustExist: false }).absPath
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const readme = resolveInside(root, ".neu-research/README.txt", { mustExist: false }).absPath
      if (!fs.existsSync(readme)) {
        fs.writeFileSync(
          readme,
          "Thư mục do ứng dụng NEU Research tạo.\nhistory/ chứa bản sao tệp trước khi trợ lý thư mục ghi thay đổi (để Hoàn tác) và nhật ký journal.jsonl.\nCó thể xoá thư mục này khi không cần hoàn tác nữa.\n",
          { mode: 0o644 },
        )
      }
      const line = {
        at: this.now().toISOString(),
        action,
        changeId: c.id,
        sessionId: c.sessionId,
        kind: c.kind,
        path: c.relPath,
        ...(c.newRelPath ? { newPath: c.newRelPath } : {}),
        beforeHash: c.baseHash,
        afterHash: c.afterHash ?? null,
      }
      fs.appendFileSync(file, JSON.stringify(line) + "\n", { mode: 0o644 })
    } catch {
      /* nhật ký là phụ — không chặn thao tác */
    }
  }

  /** Bytes sẽ ghi cho đề xuất create/modify. */
  private buildBytes(c: ChangeRecord, absPath: string): Uint8Array {
    if (c.format === "docx") {
      if (c.kind === "create") return createDocxFromText(c.after ?? "")
      return applyDocxEdits(fs.readFileSync(absPath), c.docxEdits ?? []).bytes
    }
    return encodeText(c.after ?? "", c.textStyle ?? { crlf: false, bom: false })
  }

  private notifyWrite(projectId: string, c: ChangeRecord): void {
    try {
      this.deps.onWrite?.(projectId, [c.relPath, ...(c.newRelPath ? [c.newRelPath] : [])])
    } catch {
      /* bỏ qua */
    }
  }

  private conflictOnAccept(projectId: string, c: ChangeRecord, msg: string): never {
    c.status = "conflict"
    c.error = msg
    c.decidedAt = this.now().toISOString()
    this.save(projectId)
    this.journal(projectId, c, "conflict")
    throw new ChangeError(msg, "CONFLICT")
  }

  async accept(projectId: string, id: string): Promise<ChangeView> {
    const c = this.get(projectId, id)
    if (c.status !== "pending") throw new ChangeError("Đề xuất này đã được xử lý", "BAD_STATE")
    const root = this.deps.resolveRoot(projectId)
    try {
      const src = resolveInside(root, c.relPath, { mustExist: false })
      // Kiểm tra lại chính sách (phòng bản ghi bị sửa tay).
      if (c.isDir) {
        const blocked = dirBlockedReason(src.relPath) ?? (c.newRelPath ? dirBlockedReason(c.newRelPath) : null)
        if (blocked) throw new ChangeError(blocked, "POLICY")
      } else if (c.kind === "create" || c.kind === "modify") assertWritable(src.relPath)

      if (c.isDir) {
        // ── Thư mục ──
        const srcIsDir = src.exists && fs.statSync(src.absPath).isDirectory()
        if (c.kind === "create") {
          if (srcIsDir) {
            // Thư mục đã có (vd người dùng duyệt «chuyển tệp vào thư mục» trước, thư mục được tạo kèm) → không cần làm gì.
            c.afterHash = "existed"
          } else {
            if (src.exists) this.conflictOnAccept(projectId, c, "Đã có tệp trùng tên được tạo sau khi đề xuất")
            fs.mkdirSync(src.absPath, { recursive: true })
          }
        } else if (c.kind === "rename") {
          const dst = resolveInside(root, c.newRelPath ?? "", { mustExist: false })
          if (!srcIsDir) this.conflictOnAccept(projectId, c, "Thư mục đã bị đổi tên, di chuyển hoặc xoá sau khi trợ lý đề xuất")
          if (dst.exists && !(c.caseOnly && sameEntry(src.absPath, dst.absPath))) this.conflictOnAccept(projectId, c, "Đã có tệp/thư mục ở đường dẫn mới")
          this.writeMeta(root, c, src.exists)
          this.moveEntry(src.absPath, c.caseOnly ? caseTarget(dst.absPath, c.newRelPath ?? "") : dst.absPath, !!c.caseOnly)
        } else if (c.kind === "delete") {
          if (!srcIsDir) this.conflictOnAccept(projectId, c, "Thư mục đã bị đổi tên, di chuyển hoặc xoá sau khi trợ lý đề xuất")
          const scan = scanDir(src.absPath, AGENT_LIMITS.maxDirFiles)
          if (scan.over || scan.sig !== c.baseHash) this.conflictOnAccept(projectId, c, "Thư mục đã thay đổi sau khi trợ lý đề xuất — không xoá để tránh mất dữ liệu")
          this.writeMeta(root, c, true)
          fs.cpSync(src.absPath, this.historyPath(root, c.id, "before"), { recursive: true, errorOnExist: true, force: false })
          await this.removeEntry(src.absPath, c)
        }
      } else {
        // ── Tệp ──
        const curHash = src.exists ? fileHash(src.absPath) : null
        if (curHash !== c.baseHash) {
          this.conflictOnAccept(
            projectId,
            c,
            c.baseHash === null ? "Đã có tệp trùng tên được tạo sau khi đề xuất" : "Tệp đã bị sửa hoặc xoá sau khi trợ lý đề xuất — không ghi để tránh mất dữ liệu",
          )
        }
        let mode = 0o644
        this.writeMeta(root, c, src.exists)
        if (src.exists) {
          mode = fs.statSync(src.absPath).mode & 0o666
          fs.copyFileSync(src.absPath, this.historyPath(root, c.id, "before"))
        }
        if (c.kind === "create" || c.kind === "modify") {
          const bytes = this.buildBytes(c, src.absPath)
          atomicWrite(src.absPath, bytes, mode)
          c.afterHash = sha256(bytes)
        } else if (c.kind === "delete") {
          await this.removeEntry(src.absPath, c)
          c.afterHash = undefined
        } else if (c.kind === "rename") {
          const dst = resolveInside(root, c.newRelPath ?? "", { mustExist: false })
          if (dst.exists && !(c.caseOnly && sameEntry(src.absPath, dst.absPath))) throw new ChangeError("Đã có tệp ở đường dẫn mới", "CONFLICT")
          this.moveEntry(src.absPath, c.caseOnly ? caseTarget(dst.absPath, c.newRelPath ?? "") : dst.absPath, !!c.caseOnly)
          c.afterHash = c.baseHash ?? undefined
        }
      }
      c.status = "accepted"
      c.error = undefined
      c.decidedAt = this.now().toISOString()
      this.save(projectId)
      this.journal(projectId, c, "accept")
      this.notifyWrite(projectId, c)
      return this.toView(c)
    } catch (e) {
      if (e instanceof ChangeError) throw e
      throw friendlyIo(e)
    }
  }

  private writeMeta(root: string, c: ChangeRecord, existed: boolean): void {
    const metaFile = this.historyPath(root, c.id, "meta.json")
    fs.mkdirSync(path.dirname(metaFile), { recursive: true })
    fs.writeFileSync(
      metaFile,
      JSON.stringify(
        { id: c.id, kind: c.kind, path: c.relPath, newPath: c.newRelPath ?? null, isDir: !!c.isDir, trash: !!c.trash, existed, beforeHash: c.baseHash, at: this.now().toISOString() },
        null,
        2,
      ),
      { mode: 0o644 },
    )
  }

  /** Đổi tên/di chuyển (tạo thư mục cha nếu thiếu). Đổi tên chỉ khác hoa/thường đi qua một tên tạm. */
  private moveEntry(fromAbs: string, toAbs: string, caseOnly: boolean): void {
    fs.mkdirSync(path.dirname(toAbs), { recursive: true })
    if (caseOnly) {
      const tmp = path.join(path.dirname(fromAbs), `.neu-tmp-${crypto.randomBytes(6).toString("hex")}`)
      fs.renameSync(fromAbs, tmp)
      fs.renameSync(tmp, toAbs)
    } else fs.renameSync(fromAbs, toAbs)
  }

  /** Xoá = chuyển vào Thùng rác nếu có (bản sao đã nằm trong history). */
  private async removeEntry(abs: string, c: ChangeRecord): Promise<void> {
    if (c.trash && this.deps.trash) {
      try {
        await this.deps.trash(abs)
      } catch (e) {
        throw new ChangeError(`Không chuyển được vào Thùng rác (${(e as Error)?.message ?? e}). Chưa xoá gì.`, "IO")
      }
      return
    }
    fs.rmSync(abs, { recursive: !!c.isDir, force: false })
  }

  async undo(projectId: string, id: string): Promise<ChangeView> {
    const c = this.get(projectId, id)
    if (c.status !== "accepted") throw new ChangeError("Chỉ hoàn tác được thay đổi đã ghi", "BAD_STATE")
    const root = this.deps.resolveRoot(projectId)
    try {
      const p = resolveInside(root, c.relPath, { mustExist: false })
      const backup = this.historyPath(root, c.id, "before")
      const conflict = (msg: string): never => {
        throw new ChangeError(msg, "CONFLICT")
      }
      if (c.isDir) {
        if (c.kind === "create" && c.afterHash === "existed") {
          /* thư mục đã có từ trước khi chấp nhận — hoàn tác không xoá */
        } else if (c.kind === "create") {
          if (!p.exists || !fs.statSync(p.absPath).isDirectory()) conflict("Thư mục không còn ở đó")
          if (fs.readdirSync(p.absPath).length > 0) conflict("Thư mục đã có tệp bên trong — không xoá khi hoàn tác. Hãy tự xoá nếu cần.")
          fs.rmdirSync(p.absPath)
        } else if (c.kind === "rename") {
          const dst = resolveInside(root, c.newRelPath ?? "", { mustExist: false })
          if (p.exists && !(c.caseOnly && sameEntry(p.absPath, dst.absPath))) conflict("Đường dẫn cũ đã có tệp/thư mục khác")
          if (!dst.exists || !fs.statSync(dst.absPath).isDirectory()) conflict("Thư mục đã bị đổi tên hoặc di chuyển tiếp sau đó")
          this.moveEntry(dst.absPath, c.caseOnly ? caseTarget(p.absPath, c.relPath) : p.absPath, !!c.caseOnly)
        } else if (c.kind === "delete") {
          if (p.exists) conflict("Đã có tệp/thư mục mới ở cùng đường dẫn — không khôi phục đè lên")
          fs.cpSync(backup, p.absPath, { recursive: true, errorOnExist: true, force: false })
        }
      } else if (c.kind === "create" || c.kind === "modify") {
        const cur = p.exists ? fileHash(p.absPath) : null
        if (cur !== c.afterHash) conflict("Tệp đã thay đổi sau khi trợ lý ghi — không hoàn tác tự động để tránh mất sửa đổi của bạn. Bản gốc vẫn ở .neu-research/history.")
        // Giữ lại bản trợ lý đã ghi, phòng khi muốn lấy lại.
        fs.copyFileSync(p.absPath, this.historyPath(root, c.id, "after"))
        if (c.kind === "create") fs.unlinkSync(p.absPath)
        else {
          const mode = fs.statSync(p.absPath).mode & 0o666
          atomicWrite(p.absPath, fs.readFileSync(backup), mode)
        }
      } else if (c.kind === "delete") {
        if (p.exists) conflict("Đã có tệp mới ở cùng đường dẫn — không khôi phục đè lên")
        atomicWrite(p.absPath, fs.readFileSync(backup), 0o644)
      } else if (c.kind === "rename") {
        const dst = resolveInside(root, c.newRelPath ?? "", { mustExist: false })
        if (p.exists && !(c.caseOnly && sameEntry(p.absPath, dst.absPath))) conflict("Đường dẫn cũ đã có tệp khác")
        if (!dst.exists || fileHash(dst.absPath) !== c.baseHash) conflict("Tệp đã bị sửa hoặc di chuyển sau khi đổi tên")
        this.moveEntry(dst.absPath, c.caseOnly ? caseTarget(p.absPath, c.relPath) : p.absPath, !!c.caseOnly)
      }
      c.status = "undone"
      c.decidedAt = this.now().toISOString()
      this.save(projectId)
      this.journal(projectId, c, "undo")
      this.notifyWrite(projectId, c)
      return this.toView(c)
    } catch (e) {
      if (e instanceof ChangeError) throw e
      throw friendlyIo(e)
    }
  }

  /** Huỷ mọi đề xuất đang chờ của một phiên (khi người dùng xoá phiên). */
  dropPending(projectId: string, sessionId: string): void {
    let changed = false
    for (const c of this.load(projectId)) {
      if (c.sessionId === sessionId && c.status === "pending") {
        c.status = "rejected"
        c.decidedAt = this.now().toISOString()
        changed = true
      }
    }
    if (changed) this.save(projectId)
  }
}
