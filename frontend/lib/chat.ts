// lib/chat.ts
import { API_CONFIG } from "@/lib/config"

// Always use backend URL - API routes have been migrated to backend
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_API_BASE_URL (backend URL)
    return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"
  }
  // Server-side: use configured base URL
  return API_CONFIG.baseUrl
}

const baseUrl = getBaseUrl()

export type ChatSessionDTO = {
    id: string
    user_id: string | null
    created_at: string
    updated_at: string | null
    title: string | null
    message_count: number
}

export type ChatSessionsResponse = {
    data: ChatSessionDTO[]
    page: { limit: number; offset: number; total: number }
}

export async function fetchChatSessions(params?: {
    userId?: string
    q?: string
    limit?: number
    offset?: number
}) {
    const usp = new URLSearchParams()
    if (params?.userId) usp.set("user_id", params.userId)
    if (params?.q) usp.set("q", params.q)
    usp.set("limit", String(params?.limit ?? 20))
    usp.set("offset", String(params?.offset ?? 0))

    const res = await fetch(`${baseUrl}/api/chat/sessions?${usp.toString()}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
    return (await res.json()) as ChatSessionsResponse
}

export type ChatMessageDTO = {
    id: string
    session_id: string
    role: "user" | "assistant" | "system"
    content: string
    created_at: string
}
export type ChatMessagesResponse = {
    data: ChatMessageDTO[]
    page: { limit: number; offset: number; total: number }
}


export async function createChatSession(payload?: { user_id?: string | null; title?: string | null }) {

    const res = await fetch(`${baseUrl}/api/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
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

  const backendUrl = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001")
    : API_CONFIG.baseUrl

  const res = await fetch(`${backendUrl}/api/chat/sessions/${sessionId}/messages?${usp.toString()}`, {
    cache: "no-store",
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
}) {
  const res = await fetch(
    `${baseUrl}/api/chat/sessions/${sessionId}/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Server sẽ tự nhúng history/summary theo logic bạn đã triển khai
      body: JSON.stringify(payload),
      cache: "no-store",
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
