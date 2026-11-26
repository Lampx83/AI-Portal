import { createHmac } from "node:crypto"
import { getSetting } from "./settings"

/**
 * Tích hợp Feedback Hub (https://github.com/Lampx83/FeedbackHub) — hộp góp ý dùng chung.
 * Cấu hình ở Admin → Cài đặt hệ thống (app_settings), mỗi instance (Research, Thư viện, Tuyển sinh…) một dự án riêng:
 *   FEEDBACK_HUB_URL      địa chỉ hub, vd. https://fit.neu.edu.vn/feedbackhub
 *   FEEDBACK_HUB_PROJECT  mã dự án trên hub (vd. ai-research)
 *   FEEDBACK_HUB_SECRET   khoá ký của dự án — chỉ ở máy chủ, không bao giờ gửi xuống trình duyệt
 * Thiếu một trong ba ⇒ tắt hoàn toàn: giữ nguyên hộp góp ý cũ, không route nào hoạt động.
 */
export const hubUrl = () => getSetting("FEEDBACK_HUB_URL").replace(/\/+$/, "")
export const hubProject = () => getSetting("FEEDBACK_HUB_PROJECT")
export const hubEnabled = () => /^https?:\/\//i.test(hubUrl()) && /^[a-z0-9][a-z0-9-]{0,60}$/.test(hubProject()) && getSetting("FEEDBACK_HUB_SECRET").length >= 16

const TTL_SEC = 600
const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url")

export type FeedbackIdentity = { id: string; name: string; email?: string | null; admin: boolean }

/** Token HS256 sống 10 phút (widget tự xin lại khi hết hạn). Quyền ADMIN lấy từ DB của portal, không từ trình duyệt. */
export function signFeedbackToken(who: FeedbackIdentity, now = Date.now()): string | null {
  if (!hubEnabled()) return null
  const iat = Math.floor(now / 1000)
  const claims: Record<string, unknown> = {
    prj: hubProject(),
    aud: "feedback-hub",
    iat,
    exp: iat + TTL_SEC,
    uid: who.id,
    name: who.name,
    role: who.admin ? "ADMIN" : "USER",
  }
  if (who.email) claims.email = who.email
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = b64url(JSON.stringify(claims))
  const sig = createHmac("sha256", getSetting("FEEDBACK_HUB_SECRET")).update(`${head}.${body}`).digest("base64url")
  return `${head}.${body}.${sig}`
}
