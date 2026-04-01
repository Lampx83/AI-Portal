/**
 * Rewrite storage URLs that use Docker-internal hostnames (e.g. minio:9000) so <img src> works in the browser.
 *
 * 1) Set NEXT_PUBLIC_MINIO_BROWSER_ORIGIN (e.g. http://localhost:9000) for production / custom hosts.
 *    Must NOT be http://minio:... — that is only reachable inside Docker and will keep breaking the browser.
 * 2) In development, if unset (or env points at internal Docker hosts), http(s)://minio[:port] → http://localhost[:port].
 */

/** Hostnames that are never valid as the browser-facing MinIO origin */
function isDockerInternalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === "minio" || h === "backend" || h === "postgres" || h.endsWith(".internal")
}

function explicitBrowserOrigin(): string | null {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MINIO_BROWSER_ORIGIN?.trim() : ""
  if (!raw) return null
  try {
    const base = raw.includes("://") ? new URL(raw) : new URL(`http://${raw}`)
    if (isDockerInternalHostname(base.hostname)) return null
    return base.origin
  } catch {
    return null
  }
}

function useLocalhostMinioFallback(): boolean {
  if (typeof window !== "undefined") {
    const h = window.location.hostname
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true
  }
  return typeof process !== "undefined" && process.env.NODE_ENV === "development"
}

export function rewriteMinioUrlForBrowser(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.hostname !== "minio" && u.hostname !== "backend") return url

    const origin = explicitBrowserOrigin()
    if (origin) {
      return `${origin}${u.pathname}${u.search}${u.hash}`
    }

    if (useLocalhostMinioFallback()) {
      u.hostname = "localhost"
      if (!u.port && u.protocol === "http:") u.port = "9000"
      return u.toString()
    }

    return url
  } catch {
    return url
  }
}

/** Replace every http(s)://minio[:port] in an HTML fragment */
export function rewriteMinioHostsInHtml(html: string): string {
  if (!html) return html

  const origin = explicitBrowserOrigin()
  if (origin) {
    return html.replace(/https?:\/\/minio(?::\d+)?/gi, origin)
  }

  if (useLocalhostMinioFallback()) {
    return html.replace(/https?:\/\/minio(?::(\d+))?/gi, (_m, port: string | undefined) => {
      const p = port ? `:${port}` : ":9000"
      return `http://localhost${p}`
    })
  }

  return html
}
