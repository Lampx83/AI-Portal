// hooks/use-chat-session.ts
"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { fetchChatSessions, type ChatSessionDTO } from "@/lib/chat"

export function useChatSessions(opts?: { userId?: string; projectId?: string | null; pageSize?: number; q?: string }) {
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
        const signal = aborter.current.signal
        setLoading(true)
        setError(null)
        try {
            const res = await fetchChatSessions({
                userId: opts?.userId,
                projectId: opts?.projectId,
                q: opts?.q,
                limit: pageSize,
                offset: 0,
            }, { signal })
            setItems(res.data)
            setOffset(res.page.limit)
            setTotal(res.page.total)
        } catch (e: any) {
            if (e?.name === "AbortError") return
            setError(e?.message ?? "Load sessions failed")
        } finally {
            setLoading(false)
        }
    }

    /** Reload không bật loading (dùng cho interval/background refresh) */
    const reloadSilent = async () => {
        if (!opts?.userId) return
        aborter.current?.abort()
        aborter.current = new AbortController()
        const signal = aborter.current.signal
        try {
            const res = await fetchChatSessions({
                userId: opts?.userId,
                projectId: opts?.projectId,
                q: opts?.q,
                limit: pageSize,
                offset: 0,
            }, { signal })
            setItems(res.data)
            setOffset(res.page.limit)
            setTotal(res.page.total)
        } catch {
            // ignore (AbortError hoặc lỗi mạng)
        }
    }

    const loadMore = async () => {
        if (!hasMore || loading) return
        aborter.current?.abort()
        aborter.current = new AbortController()
        const signal = aborter.current.signal
        setLoading(true)
        setError(null)
        try {
            const res = await fetchChatSessions({
                userId: opts?.userId,
                projectId: opts?.projectId,
                q: opts?.q,
                limit: pageSize,
                offset,
            }, { signal })
            setItems((prev) => [...prev, ...res.data])
            setOffset(offset + res.page.limit)
            setTotal(res.page.total)
        } catch (e: any) {
            if (e?.name === "AbortError") return
            setError(e?.message ?? "Load more failed")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // reload whenever userId / sessionId / q change
        // Only reload if userId exists (user is logged in)
        if (opts?.userId) {
            reload()
        } else {
            // If no userId, clear items
            setItems([])
            setTotal(0)
            setLoading(false)
        }
        return () => {
            aborter.current?.abort()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opts?.userId, opts?.projectId, opts?.q, pageSize])

    return { items, total, loading, error, hasMore, reload, reloadSilent, loadMore }
}
