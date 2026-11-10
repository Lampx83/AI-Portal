/**
 * Hợp đồng API giữa ứng dụng desktop và trang web của hệ thống.
 *
 * Trang web (frontend AI-Portal) truy cập qua `window.neuDesktop` — chỉ có mặt khi trang thuộc
 * đúng origin hệ thống đã cấu hình. Bản sao kiểu của tệp này nằm ở
 * `frontend/lib/desktop-bridge.ts`; khi đổi API phải sửa cả hai nơi.
 *
 * Giai đoạn 1: chỉ đọc. Giai đoạn 2: «Trợ lý thư mục» (agent chạy ở tiến trình chính) — mọi thay đổi tệp là
 * ĐỀ XUẤT, người dùng duyệt diff rồi mới ghi; có hoàn tác. Trang web không đọc được token của app.
 */

export type FileEntryType = "file" | "dir"

export interface FileEntry {
  /** Tên tệp/thư mục (không có đường dẫn). */
  name: string
  /** Đường dẫn tương đối so với thư mục dự án, luôn dùng dấu "/" (cả trên Windows). */
  relPath: string
  type: FileEntryType
  /** Kích thước byte (thư mục: 0). */
  size: number
  /** Thời điểm sửa đổi cuối, ms kể từ epoch. */
  mtimeMs: number
  /** Phần mở rộng viết thường, không có dấu chấm ("" nếu không có). */
  ext: string
}

export interface ListFilesResult {
  /** Thư mục con đang liệt kê (tương đối, "" = gốc). */
  subPath: string
  entries: FileEntry[]
  /** true nếu số mục vượt giới hạn và danh sách đã bị cắt (còn mục sau `offset + entries.length`). */
  truncated: boolean
  /** 0.3.0: tổng số mục (sau khi bỏ tệp ẩn) và vị trí bắt đầu của trang này. */
  total?: number
  offset?: number
}

/** 0.3.0: phân trang khi liệt kê thư mục lớn. */
export interface ListFilesOptions {
  offset?: number
  /** Mặc định 2000 (như 0.2.0), tối đa 5000. */
  limit?: number
}

export interface ReadTextFileResult {
  relPath: string
  content: string
  /** Kích thước thật của tệp (byte). */
  size: number
  /** true nếu tệp lớn hơn giới hạn và chỉ trả về phần đầu. */
  truncated: boolean
}

export interface LinkedFolderInfo {
  projectId: string
  /** Đường dẫn tuyệt đối trên máy (chỉ hiển thị cho chính người dùng). */
  path: string
  /** Tên thư mục (phần cuối của đường dẫn). */
  name: string
  linkedAt: string
  /** false nếu thư mục đã bị xoá/di chuyển kể từ lúc liên kết. */
  exists: boolean
}

// ───────────────────────── 0.3.0: tìm kiếm, xem trước, thư mục gần đây ─────────────────────────

export type SearchMode = "name" | "content" | "all"

export interface SearchOptions {
  /** "name": tên/đường dẫn; "content": nội dung; "all" (mặc định): cả hai. */
  mode?: SearchMode
  /** Giới hạn trong thư mục con (tương đối). */
  subPath?: string
  regex?: boolean
  /** Phân biệt hoa/thường và dấu tiếng Việt (mặc định: không — «bao cao» khớp «Báo cáo»). */
  caseSensitive?: boolean
  /** Chỉ các đuôi tệp này (không có dấu chấm). */
  exts?: string[]
  /** Số tệp tối đa trả về (mặc định 100, tối đa 500). */
  limit?: number
}

export interface SearchMatch {
  /** Số dòng (từ 1) trong văn bản đã trích. */
  line: number
  text: string
}

export interface SearchHit extends FileEntry {
  /** Tên/đường dẫn khớp truy vấn. */
  nameMatch: boolean
  /** Các dòng khớp trong nội dung (rỗng nếu chỉ khớp tên). */
  matches: SearchMatch[]
}

export interface SearchResult {
  query: string
  hits: SearchHit[]
  /** Số mục đã duyệt (tệp + thư mục). */
  scannedEntries: number
  /** Số tệp đã đọc nội dung. */
  scannedFiles: number
  /** Dừng sớm do giới hạn số mục/kết quả/thời gian. */
  truncated: boolean
  timedOut: boolean
  /** Số tệp bỏ qua vì quá lớn hoặc không đọc được nội dung. */
  skippedFiles: number
  elapsedMs: number
  /** Bị huỷ vì có tìm kiếm mới. */
  cancelled?: boolean
}

export type PreviewKind = "text" | "markdown" | "csv" | "document" | "image" | "unsupported"

