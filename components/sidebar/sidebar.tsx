"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PlusCircle, ChevronLeft, ChevronRight } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { Research } from "@/types"
import { Suspense } from "react"
// dialogs
import { AddResearchDialog } from "@/components/add-research-dialog"
import { EditResearchDialog } from "@/components/edit-research-dialog"
import { ResearchAssistantsDialog } from "@/components/research-assistants-dialog"
import { ResearchChatHistoryDialog } from "@/components/research-chat-history-dialog"

// data
import { researchAssistants } from "@/lib/research-assistants"


import { useChatSessions } from "@/hooks/use-chat-session"

// sections
import AssistantsSection from "@/components/sidebar/assistants-section"
import MyResearchSection from "@/components/sidebar/my-research-section"
import ChatHistorySection, { type ChatHistoryItem } from "@/components/sidebar/chat-history-section"

const myResearchData: Research[] = [
  { id: 1, name: "Dự án Kinh tế Vĩ mô Q3" },
  { id: 2, name: "Phân tích thị trường BĐS" },
  { id: 3, name: "Nghiên cứu lạm phát Việt Nam" },
  { id: 4, name: "Tác động FDI đến tăng trưởng" },
  { id: 5, name: "Chính sách tiền tệ 2024" },
]





interface SidebarProps {
  setActiveResearch: Dispatch<SetStateAction<Research | null>>
  onAddResearchClick: () => void
  onSeeMoreClick: () => void
  onEditResearchClick: (research: Research) => void
  onViewChatHistoryClick: (research: Research) => void
  onNewChatClick: () => void

  // Dialog control
  isAddResearchOpen: boolean
  setIsAddResearchOpen: Dispatch<SetStateAction<boolean>>
  isAssistantsDialogOpen: boolean
  setIsAssistantsDialogOpen: Dispatch<SetStateAction<boolean>>
  isEditResearchOpen: boolean
  setIsEditResearchOpen: Dispatch<SetStateAction<boolean>>
  selectedResearchForEdit: Research | null
  setSelectedResearchForEdit: Dispatch<SetStateAction<Research | null>>
  isChatHistoryOpen: boolean
  setIsChatHistoryOpen: Dispatch<SetStateAction<boolean>>
  selectedResearchForChat: Research | null
  setSelectedResearchForChat: Dispatch<SetStateAction<Research | null>>
}

