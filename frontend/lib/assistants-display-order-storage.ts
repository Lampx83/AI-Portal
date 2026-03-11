/**
 * User-defined display order for assistants (dialog + sidebar).
 * Stored as array of aliases; order is applied when rendering.
 */
const STORAGE_KEY = "portal_assistants_display_order"
const EVENT_NAME = "portal-assistants-display-order-changed"

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

export function getStoredAssistantsDisplayOrder(): string[] {
  return parseList(typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
}

export function setStoredAssistantsDisplayOrder(aliases: string[]): void {
  const list = aliases.map((a) => a.trim().toLowerCase()).filter(Boolean)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_NAME))
    }
  } catch {
    // ignore
  }
}

/** Reorder: move aliasToMove to the position of targetAlias. Returns new order array. */
export function reorderAssistantInStorage(aliasToMove: string, targetAlias: string, currentOrder: string[]): string[] {
  const a = aliasToMove.trim().toLowerCase()
  const b = targetAlias.trim().toLowerCase()
  if (a === b) return currentOrder
  const without = currentOrder.filter((x) => x !== a)
  const targetIndex = without.findIndex((x) => x === b)
  if (targetIndex === -1) return [...without, a]
  const next = [...without]
  next.splice(targetIndex, 0, a)
  return next
}

/** Insert alias at index (0 = before first, length = after last). */
export function insertAssistantAt(aliasToMove: string, insertIndex: number, currentOrder: string[]): string[] {
  const a = aliasToMove.trim().toLowerCase()
  const without = currentOrder.filter((x) => x !== a)
  const i = Math.max(0, Math.min(insertIndex, without.length))
  return [...without.slice(0, i), a, ...without.slice(i)]
}

export const ASSISTANTS_DISPLAY_ORDER_CHANGED_EVENT = EVENT_NAME
