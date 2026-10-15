// Gợi ý câu hỏi tiếp theo sau câu trả lời của Trợ lý chính (POST /api/chat/followups).
import { API_CONFIG } from "@/lib/config"
import { getOrCreateGuestDeviceId } from "@/lib/guest-device-id"

export async function fetchFollowupSuggestions(opts: {
  sessionId: string
  toolsUsed?: string[]
  projectId?: string | null
  locale?: string
}): Promise<string[]> {
  const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12_000)
  try {
    const res = await fetch(`${base}/api/chat/followups`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "x-guest-device-id": getOrCreateGuestDeviceId() },
      body: JSON.stringify({
        session_id: opts.sessionId,
        tools_used: opts.toolsUsed ?? [],
        project_id: opts.projectId ?? null,
        locale: opts.locale ?? "vi",
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return []
    const data = (await res.json().catch(() => ({}))) as { suggestions?: unknown }
    return Array.isArray(data.suggestions)
      ? data.suggestions.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 3)
      : []
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
