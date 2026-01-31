// lib/fetch-utils.ts
export async function fetchWithTimeout(input: RequestInfo, init?: RequestInit & { timeoutMs?: number }) {
    const { timeoutMs = 8000, ...rest } = init || {}
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
        const res = await fetch(input, { ...rest, signal: ctrl.signal })
        return res
    } finally {
        clearTimeout(id)
    }
}

// Chuẩn hóa baseUrl, bỏ dấu / cuối nếu có
export function normalizeBaseUrl(url: string) {
    return url.replace(/\/+$/, "")
}
