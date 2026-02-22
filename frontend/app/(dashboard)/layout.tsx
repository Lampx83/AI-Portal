"use client"

import type React from "react"

import { useState, useEffect, useCallback, Suspense } from "react"
import Image from "next/image"
import { User, BookCopy, Bell, Settings, HelpCircle, LogOut } from "lucide-react"
import { getProjects } from "@/lib/api/projects"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar/sidebar"
import { AddProjectDialog } from "@/components/add-project-dialog"
import { AssistantsDialog } from "@/components/assistants-dialog"
import { ToolsDialog } from "@/components/tools-dialog"
import { ProjectsDialog } from "@/components/projects-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { EditProjectDialog } from "@/components/edit-project-dialog"
import { ProjectChatHistoryDialog } from "@/components/project-chat-history-dialog"
import { ActiveProjectProvider } from "@/contexts/active-project-context"
import { useBranding } from "@/contexts/branding-context"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage"
import type { Project } from "@/types"

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { branding } = useBranding()
  const projectsEnabled = branding.projectsEnabled !== false
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [isAssistantsDialogOpen, setIsAssistantsDialogOpen] = useState(false)
  const [isToolsDialogOpen, setIsToolsDialogOpen] = useState(false)
  const [isProjectsDialogOpen, setIsProjectsDialogOpen] = useState(false)
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false)
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false)
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<Project | null>(null)
  const [selectedProjectForChat, setSelectedProjectForChat] = useState<Project | null>(null)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isPublicationsDialogOpen, setIsPublicationsDialogOpen] = useState(false)
  const [isNotificationsDialogOpen, setIsNotificationsDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])

  const loadProjects = useCallback(async () => {
    try {
      const list = await getProjects()
      setProjects(list)
    } catch (_) {}
  }, [])

  /** Load projects và đồng bộ activeProject (để tên dự án đã sửa hiển thị đúng) */
  const loadProjectsAndSyncActive = useCallback(async () => {
    try {
      const list = await getProjects()
      setProjects(list)
      setActiveProject((prev) =>
        prev ? list.find((p) => String(p.id) === String(prev.id)) ?? prev : null
      )
    } catch (_) {}
  }, [setActiveProject])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    const openAddProject = () => {
      if (projectsEnabled) setIsAddProjectOpen(true)
    }
    window.addEventListener("open-add-project", openAddProject)
    return () => window.removeEventListener("open-add-project", openAddProject)
  }, [projectsEnabled])

  useEffect(() => {
    const onInviteAccepted = () => loadProjects()
    window.addEventListener("project-invite-accepted", onInviteAccepted)
    return () => window.removeEventListener("project-invite-accepted", onInviteAccepted)
  }, [loadProjects])

  useEffect(() => {
    const onProjectUpdated = () => {
      getProjects().then((list) => {
        setProjects(list)
        setActiveProject((prev) => (prev ? list.find((p) => String(p.id) === String(prev.id)) ?? prev : null))
      })
    }
    window.addEventListener("project-updated", onProjectUpdated)
    return () => window.removeEventListener("project-updated", onProjectUpdated)
  }, [setActiveProject])

  useEffect(() => {
    const rid = searchParams?.get("rid")
    if (!rid) return
    const isCentralOrData = pathname?.includes("/assistants/central") || pathname?.includes("/assistants/data")
    if (!isCentralOrData) return
    setActiveProject((prev) => {
      if (prev?.id != null && (String(prev.id) === rid || prev.id === rid)) return prev
      const found = projects.find((p) => String(p.id) === rid || p.id === rid)
      return found ?? prev
    })
  }, [pathname, searchParams, projects])

  useEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight)
    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])
  const handleEditProject = (project: Project) => {
    setSelectedProjectForEdit(project)
    setIsEditProjectOpen(true)
  }

  useEffect(() => {
    const openEditProject = (e: Event) => {
      const project = (e as CustomEvent<Project>).detail
      if (project) handleEditProject(project)
    }
    window.addEventListener("open-edit-project", openEditProject)
    return () => window.removeEventListener("open-edit-project", openEditProject)
  }, [handleEditProject])

  const handleViewChatHistory = (project: Project) => {
    setSelectedProjectForChat(project)
    setIsChatHistoryOpen(true)
  }

  useEffect(() => {
    const openProjectChatHistory = (e: Event) => {
      const project = (e as CustomEvent<Project>).detail
      if (project) handleViewChatHistory(project)
    }
    window.addEventListener("open-project-chat-history", openProjectChatHistory)
    return () => window.removeEventListener("open-project-chat-history", openProjectChatHistory)
  }, [])

  const handleDeleteProject = () => {
    loadProjects()
  }

  const handleNavigateToAssistant = (assistantId: string) => {
    setActiveProject(null)
    router.push(`/assistants/${assistantId}`)
  }

  // New chat = start with Main assistant (central)
  const handleNewChat = () => {
    setActiveProject(null)
    const sid = crypto.randomUUID()
    setStoredSessionId("central", sid)
    router.push(`/assistants/central?sid=${sid}`)
  }

  const handleSelectProjectFromDialog = (project: Project) => {
    setActiveProject(project)
    const stored = getStoredSessionId("central")
    const sid = stored ?? crypto.randomUUID()
    if (!stored) setStoredSessionId("central", sid)
    const rid = project?.id != null ? String(project.id) : ""
    router.push(rid ? `/assistants/central?sid=${sid}&rid=${encodeURIComponent(rid)}` : `/assistants/central?sid=${sid}`)
  }

  return (
    <ActiveProjectProvider activeProject={activeProject} setActiveProject={setActiveProject}>
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950"
      style={{ height: viewportHeight }}>
      <Header
        onOpenProfile={() => setIsProfileDialogOpen(true)}
        onOpenPublications={() => setIsPublicationsDialogOpen(true)}
        onOpenNotifications={() => setIsNotificationsDialogOpen(true)}
        onOpenSettings={() => setIsSettingsDialogOpen(true)}
        onOpenHelp={() => setIsHelpDialogOpen(true)}
        onLogout={() => {}}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          setActiveView={handleNavigateToAssistant}
          setActiveProject={setActiveProject}
          projects={projects}
          projectsEnabled={projectsEnabled}
          onAddProjectClick={() => projectsEnabled && setIsAddProjectOpen(true)}
          onAddProjectSuccess={(project) => {
            loadProjects()
            if (project) {
              setActiveProject(project)
              const params = new URLSearchParams()
              params.set("rid", String(project.id))
              router.push(`/assistants/central?${params.toString()}`, { scroll: false })
            }
          }}
          onSeeMoreClick={() => setIsAssistantsDialogOpen(true)}
          onSeeMoreToolsClick={() => setIsToolsDialogOpen(true)}
          onSeeMoreProjectsClick={() => setIsProjectsDialogOpen(true)}
          onEditProjectClick={handleEditProject}
          onViewChatHistoryClick={handleViewChatHistory}
          onNewChatClick={handleNewChat}
        />

        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
          {children}
        </div>
      </div>

      <AddProjectDialog
        isOpen={isAddProjectOpen}
        onOpenChange={setIsAddProjectOpen}
        onSuccess={(project) => {
          loadProjects()
          if (project) {
            setActiveProject(project)
            const params = new URLSearchParams()
            if (pathname?.includes("/assistants/central") && searchParams) {
              searchParams.forEach((value, key) => params.set(key, value))
            }
            params.set("rid", String(project.id))
            router.push(`/assistants/central?${params.toString()}`, { scroll: false })
          }
        }}
      />
      <AssistantsDialog
        isOpen={isAssistantsDialogOpen}
        onOpenChange={setIsAssistantsDialogOpen}
        setActiveView={handleNavigateToAssistant}
        assistantsOnly
      />
      <ToolsDialog
        isOpen={isToolsDialogOpen}
        onOpenChange={setIsToolsDialogOpen}
        setActiveView={handleNavigateToAssistant}
      />
      {projectsEnabled && (
      <ProjectsDialog
        isOpen={isProjectsDialogOpen}
        onOpenChange={setIsProjectsDialogOpen}
        projects={projects}
        onSelect={handleSelectProjectFromDialog}
        onAdd={() => {
          setIsProjectsDialogOpen(false)
          setIsAddProjectOpen(true)
        }}
        onEdit={handleEditProject}
        activeProjectId={activeProject?.id != null ? String(activeProject.id) : null}
      />
      )}
      <EditProjectDialog
        isOpen={isEditProjectOpen}
        onOpenChange={setIsEditProjectOpen}
        project={selectedProjectForEdit}
        onDelete={handleDeleteProject}
        onSuccess={loadProjectsAndSyncActive}
      />
      <ProjectChatHistoryDialog
        isOpen={isChatHistoryOpen}
        onOpenChange={setIsChatHistoryOpen}
        project={selectedProjectForChat}
      />
    </div>
    </ActiveProjectProvider>
  )
}

function DashboardLayoutFallback() {
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<DashboardLayoutFallback />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  )
}
