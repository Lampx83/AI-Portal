// Server-only: fetch branding for generateMetadata (link preview). No window/client.

const DEFAULT_TITLE = "AI Portal"
const DEFAULT_DESCRIPTION = "AI Portal – Interface and orchestration platform for AI."

function getEnvOrDefault(key: string, fallback: string): string {
  const raw = (process.env[key] || "").trim()
  return raw || fallback
}

function getServerBaseUrl(): string {
  // BẮT BUỘC ưu tiên backend nội bộ (http://backend:3001): đây là fetch server-side,
  // gọi ra URL public (ai.neu.edu.vn) từ trong server bị treo ~21s chờ TCP timeout
  // (hairpin NAT/firewall) trên MỌI SSR động — từng làm trang gốc mất 21s/request.
  // Fetch lỗi không được Next cache nên treo lặp lại vô hạn.
  const internal = (process.env.BACKEND_URL || "").trim()
  if (internal) return internal.replace(/\/+$/, "")
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.APP_URL || "").trim()
  if (base) return base.replace(/\/+$/, "")
  if (process.env.NODE_ENV === "development") return "http://localhost:3000"
  return ""
}

export type ServerBranding = { systemName: string; systemSubtitle?: string }

/** Fetch system name and subtitle for metadata (og:title, og:description). Used in root layout generateMetadata. */
export async function getBrandingForMetadata(): Promise<ServerBranding> {
  try {
    const base = getServerBaseUrl()
    if (!base) return { systemName: "", systemSubtitle: undefined }
    // Cache 5 phút: branding đổi rất hiếm. Trước đây no-store khiến MỌI request SSR
    // (root layout chạy trên mọi trang) gọi backend → nghẽn event loop khi tải cao.
    // Timeout 3s: nếu đích không phản hồi thì trả mặc định ngay, không treo SSR.
    const res = await fetch(`${base}/api/setup/branding`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { systemName: "", systemSubtitle: undefined }
    const d = data as { systemName?: string; systemSubtitle?: string }
    const systemName = typeof d.systemName === "string" ? d.systemName.trim() : ""
    const systemSubtitle =
      typeof d.systemSubtitle === "string" && d.systemSubtitle.trim()
        ? d.systemSubtitle.trim()
        : undefined
    return { systemName, systemSubtitle }
  } catch {
    return { systemName: "", systemSubtitle: undefined }
  }
}

export function getDefaultTitle(): string {
  return getEnvOrDefault("PORTAL_DEFAULT_TITLE", DEFAULT_TITLE)
}

export function getDefaultDescription(): string {
  return getEnvOrDefault("PORTAL_DEFAULT_DESCRIPTION", DEFAULT_DESCRIPTION)
}

/** Tên hệ thống đã resolve (branding API → PORTAL_DEFAULT_TITLE) — dùng làm hậu tố tiêu đề tab. */
export async function getSystemTitle(): Promise<string> {
  const { systemName } = await getBrandingForMetadata()
  return systemName || getDefaultTitle()
}

/** URL công khai của app (đã gồm basePath, vd. https://ai.neu.edu.vn/tuyen-sinh). Rỗng nếu chưa cấu hình. */
export function getAppUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")
}
