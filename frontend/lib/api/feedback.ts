// lib/api/feedback.ts
import { API_CONFIG } from "@/lib/config"

const baseUrl = `${API_CONFIG.baseUrl}/api/feedback`

/**
 * Gửi phản hồi, góp ý về hệ thống (chung hoặc cho trợ lý cụ thể).
 */
export async function submitFeedback(
  content: string,
  assistantAlias?: string | null
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: content.trim().slice(0, 4000),
      assistant_alias: assistantAlias ?? null,
    }),
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data as { success: boolean; message: string }
}
