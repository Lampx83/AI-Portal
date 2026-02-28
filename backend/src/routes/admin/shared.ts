import { Request } from "express"
import { getSetting } from "../../lib/settings"

/** Base URL of the frontend app for redirects (ưu tiên host từ request, fallback NEXTAUTH_URL). */
export function getFrontendBaseUrl(req: Request): string {
  const reqHost = (req.get("x-forwarded-host") || req.get("host"))?.toString()?.trim()
  if (reqHost) {
    const proto = (req.get("x-forwarded-proto") || (req.secure ? "https" : "http"))?.toString()?.replace(":", "") || "http"
    const origin = `${proto}://${reqHost}`
    const fromSetting = getSetting("NEXTAUTH_URL", "")
    if (fromSetting) {
      try {
        const u = new URL(fromSetting)
        if (u.pathname && u.pathname !== "/") return origin + u.pathname.replace(/\/+$/, "")
      } catch {
        // ignore
      }
    }
    return origin
  }
  return (getSetting("NEXTAUTH_URL", "") || "").replace(/\/+$/, "")
}

/** Sample files for Agent testing (pdf, docx, xlsx, ...) */
export const SAMPLE_FILES = [
  "sample.pdf",
  "sample.docx",
  "sample.xlsx",
  "sample.xls",
  "sample.csv",
  "sample.txt",
  "sample.md",
]

/** Backend base URL so agents can fetch files (must be reachable from agent when deployed) */
export function getBackendBaseUrl(req: Request): string {
  const fromEnv =
    getSetting("BACKEND_URL") || getSetting("NEXTAUTH_URL") || getSetting("API_BASE_URL")
  if (fromEnv) {
    try {
      const u = new URL(fromEnv)
      return `${u.protocol}//${u.host}`
    } catch {
      return fromEnv.replace(/\/+$/, "")
    }
  }
  const proto = req.get("x-forwarded-proto") || req.protocol || "http"
  const host =
    req.get("x-forwarded-host") ||
    req.get("host") ||
    (process.env.NODE_ENV === "development" ? `localhost:${process.env.PORT || "3001"}` : "")
  if (!host) return ""
  return `${proto}://${host}`
}
