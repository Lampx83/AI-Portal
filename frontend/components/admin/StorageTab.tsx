"use client"

import { useEffect, useState } from "react"
import { Package, HardDrive, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getStorageStats,
  getStorageList,
  getStorageConnectionInfo,
  getStorageDownloadUrl,
  getStorageInfo,
  adminFetch,
} from "@/lib/api/admin"

type StorageObject = { key: string; size: number; lastModified?: string }

export function StorageTab() {
  const [stats, setStats] = useState<{ totalObjects: number; totalSizeFormatted?: string; prefixCount?: number } | null>(null)
  const [connInfo, setConnInfo] = useState<Record<string, unknown> | null>(null)
  const [prefix, setPrefix] = useState("")
  const [prefixes, setPrefixes] = useState<string[]>([])
  const [objects, setObjects] = useState<StorageObject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [breadcrumb, setBreadcrumb] = useState<string[]>([])

  const loadStats = () => {
    getStorageStats()
      .then((d) => setStats(d))
      .catch(() => setStats(null))
  }

  const loadConnInfo = () => {
    getStorageConnectionInfo()
      .then(setConnInfo)
      .catch(() => setConnInfo(null))
  }

  const loadList = (p: string) => {
    setPrefix(p)
    setLoading(true)
    getStorageList(p || undefined)
      .then((d) => {
        setPrefixes(Array.isArray(d.prefixes) ? d.prefixes : [])
        setObjects(Array.isArray(d.objects) ? d.objects : [])
        setBreadcrumb(p ? p.replace(/\/$/, "").split("/").filter(Boolean) : [])
      })
      .catch(() => {
        setPrefixes([])
        setObjects([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStats()
    loadConnInfo()
    loadList("")
  }, [])

  const filteredObjects = search.trim()
    ? objects.filter((o) => o.key.toLowerCase().includes(search.toLowerCase()))
    : objects

  const navigateToPrefix = (p: string) => {
    loadList(p ? p + "/" : "")
  }

  const download = (key: string) => {
    window.open(getStorageDownloadUrl(key), "_blank")
  }

  const info = async (key: string) => {
    try {
      const d = await getStorageInfo(key)
      alert(JSON.stringify(d, null, 2))
    } catch (e) {
      alert((e as Error)?.message || "Lỗi")
    }
  }

  const remove = async (key: string) => {
    if (!confirm(`Xóa object "${key}"?`)) return
    try {
      await adminFetch(`/api/storage/object/${encodeURIComponent(key)}`, { method: "DELETE" })
      loadList(prefix)
      loadStats()
    } catch (e) {
      alert((e as Error)?.message || "Lỗi")
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Quản trị Storage (MinIO)</h2>
      {connInfo != null && Object.keys(connInfo).length > 0 && (
        <div className="mb-4 p-3 bg-muted/50 rounded-md">
          <h3 className="text-sm font-semibold mb-2">Thông tin kết nối MinIO</h3>
          <pre className="text-xs overflow-x-auto">{JSON.stringify(connInfo, null, 2)}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex flex-row items-start gap-3">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 shrink-0">
              <Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Total Objects</h3>
              <p className="text-2xl font-semibold mt-1">{stats?.totalObjects ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-row items-start gap-3">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 shrink-0">
              <HardDrive className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Total Size</h3>
              <p className="text-2xl font-semibold mt-1">{stats?.totalSizeFormatted ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-row items-start gap-3">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 shrink-0">
              <Folder className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Folders</h3>
              <p className="text-2xl font-semibold mt-1">{stats?.prefixCount ?? prefixes.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-6 flex-wrap">
        <div className="w-72 flex-shrink-0">
          <h3 className="text-sm font-semibold mb-2">Folders</h3>
          <div className="p-3 bg-muted/50 rounded-md mb-2 flex flex-wrap gap-2 items-center">
            <Button variant="link" className="p-0 h-auto text-primary" onClick={() => loadList("")}>
              Root
            </Button>
            {breadcrumb.map((part, i) => {
              const path = breadcrumb.slice(0, i + 1).join("/") + "/"
              return (
                <span key={path}>
                  <span className="text-muted-foreground">/</span>
                  <Button variant="link" className="p-0 h-auto text-primary" onClick={() => loadList(path)}>
                    {part}
                  </Button>
                </span>
              )
            })}
          </div>
          <ul className="space-y-1">
            {prefixes.map((p) => {
              const name = p.replace(/\/$/, "").split("/").pop() || p
              return (
                <li key={p}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm"
                    onClick={() => loadList(p)}
                  >
                    📁 {name}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <Input
              placeholder="Tìm kiếm file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="border rounded-md overflow-hidden">
            {loading ? (
              <p className="p-4 text-muted-foreground text-center">Đang tải files...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Kích thước</TableHead>
                    <TableHead>Ngày sửa</TableHead>
                    <TableHead className="w-[200px]">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredObjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Không có file
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredObjects.map((o) => (
                      <TableRow key={o.key}>
                        <TableCell className="font-medium break-all">{o.key}</TableCell>
                        <TableCell>{formatSize(o.size)}</TableCell>
                        <TableCell>{o.lastModified ? new Date(o.lastModified).toLocaleString("vi-VN") : "—"}</TableCell>
                        <TableCell>
                          <Button variant="secondary" size="sm" className="mr-1" onClick={() => download(o.key)}>
                            Tải
                          </Button>
                          <Button variant="outline" size="sm" className="mr-1" onClick={() => info(o.key)}>
                            Info
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => remove(o.key)}>
                            Xóa
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
