"use client"

import { ChatInterface } from "@/components/chat-interface"
import type { Project } from "@/types"

interface MainViewProps {
  projectContext: Project | null
}

export function MainView({ projectContext }: MainViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex">
        <div className="flex-1">
          <ChatInterface
            assistantName="Trợ lý AI"
            projectContext={projectContext}
            isMainChat={true}
            loadingMessage="Các agent phù hợp đang trả lời..."
          />
        </div>
      </div>
    </div>
  )
}