export interface FilePreview {
  relPath: string
  name: string
  ext: string
  size: number
  mtimeMs: number
  kind: PreviewKind
  /** Văn bản (text/markdown/csv/document). */
  text?: string
  /** Ảnh: data URL (chỉ ảnh ≤ 8 MB). */
  dataUrl?: string
  width?: number
  height?: number
  truncated: boolean
  /** Ghi chú cho người dùng (vd «PDF quét ảnh, không có lớp chữ»). */
  note?: string
  /** Mở được bằng ứng dụng mặc định (không phải tệp thực thi). */
  openable: boolean
}

export interface RecentFolder {
  path: string
  name: string
  usedAt: string
  exists: boolean
}

export interface FolderChangeEvent {
  projectId: string
  /** Một số đường dẫn tương đối vừa thay đổi (có thể rỗng nếu hệ điều hành không cho biết). */
  paths: string[]
}

// ───────────────────────── Giai đoạn 2: trợ lý thư mục ─────────────────────────

export type ChangeKind = "create" | "modify" | "delete" | "rename"
export type ChangeStatus = "pending" | "accepted" | "rejected" | "undone" | "conflict" | "superseded"

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  /** Mỗi dòng bắt đầu bằng " ", "+", "-" (hoặc "\\" — không có xuống dòng cuối tệp). */
  lines: string[]
}

/** Một đề xuất thay đổi tệp để hiển thị (không chứa toàn văn). */
export interface ChangeView {
  id: string
  projectId: string
  sessionId: string
  kind: ChangeKind
  relPath: string
  newRelPath?: string
  format: "text" | "docx"
  status: ChangeStatus
  summary?: string
  createdAt: string
  decidedAt?: string
  error?: string
  /** Kích thước tệp gốc (byte). */
  size: number
  added: number
  removed: number
  hunks: DiffHunk[]
  /** Diff bị cắt bớt khi hiển thị. */
  truncated: boolean
  /** Xoá tệp không xem trước được nội dung (nhị phân/quá lớn). */
  binary: boolean
  /** 0.3.0: đề xuất áp lên THƯ MỤC (tạo thư mục, đổi tên/di chuyển thư mục, đưa thư mục vào thùng rác). */
  isDir?: boolean
  /** 0.3.0: xoá = chuyển vào Thùng rác/Recycle Bin của hệ điều hành (vẫn có bản sao để Hoàn tác). */
  trash?: boolean
  /** Số tệp bên trong (đề xuất về thư mục). */
  fileCount?: number
}

export interface AgentStatus {
  /** Đã có token của app cho máy chủ hiện tại. */
  connected: boolean
  user?: { email: string; name: string | null }
  server: string
  /** Hệ điều hành có kho khoá (Keychain/DPAPI) để lưu token. */
  secureStorage: boolean
  llm?: { available: boolean; model: string | null }
  error?: string
}

export type TranscriptItem =
  | { kind: "user"; text: string; at: string }
  | { kind: "assistant"; text: string; at: string }
  | { kind: "tool"; name: string; label: string; ok: boolean; summary: string; at: string }
  | { kind: "change"; changeId: string; at: string }
  | { kind: "notice"; level: "info" | "warn" | "error"; text: string; at: string }

export interface AgentSessionSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface AgentSession extends AgentSessionSummary {
  transcript: TranscriptItem[]
  /** runId nếu phiên đang chạy (vd người dùng rời trang rồi quay lại). */
  running?: string | null
}

export type AgentEvent =
  | { type: "run_start"; runId: string; projectId: string; sessionId: string }
  | { type: "delta"; runId: string; text: string }
  /** Kết thúc một lượt sinh văn bản (thay thế phần đã stream bằng bản cuối). */
  | { type: "assistant"; runId: string; text: string }
  | { type: "tool_start"; runId: string; callId: string; name: string; label: string }
  | { type: "tool_end"; runId: string; callId: string; name: string; label: string; ok: boolean; summary: string }
  | { type: "change"; runId: string; change: ChangeView }
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

/** Lệnh menu cần trang web xử lý (vd «Tệp → Mở thư mục dự án…» dùng chung luồng liên kết của thẻ). */
export type MenuCommand = "link-folder"

export interface NeuDesktopApi {
  readonly isDesktop: true
  readonly version: string
  readonly platform: string
  /** Mở hộp thoại chọn thư mục của hệ điều hành. Trả về null nếu người dùng huỷ. */
  pickProjectFolder(): Promise<string | null>
  /** Liên kết dự án với thư mục — `path` PHẢI là kết quả của `pickProjectFolder()` gần nhất. */
  linkProjectFolder(projectId: string, path: string): Promise<LinkedFolderInfo>
  getLinkedFolder(projectId: string): Promise<LinkedFolderInfo | null>
  unlinkProjectFolder(projectId: string): Promise<boolean>
  listFiles(projectId: string, subPath?: string, opts?: ListFilesOptions): Promise<ListFilesResult>
  readTextFile(projectId: string, relPath: string): Promise<ReadTextFileResult>
  revealInFolder(projectId: string, relPath?: string): Promise<void>
  openFile(projectId: string, relPath: string): Promise<void>
  /** Theo dõi thay đổi trong thư mục đã liên kết. Trả về hàm huỷ theo dõi. */
  onFolderChange(projectId: string, callback: (e: FolderChangeEvent) => void): () => void
  /** Cho menu ứng dụng biết dự án đang mở (để «Tệp → Mở thư mục dự án…» hoạt động). */
  setActiveProject(projectId: string | null): void
  /** Lệnh từ menu ứng dụng gửi xuống trang. Trả về hàm huỷ đăng ký. */
  onMenuCommand(callback: (command: MenuCommand) => void): () => void

