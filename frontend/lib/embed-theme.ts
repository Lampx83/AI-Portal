// Theme color and icon for embed page – used in URL ?color=...&icon=...

import { AGENT_ICON_OPTIONS, type IconName } from "@/lib/assistants"

/** Các màu cho phép khi nhúng (query param: color hoặc theme) */
export const EMBED_COLOR_OPTIONS = [
  { value: "blue", label: "Xanh dương", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500" },
  { value: "emerald", label: "Xanh lá", bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500" },
  { value: "violet", label: "Tím", bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500" },
  { value: "amber", label: "Vàng cam", bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500" },
  { value: "sky", label: "Xanh trời", bg: "bg-sky-100 dark:bg-sky-900/40", text: "text-sky-600 dark:text-sky-400", border: "border-sky-500" },
  { value: "indigo", label: "Chàm", bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500" },
  { value: "rose", label: "Hồng", bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500" },
  { value: "teal", label: "Xanh lục lam", bg: "bg-teal-100 dark:bg-teal-900/40", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500" },
] as const

export type EmbedColorValue = (typeof EMBED_COLOR_OPTIONS)[number]["value"]

const colorMap = new Map(EMBED_COLOR_OPTIONS.map((c) => [c.value, c]))

export function getEmbedTheme(colorValue: string | null | undefined) {
  if (!colorValue) return null
  return colorMap.get(colorValue as EmbedColorValue) ?? null
}

export type { IconName } from "@/lib/assistants"

/** Icon cho embed – 8 lựa chọn (bỏ bớt 2 so với form Sửa Agent) */
export const EMBED_ICON_OPTIONS: IconName[] = AGENT_ICON_OPTIONS.slice(0, 8)

export function isValidEmbedIcon(icon: string | null | undefined): icon is IconName {
  return typeof icon === "string" && EMBED_ICON_OPTIONS.includes(icon as IconName)
}
