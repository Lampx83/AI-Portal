"use client"

import { useEffect, useState, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Database,
  BarChart3,
  TrendingUp,
  Download,
  FileSpreadsheet,
  Table2,
  Eye,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from "lucide-react"
import { API_CONFIG } from "@/lib/config"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ComposedChart,
  Legend,
} from "recharts"
import type { ChartType, Dataset, DomainInfo, ProjectFileItem, RawDataRow } from "./types"
import { DEFAULT_CHART_TYPES, CHART_COLORS, DATA_PAGE_SIZE } from "./constants"
import { parseCSVToRows } from "./utils"
import { SheetDataTable } from "./SheetDataTable"
import { getDatasetChartData } from "./chart-data"
import { ChartCard } from "./ChartCard"

export function DataApplicationView({ projectFiles }: { projectFiles?: ProjectFileItem[] }) {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [domains, setDomains] = useState<DomainInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [projectFilePreview, setProjectFilePreview] = useState<{
    name: string
    data: RawDataRow[]
  } | null>(null)
  const [projectFileLoading, setProjectFileLoading] = useState(false)
  const [projectFileError, setProjectFileError] = useState<string | null>(null)
  const [projectFileDataPage, setProjectFileDataPage] = useState(1)

  const baseUrl = `${API_CONFIG.baseUrl}/api/data_agent/v1`

  const loadProjectFileAsData = useCallback(async (url: string, name: string) => {
    setProjectFileLoading(true)
    setProjectFileError(null)
    try {
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const data = parseCSVToRows(text)
      if (data.length === 0 && text.trim().length > 0) {
        setProjectFileError(
          "Không thể parse file dạng bảng. File có thể là Excel hoặc định dạng khác — bạn vẫn có thể dùng trong chat với trợ lý."
        )
        setProjectFilePreview(null)
      } else {
        setProjectFilePreview({ name, data })
        setProjectFileDataPage(1)
      }
    } catch (e) {
      setProjectFileError(e instanceof Error ? e.message : "Không tải được file")
      setProjectFilePreview(null)
    } finally {
      setProjectFileLoading(false)
    }
  }, [])

  const loadDatasets = useCallback(async () => {
    setLoading(true)
    try {
      const [dataRes, domainsRes] = await Promise.all([
        fetch(`${baseUrl}/data?type=datasets`),
        fetch(`${baseUrl}/domains`),
      ])
      const dataJson = dataRes.ok ? await dataRes.json() : {}
      const domainsJson = domainsRes.ok ? await domainsRes.json() : {}
      const items = (dataJson?.items ?? []).map((t: Record<string, unknown>) => ({
        id: String(t.id ?? t.title ?? ""),
        title: String(t.title ?? t.id ?? ""),
        description: t.description != null ? String(t.description) : undefined,
        type: t.type != null ? String(t.type) : undefined,
        domain: t.domain != null ? String(t.domain) : undefined,
        raw_data: Array.isArray(t.raw_data) ? (t.raw_data as RawDataRow[]) : undefined,
        sheets:
          t.sheets && typeof t.sheets === "object" && !Array.isArray(t.sheets)
            ? (t.sheets as Record<string, RawDataRow[]>)
            : undefined,
        chart_types: Array.isArray(t.chart_types) ? (t.chart_types as ChartType[]) : undefined,
      }))
      setDatasets(items)
      setDomains(domainsJson?.domains ?? [])
    } catch {
      setDatasets([])
      setDomains([])
    } finally {
      setLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    loadDatasets()
  }, [loadDatasets])

  const toggleDomain = (domainId: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(domainId)) next.delete(domainId)
      else next.add(domainId)
      return next
    })
  }

  const datasetsByDomain = domains
    .sort((a, b) => a.order - b.order)
    .map((dom) => ({
      ...dom,
      datasets: datasets.filter((d) => d.domain === dom.id),
    }))
    .filter((g) => g.datasets.length > 0)

  const chartData = selectedDataset ? getDatasetChartData(selectedDataset) : null
  const activeChartTypes = (selectedDataset?.chart_types?.length
    ? selectedDataset.chart_types
    : DEFAULT_CHART_TYPES) as ChartType[]

  const rawData =
    selectedDataset?.raw_data ?? (chartData ? (chartData.bar as RawDataRow[]) : [])

  const [dataViewOpen, setDataViewOpen] = useState(false)
  const [dataPage, setDataPage] = useState(1)
  const [dataViewSheet, setDataViewSheet] = useState<string>("")

  const isMultiSheet = !!(
    selectedDataset?.sheets && Object.keys(selectedDataset.sheets).length > 0
  )
  const sheetNames = selectedDataset?.sheets ? Object.keys(selectedDataset.sheets) : []
  const activeSheet = dataViewSheet || sheetNames[0] || ""
  const currentSheetData =
    isMultiSheet && activeSheet
      ? (selectedDataset!.sheets![activeSheet] ?? [])
      : rawData

  const handleDownload = (format: "csv" | "xlsx") => {
    if (!selectedDataset?.id) return
    const url = `${baseUrl}/export?dataset_id=${encodeURIComponent(selectedDataset.id)}&format=${format}`
    const a = document.createElement("a")
    a.href = url
    a.download = `${selectedDataset.title.replace(/[<>:"/\\|?*]/g, "_")}.${format === "xlsx" ? "xlsx" : "csv"}`
    a.target = "_blank"
    a.click()
  }

  return (
    <div className="flex h-full min-h-0 bg-[#f1f5f9] dark:bg-gray-950">
      <aside className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shadow-sm">
        {projectFiles && projectFiles.length > 0 && (
          <div className="p-4 border-b border-slate-200 dark:border-gray-800">
            <h2 className="text-base font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-amber-600" />
              File dự án
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
              Xem trước file đính kèm như bộ dữ liệu (CSV)
            </p>
            <div className="mt-2 space-y-1">
              {projectFiles.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => loadProjectFileAsData(f.url, f.name)}
                  disabled={projectFileLoading}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-800 text-left border border-transparent hover:border-slate-200 dark:hover:border-gray-700 transition-colors disabled:opacity-60"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-sm text-slate-800 dark:text-gray-200 truncate flex-1">
                    {f.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="p-4 border-b border-slate-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Bộ dữ liệu
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            Chọn bộ dữ liệu để xem trực quan hóa
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">Đang tải…</div>
            ) : datasets.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">Không có bộ dữ liệu</div>
            ) : datasetsByDomain.length > 0 ? (
              datasetsByDomain.map((group) => (
                <Collapsible
                  key={group.id}
                  open={expandedDomains.has(group.id)}
                  onOpenChange={() => toggleDomain(group.id)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-800 text-left"
                      type="button"
                    >
                      {expandedDomains.has(group.id) ? (
                        <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      )}
                      <FolderOpen className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate">
                        {group.name}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                        {group.dataset_count}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-6 pr-1 space-y-0.5 mb-2">
                      {group.datasets.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDataset(d)}
                          className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                            selectedDataset?.id === d.id
                              ? "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800"
                              : "hover:bg-slate-50 dark:hover:bg-gray-800 border border-transparent"
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-800 dark:text-gray-200 block truncate">
                            {d.title}
                          </span>
                          {d.description && (
                            <span className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 line-clamp-2 block">
                              {d.description}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))
            ) : (
              datasets.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDataset(d)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedDataset?.id === d.id
                      ? "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800"
                      : "hover:bg-slate-50 dark:hover:bg-gray-800 border border-transparent"
                  }`}
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-gray-200 block">
                    {d.title}
                  </span>
                  {d.description && (
                    <span className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 line-clamp-2 block">
                      {d.description}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        {selectedDataset && chartData ? (
          <div className="p-6 space-y-6">
            <header className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-gray-100">
                  {selectedDataset.title}
                </h1>
                {selectedDataset.description && (
                  <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                    {selectedDataset.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDataViewOpen(true)}
                  disabled={
                    rawData.length === 0 &&
                    !(
                      selectedDataset?.sheets &&
                      Object.values(selectedDataset.sheets).some((arr) => arr.length > 0)
                    )
                  }
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Xem dữ liệu
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        rawData.length === 0 &&
                        !(
                          selectedDataset?.sheets &&
                          Object.values(selectedDataset.sheets).some((arr) => arr.length > 0)
                        )
                      }
                      className="gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      Tải file
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownload("csv")}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Tải CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload("xlsx")}>
                      <Table2 className="h-4 w-4 mr-2" />
                      Tải Excel (.xlsx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                  <TrendingUp className="h-4 w-4" />
                  <span>Dashboard trực quan hóa</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeChartTypes.includes("bar") && (
                <ChartCard title="Phân bố theo danh mục" icon={<BarChart3 className="h-4 w-4" />}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.bar}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey={
                          chartData.bar[0]?.category
                            ? "category"
                            : chartData.bar[0]?.metric
                              ? "metric"
                              : "name"
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        dataKey={
                          chartData.bar[0]?.value !== undefined
                            ? "value"
                            : chartData.bar[0]?.count !== undefined
                              ? "count"
                              : chartData.bar[0]?.["Tăng trưởng GDP (%)"] !== undefined
                                ? "Tăng trưởng GDP (%)"
                                : "mean"
                        }
                        fill={CHART_COLORS[0]}
                        name="Giá trị"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {activeChartTypes.includes("pie") && (
                <ChartCard title="Tỷ lệ thành phần">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.pie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.pie.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, "Số lượng"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {activeChartTypes.includes("line") && (
                <ChartCard
                  title="Xu hướng theo thời gian"
                  className="lg:col-span-2 xl:col-span-1"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.line}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey={
                          (["period", "month", "time", "x"] as const).find(
                            (k) => chartData.line[0]?.[k] != null
                          ) || "x"
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey={
                          (["GDP (%)", "score", "value", "metric1", "y"] as const).find(
                            (k) => chartData.line[0]?.[k] != null
                          ) || "value"
                        }
                        stroke={CHART_COLORS[1]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Giá trị"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {activeChartTypes.includes("area") && (
                <ChartCard title="Diễn biến tích lũy" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.line}>
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey={
                          (["period", "month", "time", "x"] as const).find(
                            (k) => chartData.line[0]?.[k] != null
                          ) || "x"
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey={
                          (["GDP (%)", "score", "value", "metric1", "y"] as const).find(
                            (k) => chartData.line[0]?.[k] != null
                          ) || "value"
                        }
                        stroke={CHART_COLORS[2]}
                        fill="url(#areaGradient)"
                        name="Giá trị"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {activeChartTypes.includes("radar") && (
                <ChartCard title="Đánh giá đa chiều">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={chartData.radar}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={90} tick={{ fontSize: 10 }} />
                      <Radar
                        name="Điểm"
                        dataKey="value"
                        stroke={CHART_COLORS[3]}
                        fill={CHART_COLORS[3]}
                        fillOpacity={0.4}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {activeChartTypes.includes("composed") && (
                <ChartCard title="So sánh đa biến" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData.line}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey={
                          (["period", "month", "time", "x"] as const).find(
                            (k) => chartData.line[0]?.[k] != null
                          ) || "x"
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        yAxisId="left"
                        dataKey={
                          chartData.line[0]?.["GDP (%)"] !== undefined
                            ? "GDP (%)"
                            : chartData.line[0]?.metric1 !== undefined
                              ? "metric1"
                              : chartData.line[0]?.value !== undefined
                                ? "value"
                                : chartData.line[0]?.["Vốn đăng ký (tỷ USD)"] !== undefined
                                  ? "Vốn đăng ký (tỷ USD)"
                                  : "score"
                        }
                        fill={CHART_COLORS[4]}
                        name="GDP / Chỉ số chính"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey={
                          chartData.line[0]?.["Lạm phát (%)"] !== undefined
                            ? "Lạm phát (%)"
                            : chartData.line[0]?.metric2 !== undefined
                              ? "metric2"
                              : chartData.line[0]?.["Vốn giải ngân (tỷ USD)"] !== undefined
                                ? "Vốn giải ngân (tỷ USD)"
                                : chartData.line[0]?.baseline !== undefined
                                  ? "baseline"
                                  : "target"
                        }
                        stroke={CHART_COLORS[5]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Lạm phát / Chỉ số phụ"
                      />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {activeChartTypes.includes("scatter") && (
                <ChartCard title="Phân tán dữ liệu">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="x" type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="y" type="number" tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter
                        name="Điểm dữ liệu"
                        data={chartData.scatter}
                        fill={CHART_COLORS[6]}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-gray-400 p-8">
            <Database className="h-20 w-20 mb-4 opacity-40" />
            <p className="text-base font-medium">Chọn một bộ dữ liệu</p>
            <p className="text-sm mt-1">Bấm vào bộ dữ liệu bên trái để xem trực quan hóa</p>
          </div>
        )}
      </main>

      <Dialog
        open={dataViewOpen}
        onOpenChange={(open) => {
          setDataViewOpen(open)
          if (!open) {
            setDataPage(1)
            setDataViewSheet("")
          } else if (selectedDataset?.sheets) {
            setDataViewSheet(Object.keys(selectedDataset.sheets)[0] || "")
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              Dữ liệu: {selectedDataset?.title}
              {isMultiSheet && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({sheetNames.length} sheet)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto border rounded-lg flex flex-col">
            {currentSheetData.length === 0 && !isMultiSheet ? (
              <div className="p-8 text-center text-slate-500">Không có dữ liệu</div>
            ) : isMultiSheet ? (
              <Tabs
                value={activeSheet}
                onValueChange={(v) => {
                  setDataViewSheet(v)
                  setDataPage(1)
                }}
                className="flex-1 min-h-0 flex flex-col"
              >
                <TabsList className="flex-shrink-0 mx-4 mt-2 w-fit">
                  {sheetNames.map((name) => (
                    <TabsTrigger key={name} value={name} className="gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      {name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {sheetNames.map((name) => {
                  const sheetData = selectedDataset!.sheets![name] ?? []
                  return (
                    <TabsContent
                      key={name}
                      value={name}
                      className="flex-1 min-h-0 mt-0 flex flex-col p-4"
                    >
                      <SheetDataTable data={sheetData} pageSize={DATA_PAGE_SIZE} />
                    </TabsContent>
                  )
                })}
              </Tabs>
            ) : (
              <SheetDataTable
                data={rawData}
                pageSize={DATA_PAGE_SIZE}
                dataPage={dataPage}
                setDataPage={setDataPage}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!projectFilePreview || !!projectFileError || projectFileLoading}
        onOpenChange={(open) => {
          if (!open) {
            setProjectFilePreview(null)
            setProjectFileError(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              {projectFileLoading
                ? "Đang tải file…"
                : projectFileError
                  ? "Không xem trước được"
                  : projectFilePreview
                    ? `File: ${projectFilePreview.name}`
                    : "File dự án"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto flex flex-col">
            {projectFileLoading && (
              <div className="p-8 text-center text-slate-500">Đang tải và parse file…</div>
            )}
            {projectFileError && !projectFileLoading && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
                {projectFileError}
              </div>
            )}
            {projectFilePreview && !projectFileLoading && (
              <div className="border rounded-lg flex flex-col flex-1 min-h-0">
                <SheetDataTable
                  data={projectFilePreview.data}
                  pageSize={DATA_PAGE_SIZE}
                  dataPage={projectFileDataPage}
                  setDataPage={setProjectFileDataPage}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
