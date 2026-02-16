"use client"

import { ChatInterface } from "@/components/chat-interface"
import { useLanguage } from "@/contexts/language-context"
import type { Project } from "@/types"

interface MainViewProps {
  projectContext: Project | null
}

export function MainView({ projectContext }: MainViewProps) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex">
        <div className="flex-1">
          <ChatInterface
            assistantName={t("chat.assistantAI")}
            projectContext={projectContext}
            isMainChat={true}
            loadingMessage={t("chat.agentsResponding")}
          />
        </div>
      </div>
    </div>
  )
}
