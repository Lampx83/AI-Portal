"use client"

import { useEffect, useState } from "react"
import { Database, Table2, Package, HardDrive } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getDbStats, getStorageStats } from "@/lib/api/admin"

export function OverviewTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbStats, setDbStats] = useState<{ tables: number; totalRows: number } | null>(null)
  const [storageStats, setStorageStats] = useState<{ totalObjects: number; totalSizeFormatted?: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getDbStats(), getStorageStats()])
      .then(([db, storage]) => {
        if (cancelled) return
        setDbStats(db)
        setStorageStats(storage)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Lỗi tải thống kê")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <p className="text-muted-foreground py-8 text-center">Đang tải thống kê...</p>
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  const cards = [
    {
      title: "Tables (DB)",
      value: dbStats?.tables ?? 0,
      icon: Database,
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Tổng dòng (DB)",
      value: dbStats?.totalRows ?? 0,
      icon: Table2,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Số object (Storage)",
      value: storageStats?.totalObjects ?? 0,
      icon: Package,
      iconBg: "bg-violet-100 dark:bg-violet-900/40",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Dung lượng (Storage)",
      value: storageStats?.totalSizeFormatted ?? "—",
      icon: HardDrive,
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ]

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Tổng quan hệ thống</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ title, value, icon: Icon, iconBg, iconColor }) => (
          <Card key={title}>
            <CardHeader className="pb-2 flex flex-row items-center gap-3">
              <div className={`rounded-xl ${iconBg} p-3`}>
                <Icon className={`h-6 w-6 ${iconColor}`} />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
