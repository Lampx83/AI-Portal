"use client"

import { useEffect, useState, useMemo } from "react"
import { Settings, Lock, Type, Save, RotateCcw } from "lucide-react"
import { getAdminConfig, getAdminSiteStrings, patchAdminSiteStrings, resetDatabase, type ConfigSection, type SiteStringsMap } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SITE_STRING_GROUPS: Record<string, string> = {
  app: "Công cụ (title, mô tả, tên ngắn, SEO)",
  nav: "Điều hướng",
  settings: "Cài đặt hệ thống (Cài đặt cá nhân)",
}

function getGroup(key: string): string {
  const prefix = key.split(".")[0] ?? ""
  return SITE_STRING_GROUPS[prefix] ?? "Khác"
}

export function SettingsTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<ConfigSection[]>([])
  const [siteStrings, setSiteStrings] = useState<SiteStringsMap>({})
  const [siteStringsDraft, setSiteStringsDraft] = useState<SiteStringsMap>({})
  const [savingStrings, setSavingStrings] = useState(false)
  const [stringsError, setStringsError] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState("")
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getAdminConfig(), getAdminSiteStrings()])
      .then(([configRes, stringsRes]) => {
        setSections(configRes.sections ?? [])
        setSiteStrings(stringsRes.strings ?? {})
        setSiteStringsDraft(stringsRes.strings ?? {})
      })
      .catch((e) => setError(e?.message ?? "Lỗi tải cấu hình"))
      .finally(() => setLoading(false))
  }, [])

  const orderedKeys = useMemo(() => {
    const keys = Object.keys(siteStringsDraft)
    return keys.sort((a, b) => {
      const gA = getGroup(a)
      const gB = getGroup(b)
      if (gA !== gB) return gA.localeCompare(gB)
      return a.localeCompare(b)
    })
  }, [siteStringsDraft])

  const updateDraft = (key: string, locale: "vi" | "en", value: string) => {
    setSiteStringsDraft((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { vi: "", en: "" }),
        [locale]: value,
      },
    }))
  }

  const handleSaveSiteStrings = () => {
    setSavingStrings(true)
    setStringsError(null)
    patchAdminSiteStrings({ strings: siteStringsDraft })
      .then((res) => {
        setSiteStrings(res.strings ?? {})
        setSiteStringsDraft(res.strings ?? {})
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("site-strings-updated"))
      })
      .catch((e) => setStringsError((e as Error)?.message ?? "Lỗi lưu"))
      .finally(() => setSavingStrings(false))
  }

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
      {/* Chuỗi hiển thị (Site strings) — có thể sửa, lưu DB */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Type className="h-4 w-4" />
            Chuỗi hiển thị (Site strings)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Toàn bộ chuỗi hiển thị trên website. Sửa và lưu để rebrand (vd. đổi tên ứng dụng, mô tả, menu). Lưu vào database.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {stringsError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {stringsError}
            </div>
          )}
          {orderedKeys.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có chuỗi nào. Chạy migration 039_site_strings.sql để seed dữ liệu mặc định.</p>
          ) : (
            <div className="space-y-6">
              {(() => {
                let lastGroup = ""
                return orderedKeys.map((key) => {
                  const group = getGroup(key)
                  const showGroup = group !== lastGroup
                  if (showGroup) lastGroup = group
                  const draft = siteStringsDraft[key] ?? { vi: "", en: "" }
                  return (
                    <div key={key}>
                      {showGroup && (
                        <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 mt-4 first:mt-0">
                          {group}
                        </h4>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,180px)_1fr_1fr] gap-2 md:gap-4 items-center">
                        <code className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-1 rounded break-all">
                          {key}
                        </code>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Tiếng Việt</Label>
                          <Input
                            value={draft.vi ?? ""}
                            onChange={(e) => updateDraft(key, "vi", e.target.value)}
                            className="text-sm"
                            placeholder="(trống)"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">English</Label>
                          <Input
                            value={draft.en ?? ""}
                            onChange={(e) => updateDraft(key, "en", e.target.value)}
                            className="text-sm"
                            placeholder="(empty)"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
          {orderedKeys.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button onClick={handleSaveSiteStrings} disabled={savingStrings} className="gap-2">
                <Save className="h-4 w-4" />
                {savingStrings ? "Đang lưu…" : "Lưu chuỗi hiển thị"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <Lock className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Cấu hình môi trường (chỉ đọc)</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Tên ứng dụng, icon, tên database: cấu hình tại <strong>/setup</strong>. Các biến bên dưới có thể lưu qua Admin (API <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">POST /api/admin/config</code>) và được nạp từ <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">app_settings</code> khi khởi động.
            </p>
          </div>
        </div>
      </div>

      {/* Reset ứng dụng: xoá toàn bộ DB và thiết lập lại từ đầu */}
      <div className="rounded-lg border border-red-200 dark:border-red-900 overflow-hidden bg-red-50/50 dark:bg-red-950/20">
        <div className="bg-red-100/80 dark:bg-red-900/30 px-4 py-3 border-b border-red-200 dark:border-red-800">
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset ứng dụng
          </h3>
          <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
            Xoá toàn bộ dữ liệu (schema ai_portal) và chạy lại schema.sql — ứng dụng về trạng thái cài mới. Không thể hoàn tác.
          </p>
        </div>
        <div className="p-4 space-y-3">
          {resetError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {resetError}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 min-w-[200px]">
              <Label className="text-xs text-slate-600 dark:text-slate-400">
                Nhập <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">RESET</code> để xác nhận
              </Label>
              <Input
                value={resetConfirm}
                onChange={(e) => { setResetConfirm(e.target.value); setResetError(null) }}
                placeholder="RESET"
                className="font-mono text-sm border-red-200 dark:border-red-800"
                disabled={resetting}
              />
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                if (resetConfirm.trim() !== "RESET") {
                  setResetError("Nhập đúng chữ RESET (viết hoa) để xác nhận.")
                  return
                }
                if (typeof window !== "undefined" && !window.confirm("Bạn chắc chắn muốn xoá toàn bộ dữ liệu và thiết lập lại? Hành động này không thể hoàn tác.")) return
                setResetting(true)
                setResetError(null)
                resetDatabase("RESET")
                  .then(() => {
                    if (typeof window !== "undefined") {
                      window.alert("Đã reset database.")
                      window.location.reload()
                    }
                  })
                  .catch((e) => setResetError((e as Error)?.message ?? "Lỗi reset"))
                  .finally(() => setResetting(false))
              }}
              disabled={resetting || resetConfirm.trim() !== "RESET"}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {resetting ? "Đang reset…" : "Reset database"}
            </Button>
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
