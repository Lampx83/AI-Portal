"use client"

import { useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { MainView } from "@/components/main-view"
import { NeuDataView } from "@/components/neu-data-view"
import { ExpertView } from "@/components/expert-view"
import { ConferenceView } from "@/components/conference-view"
import { PlaceholderView } from "@/components/placeholder-view"
import { ResearchContextBanner } from "@/components/research-context-banner"
import { AddResearchDialog } from "@/components/add-research-dialog"
import { ResearchAssistantsDialog } from "@/components/research-assistants-dialog"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { EditResearchDialog } from "@/components/edit-research-dialog"
import { ResearchChatHistoryDialog } from "@/components/research-chat-history-dialog"
import { ProfileSettingsView } from "@/components/profile-settings-view"
import { PublicationsView } from "@/components/publications-view"
import { SystemSettingsView } from "@/components/system-settings-view"
import { HelpGuideView } from "@/components/help-guide-view"
import { Dialog, DialogContent } from "@/components/ui/dialog"

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

    switch (activeView) {
      case "experts":
        return <ExpertView researchContext={activeResearch} />
      case "conferences":
        return <ConferenceView researchContext={activeResearch} />
      case "neu-data":
        return <NeuDataView researchContext={activeResearch} />
      case "citation":
        return <PlaceholderView title="Soạn thảo & Trích dẫn" researchContext={activeResearch} />
      case "statistics":
        return <PlaceholderView title="Thống kê & Phân tích" researchContext={activeResearch} />
      case "plagiarism":
        return <PlaceholderView title="Kiểm tra Đạo văn" researchContext={activeResearch} />
      case "grants":
        return <PlaceholderView title="Xin tài trợ & Quỹ" researchContext={activeResearch} />
      case "translation":
        return <PlaceholderView title="Dịch thuật Học thuật" researchContext={activeResearch} />
      case "chat":
      default:
        return <MainView researchContext={activeResearch} />
    }
  }

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950">
        <header className="bg-neu-blue text-white shadow-md z-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Image src="/neu-logo.svg" alt="Logo Đại học Kinh tế Quốc dân" width={40} height={40} />
                <h1 className="text-xl font-bold tracking-tight">Neu Research</h1>
              </div>
              <div className="flex items-center space-x-2">
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-12 w-12 rounded-full hover:bg-white/10">
                      <User className="h-8 w-8" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">nguyenvana</p>
                        <p className="text-xs leading-none text-muted-foreground">nva@st.neu.edu.vn</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Hồ sơ</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsPublicationsDialogOpen(true)}>
                      <BookCopy className="mr-2 h-4 w-4" />
                      <span>Công bố của tôi</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsNotificationsDialogOpen(true)}>
                      <Bell className="mr-2 h-4 w-4" />
                      <span>Thông báo</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsSettingsDialogOpen(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Cài đặt</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsHelpDialogOpen(true)}>
                      <HelpCircle className="mr-2 h-4 w-4" />
                      <span>Trợ giúp</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        // Handle logout logic here
                        console.log("Đăng xuất")
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Đăng xuất</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            setActiveView={setActiveView}
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
      <AddResearchDialog isOpen={isAddResearchOpen} onOpenChange={setIsAddResearchOpen} />
      <ResearchAssistantsDialog
        isOpen={isAssistantsDialogOpen}
        onOpenChange={setIsAssistantsDialogOpen}
        setActiveView={setActiveView}
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
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="sm:max-w-4xl flex flex-col overflow-hidden justify-start h-auto">
          <div className="flex-1 overflow-y-auto">
            <ProfileSettingsView />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPublicationsDialogOpen} onOpenChange={setIsPublicationsDialogOpen}>
        <DialogContent className="sm:max-w-6xl h-[80vh] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <PublicationsView />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNotificationsDialogOpen} onOpenChange={setIsNotificationsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <div className="py-4">
            <p className="text-gray-500 dark:text-gray-400">Chức năng thông báo đang được phát triển.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <SystemSettingsView />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <HelpGuideView />
          </div>
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  )
}
