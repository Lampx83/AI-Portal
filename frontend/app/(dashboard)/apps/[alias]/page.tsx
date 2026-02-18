"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTools } from "@/hooks/use-tools"

export default function AppPage() {
  const params = useParams()
  const router = useRouter()
  const aliasRaw = typeof params?.alias === "string" ? params.alias : (params?.alias as string[])?.[0] ?? ""
  const alias = aliasRaw.trim().toLowerCase()
  const { tools, loading } = useTools()
  const [resolved, setResolved] = useState(false)

  const tool = tools.find((t) => (t.alias ?? "").trim().toLowerCase() === alias)

  useEffect(() => {
    if (loading) return
    setResolved(true)
  }, [loading])

  useEffect(() => {
    if (alias === "data" && resolved) router.replace("/assistants/data")
  }, [alias, resolved, router])

  if (!resolved || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground text-sm">
        Đang tải…
      </div>
    )
  }

  if (!alias) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Thiếu tên ứng dụng.
      </div>
    )
  }

  if (alias === "data") {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground text-sm">
        Đang chuyển đến Phân tích dữ liệu…
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Không tìm thấy ứng dụng với alias: <b>{aliasRaw || alias}</b>
      </div>
    )
  }

  const domainUrl = (tool as { domainUrl?: string }).domainUrl
  if (domainUrl) {
    return (
      <iframe
        src={domainUrl}
        className="w-full h-full min-h-[calc(100vh-8rem)] border-0"
        title={tool.name ?? alias}
      />
    )
  }

  return (
    <div className="p-6 text-sm text-muted-foreground">
      Ứng dụng &quot;{tool.name ?? alias}&quot; chưa có giao diện nhúng (cần domain_url).
    </div>
  )
}
