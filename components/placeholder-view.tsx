import { Construction } from "lucide-react"
import { ChatInterface } from "./chat-interface"
import type { Research } from "@/app/page"

interface PlaceholderViewProps {
  title: string
  description?: string
  researchContext: Research | null
}

export function PlaceholderView({
  title,
  description = "Chức năng này đang được phát triển và sẽ sớm ra mắt. Vui lòng quay lại sau.",
  researchContext,
}: PlaceholderViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex flex-col items-center justify-center text-center p-8 border-b dark:border-gray-800">
        <Construction className="w-16 h-16 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="max-w-md text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="flex-1 min-h-0">
        <ChatInterface assistantName={title} researchContext={researchContext} />
      </div>
    </div>
  )
}
