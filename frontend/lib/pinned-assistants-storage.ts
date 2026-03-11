/**
 * User pin/unpin assistant aliases (sidebar).
 * - Admin cấu hình pin = mặc định khi người dùng chưa thiết lập.
 * - Khi người dùng pin/unpin thì theo cấu hình của người dùng.
 */
const STORAGE_KEY = "portal_pinned_assistants"
const UNPINNED_KEY = "portal_unpinned_assistants"
const EVENT_NAME = "portal-pinned-assistants-changed"

/** Sidebar chỉ cho phép tối đa 10 trợ lý được pin (user pins). */
export const MAX_PINNED_ASSISTANTS = 10

function parseList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((a): a is string => typeof a === "string" && a.trim().length > 0).map((a) => a.trim().toLowerCase())
  } catch {
    return []
  }
}

export function getStoredPinnedAssistants(): string[] {
  return parseList(typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
}

export function setStoredPinnedAssistants(aliases: string[]): void {
  const list = [...new Set(aliases.map((a) => a.trim().toLowerCase()).filter(Boolean))]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: list }))
    }
  } catch {
    // ignore
  }
}

/** Danh sách assistant mà người dùng đã chọn "bỏ ghim" (ưu tiên hơn cấu hình admin). */
export function getStoredUnpinnedAssistants(): string[] {
  return parseList(typeof localStorage !== "undefined" ? localStorage.getItem(UNPINNED_KEY) : null)
}

function setStoredUnpinnedAssistants(aliases: string[]): void {
  const list = [...new Set(aliases.map((a) => a.trim().toLowerCase()).filter(Boolean))]
  try {
    localStorage.setItem(UNPINNED_KEY, JSON.stringify(list))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_NAME))
    }
  } catch {
    // ignore
  }
}

/** Returns true if added (or already in list), false if at limit and not in list. */
export function addStoredPinnedAssistant(alias: string): boolean {
  const current = getStoredPinnedAssistants()
  const a = alias.trim().toLowerCase()
  if (current.includes(a)) return true
  if (current.length >= MAX_PINNED_ASSISTANTS) return false
  setStoredPinnedAssistants([...current, a])
  removeStoredUnpinnedAssistant(alias)
  return true
}

/** Bỏ ghim: xóa khỏi danh sách pin của user và ghi nhận "user đã unpin" (ẩn cả khi admin pin). */
export function removeStoredPinnedAssistant(alias: string): void {
  const a = alias.trim().toLowerCase()
  const pinned = getStoredPinnedAssistants().filter((x) => x !== a)
  const unpinned = getStoredUnpinnedAssistants()
  const newUnpinned = unpinned.includes(a) ? unpinned : [...unpinned, a]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned))
    localStorage.setItem(UNPINNED_KEY, JSON.stringify(newUnpinned))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_NAME))
    }
  } catch {
    // ignore
  }
}

/** Bỏ khỏi danh sách "user unpin" (dùng khi user pin lại). */
export function removeStoredUnpinnedAssistant(alias: string): void {
  const a = alias.trim().toLowerCase()
  setStoredUnpinnedAssistants(getStoredUnpinnedAssistants().filter((x) => x !== a))
}

export const PINNED_ASSISTANTS_CHANGED_EVENT = EVENT_NAME
