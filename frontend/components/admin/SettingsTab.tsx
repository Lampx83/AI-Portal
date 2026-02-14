"use client"

import { useEffect, useState } from "react"
import { Settings, Lock } from "lucide-react"
import { getAdminConfig, type ConfigSection } from "@/lib/api/admin"

export function SettingsTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<ConfigSection[]>([])

  useEffect(() => {
    getAdminConfig()
      .then((d) => setSections(d.sections ?? []))
      .catch((e) => setError(e?.message ?? "Lỗi tải cấu hình"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 text-slate-500">
        Đang tải cấu hình…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-red-700 dark:text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <Lock className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Chỉ đọc (read-only)</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Tất cả cấu hình lấy từ biến môi trường. Để thay đổi, sửa trong file <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">.env</code> hoặc <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">docker-compose.yml</code> rồi khởi động lại container.
            </p>
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <div
          key={section.title}
          className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {section.title}
            </h3>
            {section.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{section.description}</p>
            )}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {section.items.map((item) => (
              <div
                key={item.key}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {item.key}
                    </code>
                    {item.secret && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">(ẩn giá trị)</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                  )}
                </div>
                <div className="sm:w-80 shrink-0">
                  <input
                    type="text"
                    value={item.value}
                    readOnly
                    disabled
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 px-3 py-2 text-sm cursor-not-allowed font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
