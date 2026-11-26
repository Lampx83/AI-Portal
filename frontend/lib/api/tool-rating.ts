// Đánh giá nhanh công cụ (1–5 sao + 1 câu góp ý) — /api/feedback/rating
import { API_CONFIG } from "@/lib/config"
import { getOrCreateGuestDeviceId } from "@/lib/guest-device-id"

const base = () => API_CONFIG.baseUrl.replace(/\/+$/, "")
const headers = (): Record<string, string> => ({ "Content-Type": "application/json", "x-guest-device-id": getOrCreateGuestDeviceId() })

export async function getTodayToolRating(alias: string): Promise<{ rated: boolean; rating?: number; comment?: string }> {
  try {
    const res = await fetch(`${base()}/api/feedback/rating/${encodeURIComponent(alias)}`, { credentials: "include", headers: headers() })
    if (!res.ok) return { rated: false }
    return (await res.json()) as { rated: boolean; rating?: number; comment?: string }
  } catch {
    return { rated: false }
  }
}

export async function submitToolRating(alias: string, rating: number, comment: string): Promise<{ ok: boolean; error?: string; updated?: boolean }> {
  try {
    const res = await fetch(`${base()}/api/feedback/rating`, {
      method: "POST",
      credentials: "include",
      headers: headers(),
      body: JSON.stringify({ alias, rating, comment }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string; updated?: boolean }
    if (!res.ok) return { ok: false, error: data.error || (res.status === 429 ? "feedback.rating.rateLimited" : "feedback.sendError") }
    return { ok: true, updated: !!data.updated }
  } catch {
    return { ok: false, error: "feedback.sendError" }
  }
}
