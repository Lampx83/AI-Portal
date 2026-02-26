// lib/orchestrator/agent-client.ts
import type { AgentMetadata } from "../agent-types"

export type AgentReply = {
    alias: string
    ok: boolean
    timeMs: number
    data?: any
    error?: string
}

const DEFAULT_TIMEOUT = 20_000
async function fetchWithTimeout(url: string, init: RequestInit, ms = DEFAULT_TIMEOUT): Promise<Response> {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), ms)
    try {
        return await fetch(url, { ...init, signal: ctrl.signal })
    } finally {
        clearTimeout(id)
    }
}

export async function callAgentAsk(alias: string, baseUrl: string, payload: any, retry = 1): Promise<AgentReply> {
    if (!baseUrl) return { alias, ok: false, timeMs: 0, error: "Agent not found or no baseUrl" }

    const base = baseUrl.replace(/\/+$/, "")
    async function doAsk(path: "/ask" | "v1/ask"): Promise<{ res: Response; data?: any }> {
        const url = path === "ask" ? `${base}/ask` : `${base}/v1/ask`
        const t0 = Date.now()
        const res = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        const timeMs = Date.now() - t0
        if (!res.ok) return { res }
        const data = await res.json().catch(() => ({}))
        return { res, data }
    }

    const t0 = Date.now()
    try {
        let out = await doAsk("ask")
        if (out.res.status === 404) {
            out = await doAsk("v1/ask")
        }
        const timeMs = Date.now() - t0
        if (!out.res.ok) {
            const msg = `HTTP ${out.res.status}`
            if (retry > 0) return callAgentAsk(alias, baseUrl, payload, retry - 1)
            return { alias, ok: false, timeMs, error: msg }
        }
        return { alias, ok: true, timeMs, data: out.data }
    } catch (e: any) {
        const timeMs = Date.now() - t0
        if (retry > 0) return callAgentAsk(alias, baseUrl, payload, retry - 1)
        return { alias, ok: false, timeMs, error: e?.message ?? "Fetch error" }
    }
}

/** Get text content from agent response (supports content_markdown, answer, content) */
export function getAgentReplyContent(data: any): string {
    if (!data || typeof data !== "object") return ""
    const raw =
        data.content_markdown ?? data.answer ?? data.content
    return typeof raw === "string" ? raw.trim() : ""
}

export function synthesizeAnswer(replies: AgentReply[]) {
    const okReplies = replies.filter(r => r.ok)
    if (okReplies.length === 0) {
        return {
            summary: "Không nhận được phản hồi hợp lệ từ các trợ lý.",
            parts: [],
            meta: { latency_ms: Math.max(...replies.map(r => r.timeMs)), replies },
        }
    }
    const parts = okReplies.map(r => ({
        alias: r.alias,
        answer: getAgentReplyContent(r.data) || "(không có nội dung)",
        sources: r.data?.sources ?? [],
        timeMs: r.timeMs,
    }))

    const summary =
        okReplies.length === 1
            ? parts[0].answer
            : parts.map(p => `— ${p.alias.toUpperCase()}: ${p.answer}`).join("\n\n")

    return {
        summary,
        parts,
        meta: {
            best_alias: parts.sort((a, b) => a.timeMs - b.timeMs)[0]?.alias,
            latency_ms: Math.max(...okReplies.map(r => r.timeMs)),
            replies,
        },
    }
}
