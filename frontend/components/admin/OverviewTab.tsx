"use client"

import { useEffect, useState } from "react"
import {
  Database,
  Table2,
  Package,
  HardDrive,
  Users,
  Bot,
  Server,
  CheckCircle2,
  XCircle,
  FolderOpen,
  MessageSquare,
  FolderKanban,
  LogIn,
  Search,
  Wrench,
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  getDbStats,
  getStorageStats,
  getUsers,
  getAgents,
  getTools,
  getAdminProjects,
  getStorageConnectionInfo,
  getDbConnectionInfo,
  getMessagesPerDay,
  getMessagesBySource,
  getMessagesByAgent,
  getOnlineUsers,
  getLoginsPerDay,
  getQdrantHealth,
  getQdrantCollections,
  getAppSettings,
  type UserRow,
  type AgentRow,
  type ToolRow,
} from "@/lib/api/admin"
import { useLanguage } from "@/contexts/language-context"

type DbStatsRow = { table_name: string; row_count: string }

export function OverviewTab() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbStats, setDbStats] = useState<{
    tables: number
    totalRows: number
    stats: DbStatsRow[]
  } | null>(null)
  const [storageStats, setStorageStats] = useState<{
    totalObjects: number
    totalSizeFormatted?: string
    totalSize?: number
  } | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [tools, setTools] = useState<ToolRow[]>([])
  const [storageConn, setStorageConn] = useState<Record<string, unknown> | null>(null)
  const [dbConn, setDbConn] = useState<{ connectionString?: string } | null>(null)
  const [messagesPerDay, setMessagesPerDay] = useState<{ day: string; count: number }[]>([])
  const [messagesBySource, setMessagesBySource] = useState<{ source: string; count: number }[]>([])
  const [messagesByAgent, setMessagesByAgent] = useState<{ assistant_alias: string; count: number }[]>([])
  const [onlineUsers, setOnlineUsers] = useState<{ count: number; user_ids: string[] }>({ count: 0, user_ids: [] })
  const [loginsPerDay, setLoginsPerDay] = useState<{ day: string; count: number }[]>([])
  const [projects, setProjects] = useState<Array<{ user_email: string; created_at: string }>>([])
  const [qdrantHealth, setQdrantHealth] = useState<{ ok: boolean; url?: string } | null>(null)
  const [qdrantCollections, setQdrantCollections] = useState<string[]>([])
  const [pluginQdrantEnabled, setPluginQdrantEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const basePromises: Promise<unknown>[] = [
      getDbStats(),
      getStorageStats().catch(() => null),
      getUsers(),
      getAgents(),
      getTools().catch(() => ({ tools: [] as ToolRow[] })),
      getStorageConnectionInfo().catch(() => null),
      getDbConnectionInfo().catch(() => null),
      getMessagesPerDay(30).catch(() => ({ data: [] as { day: string; count: number }[] })),
      getMessagesBySource().catch(() => ({ data: [] as { source: string; count: number }[] })),
      getMessagesByAgent().catch(() => ({ data: [] as { assistant_alias: string; count: number }[] })),
      getOnlineUsers().catch(() => ({ count: 0, user_ids: [] })),
      getLoginsPerDay(30),
      getAdminProjects().catch(() => ({ projects: [] })),
    ]
    getAppSettings()
      .then((appSettings) => {
        const qdrantEnabled = !!appSettings?.plugin_qdrant_enabled
        if (!cancelled) setPluginQdrantEnabled(qdrantEnabled)
        const promises = [...basePromises]
        if (qdrantEnabled) {
          promises.push(
            getQdrantHealth().catch(() => ({ ok: false })),
            getQdrantCollections().catch(() => ({ collections: [] }))
          )
        }
        return Promise.all(promises)
      })
      .then((results) => {
        if (cancelled) return
        const n = basePromises.length
        setDbStats(results[0] as { tables: number; totalRows: number; stats: DbStatsRow[] } | null)
        setStorageStats(results[1] as typeof storageStats)
        setUsers((results[2] as { users: UserRow[] }).users ?? [])
        setAgents((results[3] as { agents: AgentRow[] }).agents ?? [])
        setTools((results[4] as { tools: ToolRow[] })?.tools ?? [])
        setStorageConn(results[5] as Record<string, unknown> | null)
        setDbConn(results[6] as { connectionString?: string } | null)
        setMessagesPerDay((results[7] as { data: { day: string; count: number }[] }).data ?? [])
        setMessagesBySource((results[8] as { data: { source: string; count: number }[] }).data ?? [])
        setMessagesByAgent((results[9] as { data: { assistant_alias: string; count: number }[] }).data ?? [])
        setOnlineUsers((results[10] as { count: number; user_ids: string[] }) ?? { count: 0, user_ids: [] })
        setLoginsPerDay((results[11] as { data: { day: string; count: number }[] })?.data ?? [])
        setProjects((results[12] as { projects: Array<{ user_email: string; created_at: string }> })?.projects ?? [])
        if (results.length > n) {
          setQdrantHealth((results[n] as { ok: boolean; url?: string }) ?? null)
          setQdrantCollections((results[n + 1] as { collections: string[] })?.collections ?? [])
        } else {
          setQdrantHealth(null)
          setQdrantCollections([])
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || t("admin.overview.errorLoad"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("admin.overview.loading")}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  const adminCount = users.filter((u) => u.role === "admin" || u.role === "developer" || u.is_admin).length
  const activeAgents = agents.filter((a) => a.is_active).length
  const activeTools = tools.filter((t) => t.is_active).length
  const tableStats = dbStats?.stats ?? []
  const projectsCount = Number(tableStats.find((r) => r.table_name === "projects")?.row_count ?? 0)
  const summaryCards = [
    {
      title: t("admin.overview.cardTables"),
      value: dbStats?.tables ?? 0,
      desc: t("admin.overview.cardTablesDesc"),
      icon: Database,
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: t("admin.overview.cardRows"),
      value: dbStats?.totalRows?.toLocaleString("vi-VN") ?? "0",
      desc: t("admin.overview.cardRowsDesc"),
      icon: Table2,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: t("admin.overview.cardUsers"),
      value: users.length,
      desc: t("admin.overview.cardUsersDesc").replace("{online}", String(onlineUsers.count)).replace("{admins}", String(adminCount)),
      icon: Users,
      iconBg: "bg-sky-100 dark:bg-sky-900/40",
      iconColor: "text-sky-600 dark:text-sky-400",
    },
    {
      title: t("admin.overview.cardAgents"),
      value: agents.length,
      desc: t("admin.overview.cardAgentsDesc").replace("{count}", String(activeAgents)),
      icon: Bot,
      iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
      iconColor: "text-indigo-600 dark:text-indigo-400",
    },
    {
      title: t("admin.overview.cardTools"),
      value: tools.length,
      desc: t("admin.overview.cardToolsDesc").replace("{count}", String(activeTools)),
      icon: Wrench,
      iconBg: "bg-teal-100 dark:bg-teal-900/40",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      title: t("admin.overview.cardProjects"),
      value: projectsCount.toLocaleString("vi-VN"),
      desc: t("admin.overview.cardProjectsDesc"),
      icon: FolderKanban,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: t("admin.overview.cardStorageObjects"),
      value: storageStats?.totalObjects?.toLocaleString("vi-VN") ?? "—",
      desc: storageStats != null ? t("admin.overview.cardStorageObjectsDescOk") : t("admin.overview.cardStorageObjectsDescNo"),
      icon: Package,
      iconBg: "bg-violet-100 dark:bg-violet-900/40",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: t("admin.overview.cardStorageSize"),
      value: storageStats?.totalSizeFormatted ?? "—",
      desc: storageStats != null ? t("admin.overview.cardStorageSizeDescOk") : t("admin.overview.cardStorageSizeDescNo"),
      icon: HardDrive,
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    ...(pluginQdrantEnabled
      ? [
          {
            title: "Qdrant",
            value: qdrantHealth?.ok ? qdrantCollections.length : "—",
            desc: qdrantHealth?.ok ? t("admin.overview.cardQdrantDescOk").replace("{n}", String(qdrantCollections.length)) : t("admin.overview.cardQdrantDescNo"),
            icon: Search,
            iconBg: qdrantHealth?.ok ? "bg-cyan-100 dark:bg-cyan-900/40" : "bg-muted",
            iconColor: qdrantHealth?.ok ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground",
          },
        ]
      : []),
  ]

  const chartDays = 30
  const chartData = (() => {
    const map = new Map(messagesPerDay.map((d) => [d.day, d.count]))
    const out: { day: string; count: number; label: string }[] = []
    const now = new Date()
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const day = d.toISOString().slice(0, 10)
      const count = map.get(day) ?? 0
      out.push({
        day,
        count,
        label: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      })
    }
    return out
  })()

  const chartConfig = {
    count: { label: t("admin.overview.labelMessages"), color: "hsl(var(--chart-1))" },
  }

  const loginsChartData = (() => {
    const map = new Map(loginsPerDay.map((d) => [d.day, d.count]))
    const out: { day: string; count: number; label: string }[] = []
    const now = new Date()
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const day = d.toISOString().slice(0, 10)
      const count = map.get(day) ?? 0
      out.push({
        day,
        count,
        label: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      })
    }
    return out
  })()

  const loginsChartConfig = {
    count: { label: t("admin.overview.labelLogins"), color: "hsl(var(--chart-2))" },
  }

  const projectsByUser = (() => {
    const map = new Map<string, number>()
    for (const p of projects) {
      const email = p.user_email || "—"
      map.set(email, (map.get(email) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  })()
  const projectsBarConfig = { count: { label: t("admin.overview.labelProjectsCount"), color: "hsl(var(--chart-2))" } }

  const webCount = messagesBySource.find((s) => s.source === "web")?.count ?? 0
  const embedCount = messagesBySource.find((s) => s.source === "embed")?.count ?? 0
  const sourcePieDataWithZero = [
    { name: t("admin.overview.web"), value: webCount },
    { name: t("admin.overview.embedCode"), value: embedCount },
  ]
  const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))"]

  const agentBarData = messagesByAgent.map((a) => ({ name: a.assistant_alias, count: a.count }))
  const agentBarConfig = { count: { label: t("admin.overview.labelMessages"), color: "hsl(var(--chart-3))" } }

  return (
    <div className="space-y-8">
      {/* Quick stats */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {t("admin.overview.quickStats")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summaryCards.map(({ title, value, desc, icon: Icon, iconBg, iconColor }) => (
            <Card key={title} className="overflow-hidden">
              <CardHeader className="p-4 pb-3 flex flex-row items-start gap-3">
                <div className={`rounded-lg ${iconBg} p-2 shrink-0`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate" title={title}>
                    {title}
                  </p>
                  <p className="text-lg font-bold mt-0.5 truncate" title={String(value)}>{value}</p>
                  {desc && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{desc}</p>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Messages & logins by day */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("admin.overview.chartMessages")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("admin.overview.chartMessagesDesc")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(v) => {
                        const item = chartData.find((d) => d.day === v)
                        return item?.label ?? v.slice(5)
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-count)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                {t("admin.overview.chartLogins")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("admin.overview.chartLoginsDesc")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ChartContainer config={loginsChartConfig} className="w-full h-full">
                  <LineChart data={loginsChartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(v) => {
                        const item = loginsChartData.find((d) => d.day === v)
                        return item?.label ?? v.slice(5)
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-count)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Charts */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          {t("admin.overview.chartsTitle")}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects by user */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                {t("admin.overview.projectsByUser")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("admin.overview.projectsByUserDesc")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                {projectsByUser.length === 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center justify-center h-full">{t("admin.overview.noProjects")}</p>
                ) : (
                  <ChartContainer config={projectsBarConfig} className="w-full h-full">
                    <BarChart data={projectsByUser} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={88} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => (v.length > 18 ? v.slice(0, 16) + "…" : v)} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="var(--color-count)" />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Messages by source */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("admin.overview.messagesBySource")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("admin.overview.messagesBySourceDesc")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                {webCount === 0 && embedCount === 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center justify-center h-full">{t("admin.overview.noMessages")}</p>
                ) : (
                  <ChartContainer config={{ web: { label: t("admin.overview.web"), color: PIE_COLORS[0] }, embed: { label: t("admin.overview.embedCode"), color: PIE_COLORS[1] } }} className="w-full h-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={sourcePieDataWithZero}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        strokeWidth={1}
                        label={({ name, value, percent }: { name?: string; value?: number; percent?: number }) => ((value ?? 0) > 0 ? `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%` : "")}
                      >
                        {sourcePieDataWithZero.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Messages by agent */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                {t("admin.overview.messagesByAgent")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("admin.overview.messagesByAgentDesc")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                {agentBarData.length === 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center justify-center h-full">{t("admin.overview.noMessages")}</p>
                ) : (
                  <ChartContainer config={agentBarConfig} className="w-full h-full">
                    <BarChart data={agentBarData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-count)" />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* DB tables & connection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t("admin.overview.dbDetails")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("admin.overview.dbDetailsDesc")}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* DB connection */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                {t("admin.overview.dbConnection")}
              </h4>
              {dbConn?.connectionString ? (
                <p className="text-xs font-mono bg-muted/50 rounded p-3 break-all">
                  {dbConn.connectionString}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{t("admin.overview.dbConnectionError")}</p>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">{t("admin.overview.tableDetails")}</h4>
              {tableStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.overview.noData")}</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>{t("admin.overview.tableTable")}</TableHead>
                        <TableHead className="text-right">{t("admin.overview.tableRows")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableStats.map((row, idx) => (
                        <TableRow key={row.table_name}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{row.table_name}</TableCell>
                          <TableCell className="text-right">
                            {Number(row.row_count || 0).toLocaleString("vi-VN")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              {t("admin.overview.agentsTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("admin.overview.agentsDesc")}
            </p>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.overview.noAgents")}</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alias</TableHead>
                      <TableHead className="hidden sm:table-cell">Base URL</TableHead>
                      <TableHead className="w-24">{t("admin.overview.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.alias}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-xs truncate max-w-[200px]">
                          {a.base_url}
                        </TableCell>
                        <TableCell>
                          {a.is_active ? (
                            <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("admin.overview.on")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
                              <XCircle className="h-3 w-3" />
                              {t("admin.overview.off")}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              {t("admin.overview.toolsTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("admin.overview.toolsDesc")}
            </p>
          </CardHeader>
          <CardContent>
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.overview.noTools")}</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.overview.toolsNameAlias")}</TableHead>
                      <TableHead className="w-24">{t("admin.overview.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tools.map((tool) => (
                      <TableRow key={tool.id}>
                        <TableCell>
                          <span className="font-medium">{tool.name ?? tool.alias}</span>
                          {tool.name && tool.name !== tool.alias && (
                            <span className="text-xs text-muted-foreground ml-1">({tool.alias})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {tool.is_active ? (
                            <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("admin.overview.on")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
                              <XCircle className="h-3 w-3" />
                              {t("admin.overview.off")}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Users & roles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("admin.overview.usersAndRoles")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("admin.overview.usersAndRolesDesc")}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick stats */}
          <div>
            <h4 className="text-sm font-medium mb-3">{t("admin.overview.stats")}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">{t("admin.overview.totalAccounts")}</p>
              </div>
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 p-3">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onlineUsers.count}</p>
                <p className="text-xs text-muted-foreground">{t("admin.overview.online")}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-bold">{adminCount}</p>
                <p className="text-xs text-muted-foreground">{t("admin.overview.adminDev")}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-bold">{users.filter((u) => u.sso_provider).length}</p>
                <p className="text-xs text-muted-foreground">{t("admin.overview.loginSso")}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-bold">{users.filter((u) => !u.sso_provider).length}</p>
                <p className="text-xs text-muted-foreground">{t("admin.overview.loginPassword")}</p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">{t("admin.overview.userList")}</h4>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.overview.noUsers")}</p>
            ) : (
              <div className="border rounded-md overflow-auto max-h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.overview.emailName")}</TableHead>
                      <TableHead className="w-32">{t("admin.overview.role")}</TableHead>
                      <TableHead className="w-28">{t("admin.overview.login")}</TableHead>
                      <TableHead className="hidden sm:table-cell text-muted-foreground text-xs">{t("admin.overview.createdAt")}</TableHead>
                      <TableHead className="hidden md:table-cell text-muted-foreground text-xs">{t("admin.overview.lastLogin")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.slice(0, 15).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate max-w-[200px]" title={u.email}>
                              {u.email}
                            </div>
                            {onlineUsers.user_ids.includes(u.id) && (
                              <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500" title={t("admin.overview.onlineLabel")} aria-label={t("admin.overview.onlineLabel")} />
                            )}
                          </div>
                          {(u.display_name || u.full_name) && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {u.display_name || u.full_name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const role = u.role ?? (u.is_admin ? "admin" : "user")
                            if (role === "admin") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" title={t("admin.overview.roleAdmin")} aria-label={t("admin.overview.roleAdmin")} />
                            if (role === "developer") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" title={t("admin.overview.roleDeveloper")} aria-label={t("admin.overview.roleDeveloper")} />
                            return <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" title={t("admin.overview.roleUser")} aria-label={t("admin.overview.roleUser")} />
                          })()}
                        </TableCell>
                        <TableCell>
                          {u.sso_provider ? (
                            <span className="text-xs text-violet-600 dark:text-violet-400">{u.sso_provider}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("admin.overview.password")}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString("vi-VN") : "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString("vi-VN") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {users.length > 15 && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("admin.overview.showingUsers").replace("{n}", "15").replace("{total}", String(users.length))}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            {t("admin.overview.storageTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("admin.overview.storageDesc")}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div>
            <h4 className="text-sm font-medium mb-3">{t("admin.overview.stats")}</h4>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{storageStats?.totalSizeFormatted ?? "—"}</span>
                <span className="text-sm text-muted-foreground">{t("admin.overview.totalCapacity")}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{(storageStats?.totalObjects ?? 0).toLocaleString("vi-VN")}</span>
                <span className="text-sm text-muted-foreground">file / object</span>
              </div>
            </div>
          </div>
          {/* Connection info */}
          <div>
            <h4 className="text-sm font-medium mb-2">{t("admin.overview.connection")}</h4>
          {storageConn && Object.keys(storageConn).length > 0 ? (
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Endpoint</dt>
                <dd className="font-mono text-right">
                  {String(storageConn.endpoint ?? "—")}:{String(storageConn.port ?? "—")}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Bucket</dt>
                <dd className="font-mono">{String(storageConn.bucket ?? "—")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Access Key</dt>
                <dd>{String(storageConn.accessKey ?? "—")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">API URL</dt>
                <dd className="font-mono text-xs truncate max-w-[240px]" title={String(storageConn.apiUrl)}>
                  {String(storageConn.apiUrl ?? "—")}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t("admin.overview.connectionError")}</p>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