export function Sidebar({
  setActiveResearch,
  onAddResearchClick,
  onSeeMoreClick,
}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const LG_BREAKPOINT = 1024
  const userToggledRef = useRef(false)

  // Lọc bỏ trợ lý main khỏi danh sách hiển thị
  const visibleAssistants = useMemo(
    () => researchAssistants.filter((a) => a.alias !== "main"),
    []
  )

  const { items, loading, error, hasMore, loadMore } = useChatSessions({
    userId: undefined, // TODO: truyền userId nếu bạn có
    pageSize: 20,
  })

  const chatHistoryItems: ChatHistoryItem[] = useMemo(() => {
    return items.map((s) => {
      const date = new Date(s.updated_at ?? s.created_at)
      const label =
        s.title?.trim() ||
        `Phiên chat ${date.toLocaleDateString()} • ${s.message_count} tin nhắn`
      return { id: s.id, title: label }
    })
  }, [items])


  // Dialog states
  const [isAddResearchOpen, setIsAddResearchOpen] = useState(false)
  const [isAssistantsDialogOpen, setIsAssistantsDialogOpen] = useState(false)
  const [isEditResearchOpen, setIsEditResearchOpen] = useState(false)
  const [selectedResearchForEdit, setSelectedResearchForEdit] = useState<Research | null>(null)
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false)
  const [selectedResearchForChat, setSelectedResearchForChat] = useState<Research | null>(null)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LG_BREAKPOINT}px)`)
    const applyByMQ = (matches: boolean) => {
      if (!userToggledRef.current) setIsCollapsed(matches)
    }
    applyByMQ(mq.matches)
    const handler = (e: MediaQueryListEvent) => applyByMQ(e.matches)
    mq.addEventListener?.("change", handler)
    mq.addListener?.(handler)
    return () => {
      mq.removeEventListener?.("change", handler)
      mq.removeListener?.(handler)
    }
  }, [])

  const isActiveRoute = (route: string) => pathname === route || pathname.startsWith(route)
  const handleAssistantClick = (alias: string) => {
    const sid = crypto.randomUUID() // tạo session ID ngẫu nhiên
    router.push(`/assistants/${alias}?sid=${sid}`)
  }
  const handleResearchClick = (research: Research) => {
    setActiveResearch(research)
    router.push(`/research/${research.id}`)
  }

  // Luôn bắt đầu chat mới với trợ lý main
  // Luôn bắt đầu chat mới với trợ lý main
  const startNewChatWithMain = () => {
    const sid = crypto.randomUUID()
    router.push(`/assistants/main?sid=${sid}`)
  }


  return (
    <Suspense fallback={null}>
      <aside
        className={`${isCollapsed ? "w-20" : "w-[300px]"} bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 flex flex-col h-full border-r border-gray-200 dark:border-gray-800 transition-all duration-300 py-4 px-2.5`}
      >
        {!isCollapsed ? (
          <>
            <div className="mb-6 relative flex justify-center items-center h-10">
              <Button
                className="justify-center bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={startNewChatWithMain}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Trò chuyện mới
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-0 h-10 w-10 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200"
                onClick={() => {
                  userToggledRef.current = true
                  setIsCollapsed((v) => !v)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto -mx-2 space-y-6">
              <AssistantsSection
                assistants={visibleAssistants}
                limit={10}
                isActiveRoute={isActiveRoute}
                onAssistantClick={handleAssistantClick}
                onSeeMoreClick={onSeeMoreClick}
              />

              <MyResearchSection
                items={myResearchData}
                onSelect={handleResearchClick}
                onAdd={onAddResearchClick}
                initialShowCount={10}
              />

              <ChatHistorySection
                initialItems={chatHistoryItems}
                loading={loading}
                errorMessage={error ?? undefined}
                onLoadMore={hasMore ? loadMore : undefined}
              />
            </div>
          </>
        ) : (
          /* Collapsed View */
          <div className="flex flex-col items-center space-y-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200"
              onClick={() => {
                userToggledRef.current = true
                setIsCollapsed((v) => !v)
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg"
              onClick={startNewChatWithMain}
              title="Trò chuyện mới"
            >
              <PlusCircle className="h-5 w-5" />
            </Button>

            {/* Collapsed Assistant Icons */}
            <div className="flex flex-col items-center space-y-2">
              {visibleAssistants.slice(0, 10).map((assistant) => (
                <Button
                  key={assistant.alias}
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg ${isActiveRoute(`/assistants/${assistant.alias}`) ? "bg-gray-200 dark:bg-gray-800" : ""}`}
                  onClick={() => handleAssistantClick(assistant.alias)}
                  title={assistant.name}
                >
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${assistant.bgColor}`}>
                    <assistant.Icon className={`h-4 w-4 ${assistant.iconColor}`} />
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Dialogs */}
        <AddResearchDialog isOpen={isAddResearchOpen} onOpenChange={setIsAddResearchOpen} />

        <ResearchAssistantsDialog
          isOpen={isAssistantsDialogOpen}
          onOpenChange={setIsAssistantsDialogOpen}
          setActiveView={(view) => console.log("Set view từ assistants", view)}
        />

        <EditResearchDialog
          isOpen={isEditResearchOpen}
          onOpenChange={setIsEditResearchOpen}
          research={selectedResearchForEdit}
          onDelete={(r) => console.log("Xóa nghiên cứu:", r.name)}
        />

        <ResearchChatHistoryDialog
          isOpen={isChatHistoryOpen}
          onOpenChange={setIsChatHistoryOpen}
          research={selectedResearchForChat}
        />
      </aside>
    </Suspense>
  )
}
