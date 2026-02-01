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

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Tổng quan hệ thống</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
              <Database className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tables (DB)</h3>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{dbStats?.tables ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
              <Table2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tổng dòng (DB)</h3>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{dbStats?.totalRows ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
              <Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Số object (Storage)</h3>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{storageStats?.totalObjects ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
              <HardDrive className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dung lượng (Storage)</h3>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{storageStats?.totalSizeFormatted ?? "—"}</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
