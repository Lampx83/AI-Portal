"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, Mail, Users, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  getNotifications,
  acceptNotificationInvite,
  markNotificationRead,
  type Notification,
} from "@/lib/api/notifications"

export function NotificationsView() {
  const [list, setList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getNotifications({ limit: 50 })
      setList(data)
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAcceptInvite = async (n: Notification) => {
    try {
      await acceptNotificationInvite(n.id)
      await markNotificationRead(n.id)
      toast({ title: "Đã chấp nhận", description: "Nghiên cứu đã có trong danh mục Nghiên cứu của tôi." })
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("research-invite-accepted"))
      load()
    } catch (e: unknown) {
      toast({
        title: "Lỗi",
        description: e instanceof Error ? e.message : "Không thể chấp nhận",
        variant: "destructive",
      })
    }
  }

  const handleMarkRead = async (n: Notification) => {
    if (n.read_at) return
    try {
      await markNotificationRead(n.id)
      load()
    } catch {
      // ignore
    }
  }

  const formatDate = (s: string) => {
    try {
      const d = new Date(s)
      const now = new Date()
      const diff = now.getTime() - d.getTime()
      if (diff < 60000) return "Vừa xong"
      if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`
      return d.toLocaleDateString("vi-VN")
    } catch {
      return s
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Bell className="h-4 w-4" />
        Thông báo
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có thông báo nào.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 ${n.read_at ? "bg-muted/30 border-transparent" : "bg-muted/50 border-muted"}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {n.type === "research_invite" ? (
                    <Users className="h-4 w-4 text-primary" />
                  ) : (
                    <Mail className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
                  {n.type === "research_invite" && !n.read_at && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => handleAcceptInvite(n)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Đồng ý tham gia
                    </Button>
                  )}
                  {n.type !== "research_invite" && !n.read_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleMarkRead(n)}
                    >
                      Đánh dấu đã đọc
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