  // ── 0.3.0: làm việc với thư mục ──
  /** Tìm theo tên và/hoặc nội dung trong toàn thư mục dự án (bỏ qua thư mục rác, có giới hạn). Tìm mới huỷ tìm cũ. */
  searchFiles(projectId: string, query: string, opts?: SearchOptions): Promise<SearchResult>
  /** Xem trước tệp: văn bản, Markdown, CSV, văn bản trích từ .docx/.pdf/.xlsx/.pptx…, ảnh. */
  previewFile(projectId: string, relPath: string): Promise<FilePreview>
  /** Các thư mục người dùng đã chọn gần đây (qua hộp thoại hoặc kéo-thả). */
  listRecentFolders(): Promise<RecentFolder[]>
  /** Liên kết dự án với một thư mục trong danh sách gần đây (không cần mở lại hộp thoại). */
  linkRecentFolder(projectId: string, path: string): Promise<LinkedFolderInfo>
  forgetRecentFolder(path: string): Promise<boolean>
  /**
   * Kéo-thả: nhận `File` của sự kiện drop (thư mục người dùng vừa kéo vào). Trả về đường dẫn để gọi
   * `linkProjectFolder` như sau hộp thoại. Trang không tự tạo được `File` mang đường dẫn thật.
   */
  pickDroppedFolder(file: unknown): Promise<string | null>

  // ── Giai đoạn 2: trợ lý thư mục ──
  agentGetStatus(): Promise<AgentStatus>
  /** Xin token cho app bằng phiên đăng nhập web hiện tại (tiến trình chính gọi máy chủ; trang không thấy token). */
  agentConnect(): Promise<AgentStatus>
  agentDisconnect(): Promise<AgentStatus>
  agentListSessions(projectId: string): Promise<AgentSessionSummary[]>
  agentGetSession(projectId: string, sessionId: string): Promise<AgentSession | null>
  agentDeleteSession(projectId: string, sessionId: string): Promise<boolean>
  /** Gửi câu hỏi; sessionId null = phiên mới. Tiến trình chạy nền, theo dõi qua onAgentEvent. */
  agentSend(projectId: string, sessionId: string | null, text: string): Promise<{ runId: string; sessionId: string }>
  agentStop(runId: string): Promise<boolean>
  onAgentEvent(callback: (e: AgentEvent) => void): () => void
  agentListChanges(projectId: string, sessionId?: string): Promise<ChangeView[]>
  /** Ghi thay đổi vào tệp — chỉ chạy khi người dùng vừa bấm (user activation) và xác nhận. */
  agentAcceptChange(projectId: string, changeId: string): Promise<ChangeView>
  agentRejectChange(projectId: string, changeId: string): Promise<ChangeView>
  agentUndoChange(projectId: string, changeId: string): Promise<ChangeView>
}

/** Tên kênh IPC. Preload chạy trong sandbox nên không import được tệp này lúc chạy — xem test channels. */
export const CHANNELS = {
  pickFolder: "neu:folder:pick",
  link: "neu:folder:link",
  getLinked: "neu:folder:get",
  unlink: "neu:folder:unlink",
  list: "neu:folder:list",
  read: "neu:folder:read",
  reveal: "neu:folder:reveal",
  open: "neu:folder:open",
  watch: "neu:folder:watch",
  unwatch: "neu:folder:unwatch",
  changed: "neu:folder:changed",
  setActiveProject: "neu:app:active-project",
  menuCommand: "neu:app:menu-command",
  search: "neu:folder:search",
  preview: "neu:folder:preview",
  recentList: "neu:folder:recent",
  recentLink: "neu:folder:recent-link",
  recentForget: "neu:folder:recent-forget",
  dropPick: "neu:folder:drop-pick",
  agentStatus: "neu:agent:status",
  agentConnect: "neu:agent:connect",
  agentDisconnect: "neu:agent:disconnect",
  agentListSessions: "neu:agent:sessions",
  agentGetSession: "neu:agent:session",
  agentDeleteSession: "neu:agent:session-delete",
  agentSend: "neu:agent:send",
  agentStop: "neu:agent:stop",
  agentEvent: "neu:agent:event",
  agentListChanges: "neu:agent:changes",
  agentAccept: "neu:agent:accept",
  agentReject: "neu:agent:reject",
  agentUndo: "neu:agent:undo",
} as const

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS]
