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
  getUsers,
  getAgents,
  patchUsersBulk,
  postUserLimitOverride,
  patchUser,
  patchAgent,
  getAppSettings,
  patchAppSettings,
  type UserRow,
  type AgentRow,
} from "@/lib/api/admin"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"

export function LimitsTab() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [users, setUsers] = useState<UserRow[]>([])
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bulkLimit, setBulkLimit] = useState<string>("10")
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [overrideExtra, setOverrideExtra] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [guestLimit, setGuestLimit] = useState<number>(1)
  const [guestLimitInput, setGuestLimitInput] = useState<string>("1")
  const [savingGuest, setSavingGuest] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([getUsers(), getAgents(), getAppSettings()])
      .then(([u, a, s]) => {
        setUsers(u.users)
        setAgents(a.agents)
        const g = s.guest_daily_message_limit ?? 1
        setGuestLimit(g)
        setGuestLimitInput(String(g))
      })
      .catch((e) => setError(e?.message || t("admin.limits.loadError")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const effectiveLimit = (u: UserRow) => {
    const base = u.daily_message_limit ?? 10
    const extra = u.extra_messages_today != null ? Number(u.extra_messages_today) : 0
    return base + (Number.isInteger(extra) ? extra : 0)
  }

  const onBulkApply = async () => {
    const n = parseInt(bulkLimit, 10)
    if (!Number.isInteger(n) || n < 0) {
      toast({ title: t("admin.limits.bulkInvalid"), variant: "destructive" })
      return
    }
    const updates = Array.from(selectedUserIds).map((user_id) => ({ user_id, daily_message_limit: n }))
    if (updates.length === 0) {
      toast({ title: t("admin.limits.selectOneUser"), variant: "destructive" })
      return
    }
    setSaving("bulk")
    try {
      await patchUsersBulk(updates)
      toast({ title: t("admin.limits.updatedCount").replace("{count}", String(updates.length)) })
      setSelectedUserIds(new Set())
      load()
    } catch (e) {
      toast({ title: (e as Error)?.message || t("admin.limits.updateError"), variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  const onOverride = async (userId: string) => {
    const raw = overrideExtra[userId] ?? "0"
    const extra = parseInt(raw, 10)
    if (!Number.isInteger(extra) || extra < 0) {
      toast({ title: t("admin.limits.extraInvalid"), variant: "destructive" })
      return
    }
    setSaving(userId)
    try {
      await postUserLimitOverride(userId, extra)
      toast({ title: t("admin.limits.extraSuccess").replace("{count}", String(extra)) })
      setOverrideExtra((prev) => ({ ...prev, [userId]: "" }))
      load()
    } catch (e) {
      toast({ title: (e as Error)?.message || t("common.error"), variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  const onUserLimitChange = async (u: UserRow, value: string) => {
    const n = parseInt(value, 10)
    if (!Number.isInteger(n) || n < 0) return
    setSaving(u.id)
    try {
      await patchUser(u.id, { daily_message_limit: n })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, daily_message_limit: n } : x)))
      toast({ title: t("admin.limits.limitUpdated") })
    } catch (e) {
      toast({ title: (e as Error)?.message || t("common.error"), variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  const onAgentLimitChange = async (a: AgentRow, value: string) => {
    const n = parseInt(value, 10)
    if (!Number.isInteger(n) || n < 0) return
    setSaving(a.id)
    try {
      await patchAgent(a.id, { daily_message_limit: n })
      setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, daily_message_limit: n } : x)))
      toast({ title: t("admin.limits.agentLimitUpdated") })
    } catch (e) {
      toast({ title: (e as Error)?.message || t("common.error"), variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  const onGuestLimitSave = async () => {
    const n = parseInt(guestLimitInput, 10)
    if (!Number.isInteger(n) || n < 0) {
      toast({ title: t("admin.limits.guestInvalid"), variant: "destructive" })
      return
    }
    setSavingGuest(true)
    try {
      const res = await patchAppSettings({ guest_daily_message_limit: n })
      setGuestLimit(res.guest_daily_message_limit)
      setGuestLimitInput(String(res.guest_daily_message_limit))
      toast({ title: t("admin.limits.guestLimitUpdated") })
    } catch (e) {
      toast({ title: (e as Error)?.message ?? t("common.error"), variant: "destructive" })
    } finally {
      setSavingGuest(false)
    }
  }

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <p className="text-muted-foreground py-8 text-center">{t("common.loading")}</p>
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">{t("admin.limits.title")}</h2>
      <p className="text-muted-foreground text-sm mb-4">
        {t("admin.limits.subtitle")}
      </p>

      <div className="space-y-8">
        <div>
          <h3 className="font-medium mb-2">{t("admin.limits.guestTitle")}</h3>
          <p className="text-muted-foreground text-sm mb-2">
            {t("admin.limits.guestDesc")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              value={guestLimitInput}
              onChange={(e) => setGuestLimitInput(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">{t("admin.limits.messagesPerDay")}</span>
            <Button
              size="sm"
              onClick={onGuestLimitSave}
              disabled={savingGuest || parseInt(guestLimitInput, 10) === guestLimit}
            >
              {savingGuest ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-2">{t("admin.limits.byUser")}</h3>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Label className="sr-only">{t("admin.limits.messagesPerDayShort")}</Label>
            <Input
              type="number"
              min={0}
              value={bulkLimit}
              onChange={(e) => setBulkLimit(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">{t("admin.limits.messagesPerDayShort")}</span>
            <Button
              size="sm"
              onClick={onBulkApply}
              disabled={selectedUserIds.size === 0 || saving !== null}
            >
              {t("admin.limits.applyToSelected").replace("{count}", String(selectedUserIds.size))}
            </Button>
          </div>
          <div className="border rounded-md overflow-auto max-h-[360px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">{t("admin.limits.select")}</TableHead>
                  <TableHead>{t("admin.users.email")}</TableHead>
                  <TableHead className="w-24">{t("admin.limits.limitPerDay")}</TableHead>
                  <TableHead className="w-20">{t("admin.limits.usedToday")}</TableHead>
                  <TableHead className="w-24">{t("admin.limits.extraToday")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(u.id)}
                        onChange={() => toggleUser(u.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <Input
                        key={`user-limit-${u.id}-${u.daily_message_limit ?? 10}`}
                        type="number"
                        min={0}
                        defaultValue={u.daily_message_limit ?? 10}
                        onBlur={(e) => {
                          const v = e.target.value
                          const n = parseInt(v, 10)
                          if (Number.isInteger(n) && n >= 0) onUserLimitChange(u, v)
                        }}
                        className="w-20 h-8"
                        disabled={saving === u.id}
                      />
                    </TableCell>
                    <TableCell>
                      {u.daily_used ?? 0} / {effectiveLimit(u)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <Input
                          type="number"
                          min={0}
                          placeholder="+0"
                          value={overrideExtra[u.id] ?? ""}
                          onChange={(e) => setOverrideExtra((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          className="w-16 h-8"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOverride(u.id)}
                          disabled={saving === u.id}
                        >
                          {t("admin.limits.openMore")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-2">{t("admin.limits.byAgent")}</h3>
          <p className="text-muted-foreground text-sm mb-2">
            {t("admin.limits.agentDesc")}
          </p>
          <div className="border rounded-md overflow-auto max-h-[280px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.limits.agentAlias")}</TableHead>
                  <TableHead className="w-28">{t("admin.limits.limitPerDay")}</TableHead>
                  <TableHead className="w-24">{t("admin.limits.usedToday")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.alias}</TableCell>
                    <TableCell>
                      <Input
                        key={`agent-limit-${a.id}-${a.daily_message_limit ?? 100}`}
                        type="number"
                        min={0}
                        defaultValue={a.daily_message_limit ?? 100}
                        onBlur={(e) => {
                          const v = e.target.value
                          const n = parseInt(v, 10)
                          if (Number.isInteger(n) && n >= 0) onAgentLimitChange(a, v)
                        }}
                        className="w-24 h-8"
                        disabled={saving === a.id}
                      />
                    </TableCell>
                    <TableCell>{a.daily_used ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  )
}
