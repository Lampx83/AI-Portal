"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getCategories, postCategory, patchCategory, deleteCategory, type CategoryRow } from "@/lib/api/admin"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
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

export function CategoriesTab() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ slug: "", name: "", display_order: 0 })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    getCategories()
      .then((d) => setCategories(d.categories ?? []))
      .catch((e) => setError((e as Error)?.message ?? t("admin.categories.loadError")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditId(null)
    setForm({ slug: "", name: "", display_order: categories.length })
    setModalOpen(true)
  }

  const openEdit = (row: CategoryRow) => {
    setEditId(row.id)
    setForm({ slug: row.slug, name: row.name, display_order: row.display_order })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const slug = form.slug.trim().toLowerCase().replace(/\s+/g, "-")
    const name = form.name.trim()
    if (!slug || !name) {
      toast({ title: t("admin.categories.slugNameRequired"), variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (editId) {
        await patchCategory(editId, { slug, name, display_order: form.display_order })
        toast({ title: t("admin.categories.updated") })
      } else {
        await postCategory({ slug, name, display_order: form.display_order })
        toast({ title: t("admin.categories.created") })
      }
      setModalOpen(false)
      load()
    } catch (e) {
      toast({
        title: (e as Error)?.message ?? t("admin.categories.saveError"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteCategory(deleteId)
      toast({ title: t("admin.categories.deleted") })
      setDeleteId(null)
      load()
    } catch (e) {
      toast({
        title: (e as Error)?.message ?? t("admin.categories.deleteError"),
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={load}>
          {t("common.retry")}
        </Button>
      </div>
    )
  }

  const sorted = [...categories].sort((a, b) => a.display_order - b.display_order || a.slug.localeCompare(b.slug))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("admin.categories.description")}
        </p>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("admin.categories.add")}
        </Button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.categories.slug")}</TableHead>
              <TableHead>{t("admin.categories.name")}</TableHead>
              <TableHead className="w-24">{t("admin.categories.order")}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {t("admin.categories.empty")}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">{row.slug}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.display_order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? t("admin.categories.editTitle") : t("admin.categories.createTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t("admin.categories.slug")}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="e.g. productivity"
                className="font-mono mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("admin.categories.slugHint")}</p>
            </div>
            <div>
              <Label>{t("admin.categories.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Productivity"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("admin.categories.order")}</Label>
              <Input
                type="number"
                min={0}
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) || 0 }))}
                className="mt-1 w-24"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.categories.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.categories.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                {deleting ? t("common.deleting") : t("common.delete")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
