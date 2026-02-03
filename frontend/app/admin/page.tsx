"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OverviewTab } from "@/components/admin/OverviewTab"
import { UsersTab } from "@/components/admin/UsersTab"
import { AgentsTab } from "@/components/admin/AgentsTab"
import { LimitsTab } from "@/components/admin/LimitsTab"
import { DatabaseTab } from "@/components/admin/DatabaseTab"
import { StorageTab } from "@/components/admin/StorageTab"

const tabs = [
  { value: "overview", label: "Tổng quan", icon: "📊" },
  { value: "users", label: "Users", icon: "👥" },
  { value: "agents", label: "Quản lý Agents", icon: "🤖" },
  { value: "limits", label: "Giới hạn tin nhắn", icon: "📬" },
  { value: "database", label: "Database", icon: "🗄️" },
  { value: "storage", label: "Storage", icon: "💾" },
] as const

export default function AdminPage() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight">Research Backend – Admin Dashboard</h1>
        <p className="text-slate-300 text-sm mt-1">Quản trị hệ thống</p>
      </div>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start gap-0 rounded-none border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 pt-2 pb-0 min-h-[48px]">
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
        <TabsContent value="agents" className="p-6 mt-0">
          <AgentsTab />
        </TabsContent>
        <TabsContent value="limits" className="p-6 mt-0">
          <LimitsTab />
        </TabsContent>
        <TabsContent value="database" className="p-6 mt-0">
          <DatabaseTab />
        </TabsContent>
        <TabsContent value="storage" className="p-6 mt-0">
          <StorageTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
