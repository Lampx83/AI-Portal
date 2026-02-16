import { Request } from "express"
import { getSetting } from "../../lib/settings"

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
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost:3001"
  return `${proto}://${host}`
}
