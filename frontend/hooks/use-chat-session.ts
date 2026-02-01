// hooks/use-chat-session.ts
"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { fetchChatSessions, type ChatSessionDTO } from "@/lib/chat"

export function useChatSessions(opts?: { userId?: string; pageSize?: number; q?: string }) {
    const [items, setItems] = useState<ChatSessionDTO[]>([])
    const [offset, setOffset] = useState(0)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const pageSize = opts?.pageSize ?? 20
    const hasMore = useMemo(() => items.length < total, [items.length, total])
    const aborter = useRef<AbortController | null>(null)

    const reload = async () => {
        aborter.current?.abort()
        aborter.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            const res = await fetchChatSessions({
                userId: opts?.userId,
                q: opts?.q,
                limit: pageSize,
                offset: 0,
            })
            setItems(res.data)
            setOffset(res.page.limit)
            setTotal(res.page.total)
        } catch (e: any) {
            setError(e?.message ?? "Load sessions failed")
        } finally {
            setLoading(false)
        }
    }

    const loadMore = async () => {
        if (!hasMore || loading) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetchChatSessions({
                userId: opts?.userId,
                q: opts?.q,
                limit: pageSize,
                offset,
            })
            setItems((prev) => [...prev, ...res.data])
            setOffset(offset + res.page.limit)
            setTotal(res.page.total)
        } catch (e: any) {
            setError(e?.message ?? "Load more failed")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // mỗi khi userId/q thay đổi thì reload
        // Chỉ reload nếu có userId (user đã đăng nhập)
        if (opts?.userId) {
            reload()
        } else {
            // Nếu không có userId, clear items
            setItems([])
            setTotal(0)
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opts?.userId, opts?.q, pageSize])

    return { items, total, loading, error, hasMore, reload, loadMore }
}
