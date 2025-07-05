"use client"

import { Construction, ChevronUp, ChevronDown } from "lucide-react"
import { ChatInterface } from "./chat-interface"
import type { Research } from "@/app/page"
import { useState } from "react"
import { Button } from "@/components/ui/button"

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
  const [isPlaceholderViewCollapsed, setIsPlaceholderViewCollapsed] = useState(false) // New state

  const togglePlaceholderViewCollapse = () => {
    setIsPlaceholderViewCollapsed((prev) => !prev)
  }

  const handleChatStart = () => {
    setIsPlaceholderViewCollapsed(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Placeholder Section - Collapsible */}
      <div
        className={`flex-shrink-0 overflow-hidden transition-all duration-300 border-b dark:border-gray-800 ${
          isPlaceholderViewCollapsed ? "max-h-16" : "max-h-none"
        }`}
      >
        {/* Collapsed Header */}
        {isPlaceholderViewCollapsed && (
          <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <Construction className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlaceholderViewCollapse}
              className="text-gray-700 dark:text-gray-300"
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Mở rộng
            </Button>
          </div>
        )}

        {/* Full Placeholder Content */}
        {!isPlaceholderViewCollapsed && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center text-center p-8 border-b dark:border-gray-800">
            <Construction className="w-16 h-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">{title}</h2>
            <p className="max-w-md text-gray-500 dark:text-gray-400">{description}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePlaceholderViewCollapse}
              className="mt-4 text-gray-700 dark:text-gray-300 bg-transparent"
            >
              <ChevronUp className="h-4 w-4 mr-1" />
              Thu gọn
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ChatInterface
          assistantName={title}
          researchContext={researchContext}
          onChatStart={handleChatStart}
          onToggleView={togglePlaceholderViewCollapse}
        />
      </div>
    </div>
  )
}
