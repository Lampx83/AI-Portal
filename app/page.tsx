"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar/sidebar"
import { AddResearchDialog } from "@/components/add-research-dialog"
import { ResearchAssistantsDialog } from "@/components/research-assistants-dialog"
import { ThemeProvider } from "@/components/theme-provider"
import { EditResearchDialog } from "@/components/edit-research-dialog"
import { ResearchChatHistoryDialog } from "@/components/research-chat-history-dialog"


import { ResearchContextBanner } from "@/components/research-context-banner"
import { Header } from "@/components/header"

export interface Research {
  id: number
  name: string
}

export type ViewType =
  | "chat"
  | "experts"
  | "conferences"
  | "neu-data"
  | "citation"
  | "statistics"
  | "plagiarism"
  | "grants"
  | "translation"

export default function NeuResearchPage() {
  const [activeView, setActiveView] = useState<ViewType>("chat")
  const [activeResearch, setActiveResearch] = useState<Research | null>(null)
  const [isAddResearchOpen, setIsAddResearchOpen] = useState(false)
  const [isAssistantsDialogOpen, setIsAssistantsDialogOpen] = useState(false)
  const [isEditResearchOpen, setIsEditResearchOpen] = useState(false)
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false)
  const [selectedResearchForEdit, setSelectedResearchForEdit] = useState<Research | null>(null)
  const [selectedResearchForChat, setSelectedResearchForChat] = useState<Research | null>(null)

  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isPublicationsDialogOpen, setIsPublicationsDialogOpen] = useState(false)
  const [isNotificationsDialogOpen, setIsNotificationsDialogOpen] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)

  const [newChatTrigger, setNewChatTrigger] = useState(0)

  const handleEditResearch = (research: Research) => {
    setSelectedResearchForEdit(research)
    setIsEditResearchOpen(true)
  }

  const handleViewChatHistory = (research: Research) => {
    setSelectedResearchForChat(research)
    setIsChatHistoryOpen(true)
  }

  const handleDeleteResearch = (research: Research) => {
    // Logic xóa nghiên cứu
    console.log("Xóa nghiên cứu:", research.name)
  }

  const renderActiveView = () => {
    const handleNewChat = () => {
      setNewChatTrigger((prev) => prev + 1)
    }


  }

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950">
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
            setActiveResearch={setActiveResearch}
            onAddResearchClick={() => setIsAddResearchOpen(true)}
            onSeeMoreClick={() => setIsAssistantsDialogOpen(true)}
            onEditResearchClick={handleEditResearch}
            onViewChatHistoryClick={handleViewChatHistory}
            onNewChatClick={() => {
              setActiveView("chat")
              setNewChatTrigger((prev) => prev + 1)
            }}
          />
          <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
            {activeResearch && (
              <ResearchContextBanner research={activeResearch} onClear={() => setActiveResearch(null)} />
            )}
            <div className="flex-1 overflow-hidden">{renderActiveView()}</div>
          </div>
        </div>
      </div>

    </ThemeProvider>
  )
}