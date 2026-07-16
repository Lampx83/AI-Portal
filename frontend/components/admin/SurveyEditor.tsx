"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import {
  createSurvey,
  updateSurvey,
  type SurveyFull,
  type SurveyInput,
  type SurveyQuestion,
  type SurveyQuestionType,
  type SurveyDisplayConfig,
} from "@/lib/api/surveys"

function makeId(prefix = "opt") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_DC: SurveyDisplayConfig = {
  audience: "all",
  trigger: { type: "after_seconds", value: 5 },
  position: "center",
  frequency: { type: "once", value: 0 },
  reask_days: 15,
  dismissible: true,
  max_dismissals: 3,
  cooldown_days_after_dismiss: 7,
  pages_include: [],
  pages_exclude: [],
}

function emptyQuestion(type: SurveyQuestionType = "single_choice"): SurveyQuestion {
  return {
    type,
    title: "",
    description: "",
    is_required: true,
    options:
      type === "text"
        ? []
        : [
            { id: makeId(), label: "", allow_text: false },
            { id: makeId(), label: "", allow_text: false },
          ],
  }
}

function toInput(s: SurveyFull | null): SurveyInput {
  if (!s) {
    return {
      slug: "",
      name: "",
      description: "",
      is_active: false,
      priority: 0,
      start_at: null,
      end_at: null,
      thank_you_message: "",
      display_config: DEFAULT_DC,
      questions: [emptyQuestion()],
    }
  }
  return {
    slug: s.slug,
    name: s.name,
    description: s.description ?? "",
    is_active: s.is_active,
    priority: s.priority,
    start_at: s.start_at,
    end_at: s.end_at,
    thank_you_message: s.thank_you_message ?? "",
    display_config: { ...DEFAULT_DC, ...s.display_config },
    questions: s.questions.map((q) => ({
      id: q.id,
      type: q.type || "single_choice",
      title: q.title,
      description: q.description ?? "",
      is_required: q.is_required,
      options: q.options.map((o) => ({ id: o.id, label: o.label, allow_text: !!o.allow_text })),
    })),
  }
}

interface Props {
  open: boolean
  onClose: () => void
  initial: SurveyFull | null
  onSaved: () => void
}

