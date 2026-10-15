/** Chuỗi giao diện của phần vỏ (menu, hộp thoại). */
const vi = {
  appName: "NEU Research",
  file: "Tệp",
  home: "Trang chủ",
  linkFolder: "Mở thư mục dự án…",
  revealFolder: "Mở trong Finder",
  revealFolderWin: "Mở trong Explorer",
  server: "Máy chủ",
  serverCustom: "Tuỳ chỉnh (sửa tệp cấu hình)…",
  menuLanguage: "Ngôn ngữ menu",
  close: "Đóng cửa sổ",
  quit: "Thoát",
  edit: "Sửa",
  view: "Xem",
  reload: "Tải lại",
  forceReload: "Tải lại (bỏ bộ nhớ đệm)",
  back: "Quay lại",
  forward: "Tiến tới",
  zoomIn: "Phóng to",
  zoomOut: "Thu nhỏ",
  resetZoom: "Kích thước thật",
  fullscreen: "Toàn màn hình",
  devtools: "Công cụ nhà phát triển",
  window: "Cửa sổ",
  help: "Trợ giúp",
  guide: "Hướng dẫn sử dụng",
  website: "Mở bản web trong trình duyệt",
  about: "Phiên bản",
  aboutTitle: "Về ứng dụng",
  aboutDetail:
    "Hệ thống hỗ trợ nghiên cứu khoa học dựa trên AI\nĐại học Kinh tế Quốc dân\n\nPhiên bản: {version}\nElectron {electron} · Chromium {chrome}\nMáy chủ: {server}",
  ok: "Đóng",
  noProjectTitle: "Chưa mở dự án",
  noProjectDetail: "Hãy mở một dự án trong hệ thống trước, sau đó chọn lại mục này để liên kết thư mục trên máy.",
  noLinkedDetail: "Dự án đang mở chưa liên kết thư mục trên máy.",
  pickFolderTitle: "Chọn thư mục cho dự án",
  pickFolderButton: "Chọn thư mục",
  switchServerTitle: "Đổi máy chủ",
  switchServerDetail: "Chuyển sang {server}? Bạn có thể cần đăng nhập lại.",
  switchServerOk: "Chuyển",
  cancel: "Huỷ",
  configHint: "Sửa «portalUrl» trong tệp cấu hình rồi khởi động lại ứng dụng.",
  micDetail: "Ứng dụng dùng micro khi bạn nhập câu hỏi bằng giọng nói.",
}

type Dict = typeof vi

const en: Dict = {
  appName: "NEU Research",
  file: "File",
  home: "Home",
  linkFolder: "Open Project Folder…",
  revealFolder: "Show in Finder",
  revealFolderWin: "Show in Explorer",
  server: "Server",
  serverCustom: "Custom (edit config file)…",
  menuLanguage: "Menu Language",
  close: "Close Window",
  quit: "Quit",
  edit: "Edit",
  view: "View",
  reload: "Reload",
  forceReload: "Force Reload",
  back: "Back",
  forward: "Forward",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  resetZoom: "Actual Size",
  fullscreen: "Toggle Full Screen",
  devtools: "Developer Tools",
  window: "Window",
  help: "Help",
  guide: "User Guide",
  website: "Open Web Version in Browser",
  about: "Version",
  aboutTitle: "About",
  aboutDetail:
    "AI-powered Research Support System\nNational Economics University\n\nVersion: {version}\nElectron {electron} · Chromium {chrome}\nServer: {server}",
  ok: "Close",
  noProjectTitle: "No project open",
  noProjectDetail: "Open a project in the system first, then choose this item again to link a folder on this computer.",
  noLinkedDetail: "The current project is not linked to a folder on this computer.",
  pickFolderTitle: "Choose a folder for this project",
  pickFolderButton: "Choose Folder",
  switchServerTitle: "Switch server",
  switchServerDetail: "Switch to {server}? You may need to sign in again.",
  switchServerOk: "Switch",
  cancel: "Cancel",
  configHint: "Edit “portalUrl” in the config file, then restart the app.",
  micDetail: "The app uses the microphone when you dictate a question.",
}

export type StringKey = keyof Dict

/** Mặc định tiếng Việt; người dùng đổi sang tiếng Anh trong menu (lưu ở cấu hình). */
export function pickLocale(configured: "vi" | "en" | undefined): "vi" | "en" {
  return configured ?? "vi"
}

export function tr(locale: "vi" | "en", key: StringKey, vars: Record<string, string> = {}): string {
  const s = (locale === "vi" ? vi : en)[key]
  return s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}
