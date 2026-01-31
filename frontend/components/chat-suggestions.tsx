"use client"

import { Button } from "@/components/ui/button"

interface ChatSuggestionsProps {
  suggestions: string[]
  onSuggestionClick: (suggestion: string) => void
  assistantName: string
}

export function ChatSuggestions({ suggestions, onSuggestionClick, assistantName }: ChatSuggestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
      <p className="text-lg mb-4">Bắt đầu trò chuyện với trợ lý <b>{assistantName}</b></p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            className="h-auto p-4 text-left justify-start items-start whitespace-normal break-words bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            onClick={() => onSuggestionClick(suggestion)}
          >
            <span className="text-sm leading-relaxed">{suggestion}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
