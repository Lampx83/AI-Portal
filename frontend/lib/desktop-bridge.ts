/**
 * Cầu nối tới ứng dụng máy tính NEU Research (Electron, thư mục `desktop/` trong repo).
 *
 * `window.neuDesktop` CHỈ có khi trang chạy trong ứng dụng desktop và đúng origin hệ thống;
 * trên trình duyệt thường mọi hàm ở đây trả về null/không làm gì — an toàn khi deploy web.
 *
 * Kiểu dữ liệu sao chép từ desktop/src/shared/api.ts — khi đổi API phải sửa cả hai nơi.
 */

export type DesktopFileEntry = {
  name: string
  /** Đường dẫn tương đối trong thư mục dự án, dùng "/" */
  relPath: string
  type: "file" | "dir"
  size: number
  mtimeMs: number
  ext: string
}

export type DesktopListFilesResult = {
  subPath: string
  entries: DesktopFileEntry[]
  truncated: boolean
  /** App ≥ 0.3.0: tổng số mục và vị trí bắt đầu (phân trang). */
  total?: number
  offset?: number
}
export type DesktopListFilesOptions = { offset?: number; limit?: number }
export type DesktopReadTextFileResult = { relPath: string; content: string; size: number; truncated: boolean }
export type DesktopLinkedFolder = { projectId: string; path: string; name: string; linkedAt: string; exists: boolean }
export type DesktopFolderChange = { projectId: string; paths: string[] }
export type DesktopMenuCommand = "link-folder"

// ── App ≥ 0.3.0: tìm kiếm, xem trước, thư mục gần đây, kéo-thả ──
export type DesktopSearchMode = "name" | "content" | "all"
export type DesktopSearchOptions = { mode?: DesktopSearchMode; subPath?: string; regex?: boolean; caseSensitive?: boolean; exts?: string[]; limit?: number }
export type DesktopSearchHit = DesktopFileEntry & { nameMatch: boolean; matches: { line: number; text: string }[] }
export type DesktopSearchResult = {
  query: string
  hits: DesktopSearchHit[]
  scannedEntries: number
  scannedFiles: number
  truncated: boolean
  timedOut: boolean
  skippedFiles: number
  elapsedMs: number
  cancelled?: boolean
}
export type DesktopFilePreview = {
  relPath: string
  name: string
  ext: string
  size: number
  mtimeMs: number
  kind: "text" | "markdown" | "csv" | "document" | "image" | "unsupported"
  text?: string
  dataUrl?: string
  width?: number
  height?: number
  truncated: boolean
  note?: string
  openable: boolean
}
export type DesktopRecentFolder = { path: string; name: string; usedAt: string; exists: boolean }

// ── Giai đoạn 2: trợ lý thư mục (bản sao kiểu từ desktop/src/shared/api.ts) ──
export type DesktopChangeKind = "create" | "modify" | "delete" | "rename"
export type DesktopChangeStatus = "pending" | "accepted" | "rejected" | "undone" | "conflict" | "superseded"
export type DesktopDiffHunk = { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }
export type DesktopChangeView = {
  id: string
  projectId: string
  sessionId: string
  kind: DesktopChangeKind
  relPath: string
  newRelPath?: string
  format: "text" | "docx"
  status: DesktopChangeStatus
  summary?: string
  createdAt: string
  decidedAt?: string
  error?: string
  size: number
  added: number
  removed: number
  hunks: DesktopDiffHunk[]
  truncated: boolean
  binary: boolean
  /** App ≥ 0.3.0: đề xuất về thư mục; xoá = chuyển vào Thùng rác. */
  isDir?: boolean
  trash?: boolean
  fileCount?: number
}
export type DesktopAgentStatus = {
  connected: boolean
  user?: { email: string; name: string | null }
  server: string
  secureStorage: boolean
  llm?: { available: boolean; model: string | null }
  error?: string
}
export type DesktopTranscriptItem =
  | { kind: "user"; text: string; at: string }
  | { kind: "assistant"; text: string; at: string }
  | { kind: "tool"; name: string; label: string; ok: boolean; summary: string; at: string }
  | { kind: "change"; changeId: string; at: string }
  | { kind: "notice"; level: "info" | "warn" | "error"; text: string; at: string }
