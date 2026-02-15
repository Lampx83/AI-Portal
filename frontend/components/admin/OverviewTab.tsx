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
  FileText,
  FolderKanban,
  LogIn,
  Search,
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
  type UserRow,
  type AgentRow,
} from "@/lib/api/admin"

type DbStatsRow = { table_name: string; row_count: string }

export function OverviewTab() {
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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getDbStats(),
      getStorageStats().catch(() => null),
      getUsers(),
      getAgents(),
      getStorageConnectionInfo().catch(() => null),
      getDbConnectionInfo().catch(() => null),
      getMessagesPerDay(30).catch(() => ({ data: [] as { day: string; count: number }[] })),
      getMessagesBySource().catch(() => ({ data: [] as { source: string; count: number }[] })),
      getMessagesByAgent().catch(() => ({ data: [] as { assistant_alias: string; count: number }[] })),
      getOnlineUsers().catch(() => ({ count: 0, user_ids: [] })),
      getLoginsPerDay(30),
      getAdminProjects().catch(() => ({ projects: [] })),
      getQdrantHealth().catch(() => ({ ok: false })),
      getQdrantCollections().catch(() => ({ collections: [] })),
    ])
      .then(([db, storage, usersRes, agentsRes, storageConnRes, dbConnRes, messagesRes, bySourceRes, byAgentRes, onlineRes, loginsRes, projectsRes, qdrantHealthRes, qdrantCollRes]) => {
        if (cancelled) return
        setDbStats(db)
        setStorageStats(storage ?? null)
        setUsers((usersRes as { users: UserRow[] }).users ?? [])
        setAgents((agentsRes as { agents: AgentRow[] }).agents ?? [])
        setStorageConn(storageConnRes)
        setDbConn(dbConnRes)
        setMessagesPerDay((messagesRes as { data: { day: string; count: number }[] }).data ?? [])
        setMessagesBySource((bySourceRes as { data: { source: string; count: number }[] }).data ?? [])
        setMessagesByAgent((byAgentRes as { data: { assistant_alias: string; count: number }[] }).data ?? [])
        setOnlineUsers((onlineRes as { count: number; user_ids: string[] }) ?? { count: 0, user_ids: [] })
        setLoginsPerDay((loginsRes as { data: { day: string; count: number }[] })?.data ?? [])
        setProjects((projectsRes as { projects: Array<{ user_email: string; created_at: string }> })?.projects ?? [])
        setQdrantHealth((qdrantHealthRes as { ok: boolean; url?: string }) ?? null)
        setQdrantCollections((qdrantCollRes as { collections: string[] })?.collections ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Lỗi tải thống kê")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Đang tải tổng quan hệ thống...</p>
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
  const tableStats = dbStats?.stats ?? []
  const projectsCount = Number(tableStats.find((r) => r.table_name === "projects")?.row_count ?? 0)
  const articlesCount = Number(tableStats.find((r) => r.table_name === "write_articles")?.row_count ?? 0)

  const summaryCards = [
    {
      title: "Bảng (DB)",
      value: dbStats?.tables ?? 0,
      desc: "Số bảng trong cơ sở dữ liệu",
      icon: Database,
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Tổng dòng (DB)",
      value: dbStats?.totalRows?.toLocaleString("vi-VN") ?? "0",
      desc: "Tổng số bản ghi toàn hệ thống",
      icon: Table2,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Người dùng",
      value: users.length,
      desc: `${onlineUsers.count} đang trực tuyến · ${adminCount} quản trị viên`,
      icon: Users,
      iconBg: "bg-sky-100 dark:bg-sky-900/40",
      iconColor: "text-sky-600 dark:text-sky-400",
    },
    {
      title: "Trợ lý AI (Agents)",
      value: agents.length,
      desc: `${activeAgents} đang bật`,
      icon: Bot,
      iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
      iconColor: "text-indigo-600 dark:text-indigo-400",
    },
    {
      title: "Project",
      value: projectsCount.toLocaleString("vi-VN"),
      desc: "Dự án của tôi",
      icon: FolderKanban,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Bài viết",
      value: articlesCount.toLocaleString("vi-VN"),
      desc: "Trợ lý viết",
      icon: FileText,
      iconBg: "bg-teal-100 dark:bg-teal-900/40",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      title: "Object (Storage)",
      value: storageStats?.totalObjects?.toLocaleString("vi-VN") ?? "—",
      desc: storageStats != null ? "Số object trong MinIO" : "Bucket chưa tồn tại hoặc chưa cấu hình",
      icon: Package,
      iconBg: "bg-violet-100 dark:bg-violet-900/40",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Dung lượng (Storage)",
      value: storageStats?.totalSizeFormatted ?? "—",
      desc: storageStats != null ? "Tổng dung lượng bucket" : "Bucket chưa tồn tại hoặc chưa cấu hình",
      icon: HardDrive,
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Qdrant",
      value: qdrantHealth?.ok ? qdrantCollections.length : "—",
      desc: qdrantHealth?.ok ? `${qdrantCollections.length} collection · Vector DB` : "Mất kết nối",
      icon: Search,
      iconBg: qdrantHealth?.ok ? "bg-cyan-100 dark:bg-cyan-900/40" : "bg-muted",
      iconColor: qdrantHealth?.ok ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground",
    },
  ]

  // Điền đủ 30 ngày (ngày không có tin nhắn = 0) để line chart liền mạch
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
    count: { label: "Tin nhắn", color: "hsl(var(--chart-1))" },
  }

  // Điền đủ 30 ngày cho biểu đồ đăng nhập
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
    count: { label: "Đăng nhập", color: "hsl(var(--chart-2))" },
  }

  // Số dự án theo người dùng (top 12)
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
  const projectsBarConfig = { count: { label: "Số dự án", color: "hsl(var(--chart-2))" } }

  const webCount = messagesBySource.find((s) => s.source === "web")?.count ?? 0
  const embedCount = messagesBySource.find((s) => s.source === "embed")?.count ?? 0
  const sourcePieDataWithZero = [
    { name: "Web", value: webCount },
    { name: "Mã nhúng", value: embedCount },
  ]
  const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))"]

  const agentBarData = messagesByAgent.map((a) => ({ name: a.assistant_alias, count: a.count }))
  const agentBarConfig = { count: { label: "Tin nhắn", color: "hsl(var(--chart-3))" } }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Tổng quan hệ thống</h2>
        <p className="text-sm text-muted-foreground">
          Thống kê tổng hợp cơ sở dữ liệu, người dùng, trợ lý AI và kho lưu trữ.
        </p>
      </div>

      {/* Thống kê nhanh – tối đa 3 cột để card rộng, nhiều dòng */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Thống kê nhanh
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

      {/* Biểu đồ tin nhắn và đăng nhập theo ngày */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Tin nhắn mỗi ngày
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Số lượng tin nhắn hệ thống nhận trong 30 ngày gần nhất (tất cả phiên).
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
                Đăng nhập theo ngày
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Số lần đăng nhập hệ thống trong 30 ngày gần nhất (credentials + SSO).
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

      {/* Biểu đồ thống kê */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Biểu đồ thống kê
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar: Số dự án theo người dùng */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Số dự án theo người dùng
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Top 12 người dùng có nhiều dự án nhất.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                {projectsByUser.length === 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center justify-center h-full">Chưa có dự án nào</p>
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

          {/* Pie: Tin nhắn theo nguồn */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Tin nhắn theo nguồn
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Phân bố tin nhắn từ Web và từ mã nhúng (embed).
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                {webCount === 0 && embedCount === 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center justify-center h-full">Chưa có tin nhắn</p>
                ) : (
                  <ChartContainer config={{ web: { label: "Web", color: PIE_COLORS[0] }, embed: { label: "Mã nhúng", color: PIE_COLORS[1] } }} className="w-full h-full">
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
                        label={({ name, value, percent }) => (value > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : "")}
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

          {/* Bar: Tin nhắn theo Agent */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Tin nhắn theo Agent
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Số tin nhắn theo từng trợ lý (assistant_alias).
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                {agentBarData.length === 0 ? (
                  <p className="text-sm text-muted-foreground flex items-center justify-center h-full">Chưa có tin nhắn</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chi tiết bảng DB + Kết nối Database */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Cơ sở dữ liệu – Chi tiết bảng
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Số dòng theo từng bảng trong schema <code className="text-xs bg-muted px-1 rounded">ai_portal</code> và chuỗi kết nối PostgreSQL.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Kết nối Database */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                Kết nối Database
              </h4>
              {dbConn?.connectionString ? (
                <p className="text-xs font-mono bg-muted/50 rounded p-3 break-all">
                  {dbConn.connectionString}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Không lấy được thông tin kết nối.</p>
              )}
            </div>
            {/* Bảng và số dòng */}
            <div>
              <h4 className="text-sm font-medium mb-2">Chi tiết bảng</h4>
              {tableStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Bảng</TableHead>
                        <TableHead className="text-right">Số dòng</TableHead>
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

        {/* Trợ lý AI (Agents) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Trợ lý AI (Agents)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Danh sách agents đã cấu hình và trạng thái hoạt động.
            </p>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có agent nào.</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alias</TableHead>
                      <TableHead className="hidden sm:table-cell">Base URL</TableHead>
                      <TableHead className="w-24">Trạng thái</TableHead>
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
                              Bật
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
                              <XCircle className="h-3 w-3" />
                              Tắt
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

      {/* Người dùng & Phân quyền – chi tiết */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Người dùng & Phân quyền
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tổng quan tài khoản, phân quyền và phương thức đăng nhập. Chi tiết đầy đủ tại tab Người dùng.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Thống kê nhanh */}
          <div>
            <h4 className="text-sm font-medium mb-3">Thống kê</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Tổng tài khoản</p>
              </div>
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 p-3">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onlineUsers.count}</p>
                <p className="text-xs text-muted-foreground">Đang trực tuyến</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-bold">{adminCount}</p>
                <p className="text-xs text-muted-foreground">Quản trị / Phát triển</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-bold">{users.filter((u) => u.sso_provider).length}</p>
                <p className="text-xs text-muted-foreground">Đăng nhập SSO</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-bold">{users.filter((u) => !u.sso_provider).length}</p>
                <p className="text-xs text-muted-foreground">Đăng nhập mật khẩu</p>
              </div>
            </div>
          </div>
          {/* Bảng danh sách người dùng (tối đa 15) */}
          <div>
            <h4 className="text-sm font-medium mb-2">Danh sách người dùng</h4>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có người dùng nào.</p>
            ) : (
              <div className="border rounded-md overflow-auto max-h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email / Tên</TableHead>
                      <TableHead className="w-32">Quyền</TableHead>
                      <TableHead className="w-28">Đăng nhập</TableHead>
                      <TableHead className="hidden sm:table-cell text-muted-foreground text-xs">Tạo lúc</TableHead>
                      <TableHead className="hidden md:table-cell text-muted-foreground text-xs">Đăng nhập gần nhất</TableHead>
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
                              <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500" title="Đang trực tuyến" aria-label="Đang trực tuyến" />
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
                            if (role === "admin") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" title="Người quản trị" aria-label="Người quản trị" />
                            if (role === "developer") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" title="Người phát triển" aria-label="Người phát triển" />
                            return <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" title="Người dùng" aria-label="Người dùng" />
                          })()}
                        </TableCell>
                        <TableCell>
                          {u.sso_provider ? (
                            <span className="text-xs text-violet-600 dark:text-violet-400">{u.sso_provider}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Mật khẩu</span>
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
                Hiển thị 15/{users.length} — xem đầy đủ tại tab Người dùng & Phân quyền.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hạ tầng: Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Storage (MinIO)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tổng dung lượng, số lượng file và thông tin kết nối bucket.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Thống kê: tổng dung lượng, số lượng file */}
          <div>
            <h4 className="text-sm font-medium mb-3">Thống kê</h4>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{storageStats?.totalSizeFormatted ?? "—"}</span>
                <span className="text-sm text-muted-foreground">tổng dung lượng</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{(storageStats?.totalObjects ?? 0).toLocaleString("vi-VN")}</span>
                <span className="text-sm text-muted-foreground">file / object</span>
              </div>
            </div>
          </div>
          {/* Thông tin kết nối */}
          <div>
            <h4 className="text-sm font-medium mb-2">Kết nối</h4>
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
            <p className="text-sm text-muted-foreground">Không lấy được thông tin kết nối.</p>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
