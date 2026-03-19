// lib/tool-icons.ts – Icon riêng cho từng ứng dụng (tools) trên trang /tools
import type { IconName } from "@/lib/assistants"
import { getIconComponent } from "@/lib/assistants"
import type { LucideIcon } from "lucide-react"

/**
 * Map alias ứng dụng -> icon name (phù hợp và không trùng giữa các ứng dụng).
 * Dùng khi hiển thị danh sách tools để mỗi app có icon riêng.
 */
export const TOOL_ALIAS_ICON: Record<string, IconName> = {
  // Research
  quantis: "BarChart2",
  annota: "Award",
  bibliomap: "MapPin",
  writium: "Newspaper",
  surveylab: "ListTodo",
  // Education
  "library-search": "Search",
  scoreup: "GraduationCap",
  convertum: "Calculator",
  scorum: "Sparkles",
  smartdoc: "BookOpen",
  // Productivity
  pomodoro: "Timer",
  // Games
  "game-2048": "Gamepad",
  // Utilities
  "unit-converter": "Wrench",
  // General / fallback-friendly
  datium: "Database",
  write: "FileText",
  code: "Code",
}

/**
 * Trả về Icon component dùng cho tool: ưu tiên icon theo alias, không có thì dùng fallback từ API.
 */
export function getToolIcon(alias: string, fallbackIcon: LucideIcon): LucideIcon {
  const key = (alias || "").trim().toLowerCase()
  const iconName = TOOL_ALIAS_ICON[key]
  return iconName ? getIconComponent(iconName) : fallbackIcon
}