export type DesktopAgentSessionSummary = { id: string; title: string; createdAt: string; updatedAt: string }
export type DesktopAgentSession = DesktopAgentSessionSummary & { transcript: DesktopTranscriptItem[]; running?: string | null }
export type DesktopAgentEvent =
  | { type: "run_start"; runId: string; projectId: string; sessionId: string }
  | { type: "delta"; runId: string; text: string }
  | { type: "assistant"; runId: string; text: string }
  | { type: "tool_start"; runId: string; callId: string; name: string; label: string }
  | { type: "tool_end"; runId: string; callId: string; name: string; label: string; ok: boolean; summary: string }
  | { type: "change"; runId: string; change: DesktopChangeView }
  | { type: "notice"; runId: string; level: "info" | "warn" | "error"; text: string }
  | {
      type: "run_end"
      runId: string
      projectId: string
      sessionId: string
      status: "done" | "stopped" | "error" | "limit"
      message?: string
      usage: { promptTokens: number; completionTokens: number; steps: number }
    }

export type NeuDesktopBridge = {
  readonly isDesktop: true
  readonly version: string
  readonly platform: string
  pickProjectFolder(): Promise<string | null>
  linkProjectFolder(projectId: string, path: string): Promise<DesktopLinkedFolder>
  getLinkedFolder(projectId: string): Promise<DesktopLinkedFolder | null>
  unlinkProjectFolder(projectId: string): Promise<boolean>
  listFiles(projectId: string, subPath?: string, opts?: DesktopListFilesOptions): Promise<DesktopListFilesResult>
  readTextFile(projectId: string, relPath: string): Promise<DesktopReadTextFileResult>
  revealInFolder(projectId: string, relPath?: string): Promise<void>
  openFile(projectId: string, relPath: string): Promise<void>
  onFolderChange(projectId: string, callback: (e: DesktopFolderChange) => void): () => void
  setActiveProject(projectId: string | null): void
  onMenuCommand(callback: (command: DesktopMenuCommand) => void): () => void
}

/** API trợ lý thư mục — chỉ có ở ứng dụng từ bản 0.2.0. */
export type NeuDesktopAgentBridge = NeuDesktopBridge & {
  agentGetStatus(): Promise<DesktopAgentStatus>
  agentConnect(): Promise<DesktopAgentStatus>
  agentDisconnect(): Promise<DesktopAgentStatus>
  agentListSessions(projectId: string): Promise<DesktopAgentSessionSummary[]>
  agentGetSession(projectId: string, sessionId: string): Promise<DesktopAgentSession | null>
  agentDeleteSession(projectId: string, sessionId: string): Promise<boolean>
  agentSend(projectId: string, sessionId: string | null, text: string): Promise<{ runId: string; sessionId: string }>
  agentStop(runId: string): Promise<boolean>
  onAgentEvent(callback: (e: DesktopAgentEvent) => void): () => void
  agentListChanges(projectId: string, sessionId?: string): Promise<DesktopChangeView[]>
  agentAcceptChange(projectId: string, changeId: string): Promise<DesktopChangeView>
  agentRejectChange(projectId: string, changeId: string): Promise<DesktopChangeView>
  agentUndoChange(projectId: string, changeId: string): Promise<DesktopChangeView>
}

/** API làm việc với thư mục — chỉ có ở ứng dụng từ bản 0.3.0. */
export type NeuDesktopFolderBridge = NeuDesktopBridge & {
  searchFiles(projectId: string, query: string, opts?: DesktopSearchOptions): Promise<DesktopSearchResult>
  previewFile(projectId: string, relPath: string): Promise<DesktopFilePreview>
  listRecentFolders(): Promise<DesktopRecentFolder[]>
  linkRecentFolder(projectId: string, path: string): Promise<DesktopLinkedFolder>
  forgetRecentFolder(path: string): Promise<boolean>
  pickDroppedFolder(file: File): Promise<string | null>
}

/** Cầu nối có tìm kiếm/xem trước/thư mục gần đây (ứng dụng ≥ 0.3.0), ngược lại null — bản cũ vẫn dùng được thẻ. */
export function getDesktopFolderBridge(): NeuDesktopFolderBridge | null {
  const api = getDesktopBridge() as Partial<NeuDesktopFolderBridge> | null
  if (!api || typeof api.searchFiles !== "function" || typeof api.previewFile !== "function") return null
  return api as NeuDesktopFolderBridge
}

