import { EmbedAssistantPageClient } from "../../embed/[alias]/embed-assistant-client"

export default async function AssistantEmbedPage({
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
