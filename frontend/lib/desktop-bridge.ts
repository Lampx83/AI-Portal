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

export type DesktopListFilesResult = { subPath: string; entries: DesktopFileEntry[]; truncated: boolean }
export type DesktopReadTextFileResult = { relPath: string; content: string; size: number; truncated: boolean }
export type DesktopLinkedFolder = { projectId: string; path: string; name: string; linkedAt: string; exists: boolean }
export type DesktopFolderChange = { projectId: string; paths: string[] }
export type DesktopMenuCommand = "link-folder"

export type NeuDesktopBridge = {
  readonly isDesktop: true
  readonly version: string
  readonly platform: string
  pickProjectFolder(): Promise<string | null>
  linkProjectFolder(projectId: string, path: string): Promise<DesktopLinkedFolder>
  getLinkedFolder(projectId: string): Promise<DesktopLinkedFolder | null>
  unlinkProjectFolder(projectId: string): Promise<boolean>
  listFiles(projectId: string, subPath?: string): Promise<DesktopListFilesResult>
  readTextFile(projectId: string, relPath: string): Promise<DesktopReadTextFileResult>
  revealInFolder(projectId: string, relPath?: string): Promise<void>
  openFile(projectId: string, relPath: string): Promise<void>
  onFolderChange(projectId: string, callback: (e: DesktopFolderChange) => void): () => void
  setActiveProject(projectId: string | null): void
  onMenuCommand(callback: (command: DesktopMenuCommand) => void): () => void
}

/** Trả về cầu nối (API thư mục dự án) nếu đang chạy trong ứng dụng desktop, ngược lại null. */
export function getDesktopBridge(): NeuDesktopBridge | null {
  if (typeof window === "undefined") return null
  const api = (window as unknown as { neuDesktop?: Partial<NeuDesktopBridge> }).neuDesktop
  // Kiểm tra theo hàm (không chỉ isDesktop): bản desktop thử nghiệm cũ (12/10/2026) có API khác.
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
