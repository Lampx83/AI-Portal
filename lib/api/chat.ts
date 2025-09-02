// lib/api/chat.ts
import { API_CONFIG } from "@/lib/config"

const baseUrl = API_CONFIG.baseUrl

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
// lib/api/chat.ts
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

export async function fetchChatMessages(
    sessionId: string,
    opts?: { limit?: number; offset?: number }
) {
    const usp = new URLSearchParams()
    usp.set("limit", String(opts?.limit ?? 50))
    usp.set("offset", String(opts?.offset ?? 0))
    const res = await fetch(`${baseUrl}/api/chat/sessions?${usp.toString()}`, {
        cache: "no-store",
    })
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`)
    return (await res.json()) as ChatMessagesResponse
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
        user_id?: string | null
        assistant_alias?: string | null
        status?: string
        content_type?: "text" | "markdown" | string
        content_json?: any
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
