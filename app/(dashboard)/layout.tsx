"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import { User, BookCopy, Bell, Settings, HelpCircle, LogOut } from "lucide-react"
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
import { Sidebar } from "@/components/sidebar"
import { ResearchContextBanner } from "@/components/research-context-banner"
import { AddResearchDialog } from "@/components/add-research-dialog"
import { ResearchAssistantsDialog } from "@/components/research-assistants-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { EditResearchDialog } from "@/components/edit-research-dialog"
import { ResearchChatHistoryDialog } from "@/components/research-chat-history-dialog"
import { useRouter } from "next/navigation"
import type { Research } from "@/types"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [activeResearch, setActiveResearch] = useState<Research | null>(null)
  const [isAddResearchOpen, setIsAddResearchOpen] = useState(false)
  const [isAssistantsDialogOpen, setIsAssistantsDialogOpen] = useState(false)
  const [isEditResearchOpen, setIsEditResearchOpen] = useState(false)
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false)
  const [selectedResearchForEdit, setSelectedResearchForEdit] = useState<Research | null>(null)
  const [selectedResearchForChat, setSelectedResearchForChat] = useState<Research | null>(null)
  const [viewportHeight, setViewportHeight] = useState(0)

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

  const handleDeleteResearch = (research: Research) => {
    console.log("Xóa nghiên cứu:", research.name)
  }

  const handleNavigateToAssistant = (assistantId: string) => {
    router.push(`/assistants/${assistantId}`)
  }

  const handleNewChat = () => {
    router.push("/")
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950"
      style={{ height: viewportHeight }}>
      <Header
        onOpenProfile={() => setIsProfileDialogOpen(true)}
        onOpenPublications={() => setIsPublicationsDialogOpen(true)}
        onOpenNotifications={() => setIsNotificationsDialogOpen(true)}
        onOpenSettings={() => setIsSettingsDialogOpen(true)}
        onOpenHelp={() => setIsHelpDialogOpen(true)}
        onLogout={() => {
          // Logic xử lý đăng xuất
          console.log("Đăng xuất")
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          setActiveView={handleNavigateToAssistant}
          setActiveResearch={setActiveResearch}
          onAddResearchClick={() => setIsAddResearchOpen(true)}
          onSeeMoreClick={() => setIsAssistantsDialogOpen(true)}
          onEditResearchClick={handleEditResearch}
          onViewChatHistoryClick={handleViewChatHistory}
          onNewChatClick={handleNewChat}
        />

        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
          {activeResearch && (
            <ResearchContextBanner research={activeResearch} onClear={() => setActiveResearch(null)} />
          )}
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </div>

      {/* Dialogs */}
      <AddResearchDialog isOpen={isAddResearchOpen} onOpenChange={setIsAddResearchOpen} />
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
      />
      <ResearchChatHistoryDialog
        isOpen={isChatHistoryOpen}
        onOpenChange={setIsChatHistoryOpen}
        research={selectedResearchForChat}
      />
    </div>
  )
}
