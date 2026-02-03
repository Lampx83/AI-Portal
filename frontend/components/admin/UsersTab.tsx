"use client"

import { useEffect, useState } from "react"
import { Pencil, Trash2, UserPlus } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getUsers, patchUser, postUser, deleteUser, type UserRow } from "@/lib/api/admin"

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

export function UsersTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"add" | "edit">("add")
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm] = useState({ email: "", display_name: "", full_name: "", password: "" })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    getUsers()
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e?.message || "Lỗi tải users"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const onToggleAdmin = async (userId: string, checked: boolean) => {
    const prev = users.find((u) => u.id === userId)?.is_admin ?? false
    try {
      await patchUser(userId, { is_admin: checked })
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? { ...u, is_admin: checked } : u))
      )
    } catch (e) {
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? { ...u, is_admin: prev } : u))
      )
      alert((e as Error)?.message || "Lỗi cập nhật")
    }
  }

  const openAdd = () => {
    setModalMode("add")
    setEditingUser(null)
    setForm({ email: "", display_name: "", full_name: "", password: "" })
    setModalOpen(true)
  }

  const openEdit = (u: UserRow) => {
    setModalMode("edit")
    setEditingUser(u)
    setForm({ email: u.email, display_name: u.display_name ?? "", full_name: u.full_name ?? "", password: "" })
    setModalOpen(true)
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (modalMode === "add") {
      if (!form.email.trim()) {
        alert("Email là bắt buộc")
        return
      }
      if (!form.password || form.password.length < 6) {
        alert("Mật khẩu bắt buộc, tối thiểu 6 ký tự")
        return
      }
      setSaving(true)
      try {
        await postUser({
          email: form.email.trim(),
          display_name: form.display_name.trim() || undefined,
          full_name: form.full_name.trim() || undefined,
          password: form.password,
        })
        setModalOpen(false)
        load()
        alert("Đã thêm user")
      } catch (e) {
        alert((e as Error)?.message || "Lỗi thêm user")
      } finally {
        setSaving(false)
      }
    } else if (editingUser) {
      setSaving(true)
      try {
        const body: { display_name?: string; full_name?: string; is_admin?: boolean; password?: string } = {
          display_name: form.display_name.trim() || undefined,
          full_name: form.full_name.trim() || undefined,
          is_admin: editingUser.is_admin,
        }
        if (form.password && form.password.length >= 6) body.password = form.password
        await patchUser(editingUser.id, body)
        setModalOpen(false)
        load()
        alert("Đã cập nhật user")
      } catch (e) {
        alert((e as Error)?.message || "Lỗi cập nhật")
      } finally {
        setSaving(false)
      }
    }
  }

  const onDelete = async (u: UserRow) => {
    if (u.id === SYSTEM_USER_ID) {
      alert("Không được xóa tài khoản system")
      return
    }
    if (!confirm(`Xóa user "${u.email}"? Dữ liệu chat/session liên quan sẽ bị xóa.`)) return
    try {
      await deleteUser(u.id)
      load()
      alert("Đã xóa user")
    } catch (e) {
      alert((e as Error)?.message || "Lỗi xóa user")
    }
  }

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleString("vi-VN") : "—"

  if (loading) {
    return <p className="text-muted-foreground py-8 text-center">Đang tải...</p>
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Quản lý Users & Phân quyền</h2>
      <p className="text-muted-foreground text-sm mb-4">
        Chỉ tài khoản có quyền quản trị (is_admin) mới truy cập được trang quản trị. Thêm user để đăng nhập bằng email + mật khẩu.
      </p>
      <div className="flex justify-end mb-4">
        <Button onClick={openAdd}>
          <UserPlus className="h-4 w-4 mr-2" />
          Thêm user
        </Button>
      </div>
      <div className="border rounded-md overflow-auto max-h-[520px]">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Tài khoản</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead className="w-[80px] text-center">SSO</TableHead>
                <TableHead>Quyền quản trị</TableHead>
                <TableHead>Lần đăng nhập cuối</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[120px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Chưa có user. Bấm &quot;Thêm user&quot; để tạo tài khoản đăng nhập thông thường.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.display_name ?? "—"}</TableCell>
                    <TableCell>{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      {u.sso_provider ? (
                        <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">{u.sso_provider}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={u.is_admin}
                          onCheckedChange={(c) => onToggleAdmin(u.id, c === true)}
                        />
                        <span>Quản trị</span>
                      </label>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.last_login_at)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} title="Sửa">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(u)}
                          title="Xóa"
                          disabled={u.id === SYSTEM_USER_ID}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalMode === "add" ? "Thêm user" : "Sửa user"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
                type="email"
                required
                disabled={modalMode === "edit"}
                className={modalMode === "edit" ? "bg-muted" : ""}
              />
              {modalMode === "edit" && (
                <p className="text-xs text-muted-foreground mt-1">Email không đổi được</p>
              )}
            </div>
            <div>
              <Label>Tài khoản</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Tài khoản (tên hiển thị)"
              />
            </div>
            <div>
              <Label>Họ và tên</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Họ và tên (từ SSO hoặc nhập tay)"
              />
            </div>
            <div>
              <Label>Mật khẩu {modalMode === "edit" ? "(để trống nếu không đổi)" : ""}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={modalMode === "edit" ? "Để trống = giữ nguyên" : "Tối thiểu 6 ký tự"}
                required={modalMode === "add"}
                minLength={modalMode === "add" ? 6 : undefined}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : modalMode === "add" ? "Thêm" : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
