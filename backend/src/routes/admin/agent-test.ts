import { getSetting } from "../../lib/settings"

export function getInternalAgentBaseUrlForTest(alias: string): string {
  const base = (getSetting("BACKEND_URL") || `http://127.0.0.1:${getSetting("PORT", "3001")}`).replace(
    /\/+$/,
    ""
  )
  const path = alias === "central" ? "central_agent" : `${alias}_agent`
  return `${base}/api/${path}/v1`
}

export async function runAgentTestFull(
  baseUrl: string,
  testType: "metadata" | "data" | "ask",
  opts?: { dataType?: string; modelId?: string; prompt?: string; documentUrls?: string[] }
): Promise<{ ok: boolean; status?: number; data?: unknown; curl?: string }> {
  const timeout = testType === "ask" ? 60000 : 30000
  const url = baseUrl.replace(/\/+$/, "")

  if (testType === "metadata") {
    const fullUrl = `${url}/metadata`
    const curl = `curl -X GET '${fullUrl}' -H 'Content-Type: application/json'`
    const resp = await fetch(fullUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data, curl }
  }
  if (testType === "data") {
    const type = opts?.dataType || "documents"
    const fullUrl = `${url}/data?type=${encodeURIComponent(type)}`
    const curl = `curl -X GET '${fullUrl}' -H 'Content-Type: application/json'`
    const resp = await fetch(fullUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data, curl }
  }
  if (testType === "ask") {
    const payload: Record<string, unknown> = {
      session_id: `test-${Date.now()}`,
      model_id: opts?.modelId || "gpt-4o-mini",
      user: "admin-test",
      prompt: opts?.prompt || "Xin chào, bạn có thể giúp gì tôi?",
      context:
        Array.isArray(opts?.documentUrls) && opts.documentUrls.length > 0
          ? { extra_data: { document: opts.documentUrls } }
          : {},
    }
    const bodyStr = JSON.stringify(payload)
    const escaped = bodyStr.replace(/'/g, "'\\''")
    const fullUrl = `${url}/ask`
    const curl = `curl -X POST '${fullUrl}' -H 'Content-Type: application/json' -d '${escaped}'`
    const resp = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
      signal: AbortSignal.timeout(timeout),
    })
    const data = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, data, curl }
  }
  return { ok: false, status: 0 }
}

export function runAgentTest(
  baseUrl: string,
  testType: "metadata" | "data" | "ask",
  opts?: { dataType?: string; modelId?: string; prompt?: string; documentUrls?: string[] }
): Promise<{ ok: boolean }> {
  return runAgentTestFull(baseUrl, testType, opts).then((r) => ({ ok: r.ok }))
}

export function isNetworkError(e: any): boolean {
  const msg = (e?.message || String(e)).toLowerCase()
  return (
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed") ||
    msg.includes("aborted") ||
    e?.name === "AbortError"
  )
}

export async function runWithRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; delayMs?: number; onRetry?: (attempt: number) => void }
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 2
  const delayMs = opts?.delayMs ?? 2000
  let lastErr: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (attempt < maxRetries && isNetworkError(e)) {
        opts?.onRetry?.(attempt + 1)
        await new Promise((r) => setTimeout(r, delayMs))
        continue
      }
      throw e
    }
  }
  throw lastErr
}
