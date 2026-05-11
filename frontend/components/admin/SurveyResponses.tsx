"use client"

import { useEffect, useState } from "react"
import { Loader2, Download, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  getSurveyResponses,
  exportSurveyResponses,
  clearSurveyResponses,
  type SurveyFull,
  type SurveyResponseRow,
  type SurveyStats,
} from "@/lib/api/surveys"

interface Props {
  open: boolean
  onClose: () => void
  survey: SurveyFull
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("vi-VN")
}

export function SurveyResponses({ open, onClose, survey }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SurveyResponseRow[]>([])
  const [stats, setStats] = useState<SurveyStats>([])
  const [total, setTotal] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const r = await getSurveyResponses(survey.id, { limit: 200 })
      setRows(r.data)
      setStats(r.stats)
      setTotal(r.page.total)
    } catch (e: any) {
      toast({ title: "Tải dữ liệu thất bại", description: e?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, survey.id])

  const handleExport = async () => {
    try {
      const blob = await exportSurveyResponses(survey.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `survey-${survey.slug}-responses.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: "Export thất bại", description: e?.message, variant: "destructive" })
    }
  }

  const handleClear = async () => {
    try {
      await clearSurveyResponses(survey.id)
      toast({ title: "Đã xoá toàn bộ câu trả lời" })
      load()
    } catch (e: any) {
      toast({ title: "Xoá thất bại", description: e?.message, variant: "destructive" })
    }
  }

  const renderAnswer = (qid: string, ans: any) => {
    const q = survey.questions.find((x) => x.id === qid)
    if (!q) return "—"
    if (q.type === "text") {
      const text = ans?.text
      return text ? <span className="whitespace-pre-wrap">{text}</span> : <span className="text-muted-foreground">—</span>
    }
    if (!ans?.option) return <span className="text-muted-foreground">—</span>
    const opt = q.options.find((o) => o.id === ans.option)
    const label = opt?.label ?? ans.option
    return (
      <span>
        {label}
        {ans?.text && <span className="text-muted-foreground"> — {ans.text}</span>}
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Kết quả: {survey.name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">Tổng số trả lời: <strong>{total}</strong></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-destructive">
                  <Trash2 className="h-4 w-4" /> Xoá tất cả
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Xoá toàn bộ câu trả lời?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Toàn bộ {total} câu trả lời và lịch sử hiển thị sẽ bị xoá. Không thể khôi phục.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Huỷ</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClear}>Xoá</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs defaultValue="stats" className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <TabsList>
            <TabsTrigger value="stats">Thống kê</TabsTrigger>
            <TabsTrigger value="rows">Chi tiết ({rows.length})</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-auto pt-3">
            <TabsContent value="stats" className="space-y-4 mt-0">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                </div>
              ) : stats.length === 0 ? (
                <div className="text-sm text-muted-foreground">Chưa có dữ liệu.</div>
              ) : (
                stats.map((s) => (
                  <div key={s.question_id} className="rounded-lg border p-3">
                    <div className="font-medium mb-1">{s.title}</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {s.total_answers} câu trả lời
                      {s.type === "text" && " (câu hỏi tự do)"}
                    </div>
                    {s.type === "text" ? (
                      <div className="space-y-1">
                        {(s.text_samples ?? []).length === 0 ? (
                          <div className="text-sm text-muted-foreground italic">Chưa có câu trả lời.</div>
                        ) : (
                          (s.text_samples ?? []).map((t, i) => (
                            <div key={i} className="text-sm rounded bg-muted/50 p-2 whitespace-pre-wrap">
                              {t}
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {s.options.map((opt) => (
                          <div key={opt.id}>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="flex-1 truncate">{opt.label}</div>
                              <div className="w-32 h-2 bg-muted rounded overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${opt.percent}%` }}
                                />
                              </div>
                              <div className="w-20 text-right tabular-nums text-muted-foreground">
                                {opt.count} ({opt.percent}%)
                              </div>
                            </div>
                            {opt.allow_text && (opt.text_samples?.length ?? 0) > 0 && (
                              <div className="ml-4 mt-1 space-y-1">
                                {opt.text_samples!.map((t, i) => (
                                  <div key={i} className="text-xs rounded bg-muted/50 p-1.5 whitespace-pre-wrap">
                                    “{t}”
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="rows" className="mt-0">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                </div>
              ) : rows.length === 0 ? (
                <div className="text-sm text-muted-foreground">Chưa có câu trả lời.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Người trả lời</TableHead>
                      {survey.questions.map((q) => (
                        <TableHead key={q.id}>{q.title}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{fmtDate(r.submitted_at)}</TableCell>
                        <TableCell className="text-xs">
                          {r.user_email ? (
                            <span>{r.user_display_name || r.user_email}</span>
                          ) : (
                            <span className="text-muted-foreground">Khách ({r.guest_device_id?.slice(0, 8)}…)</span>
                          )}
                        </TableCell>
                        {survey.questions.map((q) => (
                          <TableCell key={q.id} className="text-sm">
                            {renderAnswer(q.id, r.answers?.[q.id])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
