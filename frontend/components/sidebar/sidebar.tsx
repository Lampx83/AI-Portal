"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
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
import { useResearchAssistants } from "@/hooks/use-research-assistants"


import { useChatSessions } from "@/hooks/use-chat-session"

// sections
import AssistantsSection from "@/components/sidebar/assistants-section"
import MyResearchSection from "@/components/sidebar/my-research-section"
import ChatHistorySection, { type ChatHistoryItem } from "@/components/sidebar/chat-history-section"






interface SidebarProps {
  setActiveResearch: Dispatch<SetStateAction<Research | null>>
  researchProjects?: Research[]
  onAddResearchClick: () => void
  onSeeMoreClick: () => void
  onEditResearchClick?: (research: Research) => void
  onViewChatHistoryClick?: (research: Research) => void
  onNewChatClick: () => void
}

export function Sidebar({
  setActiveResearch,
  researchProjects = [],
  onAddResearchClick,
  onSeeMoreClick,
  onEditResearchClick,
  onViewChatHistoryClick,
  onNewChatClick,
}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const LG_BREAKPOINT = 1024
  const userToggledRef = useRef(false)

  // Fetch assistants với metadata từ API
  const { assistants: researchAssistants, loading: assistantsLoading } = useResearchAssistants()

  // Lọc bỏ trợ lý main và chỉ hiển thị các trợ lý healthy ở sidebar
  const visibleAssistants = useMemo(
    () => researchAssistants.filter((a) => a.alias !== "main" && a.health === "healthy"),
    [researchAssistants]
  )

  // Lấy user email từ session để filter lịch sử chat
  const userEmail = session?.user?.email ?? undefined

  const { items, loading, error, hasMore, loadMore, reload } = useChatSessions({
    userId: userEmail, // Truyền email để backend filter theo user đã đăng nhập
    pageSize: 20,
  })

  // Refresh sessions khi pathname thay đổi (khi user navigate)
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Refresh sessions định kỳ để cập nhật lịch sử chat mới
  useEffect(() => {
    const interval = setInterval(() => {
      reload()
    }, 2000) // Refresh mỗi 2 giây để cập nhật nhanh hơn

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for custom event để reload ngay sau khi gửi tin nhắn thành công
  useEffect(() => {
    const handleChatMessageSent = () => {
      // Reload ngay lập tức khi có tin nhắn mới được gửi
      reload()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('chat-message-sent', handleChatMessageSent)
      return () => {
        window.removeEventListener('chat-message-sent', handleChatMessageSent)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chatHistoryItems: ChatHistoryItem[] = useMemo(() => {
    return items.map((s) => {
      const date = new Date(s.updated_at ?? s.created_at)
      const label =
        s.title?.trim() ||
        `Phiên chat ${date.toLocaleDateString()}`
      return {
        id: s.id,
        title: label,
        assistant_alias: s.assistant_alias ?? "main",
      }
    })
  }, [items])

  const totalMessages = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.message_count || 0), 0)
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
    const sid = crypto.randomUUID()
    router.push(`/assistants/main?sid=${sid}`)
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
                loading={assistantsLoading}
                limit={10}
                isActiveRoute={isActiveRoute}
                onAssistantClick={handleAssistantClick}
                onSeeMoreClick={onSeeMoreClick}
              />

              <MyResearchSection
                items={researchProjects}
                onSelect={handleResearchClick}
                onEdit={onEditResearchClick}
                onAdd={onAddResearchClick}
                initialShowCount={5}
              />

              <ChatHistorySection
                initialItems={chatHistoryItems}
                totalMessages={totalMessages}
                loading={loading}
                errorMessage={error ?? undefined}
                onDeleteSuccess={() => {
                  // Reload danh sách sessions sau khi xóa
                  reload()
                }}
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
        />

        <EditResearchDialog
          isOpen={isEditResearchOpen}
          onOpenChange={setIsEditResearchOpen}
          research={selectedResearchForEdit}
          onDelete={() => {}}
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
