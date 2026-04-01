/**
 * Rewrite storage URLs that use Docker-internal hostnames (e.g. minio:9000) so <img src> works in the browser.
 *
 * 1) Path-style MinIO URLs (http://minio:9000/<bucket>/key) → same-origin /api/storage/download/key when MinIO is not public.
 *    Bucket defaults to "portal"; override with NEXT_PUBLIC_MINIO_BUCKET_NAME.
 * 2) Set NEXT_PUBLIC_MINIO_BROWSER_ORIGIN when MinIO is reachable directly from the browser (public :9000 or CDN).
 * 3) In development, if unset, http(s)://minio[:port] → http://localhost[:port] (fallback after (1) if no portal root).
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

function portalRootForStorageDownload(): string {
  if (typeof window !== "undefined") {
    const bp = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
    return `${window.location.origin}${bp}`
  }
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")
}

const DEFAULT_MINIO_BUCKET =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MINIO_BUCKET_NAME?.trim()) || "portal"

/**
 * http(s)://minio[:port]/<bucket>/object-key → portal /api/storage/download (MinIO chỉ trong Docker, cổng 9000 không public).
 */
function rewriteMinioPathStyleToPortalDownload(u: URL): string | null {
  if (u.hostname.toLowerCase() !== "minio") return null
  const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean)
  if (parts.length < 2) return null
  const [bucket, ...keyParts] = parts
  if (bucket !== DEFAULT_MINIO_BUCKET) return null
  const key = keyParts.join("/")
  if (!key) return null
  const root = portalRootForStorageDownload()
  if (!root) return null
  return `${root}/api/storage/download/${encodeURIComponent(key)}`
}

/** Đổi URL cũ kiểu https://host:9010/portal/key → /api/storage/download/... (khi cổng MinIO không public). */
function rewriteLegacyPublicStoragePrefixInHtml(html: string): string {
  const prefix = process.env.NEXT_PUBLIC_LEGACY_STORAGE_PUBLIC_PREFIX?.trim()
  if (!prefix || !html) return html
  const root = portalRootForStorageDownload()
  if (!root || !html.includes(prefix)) return html
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(esc + "/([^\"'\\s<>]+)", "gi")
  return html.replace(re, (_full, keyTail: string) => {
    let key = keyTail
    try {
      key = decodeURIComponent(keyTail)
    } catch {
      key = keyTail
    }
    return `${root}/api/storage/download/${encodeURIComponent(key)}`
  })
}

export function rewriteMinioUrlForBrowser(url: string): string {
  if (!url) return url
  const legacyPrefix = process.env.NEXT_PUBLIC_LEGACY_STORAGE_PUBLIC_PREFIX?.trim()
  if (legacyPrefix && url.startsWith(`${legacyPrefix}/`)) {
    const root = portalRootForStorageDownload()
    if (root) {
      const tail = url.slice(legacyPrefix.length + 1)
      try {
        return `${root}/api/storage/download/${encodeURIComponent(decodeURIComponent(tail))}`
      } catch {
        return `${root}/api/storage/download/${encodeURIComponent(tail)}`
      }
    }
  }
  try {
    const u = new URL(url)
    if (u.hostname !== "minio" && u.hostname !== "backend") return url

    const origin = explicitBrowserOrigin()
    if (origin) {
      return `${origin}${u.pathname}${u.search}${u.hash}`
    }

    const viaPortal = rewriteMinioPathStyleToPortalDownload(u)
    if (viaPortal) return viaPortal

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

/** Replace path-style MinIO URLs in HTML (ảnh guide lưu http://minio:9000/portal/... khi MinIO không public). */
function rewriteMinioBucketUrlsInHtml(html: string): string {
  const root = portalRootForStorageDownload()
  if (!root || !html.includes("minio")) return html
  const esc = DEFAULT_MINIO_BUCKET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`https?:\\/\\/minio(?::\\d+)?\\/${esc}\\/([^"'\\s<>]+)`, "gi")
  return html.replace(re, (_full, keyTail: string) => {
    let key = keyTail
    try {
      key = decodeURIComponent(keyTail)
    } catch {
      key = keyTail
    }
    return `${root}/api/storage/download/${encodeURIComponent(key)}`
  })
}

/** Replace every http(s)://minio[:port] in an HTML fragment */
export function rewriteMinioHostsInHtml(html: string): string {
  if (!html) return html

  let out = rewriteMinioBucketUrlsInHtml(html)
  const origin = explicitBrowserOrigin()
  if (origin) {
    out = out.replace(/https?:\/\/minio(?::\d+)?/gi, origin)
  } else if (useLocalhostMinioFallback()) {
    out = out.replace(/https?:\/\/minio(?::(\d+))?/gi, (_m, port: string | undefined) => {
      const p = port ? `:${port}` : ":9000"
      return `http://localhost${p}`
    })
  }

  out = rewriteLegacyPublicStoragePrefixInHtml(out)
  return out
}
