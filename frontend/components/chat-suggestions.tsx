"use client"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

const MAX_DISPLAY_WORDS = 30

function truncateToWords(text: string, maxWords: number): string {
  const trimmed = (text ?? "").trim()
  if (!trimmed) return trimmed
  const words = trimmed.split(/\s+/)
  if (words.length <= maxWords) return trimmed
  return words.slice(0, maxWords).join(" ") + "..."
}

interface ChatSuggestionsProps {
  suggestions: string[]
  onSuggestionClick: (suggestion: string) => void
  assistantName: string
  /** Khi true (trợ lý chính), chỉ hiển thị "Bắt đầu trò chuyện", không kèm tên trợ lý */
  isCentral?: boolean
}

export function ChatSuggestions({ suggestions, onSuggestionClick, assistantName, isCentral }: ChatSuggestionsProps) {
  const { t } = useLanguage()
  const startChatMsg = t("chat.startChatWith")
  const [beforeName, afterName] = startChatMsg.split("{name}")

  const titleLine = isCentral ? (
    <p className="text-lg mb-4">{t("chat.startChat")}</p>
  ) : (
    <p className="text-lg mb-4">
      {beforeName}<b>{assistantName}</b>{afterName}
    </p>
  )

  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
      {titleLine}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            className="h-auto p-4 text-left justify-start items-start whitespace-normal break-words bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors w-full"
            onClick={() => onSuggestionClick(suggestion)}
          >
            <span className="text-sm leading-relaxed">
              {truncateToWords(suggestion, MAX_DISPLAY_WORDS)}
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}

