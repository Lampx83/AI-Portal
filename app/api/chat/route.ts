import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: openai("gpt-4-turbo"),
    system:
      "You are a helpful AI assistant for NEU Research, a research platform for the National Economics University of Vietnam. Your name is NeuAI. Always respond in Vietnamese.",
    messages,
  })

  return result.toDataStreamResponse()
}
