"use client"

import { useEffect, useState } from "react"
import { Upload, FolderOpen, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export function RAGDocumentsTab() {
  const { toast } = useToast()
  const [domains, setDomains] = useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>("")
  const [files, setFiles] = useState<{ name: string; size: number; mtime?: number }[]>([])
  const [loadingDomains, setLoadingDomains] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [uploadDomain, setUploadDomain] = useState("")
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)

  const loadDomains = () => {
    setLoadingDomains(true)
    getDatalakeInboxDomains()
      .then((d) => {
        setDomains(d.domains || [])
        if (selectedDomain === "" && (d.domains?.length ?? 0) > 0) {
          setSelectedDomain(d.domains![0])
        }
      })
      .catch(() => setDomains([]))
      .finally(() => setLoadingDomains(false))
  }

  const loadFiles = (domain: string) => {
    if (!domain) {
      setFiles([])
      return
    }
    setLoadingFiles(true)
    getDatalakeInboxList(domain)
      .then((d) => setFiles(d.files || []))
      .catch(() => setFiles([]))
      .finally(() => setLoadingFiles(false))
  }

  useEffect(() => {
    loadDomains()
  }, [])

  useEffect(() => {
    if (selectedDomain) loadFiles(selectedDomain)
    else setFiles([])
  }, [selectedDomain])

  const handleUpload = async () => {
    const domain = uploadDomain.trim()
    if (!domain) {
      toast({ title: "Chưa nhập domain", variant: "destructive" })
      return
    }
    if (!uploadFiles || uploadFiles.length === 0) {
      toast({ title: "Chưa chọn file", variant: "destructive" })
      return
    }
    const list = Array.from(uploadFiles)
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
    setUploading(true)
    try {
      const result = await uploadDatalakeInbox(domain, list)
      const ok = result.uploaded?.length ?? 0
      const err = result.errors?.length ?? 0
      if (ok > 0) {
        toast({ title: `Đã tải lên ${ok} file vào 000_inbox/${domain}` })
        setUploadFiles(null)
        loadDomains()
        if (selectedDomain === domain) loadFiles(domain)
      }
      if (err > 0) {
        toast({
          title: `Có ${err} lỗi`,
          description: result.errors?.slice(0, 3).join("; "),
          variant: "destructive",
        })
      }
    } catch (e) {
      toast({
        title: "Lỗi tải lên",
        description: (e as Error)?.message,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload tài liệu vào Data Lake (000_inbox)
          </CardTitle>
          <CardDescription>
            File sẽ được lưu vào thư mục 000_inbox/&lt;domain&gt;. Sau đó cần chạy pipeline Datalake (Step 0 → 4) để đưa vào Vector DB và dùng cho RAG.
            Chỉ chấp nhận: {ALLOWED_EXT.join(", ")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="upload-domain">Domain (thư mục con dưới 000_inbox)</Label>
            <Input
              id="upload-domain"
              placeholder="vd: quy_dinh, syllabus, tai_lieu"
              value={uploadDomain}
              onChange={(e) => setUploadDomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Chỉ dùng chữ cái, số, gạch dưới và gạch ngang.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="upload-files">Chọn file</Label>
            <Input
              id="upload-files"
              type="file"
              multiple
              accept={ALLOWED_EXT.join(",")}
              onChange={(e) => setUploadFiles(e.target.files)}
            />
          </div>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tải lên…
              </>
            ) : (
              "Tải lên"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Danh sách file trong inbox
          </CardTitle>
          <CardDescription>
            Chọn domain để xem file đã có trong 000_inbox (sẵn sàng cho pipeline).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="shrink-0">Domain:</Label>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              disabled={loadingDomains}
            >
              <option value="">-- Chọn domain --</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadDomains()
                if (selectedDomain) loadFiles(selectedDomain)
              }}
            >
              Làm mới
            </Button>
          </div>

          {loadingFiles ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải…
            </div>
          ) : selectedDomain ? (
            files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có file nào trong 000_inbox/{selectedDomain}.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Tên file</TableHead>
                    <TableHead className="text-right">Kích thước</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => (
                    <TableRow key={f.name}>
                      <TableCell>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatSize(f.size)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
