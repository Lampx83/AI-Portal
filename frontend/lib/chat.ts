// lib/chat.ts
import { API_CONFIG } from "@/lib/config"
import { fetchWithTimeout, DEFAULT_TIMEOUT_MS, SEND_TIMEOUT_MS } from "@/lib/fetch-utils"

const baseUrl = API_CONFIG.baseUrl

/** UUID tài khoản Khách (backend). Session thuộc user này khi đăng nhập cần chuyển sang session mới của user. */
export const GUEST_USER_ID = "11111111-1111-1111-1111-111111111111"

export type ChatSessionDTO = {
    id: string
    user_id: string | null
    project_id?: string | null
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

export async function fetchChatSessions(
  params?: {
    userId?: string
    projectId?: string | null
    assistantAlias?: string | null
    q?: string
    limit?: number
    offset?: number
  },
  options?: { signal?: AbortSignal; timeoutMs?: number }
) {
  const usp = new URLSearchParams()
  if (params?.userId) usp.set("user_id", params.userId)
  if (params?.projectId !== undefined && params?.projectId !== null && params.projectId !== "")
    usp.set("project_id", params.projectId)
  else if (params?.projectId === "")
    usp.set("project_id", "")
  if (params?.assistantAlias != null && params.assistantAlias !== "")
    usp.set("assistant_alias", params.assistantAlias)
  if (params?.q) usp.set("q", params.q)
  usp.set("limit", String(params?.limit ?? 20))
  usp.set("offset", String(params?.offset ?? 0))

  const res = await fetchWithTimeout(`${baseUrl}/api/chat/sessions?${usp.toString()}`, {
    cache: "no-store",
    credentials: "include",
    signal: options?.signal,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
  return (await res.json()) as ChatSessionsResponse
}

/** Giới hạn tin nhắn/ngày cho user (công khai). user_id: email hoặc UUID. */
export type DailyUsageDTO = { limit: number; used: number; remaining: number }
export async function getDailyUsage(userId: string): Promise<DailyUsageDTO> {
  const res = await fetchWithTimeout(
    `${baseUrl}/api/chat/daily-usage?user_id=${encodeURIComponent(userId)}`,
    { cache: "no-store", credentials: "include", timeoutMs: DEFAULT_TIMEOUT_MS }
  )
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


export async function fetchChatSession(sessionId: string): Promise<ChatSessionDTO | null> {
  const res = await fetchWithTimeout(`${baseUrl}/api/chat/sessions/${sessionId}`, {
    cache: "no-store",
    credentials: "include",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`)
  const json = await res.json()
  return json.data as ChatSessionDTO
}

export async function createChatSession(payload?: { user_id?: string | null; title?: string | null; project_id?: string | null; assistant_alias?: string | null }) {
  const res = await fetchWithTimeout(`${baseUrl}/api/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
    credentials: "include",
    timeoutMs: DEFAULT_TIMEOUT_MS,
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
  const res = await fetchWithTimeout(`${baseUrl}/api/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })
  if (!res.ok) throw new Error(`Failed to append message: ${res.status}`)
  return (await res.json()).data as ChatMessageDTO
}

export async function fetchChatMessages(
  sessionId: string,
  params?: { limit?: number; offset?: number },
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<{ data: ChatMessageDTO[] }> {
  const usp = new URLSearchParams()
  if (params?.limit) usp.set("limit", String(params.limit))
  if (params?.offset) usp.set("offset", String(params.offset))

  const res = await fetchWithTimeout(
    `${baseUrl}/api/chat/sessions/${sessionId}/messages?${usp.toString()}`,
    {
      cache: "no-store",
      credentials: "include",
      signal: options?.signal,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }
  )
  if (!res.ok) {
    let errorMessage = `Failed to fetch messages: ${res.status}`
    try {
      const errorData = await res.json()
      if (errorData.error === "Database Connection Error") {
        errorMessage = "Database connection error. Please check database configuration."
      } else if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch {
      // use default message
    }
    throw new Error(errorMessage)
  }
  return await res.json()
}

export async function sendWithMemory(
  sessionId: string,
  payload: {
    assistant_base_url: string
    model_id: string
    prompt: string
    user?: string
    context?: Record<string, any>
    session_title?: string | null
    assistant_alias?: string | null
    user_id?: string | null
    project_id?: string | null
  },
  options?: { signal?: AbortSignal }
) {
  const res = await fetchWithTimeout(
    `${baseUrl}/api/chat/sessions/${sessionId}/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      credentials: "include",
      signal: options?.signal,
      timeoutMs: SEND_TIMEOUT_MS,
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => "")
    throw new Error(`Failed to send: ${res.status} ${err}`)
  }
  return (await res.json()) as {
    status: "success"
    content_markdown: string
    meta?: { model?: string; response_time_ms?: number; tokens_used?: number }
  }
}

/**
 * Cập nhật title của chat session
 */
export async function updateChatSessionTitle(sessionId: string, title: string): Promise<{ id: string; title: string }> {
  const res = await fetchWithTimeout(`${baseUrl}/api/chat/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
    credentials: "include",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to update session: ${res.status}`)
  }
  const json = await res.json()
  return json.data
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const res = await fetchWithTimeout(`${baseUrl}/api/chat/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    credentials: "include",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to delete session: ${res.status}`)
  }
}

export async function deleteChatMessage(sessionId: string, messageId: string): Promise<void> {
  const res = await fetchWithTimeout(
    `${baseUrl}/api/chat/sessions/${sessionId}/messages/${messageId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      credentials: "include",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    }
  )
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
  const res = await fetchWithTimeout(
    `${baseUrl}/api/chat/sessions/${sessionId}/messages/${messageId}/feedback`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  return data as { feedback: "like" | "dislike" | null }
}
