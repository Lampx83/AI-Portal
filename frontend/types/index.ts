/** Dự án (Projects của tôi) – dùng id string (UUID) khi lấy từ API */
export interface Project {
  id: string | number
  name: string
  description?: string | null
  team_members?: string[]
  file_keys?: string[]
  tags?: string[]
  icon?: string | null
  created_at?: string
  updated_at?: string
  /** true khi dự án được chia sẻ cho user hiện tại (không phải chủ sở hữu) */
  is_shared?: boolean
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
