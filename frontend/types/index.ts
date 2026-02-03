/** Dự án nghiên cứu (Nghiên cứu của tôi) – dùng id string (UUID) khi lấy từ API */
export interface Research {
  id: string | number
  name: string
  description?: string | null
  team_members?: string[]
  file_keys?: string[]
  created_at?: string
  updated_at?: string
  /** true khi nghiên cứu được chia sẻ cho user hiện tại (không phải chủ sở hữu) */
  is_shared?: boolean
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
