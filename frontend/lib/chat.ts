// lib/chat.ts
import { API_CONFIG } from "@/lib/config"

// Always use backend URL from config.ts
const baseUrl = API_CONFIG.baseUrl

/** UUID tài khoản Khách (backend). Session thuộc user này khi đăng nhập cần chuyển sang session mới của user. */
export const GUEST_USER_ID = "11111111-1111-1111-1111-111111111111"

export type ChatSessionDTO = {
    id: string
    user_id: string | null
    research_id?: string | null
    created_at: string
    updated_at: string | null
    title: string | null
    assistant_alias?: string | null
    message_count: number
}

export type ChatSessionsResponse = {
    data: ChatSessionDTO[]
    page: { limit: number; offset: number; total: number }
}

export async function fetchChatSessions(params?: {
    userId?: string
    researchId?: string | null
    q?: string
    limit?: number
    offset?: number
}) {
    const usp = new URLSearchParams()
    if (params?.userId) usp.set("user_id", params.userId)
    if (params?.researchId !== undefined && params?.researchId !== null && params.researchId !== "")
        usp.set("research_id", params.researchId)
    else if (params?.researchId === "")
        usp.set("research_id", "")
    if (params?.q) usp.set("q", params.q)
    usp.set("limit", String(params?.limit ?? 20))
    usp.set("offset", String(params?.offset ?? 0))

    const res = await fetch(`${baseUrl}/api/chat/sessions?${usp.toString()}`, {
        cache: "no-store",
        credentials: "include",
    })
    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
    return (await res.json()) as ChatSessionsResponse
}

/** Giới hạn tin nhắn/ngày cho user (công khai). user_id: email hoặc UUID. */
export type DailyUsageDTO = { limit: number; used: number; remaining: number }
export async function getDailyUsage(userId: string): Promise<DailyUsageDTO> {
    const res = await fetch(`${baseUrl}/api/chat/daily-usage?user_id=${encodeURIComponent(userId)}`, {
        cache: "no-store",
        credentials: "include",
    })
    if (!res.ok) throw new Error(`Failed to fetch daily usage: ${res.status}`)
    return (await res.json()) as DailyUsageDTO
}

export type ChatMessageDTO = {
    id: string
    session_id: string
    role: "user" | "assistant" | "system"
    content: string
    created_at: string
    /** Like/dislike của user hiện tại (chỉ có khi đã đăng nhập) */
    feedback?: "like" | "dislike"
}
export type ChatMessagesResponse = {
    data: ChatMessageDTO[]
    page: { limit: number; offset: number; total: number }
}


/** Lấy thông tin một session (để kiểm tra user_id, tránh hiển thị session khách khi đã đăng nhập). */
export async function fetchChatSession(sessionId: string): Promise<ChatSessionDTO | null> {
    const res = await fetch(`${baseUrl}/api/chat/sessions/${sessionId}`, { cache: "no-store", credentials: "include" })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`)
    const json = await res.json()
    return json.data as ChatSessionDTO
}

export async function createChatSession(payload?: { user_id?: string | null; title?: string | null; research_id?: string | null; assistant_alias?: string | null }) {

    const res = await fetch(`${baseUrl}/api/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
        credentials: "include",
    })
    if (!res.ok) throw new Error(`Failed to create session: ${res.status}`)
    const json = await res.json()
    return json.data as ChatSessionDTO
}

export async function appendMessage(
    sessionId: string,
    payload: {
        role: "user" | "assistant" | "system"
        content: string
        model_id?: string | null
        assistant_alias?: string | null
        status?: string
        content_type?: "text" | "markdown" | string
        prompt_tokens?: number | null
        completion_tokens?: number | null
        total_tokens?: number | null
        response_time_ms?: number | null
        refs?: any
    }
) {
    const res = await fetch(`${baseUrl}/api/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
    })
    if (!res.ok) throw new Error(`Failed to append message: ${res.status}`)
    return (await res.json()).data as ChatMessageDTO
}

export async function fetchChatMessages(
  sessionId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ data: ChatMessageDTO[] }> {
  const usp = new URLSearchParams()
  if (params?.limit) usp.set("limit", String(params.limit))
  if (params?.offset) usp.set("offset", String(params.offset))

  const res = await fetch(`${baseUrl}/api/chat/sessions/${sessionId}/messages?${usp.toString()}`, {
    cache: "no-store",
    credentials: "include",
  })
  if (!res.ok) {
    let errorMessage = `Failed to fetch messages: ${res.status}`
    try {
      const errorData = await res.json()
      if (errorData.error === "Database Connection Error") {
        errorMessage = "Không thể kết nối đến database. Vui lòng kiểm tra cấu hình database."
      } else if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Nếu không parse được JSON, dùng message mặc định
    }
    throw new Error(errorMessage)
  }
  return await res.json()
}

export async function sendWithMemory(sessionId: string, payload: {
  assistant_base_url: string
  model_id: string
  prompt: string
  user?: string
  context?: Record<string, any>
  session_title?: string | null
  assistant_alias?: string | null
  user_id?: string | null
  research_id?: string | null
}) {
  const res = await fetch(
    `${baseUrl}/api/chat/sessions/${sessionId}/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      credentials: "include",
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => "")
    throw new Error(`Failed to send: ${res.status} ${err}`)
  }
  // server trả về content_markdown + meta
  return await res.json() as {
    status: "success"
    content_markdown: string
    meta?: { model?: string; response_time_ms?: number; tokens_used?: number }
  }
}

/**
 * Cập nhật title của chat session
 */
export async function updateChatSessionTitle(sessionId: string, title: string): Promise<{ id: string; title: string }> {
  const res = await fetch(`${baseUrl}/api/chat/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
    credentials: "include",
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to update session: ${res.status}`)
  }
  const json = await res.json()
  return json.data
}

/**
 * Xóa một chat session và tất cả messages của nó
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/chat/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    credentials: "include",
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to delete session: ${res.status}`)
  }
}

/**
 * Xóa một message cụ thể
 */
export async function deleteChatMessage(sessionId: string, messageId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/chat/sessions/${sessionId}/messages/${messageId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    credentials: "include",
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to delete message: ${res.status}`)
  }
}

/**
 * Gửi like/dislike cho câu trả lời trợ lý (lưu DB để thống kê và cải thiện trợ lý).
 * Khi dislike có thể kèm comment mô tả vấn đề cho nhà phát triển.
 * feedback: "none" để xóa trạng thái like/dislike.
 */
export async function setMessageFeedback(
  sessionId: string,
  messageId: string,
  feedback: "like" | "dislike" | "none",
  comment?: string | null
): Promise<{ feedback: "like" | "dislike" | null }> {
  const body: { feedback: string; comment?: string } = { feedback }
  if (feedback === "dislike" && typeof comment === "string" && comment.trim()) {
    body.comment = comment.trim().slice(0, 2000)
  }
  const res = await fetch(
    `${baseUrl}/api/chat/sessions/${sessionId}/messages/${messageId}/feedback`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return data as { feedback: "like" | "dislike" | null }
}
