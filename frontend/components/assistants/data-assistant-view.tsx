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
import { Database, BarChart3, TrendingUp, Maximize2, Download, FileSpreadsheet, Table2, Eye, ChevronDown, ChevronRight, FolderOpen, ChevronLeft } from "lucide-react"
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

type RawDataRow = Record<string, string | number>
type ChartType = "bar" | "pie" | "line" | "area" | "radar" | "composed" | "scatter"
type Dataset = { id: string; title: string; description?: string; type?: string; domain?: string; raw_data?: RawDataRow[]; sheets?: Record<string, RawDataRow[]>; chart_types?: ChartType[] }
type DomainInfo = { id: string; name: string; description: string; order: number; dataset_count: number }

const DEFAULT_CHART_TYPES: ChartType[] = ["bar", "pie", "line"]

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]

const DATA_PAGE_SIZE = 12

/** Bảng dữ liệu với phân trang - dùng cho modal xem dữ liệu (đơn sheet hoặc từng sheet) */
function SheetDataTable({
  data,
  pageSize,
  dataPage: controlledPage,
  setDataPage: setControlledPage,
}: {
  data: RawDataRow[]
  pageSize: number
  dataPage?: number
  setDataPage?: (p: number | ((prev: number) => number)) => void
}) {
  const [internalPage, setInternalPage] = useState(1)
  const isControlled = controlledPage !== undefined && setControlledPage !== undefined
  const page = isControlled ? controlledPage : internalPage
  const setPage = isControlled ? setControlledPage! : setInternalPage
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const slice = data.slice((page - 1) * pageSize, page * pageSize)
  if (data.length === 0) {
    return <div className="p-8 text-center text-slate-500">Không có dữ liệu</div>
  }
  const cols = Object.keys(data[0]!)
  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-800 sticky top-0">
            <tr>
              {cols.map((key) => (
                <th key={key} className="px-4 py-2 text-left font-medium border-b">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr key={(page - 1) * pageSize + i} className="border-b hover:bg-slate-50 dark:hover:bg-gray-800/50">
                {cols.map((key) => (
                  <td key={key} className="px-4 py-2">
                    {String(row[key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-2 border-t bg-slate-50 dark:bg-gray-800/50 text-sm flex-shrink-0">
        <span className="text-slate-600 dark:text-gray-400">
          Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.length)} / {data.length} bản ghi
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage((p: number) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[6rem] text-center tabular-nums">Trang {page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}

// Dữ liệu mẫu phong phú theo từng loại dataset
const getDatasetChartData = (dataset: Dataset) => {
  const type = (dataset.type ?? "").toLowerCase()
  const id = dataset.id

  if (type.includes("survey") || id.includes("survey")) {
    return {
      bar: [
        { category: "Rất hài lòng", count: 125, percent: 42 },
        { category: "Hài lòng", count: 98, percent: 33 },
        { category: "Bình thường", count: 45, percent: 15 },
        { category: "Không hài lòng", count: 22, percent: 7 },
        { category: "Rất không hài lòng", count: 10, percent: 3 },
      ],
      pie: [
        { name: "Khoa CNTT", value: 85 },
        { name: "Khoa KT", value: 72 },
        { name: "Khoa NN", value: 58 },
        { name: "Khoa KHXH", value: 45 },
        { name: "Khác", value: 40 },
      ],
      line: [
        { month: "T1", score: 3.2, target: 3.5 },
        { month: "T2", score: 3.4, target: 3.6 },
        { month: "T3", score: 3.5, target: 3.7 },
        { month: "T4", score: 3.8, target: 3.8 },
        { month: "T5", score: 4.0, target: 3.9 },
        { month: "T6", score: 3.9, target: 4.0 },
      ],
      radar: [
        { subject: "Chất lượng", value: 85, fullMark: 100 },
        { subject: "Cơ sở vật chất", value: 72, fullMark: 100 },
        { subject: "Giảng viên", value: 90, fullMark: 100 },
        { subject: "Chương trình", value: 78, fullMark: 100 },
        { subject: "Hỗ trợ", value: 65, fullMark: 100 },
      ],
      scatter: [
        { x: 1, y: 3.2 },
        { x: 2, y: 3.8 },
        { x: 3, y: 4.1 },
        { x: 4, y: 3.5 },
        { x: 5, y: 4.2 },
        { x: 6, y: 3.9 },
      ],
    }
  }

  if (type.includes("experiment") || id.includes("experiment")) {
    return {
      bar: [
        { category: "Nhóm đối chứng", mean: 45.2, std: 5.1 },
        { category: "Nhóm thí nghiệm 1", mean: 52.8, std: 4.3 },
        { category: "Nhóm thí nghiệm 2", mean: 58.1, std: 5.8 },
        { category: "Nhóm thí nghiệm 3", mean: 61.4, std: 4.9 },
      ],
      pie: [
        { name: "Thành công", value: 68 },
        { name: "Một phần", value: 22 },
        { name: "Không đạt", value: 10 },
      ],
      line: [
        { time: "0h", value: 0, baseline: 5 },
        { time: "2h", value: 12, baseline: 15 },
        { time: "4h", value: 28, baseline: 25 },
        { time: "6h", value: 45, baseline: 40 },
        { time: "8h", value: 62, baseline: 55 },
        { time: "10h", value: 78, baseline: 70 },
        { time: "12h", value: 85, baseline: 80 },
      ],
      radar: [
        { subject: "Độ chính xác", value: 92, fullMark: 100 },
        { subject: "Độ lặp lại", value: 88, fullMark: 100 },
        { subject: "Độ ổn định", value: 75, fullMark: 100 },
        { subject: "Tốc độ", value: 85, fullMark: 100 },
        { subject: "Hiệu suất", value: 78, fullMark: 100 },
      ],
      scatter: [
        { x: 10, y: 45 },
        { x: 20, y: 52 },
        { x: 30, y: 58 },
        { x: 40, y: 65 },
        { x: 50, y: 72 },
      ],
    }
  }

  if (type.includes("health") || id.includes("dich-te") || id.includes("chi-phi-y-te")) {
    const raw = dataset.raw_data ?? []
    const first = raw[0] as RawDataRow | undefined
    const catKey = first ? (Object.keys(first).find((k) => ["Tháng", "Vùng", "Ngành"].some((x) => k.includes(x))) ?? Object.keys(first)[0]) : "category"
    const valKey = first ? (Object.keys(first).find((k) => ["Ca mắc", "Chi phí", "Số lượng", "Giá trị"].some((x) => k.includes(x))) ?? Object.keys(first).filter((k) => k !== catKey)[0]) : "value"
    return {
      bar: raw.map((r: RawDataRow) => ({ category: String(r[catKey] ?? ""), value: r[valKey] ?? 0, ...r })),
      pie: raw.slice(0, 6).map((r: RawDataRow) => ({ name: String(r[catKey] ?? ""), value: Number(r[valKey] ?? 0) })),
      line: raw.map((r: RawDataRow) => ({ period: String(r[catKey] ?? ""), value: r[valKey] ?? 0, ...r })),
      radar: raw.slice(0, 5).map((r: RawDataRow, i) => ({ subject: String(r[catKey] ?? ""), value: Number(r[valKey] ?? 0), fullMark: 100 })),
      scatter: raw.map((r: RawDataRow, i) => ({ x: i + 1, y: Number(r[valKey] ?? 0) })),
    }
  }

  if (type.includes("excel") || type.includes("technology") || type.includes("environment") || type.includes("society") || type.includes("agriculture") || id.includes("fdi") || id.includes("lam-phat") || id.includes("startup") || id.includes("doanh-thu") || id.includes("chat-luong") || id.includes("nang-luong") || id.includes("dan-so") || id.includes("muc-song") || id.includes("xuat-khau") || id.includes("nang-suat")) {
    const raw = dataset.raw_data ?? []
    const first = raw[0] as RawDataRow | undefined
    const catKey = first ? (Object.keys(first).find((k) => ["Năm", "Tháng", "Vùng", "Lĩnh vực", "Ngành"].some((x) => k.includes(x))) ?? Object.keys(first)[0]) : "category"
    const valKeys = first ? Object.keys(first).filter((k) => k !== catKey && typeof (first as any)[k] === "number") : []
    const valKey = valKeys[0] ?? "value"
    return {
      bar: raw.map((r: RawDataRow) => ({ category: String(r[catKey] ?? ""), value: r[valKey] ?? 0, ...r })),
      pie: raw.slice(0, 6).map((r: RawDataRow) => ({ name: String(r[catKey] ?? ""), value: Number(r[valKey] ?? 0) })),
      line: raw.map((r: RawDataRow) => ({ period: String(r[catKey] ?? ""), value: r[valKey] ?? 0, ...r })),
      radar: raw.slice(0, 5).map((r: RawDataRow) => ({ subject: String(r[catKey] ?? "").slice(0, 12), value: Number(r[valKey] ?? 0), fullMark: 100 })),
      scatter: raw.map((r: RawDataRow, i) => ({ x: i + 1, y: Number(r[valKey] ?? 0) })),
    }
  }

  if ((type.includes("macro") || id.includes("macro-vn")) && dataset.raw_data?.[0]?.["Tăng trưởng GDP (%)"] != null) {
    const raw = dataset.raw_data ?? []
    const barData = raw.length > 0
      ? raw.map((r: RawDataRow) => ({
          category: `${r["Năm"]} ${r["Quý"] ?? ""}`.trim(),
          "Tăng trưởng GDP (%)": r["Tăng trưởng GDP (%)"],
          "Lạm phát (%)": r["Lạm phát (%)"],
          "Thất nghiệp (%)": r["Thất nghiệp (%)"],
          "Lãi suất (%)": r["Lãi suất cơ bản (%)"],
        }))
      : []
    const lineData = raw.length > 0
      ? raw.map((r: RawDataRow) => ({
          period: `${r["Năm"]} ${r["Quý"]}`,
          "GDP (%)": r["Tăng trưởng GDP (%)"],
          "Lạm phát (%)": r["Lạm phát (%)"],
          "Xuất khẩu": r["Xuất khẩu (tỷ USD)"],
          "Nhập khẩu": r["Nhập khẩu (tỷ USD)"],
          "Cán cân TM": r["Cán cân TM (tỷ USD)"],
        }))
      : []
    const years = [...new Set(raw.map((r: RawDataRow) => r["Năm"]))].sort()
    const pieData = years.length > 0
      ? [
          { name: "GDP tăng trưởng dương", value: raw.filter((r: RawDataRow) => (r["Tăng trưởng GDP (%)"] as number) > 0).length * 5 },
          { name: "GDP tăng trưởng âm", value: raw.filter((r: RawDataRow) => (r["Tăng trưởng GDP (%)"] as number) <= 0).length * 5 },
          { name: "Lạm phát trên 3%", value: raw.filter((r: RawDataRow) => (r["Lạm phát (%)"] as number) > 3).length * 5 },
          { name: "Lạm phát dưới 3%", value: raw.filter((r: RawDataRow) => (r["Lạm phát (%)"] as number) <= 3).length * 5 },
        ].filter((d) => d.value > 0)
      : [{ name: "N/A", value: 1 }]
    return {
      bar: barData.length > 0 ? barData.slice(-12) : [{ category: "N/A", "Tăng trưởng GDP (%)": 0 }],
      pie: pieData.length > 0 ? pieData : [{ name: "N/A", value: 1 }],
      line: lineData.length > 0 ? lineData : [{ period: "N/A", "GDP (%)": 0 }],
      radar: [
        { subject: "Tăng trưởng GDP", value: Math.min(100, Math.max(0, ((raw[raw.length - 1]?.["Tăng trưởng GDP (%)"] as number) ?? 0) * 10)), fullMark: 100 },
        { subject: "Kiểm soát lạm phát", value: Math.min(100, Math.max(0, 100 - ((raw[raw.length - 1]?.["Lạm phát (%)"] as number) ?? 0) * 15)), fullMark: 100 },
        { subject: "Việc làm", value: Math.min(100, Math.max(0, 100 - ((raw[raw.length - 1]?.["Thất nghiệp (%)"] as number) ?? 0) * 25)), fullMark: 100 },
        { subject: "Xuất khẩu", value: Math.min(100, ((raw[raw.length - 1]?.["Xuất khẩu (tỷ USD)"] as number) ?? 0) / 1.5), fullMark: 100 },
        { subject: "Cán cân TM", value: Math.min(100, Math.max(0, 50 + ((raw[raw.length - 1]?.["Cán cân TM (tỷ USD)"] as number) ?? 0) * 3)), fullMark: 100 },
      ],
      scatter: raw.length > 0
        ? raw.map((r: RawDataRow, i: number) => ({ x: i + 1, y: r["Tăng trưởng GDP (%)"] as number, z: r["Lạm phát (%)"] as number }))
        : [{ x: 1, y: 0 }],
    }
  }

  if (type.includes("processed") || type.includes("descriptive") || type.includes("correlation")) {
    return {
      bar: [
        { metric: "Trung bình", value: 72.5 },
        { metric: "Độ lệch chuẩn", value: 12.3 },
        { metric: "Min", value: 42 },
        { metric: "Max", value: 95 },
        { metric: "Median", value: 74 },
      ],
      pie: [
        { name: "Tương quan mạnh", value: 35 },
        { name: "Tương quan TB", value: 45 },
        { name: "Tương quan yếu", value: 20 },
      ],
      line: [
        { period: "Q1", metric1: 65, metric2: 58 },
        { period: "Q2", metric1: 72, metric2: 68 },
        { period: "Q3", metric1: 78, metric2: 75 },
        { period: "Q4", metric1: 82, metric2: 80 },
      ],
      radar: [
        { subject: "A", value: 65, fullMark: 100 },
        { subject: "B", value: 78, fullMark: 100 },
        { subject: "C", value: 72, fullMark: 100 },
        { subject: "D", value: 85, fullMark: 100 },
        { subject: "E", value: 90, fullMark: 100 },
      ],
      scatter: [
        { x: 50, y: 55 },
        { x: 60, y: 62 },
        { x: 70, y: 68 },
        { x: 80, y: 75 },
        { x: 90, y: 82 },
      ],
    }
  }

  // Mặc định
  return {
    bar: [
      { name: "Nhóm A", value: 400 },
      { name: "Nhóm B", value: 300 },
      { name: "Nhóm C", value: 200 },
      { name: "Nhóm D", value: 278 },
      { name: "Nhóm E", value: 189 },
    ],
    pie: [
      { name: "A", value: 400 },
      { name: "B", value: 300 },
      { name: "C", value: 200 },
      { name: "D", value: 278 },
    ],
    line: [
      { x: "1", metric1: 40, metric2: 35 },
      { x: "2", metric1: 55, metric2: 50 },
      { x: "3", metric1: 48, metric2: 52 },
      { x: "4", metric1: 72, metric2: 65 },
      { x: "5", metric1: 65, metric2: 70 },
    ],
    radar: [
      { subject: "X", value: 70, fullMark: 100 },
      { subject: "Y", value: 80, fullMark: 100 },
      { subject: "Z", value: 60, fullMark: 100 },
    ],
    scatter: [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 3 },
      { x: 4, y: 5 },
    ],
  }
}

/** Wrapper cho từng chart, có nút phóng to fullscreen */
function ChartCard({
  title,
  icon,
  className = "",
  children,
}: {
  title: string
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const [fullscreen, setFullscreen] = useState(false)
  return (
    <>
      <section className={`bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-4 shadow-sm relative group ${className}`.trim()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-60 hover:opacity-100"
            onClick={() => setFullscreen(true)}
            title="Phóng to toàn màn hình"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-64">{children}</div>
      </section>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-4 flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {icon}
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 pt-4">
            <div className="h-full min-h-[400px]">{children}</div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function DataAssistantView() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [domains, setDomains] = useState<DomainInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())

  const baseUrl = `${API_CONFIG.baseUrl}/api/data_agent/v1`

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
        sheets: t.sheets && typeof t.sheets === "object" && !Array.isArray(t.sheets) ? (t.sheets as Record<string, RawDataRow[]>) : undefined,
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
  const activeChartTypes = (selectedDataset?.chart_types?.length ? selectedDataset.chart_types : DEFAULT_CHART_TYPES) as ChartType[]

  const rawData = selectedDataset?.raw_data
    ?? (chartData ? (chartData.bar as RawDataRow[]) : [])

  const [dataViewOpen, setDataViewOpen] = useState(false)
  const [dataPage, setDataPage] = useState(1)
  const [dataViewSheet, setDataViewSheet] = useState<string>("")

  const isMultiSheet = !!(selectedDataset?.sheets && Object.keys(selectedDataset.sheets).length > 0)
  const sheetNames = selectedDataset?.sheets ? Object.keys(selectedDataset.sheets) : []
  const activeSheet = dataViewSheet || sheetNames[0] || ""
  const currentSheetData = isMultiSheet && activeSheet
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
      {/* Sidebar: Danh sách bộ dữ liệu - layout riêng cho Data assistant */}
      <aside className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shadow-sm">
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

      {/* Main: Dashboard nhiều biểu đồ - không dùng chung component với Write */}
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
                  disabled={rawData.length === 0 && !(selectedDataset?.sheets && Object.values(selectedDataset.sheets).some((arr) => arr.length > 0))}
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Xem dữ liệu
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={rawData.length === 0 && !(selectedDataset?.sheets && Object.values(selectedDataset.sheets).some((arr) => arr.length > 0))} className="gap-1.5">
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

            {/* Grid nhiều biểu đồ - số lượng và loại khác nhau theo từng dataset */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeChartTypes.includes("bar") && (
              <ChartCard title="Phân bố theo danh mục" icon={<BarChart3 className="h-4 w-4" />}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.bar}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey={chartData.bar[0]?.category ? "category" : chartData.bar[0]?.metric ? "metric" : "name"} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey={
                        chartData.bar[0]?.value !== undefined ? "value"
                        : chartData.bar[0]?.count !== undefined ? "count"
                        : chartData.bar[0]?.["Tăng trưởng GDP (%)"] !== undefined ? "Tăng trưởng GDP (%)"
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
              <ChartCard title="Xu hướng theo thời gian" className="lg:col-span-2 xl:col-span-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.line}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey={(["period","month","time","x"] as const).find(k => chartData.line[0]?.[k] != null) || "x"} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey={(["GDP (%)","score","value","metric1","y"] as const).find(k => chartData.line[0]?.[k] != null) || "value"}
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
                    <XAxis dataKey={(["period","month","time","x"] as const).find(k => chartData.line[0]?.[k] != null) || "x"} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey={(["GDP (%)","score","value","metric1","y"] as const).find(k => chartData.line[0]?.[k] != null) || "value"}
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
                    <Radar name="Điểm" dataKey="value" stroke={CHART_COLORS[3]} fill={CHART_COLORS[3]} fillOpacity={0.4} />
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
                    <XAxis dataKey={(["period","month","time","x"] as const).find(k => chartData.line[0]?.[k] != null) || "x"} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      yAxisId="left"
                      dataKey={
                        chartData.line[0]?.["GDP (%)"] !== undefined ? "GDP (%)"
                        : chartData.line[0]?.metric1 !== undefined ? "metric1"
                        : chartData.line[0]?.value !== undefined ? "value"
                        : chartData.line[0]?.["Vốn đăng ký (tỷ USD)"] !== undefined ? "Vốn đăng ký (tỷ USD)"
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
                        chartData.line[0]?.["Lạm phát (%)"] !== undefined ? "Lạm phát (%)"
                        : chartData.line[0]?.metric2 !== undefined ? "metric2"
                        : chartData.line[0]?.["Vốn giải ngân (tỷ USD)"] !== undefined ? "Vốn giải ngân (tỷ USD)"
                        : chartData.line[0]?.baseline !== undefined ? "baseline"
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
                    <Scatter name="Điểm dữ liệu" data={chartData.scatter} fill={CHART_COLORS[6]} />
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

      {/* Modal xem dữ liệu gốc - hỗ trợ đa sheet */}
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
                    <TabsContent key={name} value={name} className="flex-1 min-h-0 mt-0 flex flex-col p-4">
                      <SheetDataTable data={sheetData} pageSize={DATA_PAGE_SIZE} />
                    </TabsContent>
                  )
                })}
              </Tabs>
            ) : (
              <SheetDataTable data={rawData} pageSize={DATA_PAGE_SIZE} dataPage={dataPage} setDataPage={setDataPage} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
