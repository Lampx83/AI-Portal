"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, FolderOpen, FileText, Loader2, Folder, Package, HardDrive } from "lucide-react"
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
  getDatalakeInboxDomains,
  getDatalakeInboxList,
  uploadDatalakeInbox,
} from "@/lib/api/admin"
import { useToast } from "@/hooks/use-toast"

const ALLOWED_EXT = [".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".txt"]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatMtime(mtime?: number): string {
  if (mtime == null) return "—"
  try {
    return new Date(mtime * 1000).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export function RAGDocumentsTab() {
  const { toast } = useToast()
  const [domains, setDomains] = useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>("")
  const [currentPath, setCurrentPath] = useState<string>("")
  const [folders, setFolders] = useState<string[]>([])
  const [files, setFiles] = useState<{ name: string; size: number; mtime?: number }[]>([])
  const [loadingDomains, setLoadingDomains] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [domainsError, setDomainsError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDomains = () => {
    setLoadingDomains(true)
    setDomainsError(null)
    getDatalakeInboxDomains()
      .then((d) => {
        setDomains(d.domains || [])
        if (selectedDomain === "" && (d.domains?.length ?? 0) > 0) {
          setSelectedDomain(d.domains![0])
        }
      })
      .catch((e) => {
        setDomains([])
        const msg = (e as Error)?.message
        setDomainsError(
          msg && msg.includes("LAKEFLOW_API_URL")
            ? msg
            : "Không kết nối được Datalake. Khởi động LakeFlow (port 8011): trong thư mục Datalake chạy docker compose up -d, hoặc set LAKEFLOW_API_URL trong .env nếu LakeFlow chạy ở máy/port khác."
        )
      })
      .finally(() => setLoadingDomains(false))
  }

  const loadFiles = (domain: string, path: string = "") => {
    if (!domain) {
      setFolders([])
      setFiles([])
      return
    }
    setLoadingFiles(true)
    getDatalakeInboxList(domain, path || undefined)
      .then((d) => {
        setFolders(d.folders ?? [])
        setFiles(d.files ?? [])
      })
      .catch(() => {
        setFolders([])
        setFiles([])
      })
      .finally(() => setLoadingFiles(false))
  }

  const goToPath = (path: string) => {
    setCurrentPath(path)
  }

  const enterFolder = (folderName: string) => {
    const next = currentPath ? `${currentPath}/${folderName}` : folderName
    setCurrentPath(next)
  }

  const pathParts = currentPath ? currentPath.split("/").filter(Boolean) : []
  const filteredFiles = search.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files
  const totalSize = files.reduce((s, f) => s + f.size, 0)

  useEffect(() => {
    loadDomains()
  }, [])

  useEffect(() => {
    if (selectedDomain) {
      loadFiles(selectedDomain, currentPath)
    } else {
      setFolders([])
      setFiles([])
    }
  }, [selectedDomain, currentPath])

  const handleUpload = async (filesFromInput: File[]) => {
    const list = filesFromInput
    if (!selectedDomain) {
      toast({ title: "Chọn domain trước khi upload", variant: "destructive" })
      return
    }
    if (list.length === 0) {
      toast({ title: "Chưa chọn file", variant: "destructive" })
      return
    }
    const invalid = list.filter((f) => {
      const ext = "." + (f.name.split(".").pop() || "").toLowerCase()
      return !ALLOWED_EXT.includes(ext)
    })
    if (invalid.length > 0) {
      toast({
        title: "Một số file không đúng định dạng",
        description: `Chỉ chấp nhận: ${ALLOWED_EXT.join(", ")}`,
        variant: "destructive",
      })
      return
    }
    toast({ title: `Đang tải lên ${list.length} file...`, description: `Domain: ${selectedDomain}` })
    setUploading(true)
    try {
      const result = await uploadDatalakeInbox(selectedDomain, list, currentPath || undefined)
      const ok = result.uploaded?.length ?? 0
      const err = result.errors?.length ?? 0
      if (ok > 0) {
        const dest = currentPath ? `000_inbox/${selectedDomain}/${currentPath}` : `000_inbox/${selectedDomain}`
        toast({
          title: `Đã tải lên ${ok} file vào ${dest}`,
          description: "Pipeline đang chạy nền để đưa vào Qdrant.",
        })
        loadDomains()
        loadFiles(selectedDomain, currentPath)
      }
      if (err > 0) {
        toast({
          title: `Có ${err} lỗi khi tải lên`,
          description: result.errors?.slice(0, 3).join("; "),
          variant: "destructive",
        })
      }
      if (ok === 0 && err === 0) {
        toast({
          title: "Không có file nào được tải lên",
          description: "Kiểm tra định dạng hoặc kết nối Datalake.",
          variant: "destructive",
        })
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? "Lỗi không xác định"
      toast({
        title: "Lỗi tải lên",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* File browser (layout like Storage) */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Duyệt file trong Datalake (000_inbox)</h2>
        {domainsError && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md text-sm text-amber-700 dark:text-amber-300">
            {domainsError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex flex-row items-start gap-3">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 shrink-0">
                <Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Domains</h3>
                <p className="text-2xl font-semibold mt-1">{domains.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-row items-start gap-3">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 shrink-0">
                <FolderOpen className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Đang xem</h3>
                <p className="text-sm font-semibold mt-1 truncate" title={selectedDomain ? `000_inbox/${selectedDomain}${currentPath ? `/${currentPath}` : ""}` : "—"}>
                  {selectedDomain ? `000_inbox / ${selectedDomain}${currentPath ? ` / ${currentPath}` : ""}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-row items-start gap-3">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 shrink-0">
                <HardDrive className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Trong folder này</h3>
                <p className="text-2xl font-semibold mt-1">
                  {selectedDomain
                    ? `${files.length} file · ${formatSize(totalSize)}`
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-6 flex-wrap">
          <div className="w-72 flex-shrink-0">
            <h3 className="text-sm font-semibold mb-2">Folders</h3>
            <div className="p-3 bg-muted/50 rounded-md mb-2 flex flex-wrap gap-2 items-center">
              <span className="text-muted-foreground text-sm">Domain:</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm flex-1 min-w-0"
                value={selectedDomain}
                onChange={(e) => {
                  setSelectedDomain(e.target.value)
                  setCurrentPath("")
                }}
                disabled={loadingDomains}
              >
                <option value="">-- Chọn --</option>
                {domains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="p-3 bg-muted/50 rounded-md mb-2 flex flex-wrap gap-1 items-center min-w-0">
              <Button
                variant="link"
                className={`p-0 h-auto text-sm whitespace-normal break-words text-left ${!currentPath ? "font-medium text-primary" : "text-primary"}`}
                onClick={() => goToPath("")}
                disabled={!selectedDomain}
              >
                000_inbox / {selectedDomain || "…"}
              </Button>
              {pathParts.map((part, i) => {
                const pathUpToHere = pathParts.slice(0, i + 1).join("/")
                return (
                  <span key={pathUpToHere} className="inline-flex items-center gap-1 text-sm min-w-0">
                    <span className="text-muted-foreground shrink-0">/</span>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-sm text-primary whitespace-normal break-words text-left min-w-0"
                      onClick={() => goToPath(pathUpToHere)}
                    >
                      {part}
                    </Button>
                  </span>
                )
              })}
            </div>
            <div className="max-h-[320px] overflow-y-auto space-y-0.5">
              {!selectedDomain ? (
                <p className="text-sm text-muted-foreground p-2">Chọn domain để xem thư mục.</p>
              ) : loadingFiles ? (
                <p className="text-sm text-muted-foreground p-2">Đang tải…</p>
              ) : folders.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Không có thư mục con.</p>
              ) : (
                folders.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-muted truncate"
                    onClick={() => enterFolder(name)}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{name}</span>
                  </button>
                ))
              )}
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
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXT.join(",")}
                className="hidden"
                aria-hidden
                onChange={(e) => {
                  const list = e.target.files
                  if (list?.length) {
                    handleUpload(Array.from(list))
                  }
                  e.target.value = ""
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedDomain || uploading}
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải lên…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload file
                  </>
                )}
              </Button>
            </div>
            <div className="border rounded-md overflow-hidden">
              {!selectedDomain ? (
                <p className="p-4 text-center text-muted-foreground">Chọn domain để xem file.</p>
              ) : loadingFiles ? (
                <p className="p-4 text-center text-muted-foreground">Đang tải files...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Tên</TableHead>
                      <TableHead>Kích thước</TableHead>
                      <TableHead>Ngày sửa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Không có file
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFiles.map((f) => (
                        <TableRow key={f.name}>
                          <TableCell className="w-10">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell className="font-medium break-all">{f.name}</TableCell>
                          <TableCell>{formatSize(f.size)}</TableCell>
                          <TableCell>{formatMtime(f.mtime)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