/** Sự kiện «Hỏi trợ lý về tệp này» từ thẻ thư mục gửi sang khung trợ lý. */
export const DESKTOP_ASK_EVENT = "neu-desktop-ask"
export type DesktopAskDetail = { projectId: string; text: string }

/** Cầu nối có trợ lý thư mục (ứng dụng ≥ 0.2.0), ngược lại null — bản 0.1.0 vẫn dùng được thẻ thư mục. */
export function getDesktopAgentBridge(): NeuDesktopAgentBridge | null {
  const api = getDesktopBridge() as Partial<NeuDesktopAgentBridge> | null
  if (!api || typeof api.agentSend !== "function" || typeof api.onAgentEvent !== "function") return null
  return api as NeuDesktopAgentBridge
}

/** Trả về cầu nối (API thư mục dự án) nếu đang chạy trong ứng dụng desktop, ngược lại null. */
export function getDesktopBridge(): NeuDesktopBridge | null {
  if (typeof window === "undefined") return null
  const api = (window as unknown as { neuDesktop?: Partial<NeuDesktopBridge> }).neuDesktop
  // Kiểm tra theo hàm (không chỉ isDesktop) để chắc đúng API của ứng dụng NEU Research.
  if (!api || api.isDesktop !== true || typeof api.listFiles !== "function" || typeof api.getLinkedFolder !== "function") return null
  return api as NeuDesktopBridge
}

// ─────────────────────────────────────────────────────────────────────────────
// ĐIỂM NỐI GIAI ĐOẠN 2 — cho Central/agent đọc tệp cục bộ.
// Hiện CHƯA được gọi ở đâu. Giai đoạn 2 sẽ dùng hàm này để đưa danh sách tệp (và nội dung
// tệp văn bản nhỏ người dùng chọn) vào ngữ cảnh câu hỏi — luôn chạy ở máy người dùng,
// chỉ gửi lên máy chủ phần người dùng đồng ý đính kèm.
// ─────────────────────────────────────────────────────────────────────────────

export type LocalFolderSnapshot = {
  folderName: string
  files: DesktopFileEntry[]
  truncated: boolean
  /** Nội dung các tệp văn bản được yêu cầu (relPath → nội dung, có thể đã cắt). */
  contents: Record<string, DesktopReadTextFileResult>
}

/**
 * Chụp nhanh thư mục đã liên kết: duyệt theo chiều rộng tới `maxDepth`, tối đa `maxFiles` mục,
 * và đọc nội dung các tệp trong `readPaths`. Trả về null nếu không chạy trong desktop hoặc chưa liên kết.
 */
export async function getLinkedFolderSnapshot(
  projectId: string,
  opts: { maxDepth?: number; maxFiles?: number; readPaths?: string[] } = {},
): Promise<LocalFolderSnapshot | null> {
  const api = getDesktopBridge()
  if (!api) return null
  const linked = await api.getLinkedFolder(projectId)
  if (!linked?.exists) return null
  const maxDepth = opts.maxDepth ?? 3
  const maxFiles = opts.maxFiles ?? 500
  const files: DesktopFileEntry[] = []
  let truncated = false
  let queue: string[] = [""]
  for (let depth = 0; depth <= maxDepth && queue.length > 0; depth++) {
    const next: string[] = []
    for (const sub of queue) {
      const r = await api.listFiles(projectId, sub)
      truncated ||= r.truncated
      for (const e of r.entries) {
        if (files.length >= maxFiles) {
          truncated = true
          break
        }
        files.push(e)
        if (e.type === "dir") next.push(e.relPath)
      }
    }
    queue = next
    if (depth === maxDepth && next.length > 0) truncated = true
  }
  const contents: Record<string, DesktopReadTextFileResult> = {}
  for (const p of opts.readPaths ?? []) {
    try {
      contents[p] = await api.readTextFile(projectId, p)
    } catch {
      /* bỏ qua tệp không đọc được (nhị phân, đã xoá…) */
    }
  }
  return { folderName: linked.name, files, truncated, contents }
}
