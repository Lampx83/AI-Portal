"use client"

import { useEffect, useState, useCallback } from "react"
import { Package, HardDrive, Folder, Trash2, ChevronRight, ChevronDown } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getStorageStats,
  getStorageList,
  getStorageConnectionInfo,
  getStorageDownloadUrl,
  getStorageInfo,
  deleteStoragePrefix,
  deleteStorageBatch,
  adminFetch,
} from "@/lib/api/admin"
import { useToast } from "@/hooks/use-toast"

type StorageObject = { key: string; size: number; lastModified?: string }

export function StorageTab() {
  const { toast } = useToast()
  const [stats, setStats] = useState<{ totalObjects: number; totalSizeFormatted?: string } | null>(null)
  const [connInfo, setConnInfo] = useState<Record<string, unknown> | null>(null)
  const [prefix, setPrefix] = useState("")
  const [prefixes, setPrefixes] = useState<string[]>([])
  const [objects, setObjects] = useState<StorageObject[]>([])
  /** Cache cây folder: prefix -> danh sách sub-prefix đã load */
  const [folderTreeCache, setFolderTreeCache] = useState<Record<string, string[]>>({})
  /** Folder nào đang mở rộng (để hiện con) */
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [breadcrumb, setBreadcrumb] = useState<string[]>([])
  const [deleteFolderPrefix, setDeleteFolderPrefix] = useState<string | null>(null)
  const [deleteAllFilesConfirmOpen, setDeleteAllFilesConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)

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

  const loadList = useCallback((p: string) => {
    setPrefix(p)
    setLoading(true)
    setSelectedKeys(new Set())
    getStorageList(p || undefined)
      .then((d) => {
        const childPrefixes = Array.isArray(d.prefixes) ? d.prefixes : []
        setPrefixes(childPrefixes)
        setObjects(Array.isArray(d.objects) ? d.objects : [])
        setBreadcrumb(p ? p.replace(/\/$/, "").split("/").filter(Boolean) : [])
        setFolderTreeCache((prev) => ({ ...prev, [p]: childPrefixes }))
        setExpandedFolders((prev) => {
          const next = new Set(prev)
          if (p) next.add(p)
          return next
        })
      })
      .catch(() => {
        setPrefixes([])
        setObjects([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadStats()
    loadConnInfo()
    loadList("")
  }, [])

  const filteredObjects = search.trim()
    ? objects.filter((o) => o.key.toLowerCase().includes(search.toLowerCase()))
    : objects

  const navigateToPrefix = (p: string) => {
    loadList(p || "")
  }

  const toggleFolderExpand = (folderPrefix: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderPrefix)) next.delete(folderPrefix)
      else next.add(folderPrefix)
      return next
    })
  }

  const loadFolderChildren = (folderPrefix: string) => {
    if (folderTreeCache[folderPrefix]) return
    getStorageList(folderPrefix)
      .then((d) => {
        const childPrefixes = Array.isArray(d.prefixes) ? d.prefixes : []
        setFolderTreeCache((prev) => ({ ...prev, [folderPrefix]: childPrefixes }))
      })
      .catch(() => {})
  }

  const renderFolderTree = (parentPrefix: string, indent: number) => {
    const children = folderTreeCache[parentPrefix] ?? []
    if (children.length === 0) return null
    return children.map((childPrefix) => {
      const name = childPrefix.replace(/\/$/, "").split("/").pop() || childPrefix
      const isExpanded = expandedFolders.has(childPrefix)
      const hasCachedChildren = (folderTreeCache[childPrefix]?.length ?? 0) > 0
      const isSelected = prefix === childPrefix
      return (
        <div key={childPrefix} style={{ paddingLeft: indent * 16 }}>
          <div className="flex items-center gap-0.5 group">
            <button
              type="button"
              className="w-5 h-7 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (hasCachedChildren || children.length > 0) {
                  toggleFolderExpand(childPrefix)
                } else {
                  loadFolderChildren(childPrefix)
                  setExpandedFolders((prev) => new Set(prev).add(childPrefix))
                }
              }}
              aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
            >
              {hasCachedChildren || isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              className={`flex-1 text-left px-2 py-1.5 rounded-md text-sm truncate ${isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
              onClick={() => navigateToPrefix(childPrefix)}
            >
              📁 {name}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteFolderPrefix(childPrefix)
              }}
              title="Xóa toàn bộ folder"
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {isExpanded && renderFolderTree(childPrefix, indent + 1)}
        </div>
      )
    })
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
      toast({ title: "Đã xóa object" })
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message || "Không xóa được", variant: "destructive" })
    }
  }

  const handleDeleteFolder = async (folderPrefix: string) => {
    setDeleting(true)
    setDeleteFolderPrefix(null)
    try {
      await deleteStoragePrefix(folderPrefix)
      toast({ title: "Đã xóa folder", description: `Đã xóa toàn bộ nội dung trong ${folderPrefix}` })
      loadList(prefix)
      loadStats()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message || "Không xóa folder được", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAllFilesInFolder = async () => {
    if (!prefix) return
    setDeleteAllFilesConfirmOpen(false)
    setDeleting(true)
    try {
      await deleteStoragePrefix(prefix)
      toast({ title: "Đã xóa toàn bộ file", description: `Đã xóa toàn bộ file trong folder này.` })
      loadList(prefix)
      loadStats()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message || "Không xóa được", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelectKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredObjects.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(filteredObjects.map((o) => o.key)))
    }
  }

  const handleBulkDelete = async () => {
    const keys = Array.from(selectedKeys)
    if (keys.length === 0) return
    setBulkDeleteConfirmOpen(false)
    setDeleting(true)
    setSelectedKeys(new Set())
    try {
      const res = await deleteStorageBatch(keys)
      const count = res.deletedCount ?? keys.length
      toast({ title: "Đã xóa file", description: `Đã xóa ${count} file đã chọn.` })
      loadList(prefix)
      loadStats()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error)?.message || "Không xóa được", variant: "destructive" })
      setSelectedKeys(new Set(keys))
    } finally {
      setDeleting(false)
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
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                {prefix ? "Trong folder này" : "Folders (cấp hiện tại)"}
              </h3>
              <p className="text-2xl font-semibold mt-1">
                {prefix
                  ? `${objects.length} file · ${formatSize(objects.reduce((s, o) => s + o.size, 0))}`
                  : prefixes.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-6 flex-wrap">
        <div className="w-72 flex-shrink-0">
          <h3 className="text-sm font-semibold mb-2">Folders</h3>
          <div className="p-3 bg-muted/50 rounded-md mb-2 flex flex-wrap gap-2 items-center">
            <Button
              variant="link"
              className={`p-0 h-auto ${!prefix ? "font-medium text-primary" : "text-primary"}`}
              onClick={() => loadList("")}
            >
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
          <div className="max-h-[400px] overflow-y-auto">
            {renderFolderTree("", 0)}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Tìm kiếm file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            {selectedKeys.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteConfirmOpen(true)}
                disabled={deleting}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Xóa đã chọn ({selectedKeys.size})
              </Button>
            )}
            {prefix && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteAllFilesConfirmOpen(true)}
                disabled={deleting || objects.length === 0}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Xóa toàn bộ file trong folder này
              </Button>
            )}
          </div>
          <div className="border rounded-md overflow-hidden">
            {loading ? (
              <p className="p-4 text-muted-foreground text-center">Đang tải files...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      {filteredObjects.length > 0 && (
                        <Checkbox
                          checked={selectedKeys.size === filteredObjects.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Chọn tất cả"
                        />
                      )}
                    </TableHead>
                    <TableHead>Tên</TableHead>
                    <TableHead>Kích thước</TableHead>
                    <TableHead>Ngày sửa</TableHead>
                    <TableHead className="w-[200px]">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredObjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Không có file
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredObjects.map((o) => (
                      <TableRow key={o.key}>
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selectedKeys.has(o.key)}
                            onCheckedChange={() => toggleSelectKey(o.key)}
                            aria-label={`Chọn ${o.key}`}
                          />
                        </TableCell>
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

      {/* Modal xác nhận xóa folder */}
      <AlertDialog open={!!deleteFolderPrefix} onOpenChange={(open) => !open && setDeleteFolderPrefix(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ folder</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa toàn bộ folder &quot;{deleteFolderPrefix?.replace(/\/$/, "")}&quot; và mọi file bên trong? Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={() => deleteFolderPrefix != null && handleDeleteFolder(deleteFolderPrefix)}
            >
              {deleting ? "Đang xóa..." : "Xóa folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal xác nhận xóa toàn bộ file trong folder */}
      <AlertDialog open={deleteAllFilesConfirmOpen} onOpenChange={setDeleteAllFilesConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ file trong folder này</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa tất cả {objects.length} file trong folder này? Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleDeleteAllFilesInFolder}
            >
              {deleting ? "Đang xóa..." : "Xóa tất cả"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal xác nhận xóa file đã chọn */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa file đã chọn</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa {selectedKeys.size} file đã chọn? Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleBulkDelete}
            >
              {deleting ? "Đang xóa..." : "Xóa đã chọn"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
