import { EmbedAssistantPageClient } from "./embed-assistant-client"

export default async function EmbedAssistantPage({
  params,
}: {
  params: Promise<{ alias: string }>
}) {
  const { alias } = await params
  return (
    <EmbedAssistantPageClient
      alias={alias}
      initialAssistantData={null}
    />
  )
}
