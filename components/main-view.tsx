"use client"

import { ChatInterface } from "@/components/chat-interface"

export interface Research {
  id: number
  name: string
}

interface MainViewProps {
  researchContext: Research | null
}

export function MainView({ researchContext }: MainViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex">
        <div className="flex-1">
          <ChatInterface assistantName="Trợ lý AI" researchContext={researchContext} isMainChat={true} />
        </div>
      </div>
    </div>
  )
}