export function SurveyEditor({ open, onClose, initial, onSaved }: Props) {
  if (typeof window !== "undefined") console.log("[SurveyEditor v2] dropdown type-picker enabled")
  const { toast } = useToast()
  const [form, setForm] = useState<SurveyInput>(() => toInput(initial))
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("general")
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(toInput(initial))
      setTab("general")
    }
  }, [open, initial])

  // Phát hiện thay đổi có thể làm mất / sai lệch dữ liệu trả lời cũ.
  // Mỗi câu hỏi/phương án có id ổn định; nếu admin xoá hoặc đổi loại, các answer cũ
  // chiếu đến id đó sẽ không còn map được vào option mới → mất label trong thống kê.
  const destructiveChanges = useMemo<string[]>(() => {
    if (!initial) return []
    const out: string[] = []
    const formQById = new Map(form.questions.filter((q) => q.id).map((q) => [q.id as string, q]))
    for (const oq of initial.questions) {
      const nq = formQById.get(oq.id)
      if (!nq) {
        out.push(`Xoá câu hỏi: "${oq.title}"`)
        continue
      }
      if ((nq.type || "single_choice") !== (oq.type || "single_choice")) {
        out.push(`Đổi loại câu hỏi: "${oq.title}" (${oq.type} → ${nq.type})`)
      }
      if (oq.type !== "text") {
        const newOptIds = new Set(nq.options.map((o) => o.id))
        for (const oo of oq.options) {
          if (!newOptIds.has(oo.id)) {
            out.push(`Xoá phương án: "${oo.label}" trong câu "${oq.title}"`)
          }
        }
      }
    }
    return out
  }, [initial, form.questions])

  const update = (patch: Partial<SurveyInput>) => setForm((f) => ({ ...f, ...patch }))
  const updateDC = (patch: Partial<SurveyDisplayConfig>) =>
    setForm((f) => ({ ...f, display_config: { ...DEFAULT_DC, ...f.display_config, ...patch } }))

  const updateQuestion = (idx: number, patch: Partial<SurveyQuestion>) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }))
  }
  const addQuestion = () => setForm((f) => ({ ...f, questions: [...f.questions, emptyQuestion()] }))
  const removeQuestion = (idx: number) =>
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }))
  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setForm((f) => {
      const next = [...f.questions]
      const j = idx + dir
      if (j < 0 || j >= next.length) return f
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return { ...f, questions: next }
    })
  }

  const updateOption = (qIdx: number, oIdx: number, patch: Partial<{ label: string; allow_text: boolean }>) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)) }
          : q
      ),
    }))
  }
  const addOption = (qIdx: number) =>
    updateQuestion(qIdx, {
      options: [...form.questions[qIdx].options, { id: makeId(), label: "", allow_text: false }],
    })
  const removeOption = (qIdx: number, oIdx: number) =>
    updateQuestion(qIdx, { options: form.questions[qIdx].options.filter((_, j) => j !== oIdx) })

  const changeQuestionType = (qIdx: number, type: SurveyQuestionType) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => {
        if (i !== qIdx) return q
        if (type === "text") return { ...q, type, options: [] }
        return {
          ...q,
          type,
          options: q.options.length >= 2 ? q.options : [
            { id: makeId(), label: "", allow_text: false },
            { id: makeId(), label: "", allow_text: false },
          ],
        }
      }),
    }))
  }

  const validateForm = (): boolean => {
    if (!form.slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(form.slug)) {
      toast({ title: "Slug không hợp lệ", description: "Chỉ dùng a-z, 0-9, dấu gạch ngang.", variant: "destructive" })
      setTab("general")
      return false
    }
    if (!form.name.trim()) {
      toast({ title: "Thiếu tên khảo sát", variant: "destructive" })
      setTab("general")
      return false
    }
    if (form.questions.length === 0) {
      toast({ title: "Cần ít nhất 1 câu hỏi", variant: "destructive" })
      setTab("questions")
      return false
    }
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i]
      if (!q.title.trim()) {
        toast({ title: `Câu ${i + 1} thiếu tiêu đề`, variant: "destructive" })
        setTab("questions")
        return false
      }
      if (q.type === "single_choice" || q.type === "multi_choice") {
        const filled = q.options.filter((o) => o.label.trim())
        if (filled.length < 2) {
          toast({ title: `Câu ${i + 1} cần ít nhất 2 lựa chọn`, variant: "destructive" })
          setTab("questions")
          return false
        }
      }
    }
    return true
  }

  const handleSaveClick = () => {
    if (!validateForm()) return
    if (destructiveChanges.length > 0) {
      setConfirmOpen(true)
      return
    }
    void doSave()
  }

  const doSave = async () => {
    const payload: SurveyInput = {
      ...form,
      description: form.description?.toString().trim() || null,
      thank_you_message: form.thank_you_message?.toString().trim() || null,
      questions: form.questions.map((q, i) => ({
        ...q,
        id: q.id,
        title: q.title.trim(),
        description: q.description?.toString().trim() || null,
        order_index: i,
        options:
          q.type === "text"
            ? []
            : q.options
                .filter((o) => o.label.trim())
                .map((o) => ({ id: o.id, label: o.label.trim(), allow_text: !!o.allow_text })),
      })),
    }
    setSaving(true)
    try {
      if (initial) await updateSurvey(initial.id, payload)
      else await createSurvey(payload)
      toast({ title: initial ? "Đã cập nhật khảo sát" : "Đã tạo khảo sát" })
      onSaved()
      onClose()
    } catch (e: any) {
      toast({ title: "Lưu thất bại", description: e?.message || String(e), variant: "destructive" })
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  const dc = form.display_config || DEFAULT_DC

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{initial ? "Chỉnh sửa khảo sát" : "Tạo khảo sát mới"}</DialogTitle>
          <DialogDescription>
            Khảo sát single-choice, hiển thị popup theo cấu hình.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="general">Thông tin chung</TabsTrigger>
            <TabsTrigger value="questions">Câu hỏi ({form.questions.length})</TabsTrigger>
            <TabsTrigger value="display">Hiển thị & tần suất</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-auto pt-3 pr-1">
            <TabsContent value="general" className="space-y-3 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Slug (mã định danh)</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => update({ slug: e.target.value.toLowerCase() })}
                    placeholder="vd: feedback-q4-2026"
                  />
                </div>
                <div>
                  <Label>Tên khảo sát</Label>
                  <Input value={form.name} onChange={(e) => update({ name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Mô tả ngắn (hiển thị trong popup)</Label>
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => update({ description: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label>Lời cảm ơn sau khi gửi</Label>
                <Textarea
                  value={form.thank_you_message ?? ""}
                  onChange={(e) => update({ thank_you_message: e.target.value })}
                  rows={2}
                  placeholder="Cảm ơn bạn đã tham gia khảo sát!"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Bắt đầu (tuỳ chọn)</Label>
                  <Input
                    type="datetime-local"
                    value={form.start_at ? form.start_at.slice(0, 16) : ""}
                    onChange={(e) => update({ start_at: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>Kết thúc (tuỳ chọn)</Label>
                  <Input
                    type="datetime-local"
                    value={form.end_at ? form.end_at.slice(0, 16) : ""}
                    onChange={(e) => update({ end_at: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>Mức ưu tiên</Label>
                  <Input
                    type="number"
                    value={form.priority ?? 0}
                    onChange={(e) => update({ priority: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={!!form.is_active}
                  onCheckedChange={(v) => update({ is_active: v })}
                />
                <Label>Kích hoạt khảo sát</Label>
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-3 mt-0">
              {initial && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 text-sm">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="space-y-1">
                      <div className="font-medium text-amber-900 dark:text-amber-100">
                        Lưu ý khi sửa câu hỏi
                      </div>
                      <div className="text-amber-800 dark:text-amber-200">
                        Nếu khảo sát đã có người trả lời, việc <b>xoá câu hỏi</b>, <b>xoá phương án</b> hoặc <b>đổi loại câu hỏi</b> sẽ khiến các câu trả lời cũ liên quan
                        không còn hiển thị được trong phần thống kê (dữ liệu gốc vẫn được lưu trong DB nhưng không hiển thị label tương ứng).
                        Đổi <i>tên câu hỏi</i> hoặc <i>tên phương án</i> (giữ nguyên ID) thì an toàn — thống kê cũ vẫn đúng.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {form.questions.map((q, qi) => (
                <div key={qi} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Câu {qi + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => moveQuestion(qi, -1)} disabled={qi === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => moveQuestion(qi, 1)}
                        disabled={qi === form.questions.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeQuestion(qi)}
                        disabled={form.questions.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      value={q.title}
                      onChange={(e) => updateQuestion(qi, { title: e.target.value })}
                      placeholder="Tiêu đề câu hỏi"
                    />
                    <Select
                      value={q.type || "single_choice"}
                      onValueChange={(v) => changeQuestionType(qi, v as SurveyQuestionType)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_choice">Chọn 1 phương án</SelectItem>
                        <SelectItem value="multi_choice">Chọn nhiều phương án</SelectItem>
                        <SelectItem value="text">Câu trả lời tự do</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={q.description ?? ""}
                    onChange={(e) => updateQuestion(qi, { description: e.target.value })}
                    placeholder="Mô tả thêm (tuỳ chọn)"
                    rows={1}
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={q.is_required}
                      onCheckedChange={(v) => updateQuestion(qi, { is_required: v })}
                    />
                    <Label className="text-sm">Bắt buộc trả lời</Label>
                  </div>
                  {(q.type === "single_choice" || q.type === "multi_choice") && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs text-muted-foreground">
                        {q.type === "multi_choice"
                          ? "Lựa chọn (chọn nhiều) — bật \"Cho phép gõ thêm\" để hiển thị ô nhập (vd \"Khác\")"
                          : "Lựa chọn (chọn 1) — bật \"Cho phép gõ thêm\" để hiển thị ô nhập (vd \"Khác\")"}
                      </Label>
                      {q.options.map((opt, oi) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <Input
                            value={opt.label}
                            onChange={(e) => updateOption(qi, oi, { label: e.target.value })}
                            placeholder={`Lựa chọn ${oi + 1}`}
                          />
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                            <Checkbox
                              checked={!!opt.allow_text}
                              onCheckedChange={(v) => updateOption(qi, oi, { allow_text: !!v })}
                            />
                            Cho phép gõ thêm
                          </label>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeOption(qi, oi)}
                            disabled={q.options.length <= 2}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => addOption(qi)} className="gap-1">
                        <Plus className="h-3 w-3" /> Thêm lựa chọn
                      </Button>
                    </div>
                  )}
                  {q.type === "text" && (
                    <div className="text-xs text-muted-foreground italic pt-1">
                      Người dùng sẽ gõ câu trả lời tự do (textarea). Không có phương án.
                    </div>
                  )}
                </div>
              ))}
              <Button onClick={addQuestion} variant="outline" className="gap-1">
                <Plus className="h-4 w-4" /> Thêm câu hỏi
              </Button>
            </TabsContent>

            <TabsContent value="display" className="space-y-3 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Đối tượng</Label>
                  <Select
                    value={dc.audience ?? "all"}
                    onValueChange={(v: any) => updateDC({ audience: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả (kể cả khách)</SelectItem>
                      <SelectItem value="logged_in">Chỉ người đã đăng nhập</SelectItem>
                      <SelectItem value="guest">Chỉ khách (chưa đăng nhập)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vị trí popup</Label>
                  <Select
                    value={dc.position ?? "center"}
                    onValueChange={(v: any) => updateDC({ position: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="center">Giữa màn hình (modal)</SelectItem>
                      <SelectItem value="bottom_right">Góc phải dưới</SelectItem>
                      <SelectItem value="bottom_bar">Thanh dưới (full)</SelectItem>
                      <SelectItem value="top_bar">Thanh trên (full)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kích hoạt khi</Label>
                  <Select
                    value={dc.trigger?.type ?? "after_seconds"}
                    onValueChange={(v: any) => updateDC({ trigger: { type: v, value: dc.trigger?.value ?? 5 } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_load">Ngay khi tải trang</SelectItem>
                      <SelectItem value="after_seconds">Sau N giây</SelectItem>
                      <SelectItem value="after_n_visits">Sau N lượt truy cập</SelectItem>
                      <SelectItem value="on_exit_intent">Khi định rời trang (exit intent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Giá trị (giây / lượt)</Label>
                  <Input
                    type="number"
                    value={dc.trigger?.value ?? 0}
                    onChange={(e) =>
                      updateDC({ trigger: { type: dc.trigger?.type ?? "after_seconds", value: Number(e.target.value) || 0 } })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tần suất hiển thị</Label>
                  <Select
                    value={dc.frequency?.type ?? "once"}
                    onValueChange={(v: any) =>
                      updateDC({ frequency: { type: v, value: dc.frequency?.value ?? 0 } })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Chỉ 1 lần (kể cả khi đóng)</SelectItem>
                      <SelectItem value="once_per_n_days">Mỗi N ngày 1 lần</SelectItem>
                      <SelectItem value="until_answered">Hỏi tới khi trả lời</SelectItem>
                      <SelectItem value="every_session">Mỗi phiên truy cập</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Số ngày (cho "mỗi N ngày")</Label>
                  <Input
                    type="number"
                    value={dc.frequency?.value ?? 0}
                    onChange={(e) =>
                      updateDC({ frequency: { type: dc.frequency?.type ?? "once", value: Number(e.target.value) || 0 } })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hỏi lại sau (ngày)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={dc.reask_days ?? 15}
                    onChange={(e) => updateDC({ reask_days: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Sau khi trả lời, hỏi lại người dùng sau số ngày này (mặc định 15). Đặt 0 để không hỏi lại.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={dc.dismissible !== false}
                    onCheckedChange={(v) => updateDC({ dismissible: v })}
                  />
                  <Label className="text-sm">Cho phép đóng</Label>
                </div>
                <div>
                  <Label>Số lần đóng tối đa</Label>
                  <Input
                    type="number"
                    value={dc.max_dismissals ?? 3}
                    onChange={(e) => updateDC({ max_dismissals: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Cooldown sau khi đóng (ngày)</Label>
                  <Input
                    type="number"
                    value={dc.cooldown_days_after_dismiss ?? 0}
                    onChange={(e) => updateDC({ cooldown_days_after_dismiss: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label>Chỉ hiển thị tại các URL chứa (mỗi dòng 1 mẫu, để trống = mọi trang)</Label>
                <Textarea
                  value={(dc.pages_include ?? []).join("\n")}
                  onChange={(e) =>
                    updateDC({
                      pages_include: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  rows={2}
                  placeholder="/chat\n/welcome"
                />
              </div>
              <div>
                <Label>Loại trừ các URL chứa</Label>
                <Textarea
                  value={(dc.pages_exclude ?? []).join("\n")}
                  onChange={(e) =>
                    updateDC({
                      pages_exclude: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  rows={2}
                  placeholder="/admin\n/login"
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button onClick={handleSaveClick} disabled={saving} className="gap-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {initial ? "Lưu thay đổi" : "Tạo khảo sát"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !saving && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Xác nhận thay đổi có thể ảnh hưởng thống kê
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  Bạn đang thực hiện các thay đổi sau đối với khảo sát đã có dữ liệu trả lời:
                </div>
                <ul className="list-disc pl-5 space-y-1 text-sm max-h-48 overflow-auto">
                  {destructiveChanges.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
                <div className="text-sm">
                  Các câu trả lời cũ liên quan sẽ vẫn được lưu trong DB nhưng <b>không còn hiển thị nhãn</b> ở phần
                  thống kê và xuất CSV (số người trả lời vẫn đếm đúng). Bạn có chắc muốn tiếp tục?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Quay lại chỉnh sửa</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void doSave()
              }}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Tôi hiểu, vẫn lưu"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
