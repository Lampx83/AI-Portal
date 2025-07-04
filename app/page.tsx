"use client"

import { useState } from "react"
import Image from "next/image"
import { User, BarChart3, BookCopy, Bell, Settings, HelpCircle, Info, LogOut } from "lucide-react"
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
import { ChatInterface } from "@/components/chat-interface"
import { NeuDataView } from "@/components/neu-data-view"
import { ExpertView } from "@/components/expert-view"
import { ConferenceView } from "@/components/conference-view"
import { PlaceholderView } from "@/components/placeholder-view"
import { ResearchContextBanner } from "@/components/research-context-banner"
import { AddResearchDialog } from "@/components/add-research-dialog"
import { ResearchAssistantsDialog } from "@/components/research-assistants-dialog"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { ProfileView } from "@/components/profile-view"
import { EditorView } from "@/components/editor-view"

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
  | "profile"
  | "dashboard"
  | "publications"
  | "notifications"
  | "settings"
  | "help"
  | "about"

export default function NeuResearchPage() {
  const [activeView, setActiveView] = useState<ViewType>("chat")
  const [activeResearch, setActiveResearch] = useState<Research | null>(null)
  const [isAddResearchOpen, setIsAddResearchOpen] = useState(false)
  const [isAssistantsDialogOpen, setIsAssistantsDialogOpen] = useState(false)

  const renderActiveView = () => {
    switch (activeView) {
      case "experts":
        return <ExpertView researchContext={activeResearch} />
      case "conferences":
        return <ConferenceView researchContext={activeResearch} />
      case "neu-data":
        return <NeuDataView researchContext={activeResearch} />
      case "citation":
        return <EditorView researchContext={activeResearch} />
      case "statistics":
        return <PlaceholderView title="Thống kê & Phân tích" researchContext={activeResearch} />
      case "plagiarism":
        return <PlaceholderView title="Kiểm tra Đạo văn" researchContext={activeResearch} />
      case "grants":
        return <PlaceholderView title="Xin tài trợ & Quỹ" researchContext={activeResearch} />
      case "translation":
        return <PlaceholderView title="Dịch thuật Học thuật" researchContext={activeResearch} />
      case "profile":
        return <ProfileView />
      case "dashboard":
        return (
          <PlaceholderView
            title="Tổng quan"
            description="Xem tổng quan về hoạt động nghiên cứu và thống kê cá nhân."
            researchContext={activeResearch}
          />
        )
      case "publications":
        return (
          <PlaceholderView
            title="Công bố của tôi"
            description="Quản lý danh sách các bài báo, nghiên cứu đã công bố."
            researchContext={activeResearch}
          />
        )
      case "notifications":
        return (
          <PlaceholderView
            title="Thông báo"
            description="Xem các thông báo về hội thảo, tạp chí và cập nhật hệ thống."
            researchContext={activeResearch}
          />
        )
      case "settings":
        return (
          <PlaceholderView
            title="Cài đặt"
            description="Tùy chỉnh giao diện, ngôn ngữ và các thiết lập hệ thống."
            researchContext={activeResearch}
          />
        )
      case "help":
        return (
          <PlaceholderView
            title="Trợ giúp"
            description="Hướng dẫn sử dụng và câu hỏi thường gặp về NEU Research."
            researchContext={activeResearch}
          />
        )
      case "about":
        return (
          <PlaceholderView
            title="Về NEU Research"
            description="Thông tin về hệ thống và đội ngũ phát triển."
            researchContext={activeResearch}
          />
        )
      case "chat":
      default:
        return <ChatInterface researchContext={activeResearch} isMainChat={true} />
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
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <User className="h-7 w-7" />
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
                    <DropdownMenuItem onClick={() => setActiveView("profile")}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Hồ sơ</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveView("dashboard")}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      <span>Tổng quan</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveView("publications")}>
                      <BookCopy className="mr-2 h-4 w-4" />
                      <span>Công bố của tôi</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveView("notifications")}>
                      <Bell className="mr-2 h-4 w-4" />
                      <span>Thông báo</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveView("settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Cài đặt</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setActiveView("help")}>
                      <HelpCircle className="mr-2 h-4 w-4" />
                      <span>Trợ giúp</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveView("about")}>
                      <Info className="mr-2 h-4 w-4" />
                      <span>Về NEU Research</span>
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
    </ThemeProvider>
  )
}
