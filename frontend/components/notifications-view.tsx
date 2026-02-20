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
import { useLanguage } from "@/contexts/language-context"

const DATE_LOCALE: Record<string, string> = { vi: "vi-VN", en: "en-US", zh: "zh-CN", hi: "hi-IN", es: "es-ES" }

export function NotificationsView() {
  const { t, locale } = useLanguage()
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
      toast({ title: t("notifications.acceptSuccess"), description: t("notifications.acceptSuccessDesc") })
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("project-invite-accepted"))
      load()
    } catch (e: unknown) {
      toast({
        title: t("notifications.errorTitle"),
        description: e instanceof Error ? e.message : t("notifications.acceptError"),
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
      if (diff < 60000) return t("notifications.justNow")
      if (diff < 3600000) return t("notifications.minutesAgo").replace("{n}", String(Math.floor(diff / 60000)))
      if (diff < 86400000) return t("notifications.hoursAgo").replace("{n}", String(Math.floor(diff / 3600000)))
      return d.toLocaleDateString(DATE_LOCALE[locale] || "en-US")
    } catch {
      return s
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Bell className="h-4 w-4" />
        {t("notifications.title")}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("notifications.loading")}</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 ${n.read_at ? "bg-muted/30 border-transparent" : "bg-muted/50 border-muted"}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {n.type === "portal_invite" ? (
                    <Users className="h-4 w-4 text-primary" />
                  ) : (
                    <Mail className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
                  {n.type === "portal_invite" && !n.read_at && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => handleAcceptInvite(n)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {t("notifications.acceptInvite")}
                    </Button>
                  )}
                  {n.type !== "portal_invite" && !n.read_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleMarkRead(n)}
                    >
                      {t("notifications.markRead")}
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
