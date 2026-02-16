"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, User } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession } from "next-auth/react"
import { useLanguage } from "@/contexts/language-context"
import { getAppSettings } from "@/lib/api/admin"
import { OverviewTab } from "@/components/admin/OverviewTab"
import { UsersTab } from "@/components/admin/UsersTab"
import { ProjectsTab } from "@/components/admin/ProjectsTab"
import { AgentsTab } from "@/components/admin/AgentsTab"
import { LimitsTab } from "@/components/admin/LimitsTab"
import { DatabaseTab } from "@/components/admin/DatabaseTab"
import { StorageTab } from "@/components/admin/StorageTab"
import { FeedbackTab } from "@/components/admin/FeedbackTab"
import { SettingsTab } from "@/components/admin/SettingsTab"
import { ApplicationsTab } from "@/components/admin/ApplicationsTab"
import { CentralAgentTab } from "@/components/admin/CentralAgentTab"
import { QdrantTab } from "@/components/admin/QdrantTab"
import { PluginsTab } from "@/components/admin/PluginsTab"

const baseTabs = [
  { value: "overview", label: "Overview", icon: "📊" },
  { value: "users", label: "Users", icon: "👥" },
  { value: "projects", label: "Projects", icon: "📁" },
  { value: "agents", label: "Agents", icon: "🤖" },
  { value: "central", label: "Central", icon: "🎯" },
  { value: "applications", label: "Apps", icon: "📱" },
  { value: "limits", label: "Message Limits", icon: "📬" },
  { value: "feedback", label: "Feedback", icon: "💬" },
  { value: "database", label: "Database", icon: "🗄️" },
  { value: "storage", label: "Storage", icon: "💾" },
  { value: "plugins", label: "Plugins", icon: "🧩" },
  { value: "qdrant", label: "Qdrant", icon: "🔮" },
  { value: "settings", label: "Settings", icon: "⚙️" },
] as const

export default function AdminPage() {
  const { data: session } = useSession()
  const { t } = useLanguage()
  const [pluginQdrantEnabled, setPluginQdrantEnabled] = useState(false)

  useEffect(() => {
    getAppSettings().then((s) => setPluginQdrantEnabled(!!s?.plugin_qdrant_enabled)).catch(() => {})
    const onUpdate = () => {
      getAppSettings().then((s) => setPluginQdrantEnabled(!!s?.plugin_qdrant_enabled)).catch(() => {})
    }
    window.addEventListener("plugin-qdrant-updated", onUpdate)
    return () => window.removeEventListener("plugin-qdrant-updated", onUpdate)
  }, [])

  const tabs = pluginQdrantEnabled
    ? baseTabs
    : baseTabs.filter((t) => t.value !== "qdrant")

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 bg-slate-900 text-white px-4 sm:px-6 py-4 sm:py-6">
        <div>
          <Button variant="ghost" size="sm" className="text-white border border-white/30 bg-white/5 hover:bg-white/15 hover:border-white/50 hover:text-white gap-1.5" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.home")}</span>
            </Link>
          </Button>
        </div>
        <div className="text-center min-w-0">
          <h1 className="text-base sm:text-xl font-semibold tracking-tight truncate">
            <span className="sm:hidden">{t("nav.adminShort")}</span>
            <span className="hidden sm:inline">{t("nav.adminTitle")}</span>
          </h1>
        </div>
        <div className="flex justify-end items-center gap-2">
          <ThemeToggle />
          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white/10 text-white border-0">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt="Avatar"
                      width={36}
                      height={36}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{session.user.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{session.user.email || "—"}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start gap-0 rounded-none border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-2 sm:px-4 pt-2 pb-0 min-h-[48px] overflow-x-auto flex-nowrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="rounded-t-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-[0_-1px_0_0_hsl(var(--border))] -mb-px">
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="p-6 mt-0">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="users" className="p-6 mt-0">
          <UsersTab />
        </TabsContent>
        <TabsContent value="projects" className="p-6 mt-0">
          <ProjectsTab />
        </TabsContent>
        <TabsContent value="agents" className="p-6 mt-0">
          <AgentsTab />
        </TabsContent>
        <TabsContent value="central" className="p-6 mt-0">
          <CentralAgentTab />
        </TabsContent>
        <TabsContent value="applications" className="p-6 mt-0">
          <ApplicationsTab />
        </TabsContent>
        <TabsContent value="limits" className="p-6 mt-0">
          <LimitsTab />
        </TabsContent>
        <TabsContent value="feedback" className="p-6 mt-0">
          <FeedbackTab />
        </TabsContent>
        <TabsContent value="database" className="p-6 mt-0">
          <DatabaseTab />
        </TabsContent>
        <TabsContent value="storage" className="p-6 mt-0">
          <StorageTab />
        </TabsContent>
        <TabsContent value="plugins" className="p-6 mt-0">
          <PluginsTab />
        </TabsContent>
        {pluginQdrantEnabled && (
          <TabsContent value="qdrant" className="p-6 mt-0">
            <QdrantTab />
          </TabsContent>
        )}
        <TabsContent value="settings" className="p-6 mt-0">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
