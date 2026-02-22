// // hooks/use-chat-messages.ts
// "use client"

// import { useEffect, useMemo, useRef, useState } from "react"
// import { fetchChatMessages, type ChatMessageDTO } from "@/lib/api/chat"

// export function useChatMessages(sessionId?: string, pageSize = 50) {
//     const [items, setItems] = useState<ChatMessageDTO[]>([])
//     const [offset, setOffset] = useState(0)
//     const [total, setTotal] = useState(0)
//     const [loading, setLoading] = useState(false)
//     const [error, setError] = useState<string | null>(null)
//     const hasMore = useMemo(() => items.length < total, [items.length, total])

//     // load on first run or when sessionId changes
//     useEffect(() => {
//         if (!sessionId) {
//             setItems([]); setOffset(0); setTotal(0); setError(null)
//             return
//         }
//         let cancelled = false
//             ; (async () => {
//                 setLoading(true); setError(null)
//                 try {
//                     const res = await fetchChatMessages(sessionId, { limit: pageSize, offset: 0 })
//                     if (!cancelled) {
//                         setItems(res.data)
//                         setOffset(res.page.limit)
//                         setTotal(res.page.total)
//                     }
//                 } catch (e: any) {
//                     if (!cancelled) setError(e?.message ?? "Load messages failed")
//                 } finally {
//                     if (!cancelled) setLoading(false)
//                 }
//             })()
//         return () => { cancelled = true }
//     }, [sessionId, pageSize])

//     const loadMore = async () => {
//         if (!sessionId || loading || !hasMore) return
//         setLoading(true); setError(null)
//         try {
//             const res = await fetchChatMessages(sessionId, { limit: pageSize, offset })
//             setItems((prev) => [...prev, ...res.data])
//             setOffset(offset + res.page.limit)
//             setTotal(res.page.total)
//         } catch (e: any) {
//             setError(e?.message ?? "Load more failed")
//         } finally {
//             setLoading(false)
//         }
//     }

//     return { items, total, loading, error, hasMore, loadMore }
// }
