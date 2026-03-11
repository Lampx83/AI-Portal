/**
 * User pin/unpin tool aliases (sidebar).
 * - Admin cấu hình pin = mặc định khi người dùng chưa thiết lập.
 * - Khi người dùng pin/unpin thì theo cấu hình của người dùng.
 */
const STORAGE_KEY = "portal_pinned_tools"
const UNPINNED_KEY = "portal_unpinned_tools"
const EVENT_NAME = "portal-pinned-tools-changed"

/** Trang chủ / sidebar chỉ cho phép tối đa 10 tools được pin (user pins). */
export const MAX_PINNED_TOOLS = 10

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

export function getStoredPinnedTools(): string[] {
  return parseList(typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
}

export function setStoredPinnedTools(aliases: string[]): void {
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

/** Danh sách tool mà người dùng đã chọn "bỏ ghim" (ưu tiên hơn cấu hình admin). */
export function getStoredUnpinnedTools(): string[] {
  return parseList(typeof localStorage !== "undefined" ? localStorage.getItem(UNPINNED_KEY) : null)
}

function setStoredUnpinnedTools(aliases: string[]): void {
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
export function addStoredPinnedTool(alias: string): boolean {
  const current = getStoredPinnedTools()
  const a = alias.trim().toLowerCase()
  if (current.includes(a)) return true
  if (current.length >= MAX_PINNED_TOOLS) return false
  setStoredPinnedTools([...current, a])
  removeStoredUnpinnedTool(alias)
  return true
}

/** Bỏ ghim: xóa khỏi danh sách pin của user và ghi nhận "user đã unpin" (ẩn cả khi admin pin). */
export function removeStoredPinnedTool(alias: string): void {
  const a = alias.trim().toLowerCase()
  setStoredPinnedTools(getStoredPinnedTools().filter((x) => x !== a))
  const unpinned = getStoredUnpinnedTools()
  if (!unpinned.includes(a)) setStoredUnpinnedTools([...unpinned, a])
}

/** Bỏ khỏi danh sách "user unpin" (dùng khi user pin lại → quay về theo admin hoặc user pin). */
export function removeStoredUnpinnedTool(alias: string): void {
  const a = alias.trim().toLowerCase()
  setStoredUnpinnedTools(getStoredUnpinnedTools().filter((x) => x !== a))
}

export function toggleStoredPinnedTool(alias: string): boolean {
  const current = getStoredPinnedTools()
  const a = alias.trim().toLowerCase()
  if (current.includes(a)) {
    removeStoredPinnedTool(alias)
    return false
  }
  return addStoredPinnedTool(alias)
}

export const PINNED_TOOLS_CHANGED_EVENT = EVENT_NAME
