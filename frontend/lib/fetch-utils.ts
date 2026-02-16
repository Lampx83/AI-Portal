// lib/fetch-utils.ts

export const DEFAULT_TIMEOUT_MS = 15_000
export const SEND_TIMEOUT_MS = 120_000

export async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: existingSignal, ...rest } = init ?? {}
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), timeoutMs)
  if (existingSignal) {
    existingSignal.addEventListener("abort", () => ctrl.abort())
  }
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal })
  } finally {
    clearTimeout(id)
  }
}

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "")
}
