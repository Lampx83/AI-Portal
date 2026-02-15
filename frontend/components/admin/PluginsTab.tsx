"use client"

import { useEffect, useState } from "react"
import { Package, Database, CheckCircle2, Loader2, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getPluginsInstalled, installPlugin } from "@/lib/api/admin"
import { useToast } from "@/hooks/use-toast"

const DATA_AGENT_ID = "data-agent"

export function PluginsTab() {
  const [installed, setInstalled] = useState<string[]>([])
  const [mounted, setMounted] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const inRes = await getPluginsInstalled()
      setInstalled(inRes.installed || [])
      setMounted(inRes.mounted || [])
    } catch (e) {
      toast({ title: "Lỗi tải trạng thái plugin", description: (e as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async () => {
    setAdding(true)
    try {
      const res = await installPlugin(DATA_AGENT_ID)
      toast({
        title: res.success ? "Đã thêm" : "Thông báo",
        description: res.message,
        variant: res.success ? "default" : "destructive",
      })
      await load()
    } catch (e) {
      toast({
        title: "Lỗi thêm plugin",
        description: (e as Error).message,
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isInstalled = installed.includes(DATA_AGENT_ID)
  const isMounted = mounted.includes("/api/data_agent")
  const isActive = isInstalled && isMounted

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Plugins
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Thêm Data Agent từ gói đã đóng gói. Hệ thống tải từ URL cấu hình sẵn (DATA_AGENT_PACKAGE_URL), sau khi thêm trợ lý Dữ liệu có thể dùng ngay.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Data Agent</CardTitle>
              {isActive && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đã thêm & đang chạy
                </span>
              )}
            </div>
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  {isActive ? "Cập nhật" : "Thêm"}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="text-sm">
            Trợ lý phân tích và xử lý dữ liệu: thống kê mô tả, trực quan hóa, đưa ra insights từ các dataset mẫu. Gói được đóng từ repo AI-Agents (npm run pack).
          </CardDescription>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cấu hình biến môi trường <code className="bg-muted px-1 rounded">DATA_AGENT_PACKAGE_URL</code> trỏ tới file zip đã đóng gói (vd. host <code className="bg-muted px-1 rounded">dist/data-agent.zip</code> từ AI-Agents).
      </p>
    </div>
  )
}
