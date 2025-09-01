// lib/api/chat.ts
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

    const res = await fetch(`/api/chat/sessions?${usp.toString()}`, { cache: "no-store" })
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
    const res = await fetch(`/api/chat/sessions/${sessionId}/messages?${usp.toString()}`, {
        cache: "no-store",
    })
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`)
    return (await res.json()) as ChatMessagesResponse
}

