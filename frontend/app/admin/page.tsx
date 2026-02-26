"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
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
import { AgentsTab } from "@/components/admin/AgentsTab"
import { LimitsTab } from "@/components/admin/LimitsTab"
import { DatabaseTab } from "@/components/admin/DatabaseTab"
import { StorageTab } from "@/components/admin/StorageTab"
import { FeedbackTab } from "@/components/admin/FeedbackTab"
import { SettingsTab } from "@/components/admin/SettingsTab"
import { ApplicationsTab } from "@/components/admin/ApplicationsTab"
import { QdrantTab } from "@/components/admin/QdrantTab"
import { PluginsTab } from "@/components/admin/PluginsTab"
import { PagesTab } from "@/components/admin/PagesTab"

const baseTabs = [
  { value: "overview", labelKey: "admin.tabs.overview", icon: "📊" },
  { value: "agents", labelKey: "admin.tabs.agents", icon: "🤖" },
  { value: "applications", labelKey: "admin.tabs.applications", icon: "📱" },
  { value: "limits", labelKey: "admin.tabs.limits", icon: "📬" },
  { value: "users", labelKey: "admin.tabs.users", icon: "👥" },
  { value: "feedback", labelKey: "admin.tabs.feedback", icon: "💬" },
  { value: "database", labelKey: "admin.tabs.database", icon: "🗄️" },
  { value: "storage", labelKey: "admin.tabs.storage", icon: "💾" },
  { value: "plugins", labelKey: "admin.tabs.plugins", icon: "🧩" },
  { value: "qdrant", labelKey: "admin.tabs.qdrant", icon: "🔮" },
  { value: "pages", labelKey: "admin.tabs.pages", icon: "📄" },
  { value: "settings", labelKey: "admin.tabs.settings", icon: "⚙️" },
] as const

export default function AdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
    : baseTabs.filter((tab) => tab.value !== "qdrant")

  const validTabValues = tabs.map((tab) => tab.value)
  const tabFromUrl = searchParams.get("tab")
  const activeTab = tabFromUrl && validTabValues.includes(tabFromUrl) ? tabFromUrl : "overview"

  const setActiveTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/admin?${params.toString()}`, { scroll: false })
  }

  // Đồng bộ URL khi đang ở overview nhưng chưa có ?tab (để F5 luôn giữ tab)
  useEffect(() => {
    if (activeTab === "overview" && !searchParams.get("tab")) {
      router.replace("/admin?tab=overview", { scroll: false })
    }
  }, [activeTab, searchParams, router])

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start gap-0 rounded-none border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-2 sm:px-4 pt-2 pb-0 min-h-[48px] overflow-x-auto overflow-y-hidden flex flex-nowrap">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              id={tab.value === "database" ? "admin-tab-database" : undefined}
              value={tab.value}
              className="flex-shrink-0 whitespace-nowrap rounded-t-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-[0_-1px_0_0_hsl(var(--border))] -mb-px"
            >
              <span className="mr-1.5">{tab.icon}</span>
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="p-6 mt-0">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="users" className="p-6 mt-0">
          <UsersTab />
        </TabsContent>
        <TabsContent value="agents" className="p-6 mt-0">
          <AgentsTab />
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
        <TabsContent value="pages" className="p-6 mt-0">
          <PagesTab />
        </TabsContent>
        <TabsContent value="settings" className="p-6 mt-0">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
