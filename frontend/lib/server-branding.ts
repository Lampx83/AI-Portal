// Server-only: fetch branding for generateMetadata (link preview). No window/client.

const DEFAULT_TITLE = "AI Portal"
const DEFAULT_DESCRIPTION = "AI Portal – Interface and orchestration platform for AI."

function getServerBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  if (base) return base.replace(/\/+$/, "")
  return "http://localhost:3000"
}

export type ServerBranding = { systemName: string; systemSubtitle?: string }

/** Fetch system name and subtitle for metadata (og:title, og:description). Used in root layout generateMetadata. */
export async function getBrandingForMetadata(): Promise<ServerBranding> {
  try {
    const base = getServerBaseUrl()
    const res = await fetch(`${base}/api/setup/branding`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { systemName: "", systemSubtitle: undefined }
    const d = data as { systemName?: string; systemSubtitle?: string }
    const systemName = typeof d.systemName === "string" ? d.systemName.trim() : ""
    const systemSubtitle =
      typeof d.systemSubtitle === "string" && d.systemSubtitle.trim()
        ? d.systemSubtitle.trim()
        : undefined
    return { systemName, systemSubtitle }
  } catch {
    return { systemName: "", systemSubtitle: undefined }
  }
}

export function getDefaultTitle(): string {
  return DEFAULT_TITLE
}

export function getDefaultDescription(): string {
  return DEFAULT_DESCRIPTION
}
