"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { PlusCircle, ChevronLeft, ChevronRight } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { Project } from "@/types"
import { Suspense } from "react"
// data
import { useAssistants } from "@/hooks/use-assistants"
import { useTools } from "@/hooks/use-tools"


import { useChatSessions } from "@/hooks/use-chat-session"
import { useActiveProject } from "@/contexts/active-project-context"
import { useLanguage } from "@/contexts/language-context"
import { useBranding } from "@/contexts/branding-context"
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage"

// sections
import ApplicationsSection from "@/components/sidebar/applications-section"
import AssistantsSection from "@/components/sidebar/assistants-section"
import MyProjectsSection from "@/components/sidebar/my-projects-section"
import ChatHistorySection, { type ChatHistoryItem } from "@/components/sidebar/chat-history-section"
import { AssistantChatHistoryDialog } from "@/components/sidebar/assistant-chat-history-dialog"






interface SidebarProps {
  setActiveView?: (assistantId: string) => void
  setActiveProject: Dispatch<SetStateAction<Project | null>>
  projects?: Project[]
  projectsEnabled?: boolean
  onAddProjectClick: () => void
  onAddProjectSuccess?: (project: Project) => void
  onSeeMoreClick: () => void
  onSeeMoreToolsClick?: () => void
  onSeeMoreProjectsClick?: () => void
  onEditProjectClick?: (project: Project) => void
  onViewChatHistoryClick?: (project: Project) => void
  onNewChatClick: () => void
}

