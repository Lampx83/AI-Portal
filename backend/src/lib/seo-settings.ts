/**
 * Cấu hình SEO / Google Search Console lưu trong ai_portal.app_settings:
 *  - seo_google_site_verification: mã xác minh quyền sở hữu (thẻ <meta name="google-site-verification">)
 *  - seo_bing_site_verification:   mã xác minh Bing Webmaster (thẻ <meta name="msvalidate.01">)
 * Hai mã này vốn là công khai (nằm trong HTML của mọi trang) nên endpoint đọc không cần xác thực.
 */
import { query } from "./db"

export const SEO_KEYS = ["seo_google_site_verification", "seo_bing_site_verification"] as const

export type SeoSettings = {
  googleSiteVerification: string
  bingSiteVerification: string
}

const TOKEN_RE = /^[A-Za-z0-9_-]{10,128}$/

/**
 * Chấp nhận nhiều cách dán: mã trơn, nguyên thẻ <meta ... content="...">, hoặc dạng TXT
 * "google-site-verification=...". Trả "" nếu rỗng, null nếu không hợp lệ.
 */
export function normalizeVerificationToken(raw: unknown): string | null {
  if (raw == null) return ""
  let s = String(raw).trim()
  if (!s) return ""
  const meta = s.match(/content\s*=\s*["']([^"']+)["']/i)
  if (meta) s = meta[1].trim()
  s = s.replace(/^google-site-verification\s*=\s*/i, "").trim()
  return TOKEN_RE.test(s) ? s : null
}

export async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [Array.from(SEO_KEYS)]
    )
    const map = Object.fromEntries(rows.rows.map((r) => [r.key, r.value]))
    return {
      googleSiteVerification: normalizeVerificationToken(map.seo_google_site_verification) || "",
      bingSiteVerification: normalizeVerificationToken(map.seo_bing_site_verification) || "",
    }
  } catch {
    return { googleSiteVerification: "", bingSiteVerification: "" }
  }
}

export async function saveSeoSettings(s: SeoSettings): Promise<void> {
  await query(
    `INSERT INTO ai_portal.app_settings (key, value) VALUES ('seo_google_site_verification', $1), ('seo_bing_site_verification', $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [s.googleSiteVerification, s.bingSiteVerification]
  )
}
