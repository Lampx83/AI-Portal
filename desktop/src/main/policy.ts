/**
 * Chính sách điều hướng / cửa sổ mới / quyền — viết dạng hàm thuần để kiểm thử đơn vị.
 */

export interface PortalTarget {
  /** URL đầy đủ để mở (vd https://research.neu.edu.vn hoặc https://ai.neu.edu.vn/research). */
  url: string
  origin: string
  /** Tiền tố đường dẫn ("" hoặc "/research") — hệ thống chạy dưới đường dẫn con. */
  basePath: string
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

/** Chuẩn hoá địa chỉ hệ thống. https bắt buộc, trừ localhost/127.0.0.1 khi phát triển. */
export function parsePortalUrl(input: string): PortalTarget {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    throw new Error(`Địa chỉ hệ thống không hợp lệ: ${input}`)
  }
  if (u.username || u.password) throw new Error("Địa chỉ hệ thống không được chứa tài khoản/mật khẩu")
  if (u.protocol !== "https:" && !(u.protocol === "http:" && LOOPBACK.has(u.hostname))) {
    throw new Error("Địa chỉ hệ thống phải dùng https (http chỉ cho localhost khi phát triển)")
  }
  const basePath = u.pathname.replace(/\/+$/, "")
  return { url: `${u.origin}${basePath}`, origin: u.origin, basePath }
}

/** Trang có thuộc hệ thống đã cấu hình không (cùng origin và nằm dưới basePath). */
export function isPortalUrl(url: string, portal: PortalTarget): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.origin !== portal.origin) return false
  if (!portal.basePath) return true
  return u.pathname === portal.basePath || u.pathname.startsWith(portal.basePath + "/")
}

/**
 * Máy chủ đăng nhập được phép điều hướng NGAY TRONG cửa sổ (để cookie phiên quay về đúng ứng dụng).
 * NEU dùng Microsoft Entra ID liên kết (federated) với ADFS sso.neu.edu.vn.
 */
export const DEFAULT_AUTH_HOSTS = [
  "login.microsoftonline.com",
  "login.microsoft.com",
  "login.live.com",
  "account.live.com",
  "device.login.microsoftonline.com",
  "autologon.microsoftazuread-sso.com",
  "sso.neu.edu.vn",
]

export function isAuthUrl(url: string, authHosts: readonly string[]): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "https:" && authHosts.includes(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

export type NavigationDecision = "allow" | "external" | "block"

/**
 * Điều hướng khung chính (bấm liên kết, chuyển hướng máy chủ).
 *  - trong hệ thống hoặc máy chủ đăng nhập → cho phép trong cửa sổ
 *  - http(s)/mailto khác → mở bằng trình duyệt/ứng dụng mặc định của máy
 *  - còn lại (file:, javascript:, data:, giao thức lạ) → chặn
 */
export function decideNavigation(url: string, portal: PortalTarget, authHosts: readonly string[]): NavigationDecision {
  if (isPortalUrl(url, portal)) return "allow"
  if (isAuthUrl(url, authHosts)) return "allow"
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return "block"
  }
  if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") return "external"
  return "block"
}

export type WindowOpenDecision = "child" | "external" | "block"

/** window.open / target=_blank: trang của hệ thống mở trong cửa sổ con an toàn; còn lại ra trình duyệt. */
export function decideWindowOpen(url: string, portal: PortalTarget): WindowOpenDecision {
  if (isPortalUrl(url, portal)) return "child"
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return "block"
  }
  if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") return "external"
  return "block"
}

/**
 * Quyền trình duyệt. Chỉ trang thuộc hệ thống mới được cấp, và chỉ các quyền cần thiết:
 *  - clipboard-sanitized-write: nút «Sao chép» câu trả lời
 *  - media (chỉ micro): nhập bằng giọng nói trong khung chat
 *  - fullscreen: xem toàn màn hình (video, biểu đồ)
 * Camera, vị trí, thông báo, MIDI, HID/USB/Serial… đều từ chối.
 */
export function decidePermission(
  permission: string,
  requestingUrl: string,
  portal: PortalTarget,
  details: { mediaTypes?: string[] } = {},
): boolean {
  if (!isPortalUrl(requestingUrl, portal)) return false
  switch (permission) {
    case "clipboard-sanitized-write":
    case "fullscreen":
      return true
    case "media": {
      const types = details.mediaTypes ?? []
      // Kiểm tra quyền (permission check) không kèm mediaTypes → chỉ trả lời cho audio ở bước request.
      return types.length > 0 && types.every((t) => t === "audio")
    }
    default:
      return false
  }
}
