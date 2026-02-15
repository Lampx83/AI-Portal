"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getShortcuts, postShortcut, patchShortcut, deleteShortcut, type ShortcutRow } from "@/lib/api/admin"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react"

const ICON_OPTIONS = [
  { value: "ExternalLink", label: "Link" },
  { value: "Globe", label: "Globe" },
  { value: "BookOpen", label: "Sách" },
  { value: "FileText", label: "File" },
  { value: "BarChart", label: "Biểu đồ" },
  { value: "Eye", label: "Xem" },
  { value: "Users2", label: "Users" },
]

export function ShortcutsTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<ShortcutRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", url: "", description: "", icon: "ExternalLink", display_order: 0 })

  const load = () => {
    setLoading(true)
    getShortcuts()
      .then((d) => setList(d.shortcuts ?? []))
      .catch(() => toast({ title: "Lỗi", description: "Không tải được danh sách shortcuts", variant: "destructive" }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: "", url: "", description: "", icon: "ExternalLink", display_order: list.length })
    setDialogOpen(true)
  }

  const openEdit = (row: ShortcutRow) => {
    setEditingId(row.id)
    setForm({
      name: row.name,
      url: row.url,
      description: row.description ?? "",
      icon: row.icon || "ExternalLink",
      display_order: row.display_order ?? 0,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast({ title: "Lỗi", description: "Tên và URL là bắt buộc", variant: "destructive" })
      return
    }
    if (!form.url.startsWith("http://") && !form.url.startsWith("https://")) {
      toast({ title: "Lỗi", description: "URL phải bắt đầu bằng http:// hoặc https://", variant: "destructive" })
      return
    }
    if (editingId) {
      patchShortcut(editingId, {
        name: form.name.trim(),
        url: form.url.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon,
        display_order: form.display_order,
      })
        .then(() => {
          toast({ title: "Đã cập nhật shortcut" })
          setDialogOpen(false)
          load()
        })
        .catch((e) => toast({ title: "Lỗi", description: (e as Error)?.message, variant: "destructive" }))
    } else {
      postShortcut({
        name: form.name.trim(),
        url: form.url.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon,
        display_order: form.display_order,
      })
        .then(() => {
          toast({ title: "Đã thêm shortcut" })
          setDialogOpen(false)
          load()
        })
        .catch((e) => toast({ title: "Lỗi", description: (e as Error)?.message, variant: "destructive" }))
    }
  }

  const handleDelete = (id: string) => {
    if (!confirm("Xóa shortcut này?")) return
    deleteShortcut(id)
      .then(() => {
        toast({ title: "Đã xóa shortcut" })
        load()
      })
      .catch((e) => toast({ title: "Lỗi", description: (e as Error)?.message, variant: "destructive" }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Shortcuts là các link công cụ trực tuyến hiển thị trong dialog &quot;Trợ lý&quot;. Chỉ mở link, hệ thống không quản lý.
        </p>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Thêm shortcut
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có shortcut. Bấm &quot;Thêm shortcut&quot; để thêm link công cụ trực tuyến.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thứ tự</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Icon</TableHead>
              <TableHead className="w-[100px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.display_order}</TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 truncate max-w-[200px]"
                  >
                    {row.url}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </TableCell>
                <TableCell>{row.icon}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Sửa">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)} title="Xóa">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa shortcut" : "Thêm shortcut"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tên</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="VD: Semantic Scholar"
              />
            </div>
            <div className="grid gap-2">
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Mô tả (tùy chọn)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả ngắn"
              />
            </div>
            <div className="grid gap-2">
              <Label>Icon</Label>
              <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Thứ tự hiển thị</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit}>{editingId ? "Cập nhật" : "Thêm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
