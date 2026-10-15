/**
 * Hợp đồng API giữa ứng dụng desktop và trang web của hệ thống.
 *
 * Trang web (frontend AI-Portal) truy cập qua `window.neuDesktop` — chỉ có mặt khi trang thuộc
 * đúng origin hệ thống đã cấu hình. Bản sao kiểu của tệp này nằm ở
 * `frontend/lib/desktop-bridge.ts`; khi đổi API phải sửa cả hai nơi.
 *
 * Giai đoạn 1: CHỈ ĐỌC. Giai đoạn 2 sẽ thêm `proposeWrite` / `applyPatch` (có bước người dùng duyệt diff).
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
  /** true nếu số mục vượt giới hạn và danh sách đã bị cắt. */
  truncated: boolean
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

export interface FolderChangeEvent {
  projectId: string
  /** Một số đường dẫn tương đối vừa thay đổi (có thể rỗng nếu hệ điều hành không cho biết). */
  paths: string[]
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
  listFiles(projectId: string, subPath?: string): Promise<ListFilesResult>
  readTextFile(projectId: string, relPath: string): Promise<ReadTextFileResult>
  revealInFolder(projectId: string, relPath?: string): Promise<void>
  openFile(projectId: string, relPath: string): Promise<void>
  /** Theo dõi thay đổi trong thư mục đã liên kết. Trả về hàm huỷ theo dõi. */
  onFolderChange(projectId: string, callback: (e: FolderChangeEvent) => void): () => void
  /** Cho menu ứng dụng biết dự án đang mở (để «Tệp → Mở thư mục dự án…» hoạt động). */
  setActiveProject(projectId: string | null): void
  /** Lệnh từ menu ứng dụng gửi xuống trang. Trả về hàm huỷ đăng ký. */
  onMenuCommand(callback: (command: MenuCommand) => void): () => void
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
} as const

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS]
