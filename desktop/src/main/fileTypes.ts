/**
 * Loại tệp KHÔNG được mở bằng ứng dụng mặc định khi lệnh đến từ trang web.
 * Lý do: `shell.openPath` trên tệp thực thi/kịch bản = chạy chương trình. Nếu trang web bị chiếm quyền
 * (XSS), kẻ tấn công không được biến «mở tệp» thành «chạy mã» trên máy người dùng.
 * Người dùng vẫn có thể «Hiện trong Finder/Explorer» rồi tự mở.
 */
const BLOCKED_EXTENSIONS = new Set([
  // macOS
  "app", "command", "tool", "terminal", "workflow", "action", "scpt", "scptd", "applescript", "osax",
  "prefpane", "kext", "pkg", "mpkg", "dmg", "webloc", "inetloc", "fileloc", "dylib", "bundle", "plugin",
  // Windows
  "exe", "com", "bat", "cmd", "msi", "msp", "msc", "ps1", "psm1", "psd1", "vbs", "vbe", "js", "jse", "wsf", "wsh",
  "hta", "scr", "pif", "cpl", "lnk", "url", "reg", "inf", "gadget", "application", "appref-ms", "settingcontent-ms",
  "library-ms", "search-ms", "searchconnector-ms", "appx", "appxbundle", "msix", "msixbundle", "dll", "sys", "iso",
  "img", "vhd", "vhdx", "chm", "jnlp", "ins", "isp",
  // Kịch bản đa nền tảng (trình mở mặc định có thể CHẠY chúng, ví dụ Python Launcher)
  "sh", "bash", "zsh", "csh", "ksh", "fish", "py", "pyw", "pyc", "pyz", "rb", "pl", "php", "jar", "class",
  "desktop", "run", "bin", "elf", "out", "appimage", "deb", "rpm",
])

export function extOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  const i = base.lastIndexOf(".")
  if (i <= 0 || i === base.length - 1) return ""
  return base.slice(i + 1).toLowerCase()
}

/**
 * @param name tên tệp
 * @param mode stat.mode (để phát hiện tệp không đuôi có quyền thực thi trên macOS/Linux)
 * @returns lý do chặn hoặc null nếu được phép mở
 */
export function openBlockedReason(name: string, mode: number, platform: NodeJS.Platform = process.platform): string | null {
  // Bỏ các dấu chấm/khoảng trắng cuối (Windows tự cắt chúng: "a.exe." chạy như "a.exe").
  const cleaned = name.replace(/[. ]+$/, "")
  const ext = extOf(cleaned)
  if (BLOCKED_EXTENSIONS.has(ext)) return `Không mở trực tiếp tệp .${ext} từ ứng dụng vì có thể chạy chương trình. Hãy dùng «Hiện trong thư mục».`
  if (platform !== "win32" && ext === "" && (mode & 0o111) !== 0) {
    return "Tệp không có phần mở rộng và có quyền thực thi — không mở trực tiếp. Hãy dùng «Hiện trong thư mục»."
  }
  return null
}

/** Tệp/thư mục bỏ qua khi liệt kê và theo dõi. */
const IGNORED_NAMES = new Set([
  "node_modules", "__pycache__", "Thumbs.db", "desktop.ini", "$RECYCLE.BIN", "System Volume Information",
  ".DS_Store", "Icon\r",
])

export function isIgnoredName(name: string): boolean {
  return name.startsWith(".") || name.startsWith("~$") || IGNORED_NAMES.has(name)
}

/** true nếu một đoạn bất kỳ trong đường dẫn tương đối bị bỏ qua. */
export function isIgnoredRelPath(rel: string): boolean {
  return rel.split(/[\\/]+/).some((seg) => seg !== "" && isIgnoredName(seg))
}