export function Sidebar({
  setActiveView,
  setActiveProject,
  projects = [],
  projectsEnabled = true,
  onAddProjectClick,
  onAddProjectSuccess,
  onSeeMoreClick,
  onSeeMoreToolsClick,
  onSeeMoreProjectsClick,
  onEditProjectClick,
  onViewChatHistoryClick,
  onNewChatClick,
}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { branding } = useBranding()
  const hideNewChat = branding.hideNewChatOnAdmin === true
  const hideAppsAllOnAdmin = branding.hideAppsAllOnAdmin === true
  const hideAssistantsAllOnAdmin = branding.hideAssistantsAllOnAdmin === true
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [assistantHistoryDialog, setAssistantHistoryDialog] = useState<{ alias: string; name: string } | null>(null)
  const LG_BREAKPOINT = 1024
  const userToggledRef = useRef(false)
  const { t } = useLanguage()

  // Fetch assistants with metadata from API
  const { assistants, loading: assistantsLoading } = useAssistants()

  const APP_DISPLAY_NAMES: Record<string, string> = {}
  // Apps: from tools table (data), separate from assistants
  const { tools: appAssistants, loading: toolsLoading } = useTools()
  // Assistants from DB (excluding central, data; default = central)
  const visibleAssistants = useMemo(
    () => assistants.filter((a) => !["central", "main"].includes(a.alias) && a.health === "healthy"),
    [assistants]
  )

  // User email + active project to filter chat history per project
  const userEmail = session?.user?.email ?? undefined
  const { activeProject } = useActiveProject()

  const { items, loading, error, hasMore, loadMore, reload } = useChatSessions({
    userId: userEmail,
    projectId: activeProject?.id != null ? String(activeProject.id) : undefined,
    pageSize: 20,
  })

  // Refresh sessions on pathname change
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Periodic refresh for new chat history
  useEffect(() => {
    const interval = setInterval(() => {
      reload()
    }, 2000) // Refresh every 2s for quicker updates

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for custom event to reload after send
  useEffect(() => {
    const handleChatMessageSent = () => {
      // Reload when new message is sent
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
        t("chat.sessionLabel").replace("{date}", date.toLocaleDateString())
      return {
        id: s.id,
        title: label,
        assistant_alias: s.assistant_alias ?? "central",
      }
    })
  }, [items, t])

  const totalMessages = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.message_count || 0), 0)
  }, [items])


  // Dialog states (opened via onSeeMoreClick / onSeeMoreToolsClick)
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false)
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<Project | null>(null)
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false)
  const [selectedProjectForChat, setSelectedProjectForChat] = useState<Project | null>(null)

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
  // Tools: use path /tools/ for embedded editor (e.g. Write)
  const handleAppClick = (alias: string) => {
    setActiveProject(null)
    router.push(`/tools/${alias}`)
  }
  // Assistants: use /assistants/ with session id
  const handleAssistantClick = (alias: string) => {
    setActiveProject(null)
    const stored = getStoredSessionId(alias)
    const sid = stored ?? crypto.randomUUID()
    if (!stored) setStoredSessionId(alias, sid)
    router.push(`/assistants/${alias}?sid=${sid}`)
  }
  const handleProjectClick = (project: Project) => {
    setActiveProject(project)
    const stored = getStoredSessionId("central")
    const sid = stored ?? crypto.randomUUID()
    if (!stored) setStoredSessionId("central", sid)
    const rid = project?.id != null ? String(project.id) : ""
    router.push(rid ? `/assistants/central?sid=${sid}&rid=${encodeURIComponent(rid)}` : `/assistants/central?sid=${sid}`)
  }

  const handleNewChatWithAssistant = (alias: string) => {
    setActiveProject(null)
    const sid = crypto.randomUUID()
    setStoredSessionId(alias, sid)
    router.push(`/assistants/${alias}?sid=${sid}`)
  }

  const handleViewAssistantChatHistory = (alias: string, name: string) => {
    setAssistantHistoryDialog({ alias, name })
  }

  const handleSelectAssistantSession = (alias: string, sessionId: string) => {
    setActiveProject(null)
    router.replace(`/assistants/${alias}?sid=${sessionId}`, { scroll: false })
    setAssistantHistoryDialog(null)
  }

  const handlePickChatSession = (item: ChatHistoryItem) => {
    const rawAlias = item.assistant_alias ?? "central"
    const alias = rawAlias === "main" ? "central" : rawAlias
    setActiveProject(null)
    if (alias === "central") {
      router.push(`/assistants/central?sid=${item.id}&openFloating=1`)
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
              {!hideNewChat && (
                <Button
                  className="justify-center bg-brand hover:bg-brand/90 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  onClick={onNewChatClick}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {t("chat.newChat")}
                </Button>
              )}
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
              {projectsEnabled && (
                <MyProjectsSection
                  items={projects}
                  onSelect={handleProjectClick}
                  onEdit={onEditProjectClick}
                  onAdd={onAddProjectClick}
                  initialShowCount={5}
                  activeProjectId={activeProject?.id != null ? String(activeProject.id) : null}
                  onSeeMoreClick={onSeeMoreProjectsClick}
                />
              )}

              <ApplicationsSection
                assistants={appAssistants}
                loading={toolsLoading}
                isActiveRoute={isActiveRoute}
                onAssistantClick={handleAppClick}
                onSeeMoreClick={onSeeMoreToolsClick}
                hideSeeAllOnAdmin={hideAppsAllOnAdmin}
              />

              <AssistantsSection
                assistants={visibleAssistants}
                loading={assistantsLoading}
                limit={10}
                isActiveRoute={isActiveRoute}
                onAssistantClick={handleAssistantClick}
                onSeeMoreClick={onSeeMoreClick}
                onNewChatWithAssistant={handleNewChatWithAssistant}
                onViewAssistantChatHistory={session?.user ? handleViewAssistantChatHistory : undefined}
                hideSeeAllOnAdmin={hideAssistantsAllOnAdmin}
              />

              {session?.user && (
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
              )}
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

            {!hideNewChat && (
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 bg-brand hover:bg-brand/90 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg"
                onClick={onNewChatClick}
                title={t("chat.newChat")}
              >
                <PlusCircle className="h-5 w-5" />
              </Button>
            )}

            {/* Collapsed: Tools (data) — link to /tools/:alias, not chat */}
            {appAssistants.length > 0 && (
              <div className="flex flex-col items-center space-y-2">
                {appAssistants.map((assistant) => (
                  <Button
                    key={assistant.alias}
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg ${isActiveRoute(`/tools/${assistant.alias}`) ? "bg-gray-200 dark:bg-gray-800" : ""}`}
                    onClick={() => handleAppClick(assistant.alias)}
                    title={APP_DISPLAY_NAMES[assistant.alias] ?? assistant.name}
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${assistant.bgColor}`}>
                      <assistant.Icon className={`h-4 w-4 ${assistant.iconColor}`} />
                    </div>
                  </Button>
                ))}
              </div>
            )}
            {/* Collapsed: Assistants */}
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

        {/* AssistantsDialog & ToolsDialog opened via onSeeMoreClick / onSeeMoreToolsClick */}

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

      </aside>
    </Suspense>
  )
}
