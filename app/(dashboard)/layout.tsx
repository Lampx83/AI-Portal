"use client"

import type React from "react"

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
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Hồ sơ</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/publications")}>
                    <BookCopy className="mr-2 h-4 w-4" />
                    <span>Công bố của tôi</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/notifications")}>
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Thông báo</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Cài đặt</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/help")}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    <span>Trợ giúp</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => console.log("Đăng xuất")}>
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
