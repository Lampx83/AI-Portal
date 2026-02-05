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
import { useActiveResearch } from "@/contexts/active-research-context"
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage"

// sections
import AssistantsSection from "@/components/sidebar/assistants-section"
import MyResearchSection from "@/components/sidebar/my-research-section"
import ChatHistorySection, { type ChatHistoryItem } from "@/components/sidebar/chat-history-section"
import { AssistantChatHistoryDialog } from "@/components/sidebar/assistant-chat-history-dialog"






interface SidebarProps {
  setActiveResearch: Dispatch<SetStateAction<Research | null>>
  researchProjects?: Research[]
  onAddResearchClick: () => void
  /** Gọi sau khi tạo nghiên cứu mới thành công (từ dialog trong sidebar) — layout dùng để reload và chuyển trang soạn thảo */
  onAddResearchSuccess?: (project: Research) => void
  onSeeMoreClick: () => void
  onEditResearchClick?: (research: Research) => void
  onViewChatHistoryClick?: (research: Research) => void
  onNewChatClick: () => void
}

export function Sidebar({
  setActiveResearch,
  researchProjects = [],
  onAddResearchClick,
  onAddResearchSuccess,
  onSeeMoreClick,
  onEditResearchClick,
  onViewChatHistoryClick,
  onNewChatClick,
}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [assistantHistoryDialog, setAssistantHistoryDialog] = useState<{ alias: string; name: string } | null>(null)
  const LG_BREAKPOINT = 1024
  const userToggledRef = useRef(false)

  // Fetch assistants với metadata từ API
  const { assistants: researchAssistants, loading: assistantsLoading } = useResearchAssistants()

  // Ẩn main khỏi "Trợ lý và công cụ" — vào Trợ lý chính (giao diện viết + chat floating) qua "Trò chuyện mới" hoặc chọn 1 nghiên cứu
  const visibleAssistants = useMemo(
    () => researchAssistants.filter((a) => a.alias !== "main" && a.alias !== "write" && a.health === "healthy"),
    [researchAssistants]
  )

  // Lấy user email từ session và nghiên cứu đang chọn để filter lịch sử chat theo từng nghiên cứu
  const userEmail = session?.user?.email ?? undefined
  const { activeResearch } = useActiveResearch()

  const { items, loading, error, hasMore, loadMore, reload } = useChatSessions({
    userId: userEmail,
    researchId: activeResearch?.id != null ? String(activeResearch.id) : undefined,
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
  // Chuyển sang trợ lý: dùng lại sid đã lưu (nếu có) để tiếp tục trò chuyện cũ
  const handleAssistantClick = (alias: string) => {
    const stored = getStoredSessionId(alias)
    const sid = stored ?? crypto.randomUUID()
    if (!stored) setStoredSessionId(alias, sid)
    router.push(`/assistants/${alias}?sid=${sid}`)
  }
  const handleResearchClick = (research: Research) => {
    setActiveResearch(research)
    const stored = getStoredSessionId("main")
    const sid = stored ?? crypto.randomUUID()
    if (!stored) setStoredSessionId("main", sid)
    const rid = research?.id != null ? String(research.id) : ""
    router.push(rid ? `/assistants/main?sid=${sid}&rid=${encodeURIComponent(rid)}` : `/assistants/main?sid=${sid}`)
  }

  const handleNewChatWithAssistant = (alias: string) => {
    const sid = crypto.randomUUID()
    setStoredSessionId(alias, sid)
    router.push(`/assistants/${alias}?sid=${sid}`)
  }

  const handleViewAssistantChatHistory = (alias: string, name: string) => {
    setAssistantHistoryDialog({ alias, name })
  }

  const handleSelectAssistantSession = (alias: string, sessionId: string) => {
    router.replace(`/assistants/${alias}?sid=${sessionId}`, { scroll: false })
    setAssistantHistoryDialog(null)
  }

  const handlePickChatSession = (item: ChatHistoryItem) => {
    const alias = item.assistant_alias ?? "main"
    if (alias === "main") {
      setActiveResearch(null)
      router.push(`/assistants/main?sid=${item.id}&openFloating=1`)
    } else {
      router.push(`/assistants/${alias}?sid=${item.id}`)
    }
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
                onClick={onAddResearchClick}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Nghiên cứu mới
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
              <MyResearchSection
                items={researchProjects}
                onSelect={handleResearchClick}
                onEdit={onEditResearchClick}
                onAdd={onAddResearchClick}
                initialShowCount={5}
              />

              <AssistantsSection
                assistants={visibleAssistants}
                loading={assistantsLoading}
                limit={10}
                isActiveRoute={isActiveRoute}
                onAssistantClick={handleAssistantClick}
                onSeeMoreClick={onSeeMoreClick}
                onNewChatWithAssistant={handleNewChatWithAssistant}
                onViewAssistantChatHistory={handleViewAssistantChatHistory}
              />

              <ChatHistorySection
                initialItems={chatHistoryItems}
                totalMessages={totalMessages}
                loading={loading}
                errorMessage={error ?? undefined}
                onPickSession={handlePickChatSession}
                onDeleteSuccess={() => {
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
              onClick={onAddResearchClick}
              title="Nghiên cứu mới"
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
        <AddResearchDialog
          isOpen={isAddResearchOpen}
          onOpenChange={setIsAddResearchOpen}
          onSuccess={(project) => {
            if (project) {
              onAddResearchSuccess?.(project)
              setIsAddResearchOpen(false)
            }
          }}
        />

        <ResearchAssistantsDialog
          isOpen={isAssistantsDialogOpen}
          onOpenChange={setIsAssistantsDialogOpen}
        />

        {assistantHistoryDialog && (
          <AssistantChatHistoryDialog
            isOpen={!!assistantHistoryDialog}
            onOpenChange={(open) => !open && setAssistantHistoryDialog(null)}
            assistantAlias={assistantHistoryDialog.alias}
            assistantName={assistantHistoryDialog.name}
            items={chatHistoryItems}
            onSelectSession={(sessionId) => handleSelectAssistantSession(assistantHistoryDialog.alias, sessionId)}
            onDeleteSuccess={reload}
          />
        )}

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
