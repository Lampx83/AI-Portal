"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, Loader2, Pencil, Trash2, Download, Upload, BarChart3, FileText, FileType } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  listSurveys,
  getSurvey,
  deleteSurvey,
  exportSurvey,
  exportSurveyDocx,
  exportSurveyTxt,
  importSurvey,
  type SurveyListItem,
  type SurveyFull,
} from "@/lib/api/surveys"
import { SurveyEditor } from "./SurveyEditor"
import { SurveyResponses } from "./SurveyResponses"

function fmt(s: string | null) {
  return s ? new Date(s).toLocaleString("vi-VN") : "—"
}

export function SurveysTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<SurveyListItem[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<SurveyFull | null>(null)
  const [responsesFor, setResponsesFor] = useState<SurveyFull | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await listSurveys()
      setItems(r.data)
    } catch (e: any) {
      toast({ title: "Tải khảo sát thất bại", description: e?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const openEdit = async (id: string) => {
    try {
      const r = await getSurvey(id)
      setEditing(r.survey)
      setEditorOpen(true)
    } catch (e: any) {
      toast({ title: "Không tải được khảo sát", description: e?.message, variant: "destructive" })
    }
  }

  const openResponses = async (id: string) => {
    try {
      const r = await getSurvey(id)
      setResponsesFor(r.survey)
    } catch (e: any) {
      toast({ title: "Không tải được khảo sát", description: e?.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteSurvey(id)
      toast({ title: "Đã xoá khảo sát" })
      load()
    } catch (e: any) {
      toast({ title: "Xoá thất bại", description: e?.message, variant: "destructive" })
    }
  }

  const handleExport = async (s: SurveyListItem) => {
    try {
      const blob = await exportSurvey(s.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `survey-${s.slug}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: "Export thất bại", description: e?.message, variant: "destructive" })
    }
  }

  const handleExportDocx = async (s: SurveyListItem) => {
    try {
      const blob = await exportSurveyDocx(s.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `phieu-${s.slug}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: "Xuất Word thất bại", description: e?.message, variant: "destructive" })
    }
  }

  const handleExportTxt = async (s: SurveyListItem) => {
    try {
      const blob = await exportSurveyTxt(s.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `phieu-${s.slug}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: "Xuất text thất bại", description: e?.message, variant: "destructive" })
    }
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await importSurvey(json)
      toast({ title: "Đã import khảo sát" })
      load()
    } catch (err: any) {
      toast({ title: "Import thất bại", description: err?.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Khảo sát popup</h2>
          <p className="text-sm text-muted-foreground">
            Cấu hình popup khảo sát hiển thị cho người dùng (kể cả khách chưa đăng nhập).
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFile}
          />
          <Button variant="outline" onClick={handleImportClick} className="gap-1">
            <Upload className="h-4 w-4" /> Import JSON
          </Button>
          <Button onClick={openCreate} className="gap-1">
            <Plus className="h-4 w-4" /> Tạo khảo sát
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          Chưa có khảo sát nào. Bấm "Tạo khảo sát" để bắt đầu.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-center">Câu hỏi</TableHead>
              <TableHead className="text-center">Trả lời</TableHead>
              <TableHead>Cập nhật</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  {s.description && (
                    <div className="text-xs text-muted-foreground line-clamp-1">{s.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono">{s.slug}</TableCell>
                <TableCell>
                  {s.is_active ? (
                    <Badge>Đang chạy</Badge>
                  ) : (
                    <Badge variant="secondary">Tắt</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">{s.question_count}</TableCell>
                <TableCell className="text-center">{s.response_count}</TableCell>
                <TableCell className="text-xs">{fmt(s.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" title="Xem kết quả" onClick={() => openResponses(s.id)}>
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Xuất phiếu Word (.docx) để in/gửi"
                      onClick={() => handleExportDocx(s)}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Xuất phiếu Text (.txt) để paste vào email/chat"
                      onClick={() => handleExportTxt(s)}
                    >
                      <FileType className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Export JSON (để import lại)"
                      onClick={() => handleExport(s)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Sửa" onClick={() => openEdit(s.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Xoá">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xoá khảo sát "{s.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Toàn bộ câu hỏi và {s.response_count} câu trả lời sẽ bị xoá.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Huỷ</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)}>Xoá</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SurveyEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editing}
        onSaved={load}
      />
      {responsesFor && (
        <SurveyResponses
          open={!!responsesFor}
          onClose={() => setResponsesFor(null)}
          survey={responsesFor}
        />
      )}
    </div>
  )
}
