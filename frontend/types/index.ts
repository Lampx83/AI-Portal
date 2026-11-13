import type { ProjectLifecycle } from "@/lib/project-lifecycle"
export interface ProjectMember {
  email: string
  role: "editor" | "viewer"
  display_name?: string | null
  has_account?: boolean
}
export interface ProjectFileMeta {
  name: string
  size: number
  mime: string
  folder: string
  by: string
  at: string
}
/** Dự án (Projects của tôi) – dùng id string (UUID) khi lấy từ API */
export interface Project {
  id: string | number
  name: string
  description?: string | null
  team_members?: string[]
  file_keys?: string[]
  tags?: string[]
  icon?: string | null
  /** Vòng đời nghiên cứu (null = chưa có dữ liệu → 6 giai đoạn «chưa bắt đầu») */
  lifecycle?: ProjectLifecycle | null
  created_at?: string
  updated_at?: string
  /** true khi dự án được chia sẻ cho user hiện tại (không phải chủ sở hữu) */
  is_shared?: boolean
  /** Vai của người dùng hiện tại: chủ / biên tập / xem */
  my_role?: "owner" | "editor" | "viewer"
  /** Thành viên kèm vai (chỉ có khi lấy từ API danh sách) */
  members?: ProjectMember[]
  /** Siêu dữ liệu tệp: khoá → tên gốc, kích thước, thư mục, người tải */
  file_meta?: Record<string, ProjectFileMeta>
  /** Email chủ sở hữu (có khi is_shared) */
  owner_email?: string | null
  /** Tên hiển thị chủ sở hữu (có khi is_shared) */
  owner_display_name?: string | null
}

export type ViewType =
  | "chat"
  | "experts"
  | "conferences"
  | "neu-data"
  | "citation"
  | "statistics"
  | "plagiarism"
  | "grants"
  | "translation"
