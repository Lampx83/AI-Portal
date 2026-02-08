"use client"

import { useEffect, useState } from "react"
import { Pencil, Trash2, UserPlus, Link2, Copy, Check, Circle, CircleOff } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { getUsers, getOnlineUsers, patchUser, postUser, deleteUser, type UserRow } from "@/lib/api/admin"
import { API_CONFIG } from "@/lib/config"

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

function getUserApiUrl(email: string): string {
  const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
  return `${base}/api/users/email/${encodeURIComponent(email)}`
}

export function UsersTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"add" | "edit">("add")
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm] = useState({ email: "", display_name: "", full_name: "", password: "", role: "user" as "user" | "admin" | "developer" })
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all")

  const filteredUsers = users.filter((u) => {
    if (statusFilter === "all") return true
    const isOnline = onlineUserIds.has(u.id)
    return statusFilter === "online" ? isOnline : !isOnline
  })

  const copyUserUrl = async (email: string) => {
    const url = getUserApiUrl(email)
    await navigator.clipboard.writeText(url)
    setCopiedId(email)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([getUsers(), getOnlineUsers()])
      .then(([usersRes, onlineRes]) => {
        setUsers(usersRes.users)
        setOnlineUserIds(new Set(onlineRes.user_ids ?? []))
      })
      .catch((e) => setError(e?.message || "Lỗi tải users"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const ROLE_OPTIONS = [
    { value: "user", label: "Người dùng" },
    { value: "admin", label: "Người quản trị" },
    { value: "developer", label: "Người phát triển" },
  ] as const

  const onRoleChange = async (userId: string, role: "user" | "admin" | "developer") => {
    const prev = users.find((u) => u.id === userId)?.role ?? "user"
    try {
      await patchUser(userId, { role })
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? { ...u, role, is_admin: role === "admin" || role === "developer" } : u))
      )
    } catch (e) {
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? { ...u, role: prev } : u))
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
    const role = (u.role ?? (u.is_admin ? "admin" : "user")) as "user" | "admin" | "developer"
    setForm({ email: u.email, display_name: u.display_name ?? "", full_name: u.full_name ?? "", password: "", role })
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
        const body: { display_name?: string; full_name?: string; role?: "user" | "admin" | "developer"; password?: string } = {
          display_name: form.display_name.trim() || undefined,
          full_name: form.full_name.trim() || undefined,
          role: form.role,
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
        Tài khoản có quyền Người quản trị hoặc Người phát triển mới truy cập được trang quản trị. Thêm user để đăng nhập bằng email + mật khẩu.
        Khi gửi tin nhắn cho Agent, hệ thống tự động gửi kèm <strong>user_url</strong> (link API thông tin user) trong context để agent có thể fetch thông tin người dùng.
        {onlineUserIds.size > 0 && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <Circle className="h-3 w-3 fill-current" aria-hidden />
            {onlineUserIds.size} đang trực tuyến
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Label>Trạng thái:</Label>
          <Select value={statusFilter} onValueChange={(v: "all" | "online" | "offline") => setStatusFilter(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="online">Đang trực tuyến ({onlineUserIds.size})</SelectItem>
              <SelectItem value="offline">Offline ({users.length - onlineUserIds.size})</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                <TableHead className="w-[100px]">Trạng thái</TableHead>
                <TableHead>Tài khoản</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead className="w-[80px] text-center">SSO</TableHead>
                <TableHead>Link API User</TableHead>
                <TableHead>Quyền</TableHead>
                <TableHead>Lần đăng nhập cuối</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[120px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    {users.length === 0
                      ? "Chưa có user. Bấm \"Thêm user\" để tạo tài khoản đăng nhập thông thường."
                      : "Không có user nào khớp với bộ lọc."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {onlineUserIds.has(u.id) ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 gap-1">
                          <Circle className="h-2.5 w-2.5 fill-current" />
                          Online
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <CircleOff className="h-2.5 w-2.5" />
                          Offline
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.display_name ?? "—"}</TableCell>
                    <TableCell>{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      {u.sso_provider ? (
                        <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">{u.sso_provider}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {u.id === SYSTEM_USER_ID ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <code className="text-xs truncate block max-w-[160px]" title={getUserApiUrl(u.email)}>
                            /api/users/email/{u.email}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => copyUserUrl(u.email)}
                            title="Sao chép link API"
                          >
                            {copiedId === u.email ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.id === SYSTEM_USER_ID ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Select
                          value={(u.role ?? (u.is_admin ? "admin" : "user")) as string}
                          onValueChange={(v) => onRoleChange(u.id, v as "user" | "admin" | "developer")}
                        >
                          <SelectTrigger className="h-8 w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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
            {modalMode === "edit" && editingUser && editingUser.id !== SYSTEM_USER_ID && (
              <div>
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Link API User (để agent fetch thông tin)
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    readOnly
                    value={getUserApiUrl(editingUser.email)}
                    className="font-mono text-xs bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyUserUrl(editingUser!.email)}
                  >
                    {copiedId === editingUser.email ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
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
            {modalMode === "edit" && editingUser && editingUser.id !== SYSTEM_USER_ID && (
              <div>
                <Label>Quyền</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "user" | "admin" | "developer" }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
