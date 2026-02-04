"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { User, BookCopy, Bell, Settings, HelpCircle, LogOut } from "lucide-react"
import { getResearchProjects } from "@/lib/api/research-projects"
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
import { AddResearchDialog } from "@/components/add-research-dialog"
import { ResearchAssistantsDialog } from "@/components/research-assistants-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { EditResearchDialog } from "@/components/edit-research-dialog"
import { ResearchChatHistoryDialog } from "@/components/research-chat-history-dialog"
import { ActiveResearchProvider } from "@/contexts/active-research-context"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { Research } from "@/types"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeResearch, setActiveResearch] = useState<Research | null>(null)
  const [isAddResearchOpen, setIsAddResearchOpen] = useState(false)
  const [isAssistantsDialogOpen, setIsAssistantsDialogOpen] = useState(false)
  const [isEditResearchOpen, setIsEditResearchOpen] = useState(false)
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false)
  const [selectedResearchForEdit, setSelectedResearchForEdit] = useState<Research | null>(null)
  const [selectedResearchForChat, setSelectedResearchForChat] = useState<Research | null>(null)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isPublicationsDialogOpen, setIsPublicationsDialogOpen] = useState(false)
  const [isNotificationsDialogOpen, setIsNotificationsDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [researchProjects, setResearchProjects] = useState<Research[]>([])

  const loadResearchProjects = useCallback(async () => {
    try {
      const list = await getResearchProjects()
      setResearchProjects(list)
    } catch (_) {}
  }, [])

  useEffect(() => {
    loadResearchProjects()
  }, [loadResearchProjects])

  // Khi vào /assistants/main với rid trong URL (bấm nghiên cứu từ sidebar): đồng bộ activeResearch
  useEffect(() => {
    const rid = searchParams?.get("rid")
    if (!rid || !pathname?.includes("/assistants/main")) return
    setActiveResearch((prev) => {
      if (prev?.id != null && (String(prev.id) === rid || prev.id === rid)) return prev
      const found = researchProjects.find((p) => String(p.id) === rid || p.id === rid)
      return found ?? prev
    })
  }, [pathname, searchParams, researchProjects])

  useEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight)
    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])
  const handleEditResearch = (research: Research) => {
    setSelectedResearchForEdit(research)
    setIsEditResearchOpen(true)
  }

  const handleViewChatHistory = (research: Research) => {
    setSelectedResearchForChat(research)
    setIsChatHistoryOpen(true)
  }

  const handleDeleteResearch = (_research: Research) => {
    loadResearchProjects()
  }

  const handleNavigateToAssistant = (assistantId: string) => {
    router.push(`/assistants/${assistantId}`)
  }

  const handleNewChat = () => {
    router.push("/")
  }

  return (
    <ActiveResearchProvider activeResearch={activeResearch} setActiveResearch={setActiveResearch}>
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
          setActiveResearch={setActiveResearch}
          researchProjects={researchProjects}
          onAddResearchClick={() => setIsAddResearchOpen(true)}
          onSeeMoreClick={() => setIsAssistantsDialogOpen(true)}
          onEditResearchClick={handleEditResearch}
          onViewChatHistoryClick={handleViewChatHistory}
          onNewChatClick={handleNewChat}
        />

        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
          {children}
        </div>
      </div>

      {/* Dialogs */}
      <AddResearchDialog isOpen={isAddResearchOpen} onOpenChange={setIsAddResearchOpen} onSuccess={loadResearchProjects} />
      <ResearchAssistantsDialog
        isOpen={isAssistantsDialogOpen}
        onOpenChange={setIsAssistantsDialogOpen}
        setActiveView={handleNavigateToAssistant}
      />
      <EditResearchDialog
        isOpen={isEditResearchOpen}
        onOpenChange={setIsEditResearchOpen}
        research={selectedResearchForEdit}
        onDelete={handleDeleteResearch}
        onSuccess={loadResearchProjects}
      />
      <ResearchChatHistoryDialog
        isOpen={isChatHistoryOpen}
        onOpenChange={setIsChatHistoryOpen}
        research={selectedResearchForChat}
      />
    </div>
    </ActiveResearchProvider>
  )
}
