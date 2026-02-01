"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { getUsers, patchUser } from "@/lib/api/admin"

export function UsersTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<{ id: string; email: string; display_name: string | null; is_admin: boolean; created_at: string }[]>([])

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
        Chỉ tài khoản có quyền quản trị (is_admin) mới truy cập được trang quản trị. Dùng mã ADMIN_SECRET để đăng nhập tại trang chủ.
      </p>
      <div className="border rounded-md overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Tên hiển thị</TableHead>
              <TableHead>Quyền quản trị</TableHead>
              <TableHead>Ngày tạo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Chưa có user
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.display_name ?? "—"}</TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={u.is_admin}
                        onCheckedChange={(c) => onToggleAdmin(u.id, c === true)}
                      />
                      <span>Quản trị</span>
                    </label>
                  </TableCell>
                  <TableCell>{u.created_at ? new Date(u.created_at).toLocaleString("vi-VN") : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
