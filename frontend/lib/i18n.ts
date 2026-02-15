// Hỗ trợ 2 ngôn ngữ: vi | en. Người dùng cấu hình trong Cài đặt hệ thống.
export type Locale = "vi" | "en"

const STORAGE_KEY = "neu-locale"

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "vi"
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === "en" || v === "vi") return v
  } catch (_) {}
  return "vi"
}

export function setStoredLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch (_) {}
}

export const translations: Record<Locale, Record<string, string>> = {
  vi: {
    "settings.title": "Cài đặt hệ thống",
    "settings.subtitle": "Tùy chỉnh trải nghiệm sử dụng AI Portal",
    "settings.appearance": "Giao diện",
    "settings.appearanceDesc": "Tùy chỉnh ngôn ngữ và giao diện",
    "settings.language": "Ngôn ngữ",
    "settings.theme": "Chủ đề",
    "settings.themeLight": "Sáng",
    "settings.themeDark": "Tối",
    "settings.themeSystem": "Theo hệ thống",
    "settings.langVi": "Tiếng Việt",
    "settings.langEn": "English",
    "settings.notifications": "Thông báo",
    "settings.notificationsDesc": "Quản lý các loại thông báo. Mặc định tắt; thông báo email sẽ gửi đến địa chỉ bên dưới nếu bật.",
    "settings.notificationsEmailTo": "Thông báo sẽ gửi đến email:",
    "settings.notificationsEmail": "Thông báo email",
    "settings.notificationsPush": "Thông báo đẩy",
    "settings.notificationsProjects": "Cập nhật dự án",
    "settings.notificationsPublications": "Cơ hội công bố",
    "settings.privacy": "Quyền riêng tư",
    "settings.privacyDesc": "Kiểm soát thông tin hiển thị. Mặc định tắt; thay đổi được lưu vào tài khoản.",
    "settings.privacyProfile": "Hồ sơ công khai",
    "settings.privacyProjects": "Dự án công khai",
    "settings.privacyPublications": "Công bố công khai",
    "settings.ai": "Trợ lý AI",
    "settings.aiDesc": "Tùy chỉnh hành vi của AI",
    "settings.aiPersonalization": "Cá nhân hóa",
    "settings.aiAutoSuggestions": "Gợi ý tự động",
    "settings.aiExternalSearch": "Tìm kiếm thông tin từ bên ngoài",
    "settings.aiResponseLength": "Độ dài phản hồi",
    "settings.aiResponseShort": "Ngắn",
    "settings.aiResponseMedium": "Trung bình",
    "settings.aiResponseLong": "Dài",
    "settings.aiCreativity": "Độ sáng tạo",
    "settings.data": "Dữ liệu",
    "settings.dataDesc": "Quản lý lưu trữ và đồng bộ",
    "settings.dataAutoBackup": "Sao lưu tự động",
    "settings.dataSync": "Đồng bộ đám mây",
    "settings.dataCacheSize": "Kích thước cache",
    "settings.dataClearCache": "Xóa cache",
    "settings.dataExport": "Xuất dữ liệu",
    "settings.save": "Lưu cài đặt",
    "settings.saving": "Đang lưu...",
    "settings.saved": "Đã lưu cài đặt",
  },
  en: {
    "settings.title": "System Settings",
    "settings.subtitle": "Customize your AI Portal experience",
    "settings.appearance": "Appearance",
    "settings.appearanceDesc": "Language and display",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.themeSystem": "System",
    "settings.langVi": "Tiếng Việt",
    "settings.langEn": "English",
    "settings.notifications": "Notifications",
    "settings.notificationsDesc": "Manage notification types. Default: all off; email notifications will be sent to the address below when enabled.",
    "settings.notificationsEmailTo": "Notifications will be sent to email:",
    "settings.notificationsEmail": "Email notifications",
    "settings.notificationsPush": "Push notifications",
    "settings.notificationsProjects": "Project updates",
    "settings.notificationsPublications": "Publication opportunities",
    "settings.privacy": "Privacy",
    "settings.privacyDesc": "Control what information is visible. Default: all off; changes are saved to your account.",
    "settings.privacyProfile": "Profile visible",
    "settings.privacyProjects": "Projects visible",
    "settings.privacyPublications": "Publications visible",
    "settings.ai": "AI Assistant",
    "settings.aiDesc": "Customize AI behavior",
    "settings.aiPersonalization": "Personalization",
    "settings.aiAutoSuggestions": "Auto suggestions",
    "settings.aiExternalSearch": "Search for information from external sources",
    "settings.aiResponseLength": "Response length",
    "settings.aiResponseShort": "Short",
    "settings.aiResponseMedium": "Medium",
    "settings.aiResponseLong": "Long",
    "settings.aiCreativity": "Creativity",
    "settings.data": "Data",
    "settings.dataDesc": "Storage and sync",
    "settings.dataAutoBackup": "Auto backup",
    "settings.dataSync": "Cloud sync",
    "settings.dataCacheSize": "Cache size",
    "settings.dataClearCache": "Clear cache",
    "settings.dataExport": "Export data",
    "settings.save": "Save settings",
    "settings.saving": "Saving...",
    "settings.saved": "Settings saved",
  },
}

export function t(locale: Locale, key: string): string {
  return translations[locale]?.[key] ?? translations.vi[key] ?? key
}
