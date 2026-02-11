/** Lưu lịch sử phiên chat (embed) theo từng trợ lý – dùng cho panel history khi ?history=true */
const STORAGE_PREFIX = "embed-history-"
const MAX_ITEMS = 50

export type EmbedHistoryItem = { id: string; title: string; updatedAt: string }

export function getStoredSessionHistory(alias: string): EmbedHistoryItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + alias)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is EmbedHistoryItem => x && typeof x.id === "string" && typeof x.title === "string")
      .slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

export function addOrUpdateSessionInHistory(alias: string, id: string, title: string): void {
  if (typeof window === "undefined") return
  try {
    const list = getStoredSessionHistory(alias)
    const now = new Date().toISOString()
    const existing = list.findIndex((x) => x.id === id)
    const item: EmbedHistoryItem = { id, title: title || "Cuộc trò chuyện", updatedAt: now }
    let next: EmbedHistoryItem[]
    if (existing >= 0) {
      next = [...list]
      next[existing] = { ...next[existing], title: item.title, updatedAt: now }
      next.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
    } else {
      next = [item, ...list].slice(0, MAX_ITEMS)
    }
    localStorage.setItem(STORAGE_PREFIX + alias, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function ensureSessionInHistory(alias: string, id: string, title?: string): void {
  const list = getStoredSessionHistory(alias)
  if (list.some((x) => x.id === id)) return
  addOrUpdateSessionInHistory(alias, id, title ?? "Cuộc trò chuyện mới")
}
