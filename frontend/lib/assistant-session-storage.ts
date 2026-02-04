/** Key trong sessionStorage để lưu sid theo từng trợ lý (alias). */
const STORAGE_PREFIX = "assistant-sid-"

export function getStoredSessionId(alias: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + alias)
  } catch {
    return null
  }
}

export function setStoredSessionId(alias: string, sid: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_PREFIX + alias, sid)
  } catch {
    // ignore
  }
}
