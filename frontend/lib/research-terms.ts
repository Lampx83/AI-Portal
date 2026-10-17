/**
 * Chính sách quyền riêng tư và mục "Sử dụng dữ liệu cho mục đích nghiên cứu và
 * cải tiến giáo dục" (app/chinh-sach-quyen-rieng-tu, chuỗi ở lib/i18n/locales/{vi,en}.ts → privacy.*).
 */

/**
 * Email nhận đề nghị không dùng dữ liệu cho nghiên cứu. Khi còn null, trang hiện
 * placeholder theo ngôn ngữ (privacy.contactPlaceholder).
 * TODO(tos-nghien-cuu): thay email liên hệ khi thầy cung cấp
 */
export const RESEARCH_CONTACT_EMAIL: string | null = null

/** Route công khai (không nằm trong matcher của middleware.ts nên không cần đăng nhập). Next tự thêm basePath cho <Link>/router. */
export const PRIVACY_POLICY_PATH = "/chinh-sach-quyen-rieng-tu"

/** Anchor của mục nghiên cứu: /chinh-sach-quyen-rieng-tu#nghien-cuu */
export const RESEARCH_SECTION_ID = "nghien-cuu"

export const RESEARCH_SECTION_PATH = `${PRIVACY_POLICY_PATH}#${RESEARCH_SECTION_ID}`

/** Cờ localStorage: người dùng đã xem/đóng thông báo về mục nghiên cứu. */
export const RESEARCH_NOTICE_STORAGE_KEY = "tos-nghien-cuu-2026-10-seen"

export const RESEARCH_ITEMS = [
  "dataUsed",
  "anonymised",
  "aggregate",
  "noEffect",
  "security",
  "rights",
  "surveys",
] as const

/** Tên hệ thống hiển thị, cùng cách tính với components/header.tsx. */
export function systemDisplayName(systemName: string | undefined, t: (key: string) => string): string {
  const fromBranding = systemName?.trim()
  if (fromBranding) return fromBranding
  const short = t("app.shortName")
  return short && short !== "app.shortName" ? short : "AI Portal"
}
