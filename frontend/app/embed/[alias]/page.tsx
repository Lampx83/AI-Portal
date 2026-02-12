import { EmbedAssistantPageClient } from "./embed-assistant-client"
import type { ResearchAssistantResponse } from "@/lib/research-assistants"

async function fetchAssistantForEmbed(alias: string): Promise<ResearchAssistantResponse | null> {
  const apiBase =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3001"
  const url = `${apiBase.replace(/\/+$/, "")}/api/research-assistants/${encodeURIComponent(alias)}`
  try {
    const res = await fetch(url, {
      next: { revalidate: 30 },
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function EmbedAssistantPage({
  params,
}: {
  params: Promise<{ alias: string }>
}) {
  const { alias } = await params
  const initialAssistantData = await fetchAssistantForEmbed(alias)
  return (
    <EmbedAssistantPageClient
      alias={alias}
      initialAssistantData={initialAssistantData}
    />
  )
}
